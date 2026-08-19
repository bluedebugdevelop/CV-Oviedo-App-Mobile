// ==========================================================================
// El modelo de datos: qué hay en Firestore y con qué forma.
//
//   usuarios/{uid}
//   equipos/{equipoId}
//   equipos/{equipoId}/mensajes/{id}        chat del equipo
//   equipos/{equipoId}/avisos/{id}          avisos del entrenador
//   equipos/{equipoId}/entrenamientos/{id}  horario semanal
//   equipos/{equipoId}/eventos/{id}         convocatorias y partidos a mano
//
// Todo lo del equipo cuelga del equipo. Es lo que permite escribir las reglas
// de seguridad de una forma que se entiende leyéndolas: «puedes ver esto si
// estás en la lista del equipo de arriba». Con colecciones planas y un campo
// `equipoId` habría que consultar el equipo en cada regla, que es más lento y
// mucho más fácil de equivocar.
//
// Los jugadores y entrenadores se guardan como listas de uid DENTRO del equipo,
// además del campo `equipos` del usuario. Está duplicado a propósito: las
// reglas necesitan la lista en el equipo para decidir sin leer otro documento,
// y la app necesita el campo en el usuario para saber a qué equipos entrar sin
// recorrerse todos los equipos del club. `equipos.ts` mantiene las dos caras.
// ==========================================================================

import type { Timestamp } from 'firebase/firestore'

export type Rol = 'admin' | 'entrenador' | 'jugador'

export const ROLES: { valor: Rol; etiqueta: string; explicacion: string }[] = [
  {
    valor: 'admin',
    etiqueta: 'Administrador',
    explicacion: 'Gestiona el club entero: equipos, altas y el contenido de la web.',
  },
  {
    valor: 'entrenador',
    etiqueta: 'Entrenador',
    explicacion: 'Puede entrenar equipos: avisos, horarios y convocatorias de los suyos.',
  },
  {
    valor: 'jugador',
    etiqueta: 'Jugador',
    explicacion: 'Puede jugar en equipos: calendario, horarios, chat y avisos de los suyos.',
  },
]

export const etiquetaRol = (rol: Rol) => ROLES.find((r) => r.valor === rol)?.etiqueta ?? rol

/* --------------------------------------------------------------------------
   Los roles van en plural.

   En un club de verdad la gente hace más de una cosa: la entrenadora del
   infantil juega en el sénior, y quien lleva la web además entrena a un
   equipo. Con un solo rol había que elegir cuál de sus dos vidas contaba.

   Hay DOS niveles y conviene no mezclarlos:

     · Aquí, en el usuario, están los roles DE CLUB: lo que esa persona puede
       llegar a ser. Es lo que abre o cierra la administración.
     · En cada equipo, las listas `entrenadores` y `jugadores` dicen lo que es
       en ESE equipo. Es lo que decide quién manda avisos en cada sitio.

   Por eso ser «entrenador» de club no da mando sobre ningún equipo por sí
   solo: hace falta además estar en la lista de entrenadores de ese equipo. Y
   por eso la misma persona puede salir como jugadora en la plantilla de un
   equipo y como entrenadora en la de otro.
   -------------------------------------------------------------------------- */

/** Manda en todo el club: altas, equipos y contenido de la web. */
export const esAdmin = (u: { roles: Rol[] }) => u.roles.includes('admin')

/** Puede figurar como entrenador de un equipo. Un admin también. */
export const puedeEntrenar = (u: { roles: Rol[] }) =>
  u.roles.includes('entrenador') || u.roles.includes('admin')

/** Puede figurar en la plantilla de un equipo. */
export const puedeJugar = (u: { roles: Rol[] }) => u.roles.includes('jugador')

/**
 * Lee los roles de un documento de Firestore, venga como venga.
 *
 * Los documentos anteriores a esto —y la primera ficha de admin, que se crea a
 * mano en la consola siguiendo el README— traen `rol` en singular. Se admiten
 * los dos formatos para siempre: no cuesta nada y evita una migración que, si
 * se hace a medias, deja a alguien fuera de su propio club.
 */
export function rolesDe(datos: any): Rol[] {
  const validos = ROLES.map((r) => r.valor)
  const limpiar = (v: unknown[]) => v.filter((x): x is Rol => validos.includes(x as Rol))

  if (Array.isArray(datos?.roles)) {
    const lista = limpiar(datos.roles)
    if (lista.length > 0) return lista
  }
  if (typeof datos?.rol === 'string') {
    const lista = limpiar([datos.rol])
    if (lista.length > 0) return lista
  }
  // Sin nada legible, lo más inofensivo: jugador no abre ninguna puerta.
  return ['jugador']
}

