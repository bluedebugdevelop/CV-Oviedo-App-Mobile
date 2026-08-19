// ==========================================================================
// Elegir una foto del móvil y subirla a la web.
//
// Lo usan las cuatro pantallas del panel: noticias, patrocinadores, equipos y
// las fotos de sección. Todas hacen lo mismo —abrir la galería, subir, guardar
// la ruta que devuelve el servidor— así que está una vez.
//
// Se pide permiso SOLO al tocar el botón, nunca al abrir la pantalla. Es lo
// que esperan las dos tiendas y lo que tiene sentido: el sistema pregunta
// cuando la persona acaba de decir que quiere elegir una foto, no antes.
//
// El recorte va activado (`allowsEditing`) porque las fotos de la web tienen
// encuadres concretos —una cabecera apaisada, un logo cuadrado— y es más fácil
// recortar aquí que descubrir en la web que la foto sale con medio balón.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import { urlWeb } from '../lib/config'
import { color, espacio, radio } from '../tema'

/** Los que acepta `api/_almacen.js`. Si allí cambian, aquí también. */
const ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const TAMANO_MAXIMO = 4 * 1024 * 1024

export function CampoImagen({
  etiqueta,
  ayuda,
  ruta,
  proporcion = [16, 9],
  subir,
  alCambiar,
}: {
  etiqueta: string
  ayuda?: string
  /** La ruta que ya tiene guardada ('/subidas/…' o '/media/…'), si tiene. */
  ruta: string
  /** Relación de aspecto del recorte. */
  proporcion?: [number, number]
  subir: (uri: string, tipo: string, nombre: string) => Promise<string>
  alCambiar: (ruta: string) => void
}) {
  const [subiendo, setSubiendo] = useState(false)
  const vistaPrevia = urlWeb(ruta)

  async function elegir() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permiso.granted) {
      Alert.alert(
        'Sin acceso a las fotos',
        'Para subir una imagen hay que dar permiso a la galería desde los ajustes del móvil.',
      )
      return
    }

    const eleccion = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: proporcion,
      // 0.85 y no 1: una foto de móvil sin comprimir se pasa de los 4 MB que
      // admite el servidor, y a este tamaño la diferencia no se ve en la web.
      quality: 0.85,
    })
    if (eleccion.canceled) return

    const foto = eleccion.assets[0]
    const tipo = normalizaTipo(foto.mimeType, foto.uri)

    if (!ACEPTADOS.includes(tipo)) {
      Alert.alert('Formato no admitido', 'Usa JPG, PNG, WebP o AVIF.')
      return
    }
    if (foto.fileSize && foto.fileSize > TAMANO_MAXIMO) {
      Alert.alert('Imagen demasiado grande', 'El máximo son 4 MB. Prueba a recortarla más.')
      return
    }

    setSubiendo(true)
    try {
      const nueva = await subir(foto.uri, tipo, foto.fileName ?? 'imagen.jpg')
      alCambiar(nueva)
    } catch (err: any) {
      Alert.alert('No se pudo subir', err?.message ?? 'Inténtalo de nuevo.')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <View style={e.marco}>
      <Text style={e.etiqueta}>{etiqueta}</Text>

      <Pressable
        onPress={subiendo ? undefined : elegir}
        accessibilityRole="button"
        accessibilityLabel={`Cambiar ${etiqueta}`}
        style={({ pressed }) => [e.hueco, pressed && !subiendo ? { opacity: 0.7 } : null]}
      >
        {vistaPrevia ? (
          <Image source={{ uri: vistaPrevia }} style={e.foto} contentFit="cover" transition={150} />
        ) : (
          <View style={e.vacio}>
            <Ionicons name="image-outline" size={26} color={color.linea} />
            <Text style={e.vacioTexto}>Elegir imagen</Text>
          </View>
        )}

        {subiendo ? (
          <View style={e.velo}>
            <ActivityIndicator color={color.blanco} />
            <Text style={e.veloTexto}>Subiendo…</Text>
          </View>
        ) : null}
      </Pressable>

      <View style={e.pie}>
        {ayuda ? <Text style={e.ayuda}>{ayuda}</Text> : <View />}
        {ruta ? (
          <Pressable onPress={() => alCambiar('')} hitSlop={8} accessibilityRole="button">
            <Text style={e.quitar}>Quitar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

/**
 * El tipo real de la imagen.
 *
 * `mimeType` no siempre viene —en Android depende de la app de galería— así
 * que se cae a mirar la extensión. Sin esto, el servidor rechaza la subida por
 * `Content-Type` vacío y el mensaje que se ve es «formato no admitido» para
 * un JPG perfectamente válido.
 */
function normalizaTipo(mime: string | undefined, uri: string): string {
  if (mime && ACEPTADOS.includes(mime)) return mime
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'avif':
      return 'image/avif'
    default:
      return 'image/jpeg'
  }
}

const e = StyleSheet.create({
  marco: { marginBottom: espacio.lg },
  etiqueta: { fontSize: 13, fontWeight: '700', color: color.tinta, marginBottom: espacio.sm },
  hueco: {
    borderRadius: radio.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.linea,
    backgroundColor: color.fondo,
    minHeight: 132,
  },
  foto: { width: '100%', height: 160 },
  vacio: { height: 132, alignItems: 'center', justifyContent: 'center', gap: espacio.sm },
  vacioTexto: { fontSize: 13, color: color.apagado, fontWeight: '600' },
  velo: {
    // A mano y no con StyleSheet.absoluteFillObject: en React Native 0.86 ya no
    // existe esa propiedad, solo `absoluteFill`, que es un identificador de
    // estilo y no se puede esparcir dentro de otro objeto.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(8,33,57,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.sm,
  },
  veloTexto: { color: color.blanco, fontSize: 13, fontWeight: '600' },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: espacio.xs,
  },
  ayuda: { flex: 1, fontSize: 12, color: color.apagado },
  quitar: { fontSize: 12.5, color: color.rojo, fontWeight: '700' },
})
