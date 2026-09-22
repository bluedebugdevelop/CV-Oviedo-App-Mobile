// ==========================================================================
// El planning semanal: qué tiene esta persona cada día de la semana.
//
// Junta en una sola línea de tiempo tres cosas que viven en sitios distintos y
// que hasta ahora había que ir a mirar por separado:
//
//   · Entrenamientos — Firestore, por equipo. Se repiten cada semana, así que
//     no tienen fecha: tienen día de la semana y hay que colocarlos.
//   · Partidos       — las federaciones, vía /api/competicion. Vienen con
//     fecha y hora, y a veces sin hora.
//   · Citas sueltas  — Firestore, por equipo. Amistosos, torneos, la comida de
//     fin de temporada.
//
// Y de TODOS sus equipos, no solo del que esté mirando: quien dobla categoría
// entrena cinco días entre las dos y el lunes le tocan las dos cosas seguidas.
// Eso es justo lo que no se veía en ningún sitio de la app.
//
// Aquí no hay React ni Firebase a propósito: entra lo que ya se ha traído y
// sale la semana montada. Es lo que permite probar el reparto por días —que es
// donde están los casos raros— sin levantar nada.
// ==========================================================================

import type { Entrenamiento, Evento } from './firebase/modelo'
/* Lo puro desde `web/partidos` y el tipo desde `web/competicion`, en dos
   líneas y no en una.

   El `import type` desaparece al compilar, así que este módulo no depende en
   tiempo de ejecución de nada que haga red. Es lo que deja probarlo en Node
   pelado, sin Expo (ver `pruebas/semana.test.mjs`). */
import { aFecha, enCasa, jugado, rivalDe } from './web/partidos'
import type { EquipoCompeticion } from './web/competicion'

export type TipoCita = 'entrenamiento' | 'partido' | 'cita'

export interface Cita {
  /** Único dentro de la semana: el mismo entrenamiento sale una vez por día. */
  id: string
  tipo: TipoCita
  equipoId: string
  equipoNombre: string
  inicio: Date
  /** Los partidos y las citas no tienen hora de fin: no se sabe cuánto duran. */
  fin: Date | null
  titulo: string
  lugar: string | null
  /** Solo en partidos. */
  enCasa?: boolean
  /**
   * La federación no ha puesto la hora.
   *
   * Cuando pasa, el partido llega a medianoche y pintarlo como «00:00» haría
   * pensar que se juega de madrugada. Se marca para poder decir «hora sin
   * confirmar», que es lo que de verdad significa.
   */
  horaPorConfirmar?: boolean
}

export interface DiaSemana {
  fecha: Date
  citas: Cita[]
}

const DIA_MS = 24 * 60 * 60 * 1000

/** La medianoche de ese día. Para comparar días sin que estorbe la hora. */
export const aMedianoche = (f: Date) =>
  new Date(f.getFullYear(), f.getMonth(), f.getDate())

export const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/**
 * El lunes de la semana de una fecha.
 *
 * La semana del club empieza en lunes, como el cartel de horarios. `getDay()`
 * la empieza en domingo, así que el domingo hay que retroceder seis días y no
 * cero: es el error clásico y deja el domingo como primer día de la semana
 * siguiente, con el partido del sábado fuera del planning.
 */
export function lunesDe(f: Date): Date {
  const d = aMedianoche(f)
  const desplazamiento = (d.getDay() + 6) % 7
  return new Date(d.getTime() - desplazamiento * DIA_MS)
}

export const sumarSemanas = (f: Date, n: number) => new Date(f.getTime() + n * 7 * DIA_MS)

/** Los siete días a partir de un lunes. */
export const diasDeLaSemana = (lunes: Date): Date[] =>
  Array.from({ length: 7 }, (_, i) => new Date(lunes.getTime() + i * DIA_MS))

/** 'HH:MM' aplicado a un día. Devuelve `null` si la hora no vale. */
function conHora(dia: Date, hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, min)
}

