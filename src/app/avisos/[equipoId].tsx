// ==========================================================================
// Los avisos de un equipo, en su propia pantalla.
//
// Se abre desde la bandeja de avisos, igual que una conversación se abre desde
// la bandeja de chats. Todo el trabajo está en `componentes/ListaAvisos`, que
// es lo mismo que pinta la pestaña cuando la persona solo tiene un equipo.
// ==========================================================================

import { useLocalSearchParams } from 'expo-router'

import { ListaAvisos } from '../../componentes/ListaAvisos'

export default function PantallaAvisosEquipo() {
  const { equipoId } = useLocalSearchParams<{ equipoId: string }>()
  return <ListaAvisos equipoId={equipoId ?? null} atras />
}
