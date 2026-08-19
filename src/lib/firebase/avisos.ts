// ==========================================================================
// Los avisos del entrenador.
//
// Es lo que separa esto de un grupo de WhatsApp: un aviso no se pierde entre
// mensajes, se puede pedir confirmación de asistencia y se sabe quién lo ha
// leído. El chat es para hablar; los avisos son para que algo llegue.
//
// `leidoPor` y `confirmados` son listas de uid dentro del propio aviso. Se
// podría haber hecho con una subcolección por lector, que escala mejor, pero
// un equipo son 15 personas: quince cadenas en un array ocupan nada y así el
// entrenador ve el recuento sin una segunda consulta por cada aviso.
// ==========================================================================

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'

import { db } from './app'
import type { Aviso, TipoAviso } from './modelo'

const TOPE = 60

const coleccion = (equipoId: string) => collection(db, 'equipos', equipoId, 'avisos')

export function escucharAvisos(equipoId: string, alCambiar: (as: Aviso[]) => void) {
  const q = query(coleccion(equipoId), orderBy('creadoEn', 'desc'), limit(TOPE))
  return onSnapshot(q, (snap) => {
    alCambiar(
      snap.docs.map((d) => {
        const datos = d.data()
        return {
          id: d.id,
          titulo: datos.titulo ?? '',
          cuerpo: datos.cuerpo ?? '',
          tipo: (datos.tipo ?? 'general') as TipoAviso,
          autor: datos.autor ?? '',
          autorNombre: datos.autorNombre ?? '',
          creadoEn: datos.creadoEn,
          requiereConfirmacion: datos.requiereConfirmacion === true,
          confirmados: Array.isArray(datos.confirmados) ? datos.confirmados : [],
          rechazados: Array.isArray(datos.rechazados) ? datos.rechazados : [],
          leidoPor: Array.isArray(datos.leidoPor) ? datos.leidoPor : [],
        }
      }),
    )
  })
}

export interface NuevoAviso {
  titulo: string
  cuerpo: string
  tipo: TipoAviso
  requiereConfirmacion: boolean
}

export async function crearAviso(
  equipoId: string,
  datos: NuevoAviso,
  autor: { uid: string; nombre: string },
): Promise<string> {
  const ref = await addDoc(coleccion(equipoId), {
    titulo: datos.titulo.trim(),
    cuerpo: datos.cuerpo.trim(),
    tipo: datos.tipo,
    requiereConfirmacion: datos.requiereConfirmacion,
    autor: autor.uid,
    autorNombre: autor.nombre,
    // Quien lo escribe no tiene que leerlo: entra ya marcado para él, o el
    // entrenador vería siempre un punto rojo por sus propios avisos.
    leidoPor: [autor.uid],
    confirmados: [],
    rechazados: [],
    creadoEn: serverTimestamp(),
  })
  return ref.id
}

export async function marcarLeido(equipoId: string, avisoId: string, uid: string) {
  await updateDoc(doc(coleccion(equipoId), avisoId), { leidoPor: arrayUnion(uid) })
}

/** Responder a una convocatoria. `voy` cambia de lista, no suma a las dos. */
export async function responder(
  equipoId: string,
  avisoId: string,
  uid: string,
  voy: boolean,
) {
  await updateDoc(doc(coleccion(equipoId), avisoId), {
    confirmados: voy ? arrayUnion(uid) : arrayRemove(uid),
    rechazados: voy ? arrayRemove(uid) : arrayUnion(uid),
    leidoPor: arrayUnion(uid),
  })
}

export async function borrarAviso(equipoId: string, avisoId: string) {
  await deleteDoc(doc(coleccion(equipoId), avisoId))
}

export const sinLeer = (avisos: Aviso[], uid: string) =>
  avisos.filter((a) => !a.leidoPor.includes(uid)).length
