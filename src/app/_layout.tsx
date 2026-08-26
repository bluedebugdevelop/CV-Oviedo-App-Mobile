// ==========================================================================
// La raíz de la app: providers, control de acceso y pantalla de arranque.
//
// EL PORTERO
// Cada vez que cambia la sesión se comprueba en qué parte del árbol está el
// usuario y se le manda donde toca: sin sesión, a `entrar`; con sesión, dentro.
// Se hace con `router.replace` y no con `push` para que el botón de volver de
// Android no devuelva a la pantalla de login estando ya dentro.
//
// LA PANTALLA DE ARRANQUE
// Se mantiene visible hasta que se sabe si hay sesión. Sin esto, al abrir la
// app aparecería el login medio segundo y desaparecería solo, que es lo que
// hace pensar que la app «se ha cerrado sola».
// ==========================================================================

import { Stack, router, useRootNavigationState, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { ProveedorSesion, useSesion } from '../contexto/sesion'
/* Solo por el efecto de importarlo: dentro llama a `defineTask`.

   Va aquí, en la raíz, y no en una pantalla. El sistema puede arrancar el
   proceso SIN abrir ninguna pantalla —precisamente para ejecutar la tarea— y
   para entonces la tarea ya tiene que estar definida. Desde una pantalla
   existiría solo mientras alguien la tuviera delante, que es justo cuando no
   hace falta. */
import '../tareas/calendario'
import { color } from '../tema'

void SplashScreen.preventAutoHideAsync()

function Portero() {
  const { estado } = useSesion()
  const segmentos = useSegments()
  // El router no está listo en el primer render; navegar antes no hace nada y
  // deja la app en la ruta de partida.
  const navegacionLista = useRootNavigationState()?.key

  useEffect(() => {
    if (!navegacionLista || estado === 'arrancando') return

    void SplashScreen.hideAsync()

    const enLogin = segmentos[0] === 'entrar'

    if (estado === 'fuera' && !enLogin) router.replace('/entrar')
    if (estado === 'dentro' && enLogin) router.replace('/')
  }, [estado, segmentos, navegacionLista])

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="entrar" options={{ animation: 'fade' }} />
      <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
    </Stack>
  )
}

export default function Raiz() {
  return (
    <GestureHandlerRootView style={e.raiz}>
      <SafeAreaProvider>
        <View style={e.raiz}>
          <ProveedorSesion>
            <Portero />
          </ProveedorSesion>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const e = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: color.fondo },
})
