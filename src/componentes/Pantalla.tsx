// ==========================================================================
// El marco de todas las pantallas.
//
// Las cabeceras las pinta esto y no el Stack de expo-router (que va con
// `headerShown: false`). Es más código, pero el club tiene una tipografía y un
// azul propios, y las cabeceras nativas se ven distintas en iOS y en Android
// justo en lo que se quiere que sea igual: el título.
//
// De la barra de estado y del notch se encarga `useSafeAreaInsets`. Se aplica
// a mano en vez de con `<SafeAreaView>` porque las listas tienen que poder
// pintar por debajo del borde mientras se hace scroll, y solo el contenido
// lleva el margen.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { color, espacio, radio } from '../tema'

interface Props {
  titulo: string
  /** Antetítulo pequeño encima del título. */
  ante?: string
  children: ReactNode
  /** Flecha de volver. Se pone sola en todo lo que no sea una pestaña. */
  atras?: boolean
  /** Botón a la derecha de la cabecera. */
  accion?: { icono: keyof typeof Ionicons.glyphMap; alPulsar: () => void; etiqueta: string }
  /** `false` para las pantallas que llevan su propia lista (chat, tablas). */
  scroll?: boolean
  refrescando?: boolean
  alRefrescar?: () => void
  /** Deja el contenido pegado a los bordes: para listas de ancho completo. */
  sinMargen?: boolean
}

export function Pantalla({
  titulo,
  ante,
  children,
  atras = false,
  accion,
  scroll = true,
  refrescando,
  alRefrescar,
  sinMargen = false,
}: Props) {
  const bordes = useSafeAreaInsets()

  /* ¿Estamos en una de las cinco pestañas?

     Importa para el hueco de abajo: en una pestaña, la barra de navegación ya
     ocupa el borde seguro, y volver a reservarlo dejaba un vacío enorme entre
     el contenido y la barra. Fuera de las pestañas —administración, horarios,
     una noticia— no hay barra y el inset sí hace falta, o el último botón cae
     bajo la barra de gestos del móvil.

     Se mira el segmento de la ruta, que es API pública de expo-router, en vez
     del contexto interno de React Navigation. */
  const enPestanas = useSegments()[0] === '(app)'

  const cabecera = (
    <View style={[e.cabecera, { paddingTop: bordes.top + espacio.md }]}>
      <View style={e.cabeceraFila}>
        {atras ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={12}
            style={e.iconoCabecera}
          >
            <Ionicons name="chevron-back" size={22} color={color.tinta} />
          </Pressable>
        ) : null}

        <View style={{ flex: 1 }}>
          {ante ? <Text style={e.ante}>{ante}</Text> : null}
          <Text style={e.titulo} numberOfLines={2}>
            {titulo}
          </Text>
        </View>

        {accion ? (
          <Pressable
            onPress={accion.alPulsar}
            accessibilityRole="button"
            accessibilityLabel={accion.etiqueta}
            hitSlop={12}
            style={e.iconoCabecera}
          >
            <Ionicons name={accion.icono} size={21} color={color.azul} />
          </Pressable>
        ) : null}

        {/* El escudo, a la derecha del todo.

            Es lo que hace que cualquier pantalla se lea como «del club» sin
            tener que repetir el nombre. Va después de la acción para que el
            botón quede siempre en el mismo sitio, se pinte el escudo o no.

            Decorativo a efectos de accesibilidad: quien usa un lector de
            pantalla ya sabe en qué app está, y anunciarlo en cada pantalla
            sería ruido. */}
        <Image
          source={require('../../assets/icono/splash.png')}
          style={e.escudo}
          contentFit="contain"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
    </View>
  )

  /* El hueco de abajo, justo el que hace falta.

     Antes se sumaba el inset SIEMPRE, también en las pestañas, donde la
     barra de navegación ya lo ocupa. Eso dejaba casi 80 px de vacío entre el
     último elemento y la barra: se veía raro en todas las vistas.

     Ahora: en pestañas basta un respiro, y fuera de ellas se reserva el
     borde seguro porque no hay nada debajo que lo cubra. */
  const relleno = {
    padding: sinMargen ? 0 : espacio.lg,
    paddingBottom: enPestanas ? espacio.lg : espacio.lg + bordes.bottom,
  }

  return (
    <View style={e.raiz}>
      <StatusBar style="dark" />
      {cabecera}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        /* 'padding' también en Android, y no `undefined`.

           Se puso `undefined` dando por hecho que Android ya aparta la vista
           él solo con `adjustResize`. Con el modo edge-to-edge del SDK 57 eso
           dejó de ser verdad: la ventana NO encoge al abrirse el teclado (se
           comprueba con `adb shell dumpsys window displays`, donde `app=` no
           cambia), así que el teclado se pinta encima y el ScrollView ni se
           entera de que tiene menos sitio.

           Como la ventana no encoge, aquí no hay doble compensación: el
           relleno que mete este componente es el único que se aplica. */
        behavior="padding"
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={relleno}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              alRefrescar ? (
                <RefreshControl
                  refreshing={Boolean(refrescando)}
                  onRefresh={alRefrescar}
                  tintColor={color.azul}
                  colors={[color.azul]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </View>
  )
}

const e = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: color.fondo },
  cabecera: {
    backgroundColor: color.blanco,
    paddingHorizontal: espacio.lg,
    paddingBottom: espacio.md,
    borderBottomWidth: 1,
    borderBottomColor: color.linea,
  },
  cabeceraFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  escudo: { width: 36, height: 36, marginLeft: espacio.xs },
  iconoCabecera: {
    width: 38,
    height: 38,
    borderRadius: radio.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.tinte,
  },
  ante: {
    fontSize: 11,
    fontWeight: '700',
    color: color.azul,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  titulo: { fontSize: 24, fontWeight: '800', color: color.tinta, letterSpacing: -0.5 },
})
