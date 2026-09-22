// ==========================================================================
// Un partido y una tabla, y lo que se puede razonar sobre ellos.
//
// Está separado de `competicion.ts` —que es quien los TRAE de la web— porque
// esto no necesita red para nada: entra un partido y sale si se jugó, quién
// era el rival o en qué orden van. Son funciones puras.
//
// La separación no es estética. `competicion.ts` arrastra el cliente HTTP y,
// con él, `expo-constants`, o sea medio Expo. Cualquier cosa que quisiera
// llamar a `aFecha` se llevaba todo eso por delante, y en particular las
// pruebas del planning semanal (`pruebas/semana.test.mjs`), que corren en Node
// pelado y no tienen dónde montar un Expo.
//
// `competicion.ts` vuelve a exportar todo lo de aquí, así que quien ya lo
// importaba de allí no se entera.
// ==========================================================================

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

/**
 * Cómo se llamaría cada equipo del club en la app.
 *
 * Las federaciones nombran COMPETICIONES («Primera División Masculina») y el
 * club nombra EQUIPOS («Sénior Masculino»). Esto traduce de lo primero a lo
 * segundo, que es lo que la gente reconoce.
 *
 * Tres pasos, y cada uno está por un caso real de estos doce equipos:
 *
 *   1. Categoría y género. Cubre a la mayoría: «Cadete Masculino».
 *   2. La letra, sacada de cómo inscribe el club al equipo («CV OVIEDO A»).
 *      Es lo que separa al Cadete Femenino A del B.
 *   3. La división, solo si aún hay empate. Pasa con los dos sénior
 *      masculinos, que juegan Primera y Segunda: sin esto quedarían con el
 *      mismo nombre y nadie sabría cuál es cuál.
 */
export function nombresSugeridos(
  competiciones: { clave: string; categoria: string; genero: string; division: string; equipoClub: string }[],
): Record<string, string> {
  const sinTildes = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const letraDe = (equipoClub: string) => {
    // 'CV OVIEDO A' / 'C.V. OVIEDO B' → 'A' / 'B'. Sin letra, cadena vacía.
    const m = /\s([AB])$/i.exec(equipoClub.trim())
    return m ? m[1].toUpperCase() : ''
  }

  const base = competiciones.map((c) => {
    const letra = letraDe(c.equipoClub)
    return {
      clave: c.clave,
      nombre: `${c.categoria} ${c.genero}${letra ? ` ${letra}` : ''}`,
      division: c.division,
    }
  })

  // Cuántas veces se repite cada nombre, ignorando tildes: «Sénior» y «Senior»
  // vienen así de las dos federaciones y son la misma categoría.
  const cuenta = new Map<string, number>()
  for (const b of base) {
    const k = sinTildes(b.nombre)
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1)
  }

  const salida: Record<string, string> = {}
  for (const b of base) {
    const repetido = (cuenta.get(sinTildes(b.nombre)) ?? 0) > 1
    salida[b.clave] = repetido ? `${b.nombre} (${b.division})` : b.nombre
  }
  return salida
}
