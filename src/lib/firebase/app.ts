// ==========================================================================
// Arranque de Firebase.
//
// Se hace a mano en vez de con `getAuth(app)` porque en React Native hay que
// decirle DÓNDE guardar la sesión. Sin `getReactNativePersistence`, el SDK usa
// memoria: la sesión se pierde al cerrar la app y el jugador tendría que
// escribir la contraseña cada vez que la abre.
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

import { firebaseConfig, firebaseListo } from '../config'

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
 */
function crearAuth(): Auth {
  const instancia = app()
  try {
    return initializeAuth(instancia, {
      persistence: getReactNativePersistence(AsyncStorage),
    })
  } catch {
    return getAuth(instancia)
  }
}

export const auth: Auth = crearAuth()

/**
 * Firestore.
 *
 * `experimentalAutoDetectLongPolling` es lo que salva las conexiones en redes
 * que no dejan pasar el streaming del SDK: wifis de polideportivo con portal
 * cautivo, proxies de instituto, algunas 4G. Sin esto, el chat se queda
 * "conectando" para siempre y no hay forma de saber por qué.
 */
export const db: Firestore = initializeFirestore(app(), {
  experimentalAutoDetectLongPolling: true,
})

/* No se usa Firebase Storage a propósito: las imágenes que sube el admin van
   a la web del club (/api/panel/imagen), que es donde tienen que estar para
   que las vea un visitante. Guardarlas también aquí sería tener la misma foto
   en dos sitios y dos formas de que se desincronicen. */

export { firebaseListo }

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
