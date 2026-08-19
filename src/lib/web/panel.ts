// ==========================================================================
// El panel de la web, desde el móvil.
//
// Es la parte que deja a un admin publicar una noticia desde el sofá y que
// salga en clubvoleiboloviedo.com. Habla con las mismas rutas que el panel del
// navegador (`/api/panel/...`), solo que autenticándose con un token en vez de
// con la cookie: ver `api/_acceso.js` en CVOWeb.
//
// El token se guarda en el llavero del sistema (expo-secure-store), no en
// AsyncStorage. AsyncStorage es un fichero corriente dentro de la app: en un
// móvil con root o en una copia de seguridad sin cifrar se lee tal cual. El
// llavero lo respalda el hardware —Keychain en iOS, Keystore en Android— y no
// sale del dispositivo.
//
// La contraseña del panel no se guarda NUNCA. Se escribe, se cambia por un
// token y se olvida.
// ==========================================================================

import * as SecureStore from 'expo-secure-store'

import { WEB_BASE } from '../config'
import { ErrorWeb } from './cliente'
import type { Contenido, EquipoWeb, FotoSitio, Noticia, Patrocinador } from './contenido'

const LLAVE = 'cvo.panel.token'
const LLAVE_CADUCA = 'cvo.panel.caduca'

export type Lista = 'noticias' | 'patrocinadores' | 'equipos' | 'fotos'

export interface SesionPanel {
  nombre: string
  /** `false` si la web corre sin volumen: lo que se publique se perderá. */
  persistente: boolean
  limiteImagen: number
  tiposImagen: string[]
  noticias: Noticia[]
  patrocinadores: Patrocinador[]
  equipos: EquipoWeb[]
  fotos: FotoSitio[]
}

// --- el token -------------------------------------------------------------

export async function tokenGuardado(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(LLAVE)
  if (!token) return null

  const caduca = Number((await SecureStore.getItemAsync(LLAVE_CADUCA)) ?? 0)
  // Se comprueba aquí además de en el servidor para no enseñar el panel y que
  // reviente al primer toque: si ya caducó, se pide la contraseña de entrada.
  if (caduca && caduca < Date.now()) {
    await olvidarToken()
    return null
  }
  return token
}

async function guardarToken(token: string, caduca: number) {
  await SecureStore.setItemAsync(LLAVE, token)
  await SecureStore.setItemAsync(LLAVE_CADUCA, String(caduca))
}

export async function olvidarToken() {
  await SecureStore.deleteItemAsync(LLAVE).catch(() => {})
  await SecureStore.deleteItemAsync(LLAVE_CADUCA).catch(() => {})
}

// --- llamadas -------------------------------------------------------------

const TIEMPO_LIMITE = 20000

async function llamar<T>(
  ruta: string,
  opciones: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...resto } = opciones
  const corte = new AbortController()
  const alarma = setTimeout(() => corte.abort(), TIEMPO_LIMITE)

  let respuesta: Response
  try {
    respuesta = await fetch(`${WEB_BASE}${ruta}`, {
      ...resto,
      signal: corte.signal,
      headers: {
        ...(headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new ErrorWeb('La web del club no responde.')
    throw new ErrorWeb('Sin conexión con la web del club.')
  } finally {
    clearTimeout(alarma)
  }

  const cuerpo = await respuesta.json().catch(() => null)

  if (respuesta.status === 401) {
    // El token ya no vale: caducado, o alguien cambió PANEL_SECRETO en Railway
    // para echar a todo el mundo. En los dos casos toca volver a entrar.
    await olvidarToken()
    throw new ErrorWeb('La sesión del panel ha caducado. Vuelve a entrar.', 401)
  }
  if (!respuesta.ok) {
    throw new ErrorWeb(cuerpo?.error || `La web respondió ${respuesta.status}.`, respuesta.status)
  }

  return cuerpo as T
}

/** Cambia usuario y contraseña del panel por un token de 90 días. */
export async function entrarEnPanel(usuario: string, clave: string): Promise<string> {
  const datos = await llamar<{ token: string; caduca: number; nombre: string }>(
    '/api/panel/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: usuario.trim(), clave }),
    },
  )
  await guardarToken(datos.token, datos.caduca)
  return datos.nombre
}

/** Quién soy y todo el contenido de golpe, que es lo que devuelve `sesion`. */
export function estadoPanel(token: string): Promise<SesionPanel> {
  return llamar<SesionPanel>('/api/panel/sesion', { token })
}

/**
 * Guarda una lista entera.
 *
 * El panel de la web funciona igual: no manda «esta noticia ha cambiado», manda
 * las noticias que tiene que haber. Es más tosco pero deja el servidor sin
 * lógica de mezcla, y con listas de decenas de elementos no se nota.
 */
export async function guardarLista<T>(
  token: string,
  lista: Lista,
  elementos: T[],
): Promise<T[]> {
  const datos = await llamar<Record<string, T[]>>(`/api/panel/${lista}`, {
    token,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [lista]: elementos }),
  })
  // El servidor devuelve la lista ya limpia (recorta textos, tira campos que
  // no conoce). Es esa la que vale, no la que se mandó.
  return datos[lista]
}

/**
 * Sube una imagen y devuelve su ruta pública (`/subidas/...`).
 *
 * La API espera los bytes en crudo con el `Content-Type` de la imagen, no un
 * formulario. Se pasa por `fetch(uri).blob()` porque es lo único que lee un
 * fichero local del móvil sin traerlo a memoria como texto en base64, que con
 * una foto de 4 MB multiplicaría el gasto por cuatro.
 */
export async function subirImagen(
  token: string,
  uri: string,
  tipo: string,
  nombre: string,
): Promise<string> {
  const fichero = await fetch(uri)
  const bytes = await fichero.blob()

  const datos = await llamar<{ ruta: string }>('/api/panel/imagen', {
    token,
    method: 'POST',
    headers: {
      'Content-Type': tipo,
      // Solo sirve para que el fichero del servidor tenga un nombre legible.
      'X-Nombre': nombre.replace(/[^\w.-]/g, '-').slice(0, 120),
    },
    body: bytes,
  })
  return datos.ruta
}

/** Lo que el panel devuelve, en la forma que usa el resto de la app. */
export const contenidoDePanel = (s: SesionPanel): Omit<Contenido, 'origen'> => ({
  noticias: s.noticias,
  patrocinadores: s.patrocinadores,
  equipos: s.equipos,
  fotos: s.fotos,
})
