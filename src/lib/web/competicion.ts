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

export interface Partido {
  id: string
  /** 'YYYY-MM-DDTHH:MM'. Puede venir sin hora si la federación no la ha puesto. */
  iso: string
  hora: string | null
  sede: string | null
  local: string
  visitante: string
  setsLocal: number | null
  setsVisitante: number | null
  parciales: string[]
  estado: string
  jornada: number | null
  fase: string | null
}

export interface FilaClasificacion {
  pos: number
  equipo: string
  pts: number
  pj: number
  /** Sets a favor y en contra. */
  sf: number
  sc: number
  /** `true` en la fila del CV Oviedo: es la que se resalta en la tabla. */
  yo: boolean
}

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

/** ¿Ya se jugó? Un partido con sets puestos es un resultado, no una cita. */
export const jugado = (p: Partido) =>
  p.setsLocal !== null && p.setsVisitante !== null

/** ¿Juega en casa el equipo del club? */
export const enCasa = (p: Partido, equipoClub: string) =>
  p.local.trim().toLowerCase() === equipoClub.trim().toLowerCase()

/**
 * Cómo quedó, desde el punto de vista del club: 'ganado', 'perdido' o null.
 */
export function resultado(p: Partido, equipoClub: string): 'ganado' | 'perdido' | null {
  if (!jugado(p)) return null
  const nuestros = enCasa(p, equipoClub) ? p.setsLocal! : p.setsVisitante!
  const suyos = enCasa(p, equipoClub) ? p.setsVisitante! : p.setsLocal!
  return nuestros > suyos ? 'ganado' : 'perdido'
}

/** El rival, sea cual sea el lado en el que juegue el club. */
export const rivalDe = (p: Partido, equipoClub: string) =>
  enCasa(p, equipoClub) ? p.visitante : p.local

/**
 * Parte los partidos en «lo que viene» y «lo que ya pasó».
 *
 * Los próximos van de antes a después (el más cercano primero, que es el que
 * importa) y los jugados al revés (el último resultado arriba).
 */
export function repartirPartidos(partidos: Partido[], ahora = new Date()) {
  const conFecha = partidos.map((p) => ({ p, fecha: aFecha(p.iso) }))

  const proximos = conFecha
    .filter(({ p, fecha }) => !jugado(p) && (!fecha || fecha >= ahora))
    .sort((a, b) => (a.fecha?.getTime() ?? 0) - (b.fecha?.getTime() ?? 0))
    .map(({ p }) => p)

  const pasados = conFecha
    .filter(({ p, fecha }) => jugado(p) || (fecha !== null && fecha < ahora))
    .sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0))
    .map(({ p }) => p)

  return { proximos, pasados }
}

/**
 * 'YYYY-MM-DDTHH:MM' → Date en hora local.
 *
 * A mano y no con `new Date(iso)`: una cadena sin zona la interpreta cada
 * plataforma a su manera, y un partido a las 19:30 acabaría pintado a las
 * 21:30 en verano. Aquí los números son los que son, en la hora de aquí.
 */
export function aFecha(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0))
}
