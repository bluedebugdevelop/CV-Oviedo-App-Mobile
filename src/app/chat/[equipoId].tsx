// ==========================================================================
// La conversación de un equipo, en su propia pantalla.
//
// Se abre desde la bandeja de chats y no lleva barra de pestañas: el chat
// ocupa la pantalla entera y se vuelve con la flecha, como en cualquier app de
// mensajería.
//
// Todo el trabajo está en `componentes/Conversacion`, que es lo mismo que pinta
// la pestaña de Chat cuando la persona solo tiene un equipo.
// ==========================================================================

import { useLocalSearchParams } from 'expo-router'

import { Conversacion } from '../../componentes/Conversacion'

export default function PantallaConversacion() {
  const { equipoId } = useLocalSearchParams<{ equipoId: string }>()
  return <Conversacion equipoId={equipoId ?? null} atras />
}
