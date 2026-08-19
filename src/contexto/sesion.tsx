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
}

const Contexto = createContext<Sesion | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  // Sin configuración de Firebase no hay nada que arrancar: se nace 'fuera'
  // en vez de entrar en 'arrancando' y salir de ahí desde un efecto.
  const [estado, setEstado] = useState<Estado>(firebaseListo ? 'arrancando' : 'fuera')
  const [cuenta, setCuenta] = useState<User | null>(null)
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [equipoElegido, setEquipoElegido] = useState<string | null>(null)
  const [expulsion, setExpulsion] = useState<string | null>(null)
  const [avisoPush, setAvisoPush] = useState<string | null>(null)

  // Para no volver a pedir el token de push en cada re-render del perfil.
  const pushHecho = useRef(false)

  const salir = useCallback(async () => {
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
        setEquipos([])
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

  // --- los equipos ---
  // Se suscribe siempre, también sin perfil: con la lista de ids vacía,
  // `escucharEquiposPorId` emite [] y devuelve un corte que no hace nada. Así
  // no hay que vaciar el estado a mano desde el efecto.
  useEffect(() => escucharEquiposPorId(perfil?.equipos ?? [], setEquipos), [perfil])

  // --- notificaciones ---
  useEffect(() => {
    if (!perfil || pushHecho.current) return
    pushHecho.current = true

    void (async () => {
      const { token, motivo } = await registrarParaPush()
      if (!token) {
        setAvisoPush(motivo ?? null)
        return
      }
      setAvisoPush(null)
      // `arrayUnion` no duplica, así que se puede guardar en cada arranque sin
      // llenar el perfil de tokens repetidos.
      if (!perfil.tokensPush.includes(token)) {
        await guardarTokenPush(perfil.uid, token).catch(() => {})
      }
    })()
  }, [perfil])

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
    }),
    [estado, cuenta, perfil, equipos, equipoActivo, entrar, salir, expulsion, avisoPush],
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
