// ==========================================================================
// Los equipos del club y quién está en cada uno.
//
// La pertenencia vive por duplicado: en el equipo (`jugadores`,
// `entrenadores`) y en el usuario (`equipos`). Ver el comentario de modelo.ts
// para el porqué. Lo importante es que las dos caras se escriben SIEMPRE en el
// mismo `writeBatch`: si se hicieran por separado y fallara la segunda, habría
// un jugador que el equipo cree tener pero que no puede entrar, o al revés uno
// que ve un chat del que ya no forma parte.
// ==========================================================================

import {
  arrayRemove,
  arrayUnion,
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'

import { db } from './app'
import type { Equipo, Genero, Rol } from './modelo'

const COL = 'equipos'

export const docEquipo = (id: string) => doc(db, COL, id)

/** Ver `listaLimpia` en usuarios.ts: un uid vacío en una plantilla rompe igual. */
const listaLimpia = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []

function aEquipo(id: string, datos: any): Equipo {
  return {
    id,
    nombre: datos?.nombre ?? '',
    categoria: datos?.categoria ?? '',
    genero: (datos?.genero ?? 'Mixto') as Genero,
    temporada: datos?.temporada ?? '',
    claveCompeticion: datos?.claveCompeticion ?? null,
    slugWeb: datos?.slugWeb ?? null,
    entrenadores: listaLimpia(datos?.entrenadores),
    jugadores: listaLimpia(datos?.jugadores),
    archivado: datos?.archivado === true,
    creadoEn: datos?.creadoEn,
    creadoPor: datos?.creadoPor,
  }
}

export async function leerEquipo(id: string): Promise<Equipo | null> {
  const inst = await getDoc(docEquipo(id))
  return inst.exists() ? aEquipo(inst.id, inst.data()) : null
}

export function escucharEquipo(id: string, alCambiar: (e: Equipo | null) => void) {
  return onSnapshot(
    docEquipo(id),
    (inst) => alCambiar(inst.exists() ? aEquipo(inst.id, inst.data()) : null),
    () => alCambiar(null),
  )
}

/**
 * Los equipos de una persona.
 *
 * Se pide por los ids que trae su perfil en vez de consultar por
 * `array-contains`: son dos o tres documentos, ya sabemos cuáles, y así la
 * regla de lectura puede ser «solo si estás dentro» sin tener que abrir la
 * colección entera a consultas.
 */
export function escucharEquiposPorId(brutos: string[], alCambiar: (es: Equipo[]) => void) {
  // Cinturón además de los tirantes: aunque `aUsuario` ya limpia la lista, un
  // id vacío aquí lanzaría al construir la referencia y tumbaría la pantalla.
  const ids = brutos.filter((id) => typeof id === 'string' && id.trim() !== '')

  if (ids.length === 0) {
    alCambiar([])
    return () => {}
  }

  const encontrados = new Map<string, Equipo>()
  const cortes = ids.map((id) =>
    onSnapshot(
      docEquipo(id),
      (inst) => {
        if (inst.exists()) encontrados.set(id, aEquipo(inst.id, inst.data()))
        else encontrados.delete(id)
        // El orden lo fija la lista de ids del perfil, no el orden de llegada
        // de los snapshots: si no, las pestañas bailarían al recargar.
        alCambiar(ids.map((x) => encontrados.get(x)).filter(Boolean) as Equipo[])
      },
      () => {
        encontrados.delete(id)
        alCambiar(ids.map((x) => encontrados.get(x)).filter(Boolean) as Equipo[])
      },
    ),
  )
  return () => cortes.forEach((corta) => corta())
}

/** Todos los equipos del club. Solo para admins (ver firestore.rules). */
export function escucharTodosLosEquipos(alCambiar: (es: Equipo[]) => void) {
  const q = query(collection(db, COL), orderBy('nombre'))
  return onSnapshot(q, (snap) => alCambiar(snap.docs.map((d) => aEquipo(d.id, d.data()))))
}

export interface NuevoEquipo {
  nombre: string
  categoria: string
  genero: Genero
  temporada: string
  claveCompeticion: string | null
}

export async function crearEquipo(datos: NuevoEquipo, creadoPor: string): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...datos,
    nombre: datos.nombre.trim(),
    // Se enlaza a mano desde la ficha del equipo: ver `slugWeb` en modelo.ts.
    slugWeb: null,
    entrenadores: [],
    jugadores: [],
    archivado: false,
    creadoEn: serverTimestamp(),
    creadoPor,
  })
  return ref.id
}

export async function actualizarEquipo(id: string, cambios: Partial<Equipo>) {
  await updateDoc(docEquipo(id), cambios as Record<string, unknown>)
}

const listaDe = (rol: Rol) => (rol === 'entrenador' ? 'entrenadores' : 'jugadores')

/**
 * Mete a alguien en un equipo, por los dos lados y de una vez.
 *
 * Un admin no se «mete» en equipos: ya los ve todos. Si se le pasa uno, entra
 * como entrenador, que es lo que significa que un admin aparezca en la ficha.
 */
export async function anadirAEquipo(equipoId: string, uid: string, rol: Rol) {
  const lote = writeBatch(db)
  lote.update(docEquipo(equipoId), { [listaDe(rol)]: arrayUnion(uid) })
  lote.update(doc(db, 'usuarios', uid), { equipos: arrayUnion(equipoId) })
  await lote.commit()
}

export async function quitarDeEquipo(equipoId: string, uid: string) {
  const lote = writeBatch(db)
  // Se quita de las dos listas sin mirar en cuál estaba: `arrayRemove` con un
  // valor que no está no hace nada, y así no hace falta leer el equipo antes.
  lote.update(docEquipo(equipoId), {
    entrenadores: arrayRemove(uid),
    jugadores: arrayRemove(uid),
  })
  lote.update(doc(db, 'usuarios', uid), { equipos: arrayRemove(equipoId) })
  await lote.commit()
}

/** ¿Puede esta persona mandar avisos y tocar el horario de este equipo? */
export function mandaEnEquipo(
  equipo: Equipo | null,
  uid: string,
  roles: Rol[],
): boolean {
  // Un admin manda en todos. El resto, solo donde figure como entrenador: ser
  // «entrenador» de club no da mando sobre un equipo al que no perteneces.
  if (roles.includes('admin')) return true
  return Boolean(equipo && equipo.entrenadores.includes(uid))
}
