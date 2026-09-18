// ==========================================================================
// Calendario, resultados y clasificación, tal y como los publican las
// federaciones (FVBPA y RFEVB).
//
// Vienen de `/api/competicion`, que sirve lo que scrapea `npm run datos` en la
// web. La app no scrapea nada: si lo hiciera, habría dos raspadores que
// mantener y dos versiones distintas de la misma jornada.
//
// Un equipo de Firestore se ata a su competición por `claveCompeticion`. Los
// equipos que no compiten federado —escuela, veteranos— lo tienen a `null` y
// esta parte simplemente no se les enseña.
// ==========================================================================

import { pedir } from './cliente'
import type { FilaClasificacion, Partido } from './partidos'

/* Lo puro se vuelve a exportar desde aquí.

   Vive en `partidos.ts` para que se pueda usar sin arrastrar el cliente HTTP
   (ver la cabecera de ese fichero), pero conceptualmente es lo mismo: el que
   quiera «lo de la competición» lo sigue pidiendo a este módulo y no tiene que
   saber que por dentro son dos. */
export * from './partidos'

export interface EquipoCompeticion {
  clave: string
  nombre: string
  categoria: string
  genero: string
  division: string
  grupo: string | null
  ente: 'FVBPA' | 'RFEVB'
  /** Cómo se llama el equipo del club en esa competición. */
  equipoClub: string
  url: string
  partidos: Partido[]
  clasificacion: FilaClasificacion[]
}

export interface ResumenCompeticion {
  clave: string
  nombre: string
  categoria: string
  genero: string
  division: string
  grupo: string | null
  ente: string
  url: string
  /** Cuántos partidos tiene, no los partidos. El índice va sin ellos. */
  partidos: number
}

interface Cabecera {
  generado: string | null
  temporada: string | null
  fuentes: Record<string, string>
}

export type RespuestaEquipo = Cabecera & { equipo: EquipoCompeticion }
export type RespuestaIndice = Cabecera & { equipos: ResumenCompeticion[] }

/** Una sola competición, con sus partidos y su tabla. */
export function cargarCompeticion(clave: string): Promise<RespuestaEquipo> {
  return pedir<RespuestaEquipo>(`/api/competicion?clave=${encodeURIComponent(clave)}`)
}

/** La lista de competiciones, sin partidos: para elegir en el panel de admin. */
export function cargarIndiceCompeticion(): Promise<RespuestaIndice> {
  return pedir<RespuestaIndice>('/api/competicion?indice')
}

