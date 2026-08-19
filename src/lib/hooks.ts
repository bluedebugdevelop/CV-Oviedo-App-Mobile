// ==========================================================================
// Los datos de la web, traídos a React.
//
// Nada de librerías de caché: son dos peticiones GET que se piden al abrir una
// pantalla y se vuelven a pedir al tirar hacia abajo. Meter react-query para
// esto sería más configuración que código propio.
//
// LO QUE CUESTA ACERTAR
// Que al cambiar de equipo no se vea un instante el calendario del equipo
// anterior. La forma fácil —vaciar el estado en un efecto cuando cambia la
// clave— provoca un render de más con los datos viejos puestos, que es
// justamente el parpadeo que se quiere evitar.
//
// Así que el estado guarda A QUÉ CLAVE pertenece lo que tiene dentro. Si no
// coincide con la que se está pidiendo, se considera que no hay datos, y eso se
// decide al pintar: no hay ventana en la que se enseñe lo que no toca.
// ==========================================================================

import { useCallback, useEffect, useState } from 'react'

import { cargarCompeticion, type EquipoCompeticion } from './web/competicion'
import { cargarContenido, type Contenido } from './web/contenido'

interface Traida<T> {
  datos: T | null
  cargando: boolean
  error: string | null
  refrescando: boolean
  recargar: () => void
}

interface Guardado<T> {
  /** A qué petición pertenece esto. `null` = todavía no hay nada. */
  clave: string | null
  datos: T | null
  error: string | null
}

/**
 * Pide algo y lo deja en estado, atado a la clave que lo identifica.
 *
 * @param clave  qué se está pidiendo. `null` = no hay nada que pedir (por
 *               ejemplo, un equipo sin competición federada).
 */
function useTraida<T>(clave: string | null, traer: () => Promise<T>): Traida<T> {
  const [guardado, setGuardado] = useState<Guardado<T>>({
    clave: null,
    datos: null,
    error: null,
  })
  const [refrescando, setRefrescando] = useState(false)

  /* Un contador para volver a pedir.

     Subirlo cambia las dependencias del efecto, así que la recarga pasa por el
     mismo camino que la carga inicial en vez de ser una segunda función que
     hace casi lo mismo. */
  const [tirada, setTirada] = useState(0)

  useEffect(() => {
    if (!clave) return

    /* La cancelación va por la limpieza del efecto y no por un contador
       aparte: si alguien cambia de equipo mientras carga, la respuesta del
       equipo anterior llega con `vigente` ya en false y se descarta sola. */
    let vigente = true

    void (async () => {
      try {
        const resultado = await traer()
        if (vigente) setGuardado({ clave, datos: resultado, error: null })
      } catch (e: any) {
        if (vigente) {
          setGuardado({ clave, datos: null, error: e?.message ?? 'No se pudo cargar.' })
        }
      } finally {
        if (vigente) setRefrescando(false)
      }
    })()

    return () => {
      vigente = false
    }
  }, [clave, traer, tirada])

  const recargar = useCallback(() => {
    // Sin clave el efecto se sale sin pedir nada, así que nadie apagaría el
    // indicador: el equipo que no compite federado se quedaría girando para
    // siempre al tirar de la pantalla.
    if (!clave) return
    setRefrescando(true)
    setTirada((n) => n + 1)
  }, [clave])

  // Lo guardado solo vale si es de la clave que se está pidiendo ahora.
  const alDia = guardado.clave === clave

  return {
    datos: alDia ? guardado.datos : null,
    error: alDia ? guardado.error : null,
    // Sin clave no hay nada que cargar, así que tampoco hay que esperar.
    cargando: Boolean(clave) && !alDia,
    refrescando,
    recargar,
  }
}

/** Noticias, patrocinadores, equipos y fotos de la web del club. */
export function useContenido(): Traida<Contenido> {
  return useTraida(
    'contenido',
    useCallback(() => cargarContenido(), []),
  )
}

/**
 * Calendario y clasificación de una competición.
 *
 * `clave` es `null` en los equipos que no compiten federado. En ese caso no se
 * pide nada y la pantalla enseña su mensaje, en vez de un error de red.
 */
export function useCompeticion(clave: string | null): Traida<EquipoCompeticion> {
  const traer = useCallback(async () => {
    const r = await cargarCompeticion(clave!)
    return r.equipo
  }, [clave])

  return useTraida(clave, traer)
}