export interface FuenteEquipo {
  id: string
  nombre: string
  claveCompeticion: string | null
  entrenamientos: Entrenamiento[]
  eventos: Evento[]
}

/**
 * Monta la semana que empieza en `lunes`.
 *
 * @param equipos      los equipos de la persona, con lo suyo ya traído
 * @param competiciones los calendarios federados, por `claveCompeticion`
 */
export function construirSemana(
  lunes: Date,
  equipos: FuenteEquipo[],
  competiciones: Record<string, EquipoCompeticion>,
): DiaSemana[] {
  const dias = diasDeLaSemana(lunes).map((fecha) => ({ fecha, citas: [] as Cita[] }))
  const finDeSemana = new Date(dias[6].fecha.getTime() + DIA_MS)

  const meter = (cita: Cita) => {
    const hueco = dias.find((d) => mismoDia(d.fecha, cita.inicio))
    if (hueco) hueco.citas.push(cita)
  }

  for (const equipo of equipos) {
    // --- entrenamientos: se repiten, así que se colocan en su día ---
    for (const ent of equipo.entrenamientos) {
      // Un entrenamiento desactivado es uno suspendido, no uno oculto: no se
      // pinta porque esa semana no lo hay.
      if (!ent.activo) continue

      const dia = dias.find((d) => d.fecha.getDay() === ent.dia)
      if (!dia) continue

      const inicio = conHora(dia.fecha, ent.inicio)
      if (!inicio) continue

      meter({
        id: `ent-${equipo.id}-${ent.id}`,
        tipo: 'entrenamiento',
        equipoId: equipo.id,
        equipoNombre: equipo.nombre,
        inicio,
        fin: conHora(dia.fecha, ent.fin),
        titulo: 'Entrenamiento',
        lugar: ent.lugar || null,
      })
    }

    // --- partidos de la federación ---
    const comp = equipo.claveCompeticion ? competiciones[equipo.claveCompeticion] : null
    if (comp) {
      for (const p of comp.partidos) {
        const cuando = aFecha(p.iso)
        if (!cuando || cuando < lunes || cuando >= finDeSemana) continue

        const casa = enCasa(p, comp.equipoClub)
        meter({
          id: `par-${equipo.id}-${p.id}`,
          tipo: 'partido',
          equipoId: equipo.id,
          equipoNombre: equipo.nombre,
          inicio: cuando,
          fin: null,
          // Ya jugado, el rival solo no dice nada: interesa el marcador.
          titulo: jugado(p)
            ? `${rivalDe(p, comp.equipoClub)} · ${p.setsLocal}–${p.setsVisitante}`
            : rivalDe(p, comp.equipoClub),
          lugar: p.sede,
          enCasa: casa,
          horaPorConfirmar: !/T\d{2}:\d{2}/.test(p.iso) || p.iso.endsWith('T00:00'),
        })
      }
    }

    // --- citas sueltas ---
    for (const ev of equipo.eventos) {
      const cuando = aFecha(ev.iso)
      if (!cuando || cuando < lunes || cuando >= finDeSemana) continue

      meter({
        id: `cit-${equipo.id}-${ev.id}`,
        tipo: ev.tipo === 'partido' ? 'partido' : 'cita',
        equipoId: equipo.id,
        equipoNombre: equipo.nombre,
        inicio: cuando,
        fin: null,
        titulo: ev.titulo,
        lugar: ev.lugar || null,
      })
    }
  }

  /* Cada día, en orden de reloj.

     Y a igualdad de hora, el partido antes que el entrenamiento: si coinciden,
     lo que se juega manda sobre lo que se entrena. Pasa de verdad los sábados
     de los equipos que además entrenan ese día. */
  const peso: Record<TipoCita, number> = { partido: 0, cita: 1, entrenamiento: 2 }
  for (const d of dias) {
    d.citas.sort((a, b) => {
      const dif = a.inicio.getTime() - b.inicio.getTime()
      return dif !== 0 ? dif : peso[a.tipo] - peso[b.tipo]
    })
  }

  return dias
}
