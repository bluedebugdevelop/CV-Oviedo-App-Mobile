// ==========================================================================
// Los usuarios del club.
//
// No hay registro abierto: en la app no existe pantalla de «crear cuenta». Las
// cuentas las da de alta un administrador desde `admin/usuarios`, que es lo que
// pidió el club — aquí la gente no se apunta sola, la apunta el club.
//
// Eso se sostiene en dos sitios a la vez:
//   · aquí, porque no hay ninguna función que cree cuentas sin ser admin;
//   · y sobre todo en firestore.rules, porque un móvil se puede trastear y el
//     SDK de Firebase se puede llamar desde fuera de la app. Sin documento en
//     `usuarios/`, una cuenta de Auth no puede leer ni escribir nada.
// ==========================================================================

import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'

import { authAlta, db } from './app'
import type { Rol, Usuario } from './modelo'

const COL = 'usuarios'

const docUsuario = (uid: string) => doc(db, COL, uid)

/**
 * Una lista de cadenas, sin huecos.
 *
 * La consola de Firebase OBLIGA a meter un elemento al crear un campo de tipo
 * array, así que la primera ficha de admin —la que hay que crear a mano, porque
 * las reglas no dejan crearla desde la app— acaba con `equipos: [""]`. Ese id
 * vacío llega a `doc(db, 'equipos', '')`, que lanza, y la app se queda tiesa
 * nada más entrar.
 *
 * Se limpia aquí, en la frontera por la que entran los datos de Firestore, en
 * vez de en cada sitio que los use.
 */
const listaLimpia = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []

/** Rellena lo que falte: los documentos viejos pueden no tener campos nuevos. */
function aUsuario(uid: string, datos: any): Usuario {
  return {
    uid,
    nombre: datos?.nombre ?? '',
    email: datos?.email ?? '',
    rol: (datos?.rol ?? 'jugador') as Rol,
    equipos: listaLimpia(datos?.equipos),
    dorsal: datos?.dorsal ?? '',
    posicion: datos?.posicion ?? '',
    telefono: datos?.telefono ?? '',
    activo: datos?.activo !== false,
    tokensPush: listaLimpia(datos?.tokensPush),
    creadoEn: datos?.creadoEn,
    creadoPor: datos?.creadoPor,
  }
}

export async function leerUsuario(uid: string): Promise<Usuario | null> {
  const inst = await getDoc(docUsuario(uid))
  return inst.exists() ? aUsuario(inst.id, inst.data()) : null
}

/**
 * El perfil propio, en vivo: si el admin cambia el rol, la app se entera sola.
 *
 * El segundo argumento del callback separa dos cosas que se parecen mucho y
 * que se arreglan de formas muy distintas:
 *
 *   · null sin fallo → la cuenta existe en Auth pero no tiene ficha; es
 *     alguien a quien no ha dado de alta ningún administrador.
 *   · con fallo → Firestore rechazó la lectura. Casi siempre significa que
 *     las reglas no están desplegadas todavía.
 *
 * Sin distinguirlas, un proyecto recién montado le dice «no estás dado de
 * alta» a alguien que sí lo está, y ahí se pierde la tarde.
 */
export function escucharUsuario(
  uid: string,
  alCambiar: (u: Usuario | null, fallo?: string) => void,
) {
  return onSnapshot(
    docUsuario(uid),
    (inst) => alCambiar(inst.exists() ? aUsuario(inst.id, inst.data()) : null),
    (e: any) => alCambiar(null, e?.code ?? e?.message ?? 'error desconocido'),
  )
}

export function escucharUsuariosDeEquipo(
  equipoId: string,
  alCambiar: (us: Usuario[]) => void,
) {
  const q = query(
    collection(db, COL),
    where('equipos', 'array-contains', equipoId),
    orderBy('nombre'),
  )
  return onSnapshot(q, (snap) => alCambiar(snap.docs.map((d) => aUsuario(d.id, d.data()))))
}

/** Todo el censo. Solo lo puede leer un admin (ver firestore.rules). */
export function escucharTodosLosUsuarios(alCambiar: (us: Usuario[]) => void) {
  const q = query(collection(db, COL), orderBy('nombre'))
  return onSnapshot(q, (snap) => alCambiar(snap.docs.map((d) => aUsuario(d.id, d.data()))))
}

export async function emailYaUsado(email: string): Promise<boolean> {
  const q = query(collection(db, COL), where('email', '==', email.trim().toLowerCase()))
  const snap = await getDocs(q)
  return !snap.empty
}

export interface AltaUsuario {
  nombre: string
  email: string
  clave: string
  rol: Rol
  equipos?: string[]
  dorsal?: string
  posicion?: string
  telefono?: string
}

/**
 * Da de alta una cuenta y devuelve su uid.
 *
 * Va por la instancia secundaria de Firebase (ver `authAlta`): crear un usuario
 * inicia sesión con él, y si eso pasara en la instancia normal el admin se
 * quedaría con la sesión del jugador que acaba de crear.
 *
 * Si Auth acepta la cuenta pero Firestore rechaza el perfil, la cuenta queda
 * huérfana: existe para entrar pero sin documento, así que las reglas no la
 * dejan hacer nada. El error se propaga para que el admin lo vea y pueda
 * volver a intentarlo con el mismo correo desde la consola de Firebase.
 */
export async function crearUsuario(datos: AltaUsuario, creadoPor: string): Promise<string> {
  const email = datos.email.trim().toLowerCase()
  const auth = authAlta()

  const cred = await createUserWithEmailAndPassword(auth, email, datos.clave)
  const uid = cred.user.uid

  try {
    // Para que en la consola de Firebase se vea el nombre y no solo el correo.
    await updateProfile(cred.user, { displayName: datos.nombre.trim() })
  } catch {
    /* cosmético: si falla, da igual */
  }

  try {
    await setDoc(docUsuario(uid), {
      nombre: datos.nombre.trim(),
      email,
      rol: datos.rol,
      equipos: datos.equipos ?? [],
      dorsal: datos.dorsal ?? '',
      posicion: datos.posicion ?? '',
      telefono: datos.telefono ?? '',
      activo: true,
      tokensPush: [],
      creadoEn: serverTimestamp(),
      creadoPor,
    })
  } finally {
    // Pase lo que pase, la sesión secundaria se cierra: si se quedara abierta,
    // la siguiente alta la haría el usuario recién creado y no el admin.
    await signOut(auth).catch(() => {})
  }

  return uid
}

export async function actualizarUsuario(uid: string, cambios: Partial<Usuario>) {
  await updateDoc(docUsuario(uid), cambios as Record<string, unknown>)
}

/** Baja: no se borra, se desactiva. Las reglas le cierran el acceso. */
export async function cambiarActivo(uid: string, activo: boolean) {
  await updateDoc(docUsuario(uid), { activo })
}

// --- tokens de notificación ---------------------------------------------

export async function guardarTokenPush(uid: string, token: string) {
  await updateDoc(docUsuario(uid), { tokensPush: arrayUnion(token) })
}

export async function olvidarTokenPush(uid: string, token: string) {
  await updateDoc(docUsuario(uid), { tokensPush: arrayRemove(token) })
}
