// ==========================================================================
// La bandeja de chats: el último mensaje de cada equipo y cuántos van sin leer.
//
// Antes el chat miraba solo al equipo activo y se cambiaba de uno a otro con
// un selector arriba. Eso obligaba a entrar y salir para saber si había algo
// nuevo en el otro equipo, que es justo lo que una app de mensajería resuelve
// enseñando todas las conversaciones juntas.
//
// Así que esto escucha los chats de TODOS los equipos de la persona a la vez,
// y de cada uno se queda con dos cosas: el último mensaje (la vista previa) y
// cuántos hay sin leer (el globito).
//
// EL COSTE, QUE AQUÍ SÍ IMPORTA
// Es un listener por equipo, no uno para todo: en Firestore los mensajes
// cuelgan de su equipo (ver modelo.ts) y no hay forma de consultar varias
// subcolecciones de golpe sin abrir un `collectionGroup`, que se llevaría por
// delante el modelo de seguridad —una consulta así tendría que poder leer los
// mensajes de todo el club—. Con dos o tres equipos por persona, que es lo
// normal, son dos o tres suscripciones a los últimos TOPE mensajes. Poco.
//
// LOS NO LEÍDOS
// Salen de comparar la hora de cada mensaje con `lecturasChat[equipoId]` de la
// ficha propia, que ya viene en la sesión. Cero lecturas de más.
//
// Se cuenta sobre la ventana de los últimos TOPE mensajes, así que a partir de
// ahí el globito dice «+». Es lo mismo que hace cualquier app de mensajería y
// evita tener que contar el histórico entero para pintar un número que, pasado
// de veinte, ya nadie lee como cantidad exacta.
//
// EL PRIMER DÍA
// Un equipo sin marca de lectura no se cuenta entero como no leído: se le pone
// la marca AHORA y se empieza a contar desde aquí.
//
// Sin eso, el día que se publica esta versión todo el club abre la app y se
// encuentra un «30+» rojo en un chat que llevaba leído semanas —antes de esto
// no se guardaba ninguna marca, así que no había nada que pudiera estar sin
// leer de verdad—. Y a quien entra nuevo en un equipo le pasaría lo mismo con
// una conversación en la que aún no ha dicho nada.
// ==========================================================================

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { aDate } from '../lib/fechas'
import { escucharMensajes } from '../lib/firebase/chat'
import type { Mensaje } from '../lib/firebase/modelo'
import { marcarChatLeido } from '../lib/firebase/usuarios'
import { useSesion } from './sesion'

/** Los que se traen de cada equipo para la lista. Ver el bloque de arriba. */
const TOPE_VISTA = 30

export interface ResumenChat {
  equipoId: string
  /** El último mensaje, para la vista previa. `null` si el chat está vacío. */
  ultimo: Mensaje | null
  /** Cuántos sin leer dentro de la ventana. */
  noLeidos: number
  /** `true` si se llegó al tope contando: el globito pinta «30+». */
  desbordado: boolean
}

interface Estado {
  /** Por id de equipo. Un equipo sin entrada todavía no ha cargado. */
  porEquipo: Record<string, ResumenChat>
  /** La suma de todos, para el globito de la pestaña. */
  totalNoLeidos: number
  cargando: boolean
}

const VACIO: Estado = { porEquipo: {}, totalNoLeidos: 0, cargando: true }

const Contexto = createContext<Estado>(VACIO)

