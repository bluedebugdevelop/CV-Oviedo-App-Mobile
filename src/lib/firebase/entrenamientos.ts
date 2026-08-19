// ==========================================================================
// El horario de entrenamientos y los eventos del equipo.
//
// Dos cosas distintas que se editan en la misma pantalla:
//
//   · Entrenamiento: se repite cada semana («martes y jueves de 20:00 a 21:30
//     en el Palacio»). No tiene fecha, tiene día de la semana.
//   · Evento: pasa una vez y tiene fecha y hora («amistoso el sábado 12»).
//     Sirve para lo que no sale del calendario federado: amistosos, torneos,
//     una comida de equipo.
//
// Los partidos de liga NO están aquí: vienen de las federaciones a través de
// `/api/competicion`. Meterlos a mano sería duplicar un dato que ya se scrapea
// y que además se corrige solo cuando la federación cambia un horario.
// ==========================================================================

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'

import { db } from './app'
import type { DiaSemana, Entrenamiento, Evento } from './modelo'
import { DIAS_ORDEN } from './modelo'

const colEntrenos = (equipoId: string) =>
  collection(db, 'equipos', equipoId, 'entrenamientos')
const colEventos = (equipoId: string) => collection(db, 'equipos', equipoId, 'eventos')

// --- entrenamientos -------------------------------------------------------

export function escucharEntrenamientos(
  equipoId: string,
  alCambiar: (es: Entrenamiento[]) => void,
) {
  return onSnapshot(colEntrenos(equipoId), (snap) => {
    const lista = snap.docs.map((d) => {
      const datos = d.data()
      return {
        id: d.id,
        dia: (datos.dia ?? 1) as DiaSemana,
        inicio: datos.inicio ?? '',
        fin: datos.fin ?? '',
        lugar: datos.lugar ?? '',
        notas: datos.notas ?? '',
        activo: datos.activo !== false,
      }
    })
    // Se ordena aquí y no en la consulta: Firestore ordenaría el domingo (0) el
    // primero, y un horario semanal empieza en lunes. Son cuatro elementos, el
    // coste es cero.
    lista.sort((a, b) => {
      const dif = DIAS_ORDEN.indexOf(a.dia) - DIAS_ORDEN.indexOf(b.dia)
      return dif !== 0 ? dif : a.inicio.localeCompare(b.inicio)
    })
    alCambiar(lista)
  })
}

export type NuevoEntrenamiento = Omit<Entrenamiento, 'id'>

export async function crearEntrenamiento(equipoId: string, datos: NuevoEntrenamiento) {
  await addDoc(colEntrenos(equipoId), datos)
}

export async function actualizarEntrenamiento(
  equipoId: string,
  id: string,
  cambios: Partial<Entrenamiento>,
) {
  await updateDoc(doc(colEntrenos(equipoId), id), cambios as Record<string, unknown>)
}

export async function borrarEntrenamiento(equipoId: string, id: string) {
  await deleteDoc(doc(colEntrenos(equipoId), id))
}

// --- eventos --------------------------------------------------------------

export function escucharEventos(equipoId: string, alCambiar: (es: Evento[]) => void) {
  const q = query(colEventos(equipoId), orderBy('iso'))
  return onSnapshot(q, (snap) => {
    alCambiar(
      snap.docs.map((d) => {
        const datos = d.data()
        return {
          id: d.id,
          titulo: datos.titulo ?? '',
          tipo: (datos.tipo ?? 'otro') as Evento['tipo'],
          iso: datos.iso ?? '',
          lugar: datos.lugar ?? '',
          rival: datos.rival ?? '',
          notas: datos.notas ?? '',
          convocados: Array.isArray(datos.convocados) ? datos.convocados : [],
        }
      }),
    )
  })
}

export type NuevoEvento = Omit<Evento, 'id'>

export async function crearEvento(equipoId: string, datos: NuevoEvento) {
  await addDoc(colEventos(equipoId), datos)
}

export async function actualizarEvento(
  equipoId: string,
  id: string,
  cambios: Partial<Evento>,
) {
  await updateDoc(doc(colEventos(equipoId), id), cambios as Record<string, unknown>)
}

export async function borrarEvento(equipoId: string, id: string) {
  await deleteDoc(doc(colEventos(equipoId), id))
}
