// ==========================================================================
// Arranque de Firebase.
//
// Se hace a mano en vez de con `getAuth(app)` porque en React Native hay que
// decirle DÓNDE guardar la sesión. Sin `getReactNativePersistence`, el SDK usa
// memoria: la sesión se pierde al cerrar la app y el jugador tendría que
// escribir la contraseña cada vez que la abre.
//
// SI FIREBASE NO ESTÁ CONFIGURADO, LA APP TIENE QUE ABRIR IGUAL
// Esto se aprende por las malas: con la clave vacía o mal, `initializeAuth`
// lanza `auth/invalid-api-key` al IMPORTAR este módulo, o sea antes de que
// React pinte nada. Resultado: la app se cierra sola al tocar el icono, sin un
// mensaje, y el aviso de «falta la configuración» de la pantalla de entrada no
// llega a verse nunca.
//
// No es solo un problema de desarrollo: una build de tienda a la que se le
// olvide un secreto de EAS se comporta igual. Un fallo de configuración tiene
// que enseñar una pantalla que lo explique, no matar el proceso.
//
// Así que aquí no se lanza nada. Si no se puede arrancar, `firebaseListo` se
// queda en false, `errorFirebase` dice por qué, y `auth` y `db` pasan a ser
// señuelos que solo protestan si alguien los usa de verdad. Nadie lo hace: todo
// lo que toca Firebase está detrás del login, y el login mira `firebaseListo`.
// ==========================================================================

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth'
import { initializeFirestore, type Firestore } from 'firebase/firestore'

import { firebaseConfig, hayConfigFirebase } from '../config'

const NOMBRE_ALTA = 'alta-usuarios'

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

/**
 * La sesión.
 *
 * `initializeAuth` solo se puede llamar una vez por app. Con Fast Refresh el
 * módulo se reevalúa y la segunda llamada revienta, así que se cae a `getAuth`,
 * que devuelve la instancia que ya había configurada.
 *
 * Ojo: ese `catch` NO cubre una clave inválida. Con una clave mala fallan las
 * dos llamadas, y la segunda lanza fuera. Por eso el try/catch de verdad está
 * en `arrancar()`, envolviendo a esta función entera.
 */
function crearAuth(instancia: FirebaseApp): Auth {
  try {
    return initializeAuth(instancia, {
      persistence: getReactNativePersistence(AsyncStorage),
    })
  } catch {
    return getAuth(instancia)
  }
}

interface Arranque {
  auth: Auth
  db: Firestore
}

function arrancar(): { piezas: Arranque | null; error: string | null } {
  if (!hayConfigFirebase) {
    return {
      piezas: null,
      error: 'Faltan las claves de Firebase. Copia `.env.example` a `.env.local` y rellénalas.',
    }
  }

  try {
    const instancia = app()
    return {
      piezas: {
        auth: crearAuth(instancia),
        /* `experimentalAutoDetectLongPolling` es lo que salva las conexiones
           en redes que no dejan pasar el streaming del SDK: wifis de
           polideportivo con portal cautivo, proxies de instituto, algunas 4G.
           Sin esto, el chat se queda «conectando» para siempre y no hay forma
           de saber por qué. */
        db: initializeFirestore(instancia, { experimentalAutoDetectLongPolling: true }),
      },
      error: null,
    }
  } catch (e: any) {
    // Lo más habitual aquí es `auth/invalid-api-key`: las claves están puestas
    // pero no son las del proyecto.
    return {
      piezas: null,
      error: `Firebase no arrancó: ${e?.message ?? 'error desconocido'}`,
    }
  }
}

const { piezas, error } = arrancar()

/** ¿Se puede hablar con Firebase? Si no, la app abre pero no deja entrar. */
export const firebaseListo = piezas !== null

/** Por qué no, para poder enseñarlo en la pantalla de entrada. */
export const errorFirebase = error

/**
 * Un señuelo que protesta en vez de reventar en silencio.
 *
 * Si algún día alguien usa `auth` o `db` sin comprobar `firebaseListo`, el
 * error dice exactamente qué pasa y dónde, en vez de un `undefined is not an
 * object` a treinta llamadas de distancia.
 */
function senuelo(nombre: string): any {
  const protestar = () => {
    throw new Error(
      `Se ha usado \`${nombre}\` sin Firebase configurado. ` +
        `Comprueba \`firebaseListo\` antes. Motivo: ${error}`,
    )
  }
  return new Proxy(
    {},
    {
      get: protestar,
      set: protestar,
      apply: protestar,
    },
  )
}

export const auth: Auth = piezas?.auth ?? senuelo('auth')
export const db: Firestore = piezas?.db ?? senuelo('db')

/* No se usa Firebase Storage a propósito: las imágenes que sube el admin van
   a la web del club (/api/panel/imagen), que es donde tienen que estar para
   que las vea un visitante. Guardarlas también aquí sería tener la misma foto
   en dos sitios y dos formas de que se desincronicen. */

/**
 * Una segunda instancia de Firebase, solo para dar de alta usuarios.
 *
 * `createUserWithEmailAndPassword` inicia sesión con el usuario recién creado.
 * Si se llamara sobre la instancia normal, el admin se quedaría dentro de la
 * app como el jugador que acaba de crear: sesión perdida y jugador logueado en
 * el móvil de otro.
 *
 * Con una app secundaria, ese efecto ocurre en una sesión aparte que se cierra
 * inmediatamente después. Es el apaño estándar cuando no se quiere montar un
 * backend con el Admin SDK; el día que haya Cloud Functions, esto se sustituye
 * por una llamada a una función y este comentario se borra.
 */
export function authAlta(): Auth {
  const secundaria =
    getApps().find((a) => a.name === NOMBRE_ALTA) ??
    initializeApp(firebaseConfig, NOMBRE_ALTA)
  return getAuth(secundaria)
}
