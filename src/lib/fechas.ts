// ==========================================================================
// Fechas en castellano, sin librerías.
//
// `Intl` viene en el motor de JavaScript del móvil y sabe hacer esto: meter
// date-fns o moment por formatear cuatro fechas son cientos de kB en el bundle
// para algo que ya está.
//
// Ojo en Android: las versiones viejas de Hermes traían un `Intl` recortado.
// Por eso cada formato tiene su salida a mano si `Intl` no da lo esperado.
// ==========================================================================

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const MESES_CORTO = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const DIAS_CORTO = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const dosCifras = (n: number) => String(n).padStart(2, '0')

/** 'SÁB 12 SEP' — lo que va en la pastilla de fecha de un partido. */
export const fechaCorta = (f: Date) =>
  `${DIAS_CORTO[f.getDay()]} ${f.getDate()} ${MESES_CORTO[f.getMonth()]}`

/** 'sábado 12 de septiembre' */
export const fechaLarga = (f: Date) =>
  `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`

/** '19:30' */
export const hora = (f: Date) => `${dosCifras(f.getHours())}:${dosCifras(f.getMinutes())}`

/** '12/09/2026' */
export const fechaNumerica = (f: Date) =>
  `${dosCifras(f.getDate())}/${dosCifras(f.getMonth() + 1)}/${f.getFullYear()}`

const DIA_MS = 24 * 60 * 60 * 1000

/** Días de diferencia contando días de calendario, no de 24 horas exactas. */
function diasHasta(f: Date, ahora: Date): number {
  const a = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime()
  const b = new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime()
  return Math.round((b - a) / DIA_MS)
}

/**
 * 'Hoy', 'Mañana', 'En 3 días', 'Hace 2 días'.
 *
 * Un partido «mañana» tiene que decir mañana aunque falten 30 horas: lo que
 * cuenta es el día del calendario, no el reloj.
 */
export function relativoDia(f: Date, ahora = new Date()): string {
  const d = diasHasta(f, ahora)
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  if (d === -1) return 'Ayer'
  if (d > 1 && d <= 7) return `En ${d} días`
  if (d < -1 && d >= -7) return `Hace ${-d} días`
  return fechaCorta(f)
}

/**
 * 'ahora', 'hace 5 min', 'hace 3 h', y a partir del día la fecha.
 * Es la marca de tiempo de un mensaje de chat o de un aviso.
 */
export function desde(f: Date, ahora = new Date()): string {
  const segundos = Math.floor((ahora.getTime() - f.getTime()) / 1000)
  if (segundos < 45) return 'ahora'
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`
  if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} h`

  const dias = -diasHasta(f, ahora)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return fechaCorta(f)
}

/** La hora de un mensaje: hoy solo la hora, antes también el día. */
export function selloChat(f: Date, ahora = new Date()): string {
  return diasHasta(f, ahora) === 0 ? hora(f) : `${fechaCorta(f)} · ${hora(f)}`
}

/**
 * Un Timestamp de Firestore como Date.
 *
 * Devuelve `null` mientras el servidor no ha puesto la hora: entre que se
 * manda un mensaje y llega la confirmación, `serverTimestamp()` se lee como
 * null en el snapshot local. La pantalla lo dibuja como «enviando».
 */
export function aDate(sello: any): Date | null {
  if (!sello) return null
  if (typeof sello.toDate === 'function') return sello.toDate()
  if (sello instanceof Date) return sello
  return null
}

/** 'HH:MM' válido? Se usa al escribir el horario de entrenamiento. */
export const horaValida = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v.trim())

/** Mete los dos puntos solo: '2030' → '20:30'. */
export function normalizaHora(v: string): string {
  const soloNumeros = v.replace(/\D/g, '').slice(0, 4)
  if (soloNumeros.length <= 2) return soloNumeros
  return `${soloNumeros.slice(0, 2)}:${soloNumeros.slice(2)}`
}
