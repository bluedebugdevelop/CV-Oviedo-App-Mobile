// ==========================================================================
// Las pestañas de abajo.
//
// Son cinco y las mismas para todo el mundo: Inicio, Equipo, Chat, Avisos y
// Más. Lo que cambia según el rol no son las pestañas sino lo que hay dentro —
// un entrenador ve el botón de crear aviso donde un jugador ve la lista, y las
// pantallas de administración cuelgan de «Más».
//
// Se decidió así en vez de tener una barra distinta por rol porque los tres
// roles usan lo mismo el 90% del tiempo, y porque un entrenador también es
// alguien que quiere mirar el calendario de su equipo.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ProveedorAvisos, useAvisos } from '../../contexto/avisos'
import { color } from '../../tema'

/** El globito rojo con el número de avisos sin leer. */
function Globo({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <View style={e.globo}>
      <Text style={e.globoTexto}>{n > 9 ? '9+' : n}</Text>
    </View>
  )
}

function Barra() {
  const { noLeidos } = useAvisos()
  const bordes = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.azul,
        tabBarInactiveTintColor: color.apagado,
        tabBarStyle: {
          backgroundColor: color.blanco,
          borderTopColor: color.linea,
          /* La altura se calcula, no se fija.

             Antes había un `height: 64` a pelo en Android, y ese era el bug:
             la barra de gestos del móvil se pintaba ENCIMA de las pestañas, así
             que la fila de iconos quedaba medio tapada y «Más» era casi
             impulsable. Con el modo edge-to-edge del SDK 57 el sistema dibuja
             sobre la app, y hay que reservarle el hueco a mano.

             Se ponen las dos cosas —alto y relleno— porque al declarar
             `tabBarStyle` se pisa lo que calcula React Navigation: o se controla
             todo, o se deja todo. */
          height: 58 + bordes.bottom,
          paddingBottom: bordes.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color: c, size }) => <Ionicons name="home" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="equipo"
        options={{
          title: 'Equipo',
          tabBarIcon: ({ color: c, size }) => <Ionicons name="trophy" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color: c, size }) => (
            <Ionicons name="chatbubbles" size={size} color={c} />
          ),
        }}
      />
      <Tabs.Screen
        name="avisos"
        options={{
          title: 'Avisos',
          tabBarIcon: ({ color: c, size }) => (
            <View>
              <Ionicons name="notifications" size={size} color={c} />
              <Globo n={noLeidos} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="mas"
        options={{
          title: 'Más',
          tabBarIcon: ({ color: c, size }) => (
            <Ionicons name="ellipsis-horizontal-circle" size={size} color={c} />
          ),
        }}
      />
    </Tabs>
  )
}

export default function DisposicionApp() {
  return (
    <ProveedorAvisos>
      <Barra />
    </ProveedorAvisos>
  )
}

const e = StyleSheet.create({
  globo: {
    position: 'absolute',
    top: -4,
    right: -9,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: color.rojo,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: color.blanco,
  },
  globoTexto: { color: color.blanco, fontSize: 10, fontWeight: '800' },
})
