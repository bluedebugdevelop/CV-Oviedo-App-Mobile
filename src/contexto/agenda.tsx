// ==========================================================================
// La agenda: los horarios y las citas de TODOS los equipos de la persona.
//
// Existe por el planning semanal de Inicio, que necesita a la vez lo de cada
// equipo. Antes cada pantalla escuchaba lo del equipo activo y punto; quien
// dobla categoría no tenía ningún sitio donde ver su semana entera.
//
// Va en un contexto y no en un hook suelto porque lo piden dos sitios a la vez
// —Inicio y, de rebote, quien quiera saber qué toca hoy— y son dos listeners
// por equipo: montarlos dos veces sería pagar el doble por el mismo dato.
//
// Los partidos NO se escuchan: se piden. Vienen de la web del club por HTTP
// (ver `lib/hooks`), y un calendario de federación cambia como mucho una vez
// por semana. Tenerlo en vivo no aportaría nada y sería una conexión abierta
// para nada.
// ==========================================================================

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { useCompeticiones } from '../lib/hooks'
import { escucharEntrenamientos, escucharEventos } from '../lib/firebase/entrenamientos'
import type { Entrenamiento, Evento } from '../lib/firebase/modelo'
import { construirSemana, lunesDe, type DiaSemana, type FuenteEquipo } from '../lib/semana'
import { useSesion } from './sesion'

interface Estado {
  /** La semana que empieza en ese lunes, con sus siete días. */
  semanaDe: (lunes: Date) => DiaSemana[]
  cargando: boolean
  recargar: () => void
}

const Contexto = createContext<Estado>({
  semanaDe: () => [],
  cargando: true,
  recargar: () => {},
})

export function ProveedorAgenda({ children }: { children: ReactNode }) {
  const { equipos } = useSesion()

  /* Lo de Firestore va JUNTO CON la lista de equipos de la que es: misma
     razón y mismo patrón que en `contexto/chats` y `contexto/avisos`. */
  const [horarios, setHorarios] = useState<{
    firma: string
    entrenamientos: Record<string, Entrenamiento[]>
    eventos: Record<string, Evento[]>
  }>({ firma: '', entrenamientos: {}, eventos: {} })

  const activos = useMemo(() => equipos.filter((eq) => !eq.archivado), [equipos])
  // Ver el mismo truco en `contexto/chats`: una firma estable, porque el array
  // de equipos es nuevo en cada render de la sesión.
  const firmaIds = activos.map((eq) => eq.id).join(',')

  useEffect(() => {
    const ids = firmaIds ? firmaIds.split(',') : []
    if (ids.length === 0) return

    /** Mete lo que llega sin arrastrar lo de una lista de equipos anterior. */
    const guardar = (
      campo: 'entrenamientos' | 'eventos',
      id: string,
      lista: Entrenamiento[] | Evento[],
    ) =>
      setHorarios((antes) => {
        const vigente = antes.firma === firmaIds
        return {
          firma: firmaIds,
          entrenamientos: vigente ? antes.entrenamientos : {},
          eventos: vigente ? antes.eventos : {},
          [campo]: { ...(vigente ? antes[campo] : {}), [id]: lista },
        } as typeof antes
      })

    const cortes = ids.flatMap((id) => [
      escucharEntrenamientos(id, (lista) => guardar('entrenamientos', id, lista)),
      escucharEventos(id, (lista) => guardar('eventos', id, lista)),
    ])
    return () => cortes.forEach((corta) => corta())
  }, [firmaIds])

  /* Lo guardado solo vale si es de los equipos que hay ahora.

     Con `useMemo` y no con un ternario suelto: el `{}` del caso «no vale»
     sería un objeto nuevo en cada render y arrastraría a recalcular la semana
     entera sin que haya cambiado nada. */
  const alDia = horarios.firma === firmaIds
  const entrenamientos = useMemo(
    () => (alDia ? horarios.entrenamientos : {}),
    [alDia, horarios.entrenamientos],
  )
  const eventos = useMemo(
    () => (alDia ? horarios.eventos : {}),
    [alDia, horarios.eventos],
  )

  const claves = useMemo(
    () => activos.map((eq) => eq.claveCompeticion).filter((c): c is string => Boolean(c)),
    [activos],
  )
  const competiciones = useCompeticiones(claves)

  const fuentes = useMemo<FuenteEquipo[]>(
    () =>
      activos.map((eq) => ({
        id: eq.id,
        nombre: eq.nombre,
        claveCompeticion: eq.claveCompeticion,
        entrenamientos: entrenamientos[eq.id] ?? [],
        eventos: eventos[eq.id] ?? [],
      })),
    [activos, entrenamientos, eventos],
  )

  const valor = useMemo<Estado>(
    () => ({
      /* Se monta al vuelo, sin caché.

         Se llegó a guardar la última semana calculada, pero era optimizar lo
         que no cuesta: son unas decenas de entrenamientos y un par de
         calendarios, y recorrerlos es más barato que el render que lo pide.
         La caché, además, obligaba a mutar variables entre renders, que es
         justo lo que no hay que hacer dentro de un componente. */
      semanaDe: (lunes: Date) =>
        construirSemana(lunesDe(lunes), fuentes, competiciones.porClave),
      // Solo cuenta como «cargando» lo que falta por llegar de Firestore: los
      // partidos pueden tardar más y el horario de la semana ya se puede
      // pintar sin ellos.
      cargando: activos.some((eq) => !entrenamientos[eq.id]),
      recargar: competiciones.recargar,
    }),
    [fuentes, competiciones.porClave, competiciones.recargar, activos, entrenamientos],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useAgenda = () => useContext(Contexto)
