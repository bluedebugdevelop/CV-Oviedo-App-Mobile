// ==========================================================================
// Las pestañas de abajo.
//
// Son cinco y las mismas para todo el mundo: Inicio, Equipo, Chat, Avisos y
// Mi perfil (que para un admin se llama Más). Lo que cambia según el rol no son las pestañas sino lo que hay dentro —
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

import { useAvisos } from '../../contexto/avisos'
import { useChats } from '../../contexto/chats'
import { useSesion } from '../../contexto/sesion'
import { esAdmin } from '../../lib/firebase/modelo'
import { color } from '../../tema'

/**
 * El globito rojo de la barra: cuántos mensajes o avisos hay sin leer.
 *
 * Lo llevan Chat y Avisos, y cuentan TODOS los equipos de la persona, no el
 * que se esté mirando (ver `contexto/chats` y `contexto/avisos`). Es la única
 * forma de enterarse de que hay algo nuevo en el otro equipo sin entrar a
 * mirarlo.
 *
 * Hasta 99, el número exacto; por encima, «99+». Antes cortaba en «9+», que en
 * un chat de equipo se alcanza en una conversación de media tarde y a partir
 * de ahí dejaba de decir nada: «9+» es lo mismo para diez mensajes que para
 * ciento veinte.
 *
 * El número cambia de ancho, así que el globo crece con él en vez de tener un
 * tamaño fijo: con `minWidth` y relleno a los lados, una cifra queda redonda y
 * tres quedan en cápsula, que es lo que hacen iOS y Android.
 */
function Globo({ n, que }: { n: number; que: string }) {
  if (n <= 0) return null
  return (
    <View
      style={e.globo}
      accessibilityRole="text"
      accessibilityLabel={`${n} ${que} sin leer`}
    >
      <Text style={e.globoTexto} numberOfLines={1}>
        {n > 99 ? '99+' : n}
      </Text>
    </View>
  )
}

function Barra() {
  const { noLeidos } = useAvisos()
  const { totalNoLeidos: mensajesNuevos } = useChats()
  const { perfil } = useSesion()
  const bordes = useSafeAreaInsets()
  // Para un jugador o un entrenador esa pestaña es su cuenta y poco más. Para
  // un admin es además la puerta a toda la administración, y ahí «Mi perfil»
  // se queda corto.
  const admin = perfil ? esAdmin(perfil) : false

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
          // El mismo globito que los avisos: ahora que la bandeja enseña todos
          // los equipos, la pestaña puede decir si hay algo nuevo en CUALQUIERA
          // de ellos sin tener que entrar a mirar.
          tabBarIcon: ({ color: c, size }) => (
            <View>
              <Ionicons name="chatbubbles" size={size} color={c} />
              <Globo n={mensajesNuevos} que="mensajes" />
            </View>
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
              <Globo n={noLeidos} que="avisos" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="mas"
        options={{
          title: admin ? 'Más' : 'Mi perfil',
          tabBarIcon: ({ color: c, size }) => (
            <Ionicons
              name={admin ? 'ellipsis-horizontal-circle' : 'person-circle'}
              size={size}
              color={c}
            />
          ),
        }}
      />
    </Tabs>
  )
}

// Los proveedores de avisos y chats ya no se montan aquí, sino en la raíz
// (`app/_layout.tsx`): las pantallas de conversación y de avisos de un equipo
// viven fuera de las pestañas y necesitan los mismos datos.
export default function DisposicionApp() {
  return <Barra />
}

const e = StyleSheet.create({
  globo: {
    position: 'absolute',
    top: -6,
    // Colgando del lado derecho del icono, no centrado sobre él.
    left: 12,
    minWidth: 19,
    height: 19,
    // La mitad del alto: con una cifra sale un círculo y con tres, una
    // cápsula. Un radio fijo dejaría las esquinas raras en el caso ancho.
    borderRadius: 9.5,
    paddingHorizontal: 5,
    backgroundColor: color.rojo,
    alignItems: 'center',
    justifyContent: 'center',
    // El aro blanco es lo que lo despega del icono de debajo; sin él, sobre un
    // icono oscuro el globo parece parte del dibujo.
    borderWidth: 2,
    borderColor: color.blanco,
  },
  globoTexto: {
    color: color.blanco,
    fontSize: 10.5,
    fontWeight: '800',
    // Sin esto, Android le reserva alto de línea de sobra y el número queda
    // descentrado hacia abajo dentro del círculo.
    lineHeight: 13,
  },
})
