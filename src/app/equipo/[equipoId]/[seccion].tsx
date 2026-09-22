// ==========================================================================
// Una sección del equipo, a pantalla completa.
//
// Las cuatro comparten pantalla porque comparten todo lo demás: la misma
// cabecera, los mismos datos y la misma forma de volver. Cuatro ficheros casi
// iguales habrían sido cuatro sitios donde arreglar lo mismo.
//
// A pantalla completa y no en pestañas: la tabla de clasificación tiene doce
// filas y cinco columnas, y antes competía por el alto con un selector que
// estaba puesto siempre.
// ==========================================================================

import { useLocalSearchParams } from 'expo-router'

import { Pantalla } from '../../../componentes/Pantalla'
import { useDatosEquipo } from '../../../componentes/equipo/datos'
import {
  Clasificacion,
  Horario,
  Partidos,
  Plantilla,
} from '../../../componentes/equipo/secciones'
import { Vacio } from '../../../componentes/ui'
import { mandaAqui, useSesion } from '../../../contexto/sesion'

/** El nombre que va en la cabecera, entero y sin cortar. */
const TITULOS = {
  partidos: 'Partidos',
  clasificacion: 'Clasificación',
  horarios: 'Horarios',
  plantilla: 'Plantilla',
} as const

type Seccion = keyof typeof TITULOS

const esSeccion = (v: string): v is Seccion => v in TITULOS

export default function SeccionEquipo() {
  const { equipoId, seccion } = useLocalSearchParams<{ equipoId: string; seccion: string }>()
  const sesion = useSesion()
  const datos = useDatosEquipo(equipoId)
  const { equipo } = datos

  const cual: Seccion = seccion && esSeccion(seccion) ? seccion : 'partidos'

  if (!equipo) {
    return (
      <Pantalla titulo={TITULOS[cual]} atras>
        <Vacio
          icono="people-outline"
          titulo="Este equipo ya no es tuyo"
          texto="O se ha archivado al acabar la temporada, o el club te ha sacado de él."
        />
      </Pantalla>
    )
  }

  return (
    <Pantalla ante={equipo.nombre} titulo={TITULOS[cual]} atras>
      {cual === 'partidos' ? (
        <Partidos equipo={equipo} competicion={datos.competicion} eventos={datos.eventos} />
      ) : cual === 'clasificacion' ? (
        <Clasificacion equipo={equipo} competicion={datos.competicion} />
      ) : cual === 'horarios' ? (
        <Horario
          equipo={equipo}
          entrenamientos={datos.entrenamientos}
          eventos={datos.eventos}
          mando={mandaAqui(sesion, equipo)}
        />
      ) : (
        <Plantilla gente={datos.plantilla} equipo={equipo} />
      )}
    </Pantalla>
  )
}
