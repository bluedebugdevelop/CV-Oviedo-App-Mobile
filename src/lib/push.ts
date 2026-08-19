// ==========================================================================
// Notificaciones.
//
// Hay dos capas y conviene no confundirlas:
//
//   · El aviso dentro de la app. Es un documento en Firestore; la pantalla lo
//     ve llegar por el listener y pinta el punto rojo. Esto funciona SIEMPRE,
//     incluso sin permiso de notificaciones y en el simulador.
//   · El aviso del sistema, el que suena con la app cerrada. Ese va por Expo
//     Push y necesita permiso, dispositivo físico y una build de desarrollo o
//     de tienda (Expo Go ya no entrega push desde el SDK 53).
//
// La segunda es un extra sobre la primera. Si falla el push, el aviso sigue
// llegando: al abrir la app está ahí. Por eso ninguna función de aquí corta el
// flujo cuando algo va mal, solo devuelve `false` y deja constancia.
//
// QUIÉN MANDA EL PUSH
// El envío lo hace el móvil del entrenador, llamando a la API de Expo con los
// tokens que lee de Firestore. No hay servidor de por medio. Es lo que permite
// que todo esto viva en el plan gratuito de Firebase, sin Cloud Functions.
//
// El precio es que los tokens de un equipo los puede leer su entrenador, que
// es exactamente lo que dicen las reglas. Un token de Expo no sirve para leer
// nada, solo para mandar una notificación a ese aparato; lo peor que puede
// hacer un entrenador con ellos es mandar avisos a su propio equipo, que es su
// trabajo. Si algún día se quiere cerrar del todo, se mueve este envío a una
// Cloud Function y las reglas dejan de exponer `tokensPush`.
// ==========================================================================

import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

import { color } from '../tema'

const API_EXPO = 'https://exp.host/--/api/v2/push/send'

/** Con la app abierta, un aviso se enseña igual: es el punto de la app. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/**
 * El canal de Android.
 *
 * Android exige canal desde la versión 8: sin uno declarado, las
 * notificaciones llegan pero mudas y sin vibración, y el usuario no puede
 * configurarlas. El nombre se ve en los ajustes del sistema, así que va en
 * castellano y dice algo.
 */
export async function prepararCanal() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('avisos', {
    name: 'Avisos del equipo',
    description: 'Convocatorias, cambios de horario y mensajes del entrenador.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: color.azul,
  })
}

function idProyecto(): string | null {
  const id =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId ??
    null
  // El placeholder de app.json no vale: pedir un token con él da un error del
  // servidor de Expo que no dice gran cosa.
  if (!id || id.startsWith('00000000')) return null
  return id
}

export interface ResultadoRegistro {
  token: string | null
  motivo?: string
}

/**
 * Pide permiso y devuelve el token de este dispositivo.
 *
 * Devuelve el motivo cuando no puede, para poder explicárselo a quien lo mira:
 * «no llegan los avisos» tiene respuestas muy distintas según si es que dijo
 * que no al permiso o que está en un emulador.
 */
export async function registrarParaPush(): Promise<ResultadoRegistro> {
  await prepararCanal()

  if (!Device.isDevice) {
    return { token: null, motivo: 'Las notificaciones solo funcionan en un móvil real.' }
  }

  const { status: actual } = await Notifications.getPermissionsAsync()
  let status = actual
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status
  }
  if (status !== 'granted') {
    return {
      token: null,
      motivo: 'No has dado permiso para las notificaciones. Puedes activarlo en los ajustes del móvil.',
    }
  }

  const projectId = idProyecto()
  if (!projectId) {
    return {
      token: null,
      motivo: 'Falta el identificador de proyecto de EAS en app.json.',
    }
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId })
    return { token: data }
  } catch (e: any) {
    return { token: null, motivo: e?.message ?? 'No se pudo obtener el token.' }
  }
}

export interface Envio {
  titulo: string
  cuerpo: string
  /** Viaja con la notificación; sirve para abrir la pantalla que toca al tocarla. */
  datos?: Record<string, unknown>
}

/**
 * Manda una notificación a una lista de dispositivos.
 *
 * Devuelve cuántas aceptó Expo. No lanza: un push que no sale no puede tumbar
 * la publicación del aviso, que es lo que de verdad importa.
 */
export async function enviarPush(tokens: string[], envio: Envio): Promise<number> {
  const validos = [...new Set(tokens)].filter((t) => t?.startsWith('ExponentPushToken'))
  if (validos.length === 0) return 0

  // Expo acepta 100 mensajes por petición. Un equipo no llega, pero el club
  // entero sí, y el día que se mande algo a todos esto ya está resuelto.
  const tandas: string[][] = []
  for (let i = 0; i < validos.length; i += 100) tandas.push(validos.slice(i, i + 100))

  let aceptados = 0
  for (const tanda of tandas) {
    try {
      const respuesta = await fetch(API_EXPO, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          tanda.map((to) => ({
            to,
            sound: 'default',
            title: envio.titulo,
            body: envio.cuerpo,
            data: envio.datos ?? {},
            channelId: 'avisos',
            priority: 'high',
          })),
        ),
      })
      const cuerpo = await respuesta.json().catch(() => null)
      const partes: any[] = Array.isArray(cuerpo?.data) ? cuerpo.data : []
      aceptados += partes.filter((p) => p?.status === 'ok').length
    } catch {
      /* sin conexión: el aviso ya está guardado, se verá al abrir la app */
    }
  }
  return aceptados
}

/** Pone el número del icono de la app. En Android depende del lanzador. */
export async function ponerContador(n: number) {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, n))
  } catch {
    /* no todos los lanzadores lo admiten */
  }
}
