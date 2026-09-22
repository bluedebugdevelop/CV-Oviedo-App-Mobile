// ==========================================================================
// Quién está usando la app.
//
// Junta tres cosas que siempre van de la mano y que casi todas las pantallas
// necesitan a la vez:
//
//   · la cuenta de Firebase Auth (¿hay sesión?)
//   · su perfil de Firestore (¿quién es, qué rol tiene?)
//   · sus equipos, y cuál está mirando ahora
//
// Todo en vivo. Si un admin cambia el rol de alguien o lo saca de un equipo,
// la app de esa persona se entera sin cerrar sesión ni recargar.
//
// LA PUERTA
// Tener cuenta de Auth no es ser del club. Alguien podría crear una cuenta
// llamando al SDK por fuera de la app (el registro abierto no se puede apagar
// del todo desde el cliente). Lo que decide es el documento de `usuarios/`:
// sin él, o con `activo: false`, aquí se cierra la sesión y se explica por qué.
// Las reglas de Firestore dicen lo mismo; esto es solo para que la persona vea
// un mensaje en vez de una pantalla vacía.
// ==========================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'

import { auth, firebaseListo } from '../lib/firebase/app'
import { escucharEquiposPorId } from '../lib/firebase/equipos'
import { escucharUsuario, guardarTokenPush } from '../lib/firebase/usuarios'
import type { Equipo, Usuario } from '../lib/firebase/modelo'
import { registrarParaPush } from '../lib/push'
import {
  olvidarVigilancia,
  ponerEquiposVigilados,
} from '../lib/vigilanciaCalendario'
import { dejarDeVigilar, vigilarCalendario } from '../tareas/calendario'

type Estado = 'arrancando' | 'fuera' | 'dentro'

interface Sesion {
  estado: Estado
  cuenta: User | null
  perfil: Usuario | null
  equipos: Equipo[]
  equipoActivo: Equipo | null
  cambiarEquipo: (id: string) => void
  entrar: (email: string, clave: string) => Promise<void>
  salir: () => Promise<void>
  /** Por qué se cerró la sesión sola, si es que se cerró. */
  expulsion: string | null
  limpiarExpulsion: () => void
  /** Por qué no llegan las notificaciones del sistema, si no llegan. */
  avisoPush: string | null
  /**
   * Vuelve a pedir permiso y a registrar el token de este móvil.
   *
   * Para quien dijo que no al diálogo del primer arranque sin querer: sin esto
   * la única salida era reinstalar la app.
   */
  activarPush: () => Promise<boolean>
}

