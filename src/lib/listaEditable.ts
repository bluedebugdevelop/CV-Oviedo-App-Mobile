// ==========================================================================
// Editar una de las listas del panel sin escribir en el servidor a cada tecla.
//
// La API de la web guarda listas enteras (`PUT /api/panel/noticias` manda TODAS
// las noticias). Si cada letra escrita disparara un guardado, serían cientos de
// peticiones y cualquier corte de red dejaría la web a medias.
//
// Así que se trabaja sobre una copia en memoria y se guarda cuando la persona
// lo dice. `sucio` es lo que permite avisar de que hay cambios sin guardar
// antes de salir de la pantalla — que es el fallo clásico de este patrón.
//
// Al volver del servidor se adopta lo que él devuelve, no lo que se mandó: el
// servidor recorta textos y tira campos que no conoce, y si nos quedáramos con
// nuestra versión la pantalla enseñaría algo distinto de lo publicado.
// ==========================================================================

import { useCallback, useState } from 'react'

export interface ListaEditable<T> {
  elementos: T[]
  sucio: boolean
  guardando: boolean
  error: string | null
  cambiar: (indice: number, cambios: Partial<T>) => void
  anadir: (elemento: T) => void
  quitar: (indice: number) => void
  /** Sube o baja un elemento. En la web, el orden de la lista es el orden en pantalla. */
  mover: (indice: number, salto: 1 | -1) => void
  guardar: () => Promise<boolean>
  descartar: () => void
}

export function useListaEditable<T>(
  original: T[] | undefined,
  guardarEnServidor: (elementos: T[]) => Promise<void>,
): ListaEditable<T> {
  const [elementos, setElementos] = useState<T[]>(original ?? [])
  const [sucio, setSucio] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* Adoptar lo que llega del servidor, pero sin pisar lo que se está
     escribiendo.

     Se hace ajustando el estado DURANTE el render, que es el patrón que
     recomienda React para derivar estado de una prop que cambia. React
     descarta el render a medias y vuelve a empezar con el valor nuevo, así que
     no hay ni un fotograma con la lista vieja ni un render de más.

     Con un efecto haría falta un ref para consultar `sucio` sin meterlo en las
     dependencias, y leer un ref durante el render es justo lo que no se debe
     hacer. */
  const [ultimaVista, setUltimaVista] = useState(original)

  if (original !== ultimaVista) {
    setUltimaVista(original)
    if (!sucio) setElementos(original ?? [])
  }

  const cambiar = useCallback((indice: number, cambios: Partial<T>) => {
    setElementos((lista) =>
      lista.map((x, i) => (i === indice ? { ...x, ...cambios } : x)),
    )
    setSucio(true)
  }, [])

  const anadir = useCallback((elemento: T) => {
    // Al principio y no al final: lo que se acaba de crear es lo que se quiere
    // ver y seguir editando, y en la web las noticias nuevas van arriba.
    setElementos((lista) => [elemento, ...lista])
    setSucio(true)
  }, [])

  const quitar = useCallback((indice: number) => {
    setElementos((lista) => lista.filter((_, i) => i !== indice))
    setSucio(true)
  }, [])

  const mover = useCallback((indice: number, salto: 1 | -1) => {
    setElementos((lista) => {
      const destino = indice + salto
      if (destino < 0 || destino >= lista.length) return lista
      const copia = [...lista]
      ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
      return copia
    })
    setSucio(true)
  }, [])

  const guardar = useCallback(async () => {
    setGuardando(true)
    setError(null)
    try {
      await guardarEnServidor(elementos)
      setSucio(false)
      return true
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar.')
      return false
    } finally {
      setGuardando(false)
    }
  }, [elementos, guardarEnServidor])

  const descartar = useCallback(() => {
    setElementos(original ?? [])
    setSucio(false)
    setError(null)
  }, [original])

  return { elementos, sucio, guardando, error, cambiar, anadir, quitar, mover, guardar, descartar }
}

/** 'Copa del Rey 2026' → 'copa-del-rey-2026'. El mismo que hace el servidor. */
export function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

/** 'ago 2026' con el formato que ya usan las noticias de la web. */
export function fechaDeHoy(hoy = new Date()): string {
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${hoy.getDate()} ${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`
}
