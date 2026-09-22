// ==========================================================================
// El resumen de un equipo, en su propia pantalla.
//
// Se abre desde la lista de equipos y lleva flecha de volver. Todo el trabajo
// está en `componentes/equipo/Resumen`, que es lo mismo que pinta la pestaña
// de Equipo cuando la persona solo tiene uno.
// ==========================================================================

import { useLocalSearchParams } from 'expo-router'

import { ResumenEquipo } from '../../../componentes/equipo/Resumen'

export default function PantallaEquipo() {
  const { equipoId } = useLocalSearchParams<{ equipoId: string }>()
  return <ResumenEquipo equipoId={equipoId ?? null} atras />
}
