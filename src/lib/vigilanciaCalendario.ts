// ==========================================================================
// Vigilar el calendario de la federación.
//
// EL PROBLEMA
// De las cosas que hay que avisar, tres las provoca alguien con el móvil en la
// mano —un mensaje, un aviso, un cambio de horario del entrenador— y esas se
// mandan desde ese mismo móvil (ver firebase/notificar.ts). Pero los partidos
// vienen de la FVBPA y la RFEVB: cuando la federación mueve un partido del
// sábado al domingo, NADIE toca la app. No hay dispositivo que dispare nada.
//
// Sin servidor, la única forma honesta de enterarse es que cada móvil mire de
// vez en cuando y se compare con lo que vio la última vez. Eso es lo que hay
// aquí, y la notificación que sale es LOCAL: no pasa por Expo Push porque no
// viene de fuera, la genera el propio aparato.
//
// LO QUE ESTO NO ES
// No es tiempo real. Android suele ejecutar la tarea cada pocas horas si el
// móvil está cargando o en reposo; iOS decide él y puede tardar un día, o no
// hacerlo nunca si la app se usa poco. Es un extra sobre mirar la app, no un
// sustituto — por eso el cambio también se ve al abrir el calendario, que es
// donde la gente lo va a mirar de todos modos.
//
// La alternativa de verdad sería una Cloud Function que scrapea, compara y
// empuja. Eso pide el plan Blaze y un servidor que mantener; si algún día se
// monta, esta vigilancia se apaga y el resto de la app no se entera.
// ==========================================================================

import AsyncStorage from '@react-native-async-storage/async-storage'

import { WEB_BASE } from './config'
import { fechaCorta, hora } from './fechas'

/** Lo mínimo que hace falta saber de un equipo para vigilarlo sin sesión. */
export interface EquipoVigilado {
  id: string
  nombre: string
  clave: string
}

const LLAVE_EQUIPOS = 'cvo.vigilancia.equipos'
const LLAVE_HUELLAS = 'cvo.vigilancia.huellas'

/**
 * Deja apuntados los equipos a vigilar.
 *
 * La tarea corre con la app cerrada, donde no hay sesión de Firebase ni
 * contexto de React: no puede preguntar a Firestore a qué equipos pertenece
 * nadie. Así que la app, cuando sí está abierta y sabe quién es, deja la lista
 * escrita en el disco para que la tarea la encuentre.
 */
export async function ponerEquiposVigilados(equipos: EquipoVigilado[]) {
  await AsyncStorage.setItem(LLAVE_EQUIPOS, JSON.stringify(equipos)).catch(() => {})
}

export async function leerEquiposVigilados(): Promise<EquipoVigilado[]> {
  try {
    const crudo = await AsyncStorage.getItem(LLAVE_EQUIPOS)
    const lista = crudo ? JSON.parse(crudo) : []
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

/** Al cerrar sesión se olvida todo: si no, seguiría avisando de equipos ajenos. */
export async function olvidarVigilancia() {
  await AsyncStorage.multiRemove([LLAVE_EQUIPOS, LLAVE_HUELLAS]).catch(() => {})
}

// --- las huellas ----------------------------------------------------------

/**
 * De cada partido se guarda una huella: cuándo y dónde.
 *
 * No se guarda el partido entero. Lo único que interesa es si cambió algo de
 * lo que obliga a mover el sábado a alguien, y guardar menos significa menos
 * disco y comparaciones más rápidas y más claras.
 */
type Huellas = Record<string, Record<string, string>>

const huellaDe = (p: Partido) => `${p.iso ?? ''}|${p.sede ?? ''}`

async function leerHuellas(): Promise<Huellas> {
  try {
    const crudo = await AsyncStorage.getItem(LLAVE_HUELLAS)
    const datos = crudo ? JSON.parse(crudo) : {}
    return datos && typeof datos === 'object' ? datos : {}
  } catch {
    return {}
  }
}

async function escribirHuellas(h: Huellas) {
  await AsyncStorage.setItem(LLAVE_HUELLAS, JSON.stringify(h)).catch(() => {})
}

// --- lo que llega de la web -----------------------------------------------

interface Partido {
  id: string
  iso: string
  sede: string | null
  local: string
  visitante: string
  setsLocal: number | null
}

/**
 * Los partidos de una competición.
 *
 * Se pide a pelo y no con el cliente de `lib/web`: en segundo plano no hay
 * pantalla que enseñe un error, y lo que interesa es rendirse rápido y volver
 * a intentarlo en la siguiente pasada.
 */
async function traerPartidos(clave: string): Promise<Partido[] | null> {
  const corte = new AbortController()
  const alarma = setTimeout(() => corte.abort(), 15000)
  try {
    const r = await fetch(`${WEB_BASE}/api/competicion?clave=${encodeURIComponent(clave)}`, {
      signal: corte.signal,
    })
    if (!r.ok) return null
    const datos = await r.json()
    const partidos = datos?.equipo?.partidos
    return Array.isArray(partidos) ? partidos : null
  } catch {
    return null
  } finally {
    clearTimeout(alarma)
  }
}

export interface CambioDetectado {
  equipo: string
  texto: string
}

/**
 * Compara lo que hay ahora con lo que se vio la última vez.
 *
 * Solo mira los partidos SIN jugar: que a un partido del mes pasado le corrijan
 * el acta es verdad, pero no es algo por lo que despertar a nadie.
 *
 * La primera vez no avisa de nada. Solo apunta las huellas: sin un «antes» con
 * el que comparar, todo parecería nuevo y el móvil sonaría con el calendario
 * entero justo después de instalar la app.
 */
export async function revisarCalendarios(): Promise<CambioDetectado[]> {
  const equipos = await leerEquiposVigilados()
  if (equipos.length === 0) return []

  const huellas = await leerHuellas()
  const cambios: CambioDetectado[] = []
  let algoQueGuardar = false

  for (const equipo of equipos) {
    const partidos = await traerPartidos(equipo.clave)
    if (!partidos) continue // sin red o web caída: se reintenta a la próxima

    const antes = huellas[equipo.clave]
    const ahora: Record<string, string> = {}

    for (const p of partidos) {
      // Los jugados ya no se mueven a efectos de organizarse.
      if (p.setsLocal !== null) continue
      ahora[p.id] = huellaDe(p)
    }

    if (antes) {
      for (const [id, huella] of Object.entries(ahora)) {
        const anterior = antes[id]
        if (anterior === undefined) {
          cambios.push({ equipo: equipo.nombre, texto: `Partido nuevo: ${describir(partidos, id)}` })
        } else if (anterior !== huella) {
          cambios.push({ equipo: equipo.nombre, texto: `Cambia: ${describir(partidos, id)}` })
        }
      }
    }

    huellas[equipo.clave] = ahora
    algoQueGuardar = true
  }

  if (algoQueGuardar) await escribirHuellas(huellas)
  return cambios
}

/** 'CV Oviedo – Gijón, SÁB 12 SEP · 19:30' */
function describir(partidos: Partido[], id: string): string {
  const p = partidos.find((x) => x.id === id)
  if (!p) return 'un partido'

  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(p.iso ?? '')
  const cuando = m
    ? (() => {
        const f = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0))
        const conHora = Boolean(m[4]) && !(m[4] === '00' && m[5] === '00')
        return conHora ? `${fechaCorta(f)} · ${hora(f)}` : fechaCorta(f)
      })()
    : 'sin fecha'

  return `${p.local} – ${p.visitante}, ${cuando}${p.sede ? ` (${p.sede})` : ''}`
}