const Contexto = createContext<Sesion | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  // Sin configuración de Firebase no hay nada que arrancar: se nace 'fuera'
  // en vez de entrar en 'arrancando' y salir de ahí desde un efecto.
  const [estado, setEstado] = useState<Estado>(firebaseListo ? 'arrancando' : 'fuera')
  const [cuenta, setCuenta] = useState<User | null>(null)
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [todosSusEquipos, setTodosSusEquipos] = useState<Equipo[]>([])
  const [equipoElegido, setEquipoElegido] = useState<string | null>(null)
  const [expulsion, setExpulsion] = useState<string | null>(null)
  const [avisoPush, setAvisoPush] = useState<string | null>(null)

  // Para no volver a pedir el token de push en cada re-render del perfil.
  const pushHecho = useRef(false)

  const salir = useCallback(async () => {
    // Se olvida lo apuntado para la vigilancia ANTES de cerrar: si no, la tarea
    // seguiría mirando los partidos de un equipo que ya no es de nadie en este
    // móvil, y avisaría a quien entre después.
    await olvidarVigilancia()
    await dejarDeVigilar()
    await signOut(auth).catch(() => {})
  }, [])

  const expulsar = useCallback(
    async (motivo: string) => {
      setExpulsion(motivo)
      await salir()
    },
    [salir],
  )

  // --- la cuenta ---
  useEffect(() => {
    if (!firebaseListo) return
    return onAuthStateChanged(auth, (u) => {
      setCuenta(u)
      if (!u) {
        setPerfil(null)
        setTodosSusEquipos([])
        setEquipoElegido(null)
        pushHecho.current = false
        setEstado('fuera')
      }
    })
  }, [])

  // --- el perfil ---
  useEffect(() => {
    if (!cuenta) return
    return escucharUsuario(cuenta.uid, (u, fallo) => {
      if (fallo) {
        // Firestore ha dicho que no. Lo normal en un proyecto recién montado
        // es que falten las reglas por desplegar, y decir «no estás dado de
        // alta» mandaría a buscar el problema al sitio equivocado.
        void expulsar(
          fallo === 'permission-denied'
            ? 'Firestore rechaza la lectura de tu ficha. Si acabas de montar el proyecto, faltan las reglas por desplegar (npm run reglas:desplegar).'
            : 'No se ha podido leer tu ficha (' + fallo + '). Inténtalo de nuevo.',
        )
        return
      }
      if (!u) {
        // Cuenta sin ficha: no la ha dado de alta ningún admin.
        void expulsar(
          'Esta cuenta no está dada de alta en el club. Habla con tu entrenador o con el club.',
        )
        return
      }
      if (!u.activo) {
        void expulsar('Tu cuenta está desactivada. Si crees que es un error, avisa al club.')
        return
      }
      setPerfil(u)
      setEstado('dentro')
    })
  }, [cuenta, expulsar])

  /* --- los equipos ---

     La dependencia es la LISTA DE IDS en texto, no el perfil entero, y eso no
     es una micro-optimización: es lo que impide una tormenta.

     El perfil llega de un `onSnapshot`, así que es un objeto nuevo cada vez que
     cambia CUALQUIER campo suyo — y uno de esos campos es `lecturasChat`, que
     la app escribe sola cada vez que alguien mira un chat. Con `[perfil]` como
     dependencia, esa escritura volvía a montar los listeners de TODOS los
     equipos, que devolvían objetos `Equipo` nuevos, que hacían resuscribirse a
     todo lo que dependiera de ellos. Con la app abierta en el chat eso era un
     parpadeo constante y una cascada de lecturas de Firestore.

     Los ids solo cambian cuando el club mete o saca a alguien de un equipo,
     que es exactamente cuando hay que volver a suscribirse. */
  const idsEquipos = (perfil?.equipos ?? []).join(',')
  // Para los efectos que solo necesitan saber SI hay alguien dentro.
  const hayPerfil = perfil !== null

  useEffect(
    () => escucharEquiposPorId(idsEquipos ? idsEquipos.split(',') : [], setTodosSusEquipos),
    [idsEquipos],
  )

  /* Los equipos ARCHIVADOS no salen de aquí.

     Archivar es lo que se hace al acabar la temporada: el equipo conserva su
     chat, sus avisos y su horario, pero deja de existir para quien estaba en
     él. Antes el filtro lo ponía cada consumidor por su cuenta —los contextos
     de chat, avisos y agenda lo hacían; el selector de equipo y `equipoActivo`
     no—, y el resultado era que en la pestaña de Equipo seguían apareciendo
     los de la temporada pasada, vacíos y sin calendario, mezclados con los de
     esta. Filtrar UNA vez aquí arregla los cuatro sitios a la vez.

     Un equipo archivado no se queda huérfano: sigue en `perfil.equipos` y la
     administración lo ve entero con `escucharTodosLosEquipos`. */
  const equipos = useMemo(
    () => todosSusEquipos.filter((eq) => !eq.archivado),
    [todosSusEquipos],
  )

  /* --- vigilancia del calendario federado ---

     La tarea corre con la app cerrada, donde no hay sesión ni forma de
     preguntar a Firestore a qué equipos pertenece nadie. Así que se le deja
     escrita la lista cada vez que cambia, mientras la app SÍ sabe quién es.

     Solo los equipos con competición federada: los demás no tienen
     calendario que se pueda mover. */
  // `equipos` ya viene sin archivados; aquí solo se filtra por competición.
  const vigilados = useMemo(
    () =>
      equipos
        .filter((eq) => eq.claveCompeticion)
        .map((eq) => ({ id: eq.id, nombre: eq.nombre, clave: eq.claveCompeticion! })),
    [equipos],
  )

  /* La dependencia es una FIRMA en texto de lo que se va a escribir.

     Igual que con los ids de los equipos: `equipos` y `perfil` son objetos
     nuevos cada vez que llega un snapshot, así que con ellos como dependencia
     esto reescribía el almacén y volvía a registrar la tarea de fondo en cada
     refresco del club. Con la firma solo se toca cuando de verdad cambia la
     lista de equipos vigilados o alguno de sus nombres. */
  const firmaVigilados = vigilados.map((v) => `${v.id}:${v.clave}`).join('|')

  useEffect(() => {
    if (!hayPerfil) return

    void (async () => {
      await ponerEquiposVigilados(vigilados)
      // Registrar una tarea ya registrada no hace daño, y así se recupera
      // sola si el sistema la descartó por falta de uso.
      if (vigilados.length > 0) await vigilarCalendario()
      else await dejarDeVigilar()
    })()
    // `vigilados` se deja fuera a propósito: `firmaVigilados` lo resume, y
    // meterlo devolvería el efecto a dispararse con cada objeto nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayPerfil, firmaVigilados])

  // --- notificaciones ---
  const registrarPush = useCallback(async (quien: Usuario) => {
    const { token, motivo } = await registrarParaPush()
    if (!token) {
      setAvisoPush(motivo ?? null)
      return false
    }
    setAvisoPush(null)
    // `arrayUnion` no duplica, así que se puede guardar en cada arranque sin
    // llenar el perfil de tokens repetidos.
    if (!quien.tokensPush.includes(token)) {
      await guardarTokenPush(quien.uid, token).catch(() => {})
    }
    return true
  }, [])

  useEffect(() => {
    if (!perfil || pushHecho.current) return
    pushHecho.current = true
    void registrarPush(perfil)
  }, [perfil, registrarPush])

  const activarPush = useCallback(
    async () => (perfil ? registrarPush(perfil) : false),
    [perfil, registrarPush],
  )

  const entrar = useCallback(async (email: string, clave: string) => {
    setExpulsion(null)
    await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), clave)
  }, [])

  /* El equipo que se está mirando.

     Se deriva en vez de guardarse: si a alguien lo sacan de un equipo o lo
     archivan, la elección deja de existir y cae sola al primero que le quede,
     sin un efecto que corrija el estado después de haber pintado una pantalla
     en blanco. */
  const equipoActivo = useMemo(
    () => equipos.find((e) => e.id === equipoElegido) ?? equipos[0] ?? null,
    [equipos, equipoElegido],
  )

  const valor = useMemo<Sesion>(
    () => ({
      estado,
      cuenta,
      perfil,
      equipos,
      equipoActivo,
      cambiarEquipo: setEquipoElegido,
      entrar,
      salir,
      expulsion,
      limpiarExpulsion: () => setExpulsion(null),
      avisoPush,
      activarPush,
    }),
    [
      estado,
      cuenta,
      perfil,
      equipos,
      equipoActivo,
      entrar,
      salir,
      expulsion,
      avisoPush,
      activarPush,
    ],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSesion(): Sesion {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useSesion fuera de <ProveedorSesion>')
  return valor
}

/**
 * La sesión dando por hecho que hay alguien dentro.
 *
 * Las pantallas de dentro solo se montan con sesión abierta (lo garantiza el
 * _layout), así que obligarlas a comprobar `perfil` en cada línea sería ruido.
 */
export function useSesionActiva() {
  const sesion = useSesion()
  if (!sesion.perfil) throw new Error('useSesionActiva sin perfil cargado')
  return { ...sesion, perfil: sesion.perfil }
}

/** ¿Es entrenador de este equipo, o admin? */
export function mandaAqui(sesion: { perfil: Usuario | null }, equipo: Equipo | null) {
  if (!sesion.perfil) return false
  if (sesion.perfil.roles.includes('admin')) return true
  return Boolean(equipo?.entrenadores.includes(sesion.perfil.uid))
}
