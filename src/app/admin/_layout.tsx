// ==========================================================================
// La zona de administración.
//
// El portero de aquí devuelve a Inicio a quien no sea admin. Es comodidad, no
// seguridad: quien de verdad manda es firestore.rules, que rechaza escribir un
// equipo o leer el censo de usuarios sin el rol puesto. Si esto fuera lo único,
// bastaría con trastear la app para saltárselo.
//
// Mientras se sabe el rol no se redirige nada. En el primer render el perfil
// todavía no ha llegado de Firestore, y echar a alguien por eso sería echar a
// todo el mundo, admins incluidos.
// ==========================================================================

import { Redirect, Stack } from 'expo-router'

import { Cargando } from '../../componentes/ui'
import { useSesion } from '../../contexto/sesion'
import { ProveedorPanel } from '../../contexto/panel'

export default function DisposicionAdmin() {
  const { perfil, estado } = useSesion()

  if (estado === 'arrancando' || (estado === 'dentro' && !perfil)) {
    return <Cargando />
  }

  if (perfil?.rol !== 'admin') return <Redirect href="/" />

  return (
    <ProveedorPanel>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </ProveedorPanel>
  )
}
