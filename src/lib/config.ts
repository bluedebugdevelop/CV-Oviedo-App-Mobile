// ==========================================================================
// De dónde saca la app sus ajustes.
//
// Firebase: las claves del SDK web NO son secretas —viajan dentro de cualquier
// app compilada, se saquen de donde se saquen— así que van por EXPO_PUBLIC_*,
// que Expo incrusta en el bundle. Lo que de verdad protege los datos son las
// reglas de Firestore (firestore.rules), no esconder estas cadenas.
//
// La contraseña del panel de la web NO está aquí ni en ningún fichero: la
// escribe el admin cuando entra y lo que se guarda es el token que devuelve el
// servidor, en el llavero del móvil (expo-secure-store).
// ==========================================================================

import Constants from 'expo-constants'

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, any>

/** Raíz de la web del club. La app le pide noticias, competición y panel. */
export const WEB_BASE: string = (
  process.env.EXPO_PUBLIC_WEB_BASE ||
  extra.web?.base ||
  'https://clubvoleiboloviedo.com'
).replace(/\/+$/, '')

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
}

/**
 * ¿Están puestas las claves?
 *
 * Solo mira que no estén vacías: que sean las BUENAS no se sabe hasta que el
 * SDK las usa. De eso se encarga `firebaseListo` en firebase/app.ts, que es el
 * que hay que consultar antes de tocar nada de Firebase.
 */
export const hayConfigFirebase = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

/** Convierte `/subidas/foto.jpg` en una URL que el móvil pueda cargar. */
export function urlWeb(ruta?: string | null): string | null {
  if (!ruta) return null
  if (/^https?:\/\//i.test(ruta)) return ruta
  return `${WEB_BASE}${ruta.startsWith('/') ? '' : '/'}${ruta}`
}
