// ==========================================================================
// El chat del equipo.
//
// Un chat por equipo, con todos dentro: jugadores y entrenador. No hay
// privados uno a uno a propósito — lo que pidió el club es un grupo donde el
// entrenador avisa y el equipo responde, y los privados entre menores en una
// app del club son un problema de moderación que nadie quiere.
//
// Se traen los últimos 200 mensajes y ya. Un equipo no llega a eso en una
// temporada normal, y evita paginar hacia atrás en una lista invertida, que es
// de las cosas que peor salen en React Native.
// ==========================================================================

import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'

import { db } from './app'
import type { Mensaje, Rol } from './modelo'

const TOPE = 200

const coleccion = (equipoId: string) => collection(db, 'equipos', equipoId, 'mensajes')

/**
 * Los mensajes, del más nuevo al más viejo.
 *
 * Ese orden es el que quiere una FlatList invertida, que es como se pinta un
 * chat: la lista arranca abajo y crece hacia arriba sin tener que medir nada.
 */
export function escucharMensajes(equipoId: string, alCambiar: (ms: Mensaje[]) => void) {
  const q = query(coleccion(equipoId), orderBy('creadoEn', 'desc'), limit(TOPE))
  return onSnapshot(q, (snap) => {
    alCambiar(
      snap.docs.map((d) => {
        const datos = d.data()
        return {
          id: d.id,
          autor: datos.autor ?? '',
          autorNombre: datos.autorNombre ?? '',
          autorRol: (datos.autorRol ?? 'jugador') as Rol,
          texto: datos.texto ?? '',
          creadoEn: datos.creadoEn,
        }
      }),
    )
  })
}

export const LIMITE_MENSAJE = 1000

export async function enviarMensaje(
  equipoId: string,
  autor: { uid: string; nombre: string; rol: Rol },
  texto: string,
) {
  const limpio = texto.trim().slice(0, LIMITE_MENSAJE)
  if (!limpio) return

  await addDoc(coleccion(equipoId), {
    autor: autor.uid,
    autorNombre: autor.nombre,
    autorRol: autor.rol,
    texto: limpio,
    // La hora la pone el servidor, no el móvil: si no, un reloj mal puesto
    // colocaría el mensaje en mitad de la conversación de ayer.
    creadoEn: serverTimestamp(),
  })
}
