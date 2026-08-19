// ==========================================================================
// Los avisos del equipo activo, escuchados una sola vez.
//
// Los necesitan dos sitios a la vez: la pestaña, para el globito de no leídos,
// y la pantalla de avisos, para la lista. Con un listener en cada uno serían
// dos suscripciones a Firestore por el mismo dato, y el contador podría ir un
// instante por detrás de la lista.
//
// También pone el número en el icono de la app. Se hace aquí porque es el
// único punto que sabe cuántos avisos hay sin leer en cada momento.
// ==========================================================================

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { escucharAvisos, sinLeer } from '../lib/firebase/avisos'
import type { Aviso } from '../lib/firebase/modelo'
import { ponerContador } from '../lib/push'
import { useSesion } from './sesion'

interface Estado {
  avisos: Aviso[]
  noLeidos: number
  cargando: boolean
}

const Contexto = createContext<Estado>({ avisos: [], noLeidos: 0, cargando: true })

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const { equipoActivo, perfil } = useSesion()

  /* Lo recibido va junto con el equipo al que pertenece.

     Al cambiar de equipo, lo de antes deja de valer al instante porque la
     clave ya no coincide. Vaciarlo desde un efecto daría un render con los
     avisos del equipo anterior todavía puestos —y con su contador rojo—
     antes de limpiarse. */
  const [recibido, setRecibido] = useState<{ equipoId: string | null; lista: Aviso[] }>({
    equipoId: null,
    lista: [],
  })

  useEffect(() => {
    if (!equipoActivo) return
    const id = equipoActivo.id
    return escucharAvisos(id, (lista) => setRecibido({ equipoId: id, lista }))
  }, [equipoActivo])

  const alDia = recibido.equipoId === (equipoActivo?.id ?? null)
  // Con useMemo para que la lista vacía no sea un array nuevo en cada render:
  // si lo fuera, arrastraría a recalcular el contador de no leídos sin parar.
  const avisos = useMemo(() => (alDia ? recibido.lista : []), [alDia, recibido.lista])
  const cargando = Boolean(equipoActivo) && !alDia

  const noLeidos = useMemo(
    () => (perfil ? sinLeer(avisos, perfil.uid) : 0),
    [avisos, perfil],
  )

  useEffect(() => {
    void ponerContador(noLeidos)
  }, [noLeidos])

  const valor = useMemo(() => ({ avisos, noLeidos, cargando }), [avisos, noLeidos, cargando])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useAvisos = () => useContext(Contexto)
