// ==========================================================================
// Lo básico para hablar con clubvoleiboloviedo.com.
//
// La app no tiene su propio backend para el contenido: lee el de la web. Así
// una noticia se publica una vez y sale en los dos sitios, que es justo lo que
// se decidió al montar esto.
// ==========================================================================

import { WEB_BASE } from '../config'

/** Un fallo que se le puede enseñar a alguien sin que le diga nada raro. */
export class ErrorWeb extends Error {
  constructor(
    mensaje: string,
    readonly estado?: number,
  ) {
    super(mensaje)
    this.name = 'ErrorWeb'
  }
}

const TIEMPO_LIMITE = 15000

/**
 * `fetch` con tiempo límite y errores en cristiano.
 *
 * Sin el límite, una petición en una wifi que acepta la conexión pero no
 * contesta se queda colgada para siempre y la pantalla con ella. El móvil no
 * avisa: simplemente no pasa nada.
 */
export async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const corte = new AbortController()
  const alarma = setTimeout(() => corte.abort(), TIEMPO_LIMITE)

  let respuesta: Response
  try {
    respuesta = await fetch(`${WEB_BASE}${ruta}`, { ...opciones, signal: corte.signal })
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new ErrorWeb('La web del club no responde. Inténtalo en un momento.')
    }
    throw new ErrorWeb('Sin conexión con la web del club.')
  } finally {
    clearTimeout(alarma)
  }

  const tipo = respuesta.headers.get('content-type') ?? ''
  const esJson = tipo.includes('application/json')
  const cuerpo = esJson ? await respuesta.json().catch(() => null) : null

  if (!respuesta.ok) {
    throw new ErrorWeb(
      cuerpo?.error || `La web respondió ${respuesta.status}.`,
      respuesta.status,
    )
  }
  if (!esJson) {
    // Pasa cuando el servidor devuelve el index.html porque la ruta no existe:
    // status 200 y una página entera donde se esperaba un JSON.
    throw new ErrorWeb('La web devolvió algo que no era JSON.')
  }

  return cuerpo as T
}
