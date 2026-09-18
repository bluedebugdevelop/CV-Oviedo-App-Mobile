// ==========================================================================
// Los avisos de TODOS los equipos de la persona, escuchados una sola vez.
//
// Antes esto miraba solo al equipo activo, y con ello el globito de la pestaña
// contaba solo los avisos de ese equipo: quien juega en dos categorías podía
// tener una convocatoria sin leer en la otra y no enterarse hasta cambiar de
// equipo a mano. Ahora la bandeja de avisos es una lista de equipos —igual
// que la de chats— y el contador es el del club entero.
//
// Los necesitan tres sitios: la pestaña (el globito), la bandeja (la lista de
// equipos con su último aviso) y la pantalla de un equipo (sus avisos). Con un
// listener en cada uno serían tres suscripciones al mismo dato y tres
// contadores que podrían ir desacompasados.
//
// También pone el número en el icono de la app. Se hace aquí porque es el
// único punto que sabe cuántos hay sin leer en todo el club.
// ==========================================================================

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { escucharAvisos, sinLeer } from '../lib/firebase/avisos'
import type { Aviso } from '../lib/firebase/modelo'
import { ponerContador } from '../lib/push'
import { useSesion } from './sesion'

export interface ResumenAvisos {
  equipoId: string
  avisos: Aviso[]
  /** El más reciente, para la vista previa de la bandeja. */
  ultimo: Aviso | null
  noLeidos: number
}

interface Estado {
  porEquipo: Record<string, ResumenAvisos>
  /** Los avisos de un equipo, ya ordenados. Vacío si aún no ha cargado. */
  avisosDe: (equipoId: string | null | undefined) => Aviso[]
  noLeidosDe: (equipoId: string | null | undefined) => number
  /** La suma de todos los equipos: lo que pinta el globito de la pestaña. */
  noLeidos: number
  cargando: boolean
}

const VACIO: Estado = {
  porEquipo: {},
  avisosDe: () => [],
  noLeidosDe: () => 0,
  noLeidos: 0,
  cargando: true,
}

const Contexto = createContext<Estado>(VACIO)

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const { equipos, perfil } = useSesion()

  /* Lo recibido va JUNTO CON la lista de equipos de la que es.

     Igual que en `contexto/chats`: al cambiar de equipos, lo de antes deja de
     valer porque la firma ya no coincide, y eso se decide al pintar. Vaciarlo
     desde el efecto daría un render con los avisos —y el contador rojo— de
     equipos en los que la persona ya no está. */
  const [recibido, setRecibido] = useState<{ firma: string; datos: Record<string, Aviso[]> }>({
    firma: '',
    datos: {},
  })

  const ids = useMemo(
    () => equipos.filter((eq) => !eq.archivado).map((eq) => eq.id),
    [equipos],
  )
  // Ver el mismo truco en `contexto/chats`: una cadena estable como
  // dependencia, porque el array es nuevo en cada render de la sesión.
  const firmaIds = ids.join(',')

  useEffect(() => {
    const listaIds = firmaIds ? firmaIds.split(',') : []
    if (listaIds.length === 0) return

    const cortes = listaIds.map((id) =>
      escucharAvisos(id, (lista) =>
        setRecibido((antes) => ({
          firma: firmaIds,
          datos: { ...(antes.firma === firmaIds ? antes.datos : {}), [id]: lista },
        })),
      ),
    )
    return () => cortes.forEach((corta) => corta())
  }, [firmaIds])

  const valor = useMemo<Estado>(() => {
    // Lo guardado solo vale si es de los equipos que hay ahora.
    const crudos = recibido.firma === firmaIds ? recibido.datos : {}

    const porEquipo: Record<string, ResumenAvisos> = {}
    let total = 0

    for (const id of ids) {
      const avisos = crudos[id]
      if (!avisos) continue

      const cuentan = perfil ? sinLeer(avisos, perfil.uid) : 0
      porEquipo[id] = { equipoId: id, avisos, ultimo: avisos[0] ?? null, noLeidos: cuentan }
      total += cuentan
    }

    return {
      porEquipo,
      avisosDe: (id) => (id ? (porEquipo[id]?.avisos ?? []) : []),
      noLeidosDe: (id) => (id ? (porEquipo[id]?.noLeidos ?? 0) : 0),
      noLeidos: total,
      cargando: ids.some((id) => !crudos[id]),
    }
  }, [ids, firmaIds, recibido, perfil])

  useEffect(() => {
    void ponerContador(valor.noLeidos)
  }, [valor.noLeidos])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useAvisos = () => useContext(Contexto)