export function ProveedorChats({ children }: { children: ReactNode }) {
  const { equipos, perfil } = useSesion()

  /* Los mensajes crudos van JUNTO CON la lista de equipos de la que son.

     Al cambiar de equipos, lo guardado deja de valer al instante porque la
     firma ya no coincide, y eso se decide al pintar. Vaciarlo desde el efecto
     —que es lo primero que se intentó— daba un render con los chats de equipos
     en los que la persona ya no está, y además es una cascada de renders que
     el linter marca con razón. */
  const [recibido, setRecibido] = useState<{ firma: string; datos: Record<string, Mensaje[]> }>({
    firma: '',
    datos: {},
  })

  /* Equipos a los que ya se les ha puesto la primera marca en esta sesión.

     El `perfil` tarda un momento en traer de vuelta lo que se acaba de
     escribir, y sin esto se mandaría la misma escritura en cada render de ese
     rato. Es un ref y no estado porque no pinta nada. */
  const estrenados = useRef(new Set<string>())

  const ids = useMemo(
    () => equipos.filter((eq) => !eq.archivado).map((eq) => eq.id),
    [equipos],
  )
  // Una cadena estable como dependencia: el array es nuevo en cada render de
  // la sesión y volvería a suscribirlo todo sin que haya cambiado nada.
  const firmaIds = ids.join(',')

  useEffect(() => {
    const listaIds = firmaIds ? firmaIds.split(',') : []
    if (listaIds.length === 0) return

    const cortes = listaIds.map((id) =>
      escucharMensajes(
        id,
        (lista) =>
          setRecibido((antes) => ({
            firma: firmaIds,
            // Lo de una lista de equipos anterior se descarta aquí: si la
            // firma cambió, se empieza de cero en vez de arrastrar chats
            // ajenos.
            datos: { ...(antes.firma === firmaIds ? antes.datos : {}), [id]: lista },
          })),
        TOPE_VISTA,
      ),
    )
    return () => cortes.forEach((corta) => corta())
  }, [firmaIds])

  const valor = useMemo<Estado>(() => {
    // Lo guardado solo vale si es de los equipos que hay ahora.
    const crudos = recibido.firma === firmaIds ? recibido.datos : {}

    const porEquipo: Record<string, ResumenChat> = {}
    let total = 0

    for (const id of ids) {
      const mensajes = crudos[id]
      if (!mensajes) continue

      const desde = aDate(perfil?.lecturasChat?.[id])

      /* Un mensaje cuenta como nuevo si llegó después de la última vez que se
         abrió el chat y no lo escribió quien mira.

         Sin marca de lectura no cuenta NINGUNO —ver «EL PRIMER DÍA» arriba—:
         ese equipo está a punto de estrenarla y contarlos mientras tanto
         enseñaría el «30+» rojo justo el rato que se quiere evitar.

         Los que todavía no tienen hora del servidor (`aDate` → null) son los
         que acaban de salir de este mismo móvil: no son novedad para nadie. */
      const nuevos = !desde
        ? []
        : mensajes.filter((m) => {
            if (m.autor === perfil?.uid) return false
            const cuando = aDate(m.creadoEn)
            if (!cuando) return false
            return cuando > desde
          })

      porEquipo[id] = {
        equipoId: id,
        ultimo: mensajes[0] ?? null,
        noLeidos: nuevos.length,
        desbordado: nuevos.length >= TOPE_VISTA,
      }
      total += nuevos.length
    }

    return {
      porEquipo,
      totalNoLeidos: total,
      // Cargando mientras falte algún equipo por dar su primera respuesta.
      cargando: ids.some((id) => !crudos[id]),
    }
  }, [ids, firmaIds, recibido, perfil])

  /* La primera marca de lectura de cada equipo: ver «EL PRIMER DÍA» arriba.

     Todo esto vive en el efecto, incluida la decisión de a quién le falta. Es
     donde tiene que estar: leer el ref mientras se calcula lo que se pinta está
     prohibido —un render no puede depender de algo que cambia por fuera de
     React— y escribir en Firestore al pintar dispararía una escritura por
     render durante el rato que el perfil tarda en volver con el dato puesto. */
  /* `uid` y `lecturas` sueltos, no el `perfil` entero.

     Este efecto ESCRIBE en la ficha propia, y la ficha se escucha: con
     `perfil` en las dependencias, cada escritura lo devolvía como objeto nuevo
     y volvía a disparar el efecto. El `estrenados` cortaba el bucle de
     escrituras, pero no el de renders. */
  const uid = perfil?.uid ?? null
  const lecturas = perfil?.lecturasChat

  useEffect(() => {
    if (!uid) return
    const crudos = recibido.firma === firmaIds ? recibido.datos : {}

    for (const id of ids) {
      // Solo con el chat ya cargado: sin haber visto los mensajes no se sabe
      // si hay algo que marcar, y la marca es irreversible.
      if (!crudos[id]) continue
      if (lecturas?.[id]) continue
      if (estrenados.current.has(id)) continue

      estrenados.current.add(id)
      void marcarChatLeido(uid, id).catch(() => {
        // Si no se pudo, se reintenta en el siguiente arranque. Lo peor que
        // pasa es que el globito tarde en encenderse.
        estrenados.current.delete(id)
      })
    }
  }, [uid, lecturas, ids, firmaIds, recibido])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useChats = () => useContext(Contexto)
