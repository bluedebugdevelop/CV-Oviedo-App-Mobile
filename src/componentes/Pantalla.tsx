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
import { router } from 'expo-router'
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
      </View>
    </View>
  )

  /* El hueco de abajo tiene que dejar sitio a la barra de gestos.

     Sin esto, en cualquier pantalla que no sea una pestaña —administración,
     horarios, una noticia— el último botón queda debajo de la barra del
     sistema y no se puede pulsar.

     En las pestañas el inset ya lo consume la barra de abajo, así que aquí
     sobra: son unos 24 px de scroll de más al final, que no molestan. Se
     prefiere eso a leer el contexto interno de expo-router para distinguir
     los dos casos. */
  const relleno = {
    padding: sinMargen ? 0 : espacio.lg,
    paddingBottom: espacio.xxl + bordes.bottom,
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