/** 'Jugador y entrenador' — para enseñarlos en una línea. */
export function resumenRoles(roles: Rol[]): string {
  const nombres = ROLES.filter((r) => roles.includes(r.valor)).map((r) => r.etiqueta)
  if (nombres.length === 0) return '—'
  if (nombres.length === 1) return nombres[0]
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1].toLowerCase()}`
}

export interface Usuario {
  uid: string
  nombre: string
  email: string
  /** Roles de club. Ver el bloque de arriba: son capacidades, no el puesto. */
  roles: Rol[]
  /** Ids de los equipos a los que pertenece. Un jugador puede doblar categoría. */
  equipos: string[]
  dorsal?: string
  posicion?: string
  telefono?: string
  /** Una baja no borra al usuario: lo desactiva. Las reglas le cierran la puerta. */
  activo: boolean
  /** Tokens de Expo Push, uno por dispositivo donde tenga la app. */
  tokensPush: string[]
  creadoEn?: Timestamp
  creadoPor?: string
}

export type Genero = 'Masculino' | 'Femenino' | 'Mixto'

export interface Equipo {
  id: string
  nombre: string
  categoria: string
  genero: Genero
  temporada: string
  /**
   * Enlace con los datos de las federaciones (`/api/competicion?clave=`).
   * `null` para los equipos que no compiten federado (escuela, veteranos).
   */
  claveCompeticion: string | null
  entrenadores: string[]
  jugadores: string[]
  archivado: boolean
  creadoEn?: Timestamp
  creadoPor?: string
}

export interface Mensaje {
  id: string
  autor: string
  autorNombre: string
  /**
   * El papel del autor EN ESTE EQUIPO cuando escribió, no sus roles de club.
   *
   * Se guarda con el mensaje en vez de mirarlo al pintarlo: si alguien deja de
   * entrenar a un equipo, sus mensajes de entonces siguen siendo los del
   * entrenador que era. Y quien juega en un equipo y entrena en otro sale como
   * lo que es en cada chat.
   */
  autorRol: Rol
  texto: string
  creadoEn?: Timestamp
}

export type TipoAviso = 'general' | 'partido' | 'entrenamiento' | 'urgente'

export const TIPOS_AVISO: { valor: TipoAviso; etiqueta: string; icono: string }[] = [
  { valor: 'general', etiqueta: 'General', icono: 'megaphone' },
  { valor: 'partido', etiqueta: 'Partido', icono: 'trophy' },
  { valor: 'entrenamiento', etiqueta: 'Entrenamiento', icono: 'fitness' },
  { valor: 'urgente', etiqueta: 'Urgente', icono: 'alert-circle' },
]

export interface Aviso {
  id: string
  titulo: string
  cuerpo: string
  tipo: TipoAviso
  autor: string
  autorNombre: string
  creadoEn?: Timestamp
  /** Si está puesto, cada jugador tiene que decir si va o no. */
  requiereConfirmacion: boolean
  /** uid de quien ha dicho que sí, y de quien ha dicho que no. */
  confirmados: string[]
  rechazados: string[]
  /** uid de quien ya lo ha abierto; alimenta el contador de no leídos. */
  leidoPor: string[]
}

/** 0 = domingo, como `Date.getDay()`. */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const DIAS_CORTO = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

/** El orden natural de un horario de entrenamientos empieza en lunes. */
export const DIAS_ORDEN: DiaSemana[] = [1, 2, 3, 4, 5, 6, 0]

export interface Entrenamiento {
  id: string
  dia: DiaSemana
  /** 'HH:MM' en 24 h. Texto y no número: es lo que se escribe y lo que se pinta. */
  inicio: string
  fin: string
  lugar: string
  notas?: string
  activo: boolean
}

export interface Evento {
  id: string
  titulo: string
  tipo: 'partido' | 'otro'
  /** 'YYYY-MM-DDTHH:MM', el mismo formato que usa el scraper de la web. */
  iso: string
  lugar?: string
  rival?: string
  notas?: string
  /** Convocatoria: uid de los llamados. Vacío = va el equipo entero. */
  convocados: string[]
}

export const POSICIONES = [
  'Colocador/a',
  'Opuesto/a',
  'Receptor/a',
  'Central',
  'Líbero',
]

export const CATEGORIAS = [
  'Sénior',
  'Junior',
  'Juvenil',
  'Cadete',
  'Infantil',
  'Alevín',
  'Benjamín',
  'Escuela',
]

/** '2026/27' para la temporada que empieza en el año que toque. */
export function temporadaActual(hoy = new Date()): string {
  // La temporada arranca en septiembre: de enero a agosto todavía es la anterior.
  const inicio = hoy.getMonth() >= 8 ? hoy.getFullYear() : hoy.getFullYear() - 1
  return `${inicio}/${String((inicio + 1) % 100).padStart(2, '0')}`
}
