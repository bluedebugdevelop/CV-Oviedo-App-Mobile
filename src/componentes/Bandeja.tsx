// ==========================================================================
// La bandeja: una lista de equipos con vista previa, hora y no leídos.
//
// La usan el chat y los avisos, y por eso está aquí y no dentro de una de las
// dos. Son la misma idea —«tus equipos, y en cuál hay algo nuevo»— y verlas
// distintas obligaría a aprender dos veces lo mismo.
//
// Sustituye al selector de equipos de arriba, que era una fila de pastillas
// que había que ir tocando para descubrir dónde había novedades. La lista lo
// dice de un vistazo, que es lo que hace cualquier app de mensajería.
//
// Con UN solo equipo esto no llega a pintarse: la pantalla entra directa a la
// conversación (ver `chat.tsx` y `avisos.tsx`). Una bandeja de un elemento es
// un toque de más para no dar a elegir nada.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { color, espacio, radio } from '../tema'

/**
 * Las iniciales del equipo, hasta tres.
 *
 * «Cadete Femenino A» → CFA, «Superliga 2 Masculina» → S2M, «Benjamín /
 * Alevín» → BA. Se salta las barras y las palabras de enlace, que no aportan
 * y gastan una de las tres letras.
 */
export function iniciales(nombre: string): string {
  const palabras = nombre
    .split(/[\s/]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !['de', 'del', 'la', 'el', 'y'].includes(p.toLowerCase()))

  return palabras
    .slice(0, 3)
    .map((p) => p[0].toUpperCase())
    .join('')
}

/* Un color por equipo, siempre el mismo.

   Sale del nombre y no de un campo guardado: así un equipo nuevo tiene su
   color desde el primer segundo, sin que nadie se lo asigne, y el mismo equipo
   se ve igual en todos los móviles. Son los azules y verdes del club más el
   ámbar y el rojo de las competiciones nacionales: lo justo para distinguir
   tres o cuatro equipos en una lista sin que parezca otra app. */
const PALETA = [
  { fondo: color.tinte, texto: color.azulOscuro },
  { fondo: color.verdeTinte, texto: color.verde },
  { fondo: color.ambarTinte, texto: '#8a5a00' },
  { fondo: color.rojoTinte, texto: '#9b1c23' },
  { fondo: '#e4e9f0', texto: color.tinta },
] as const

export function tonoDe(nombre: string) {
  let suma = 0
  for (let i = 0; i < nombre.length; i++) suma = (suma + nombre.charCodeAt(i)) % 9973
  return PALETA[suma % PALETA.length]
}

export function Monograma({ nombre, size = 50 }: { nombre: string; size?: number }) {
  const tono = tonoDe(nombre)
  return (
    <View
      style={[
        e.monograma,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tono.fondo },
      ]}
    >
      <Text style={[e.monogramaTexto, { color: tono.texto, fontSize: size * 0.32 }]}>
        {iniciales(nombre)}
      </Text>
    </View>
  )
}

/** El globito de no leídos. Por encima de 99 (o desbordado), «+». */
export function Globito({ n, mas = false }: { n: number; mas?: boolean }) {
  if (n <= 0) return null
  return (
    <View style={e.globito}>
      <Text style={e.globitoTexto}>{mas || n > 99 ? `${Math.min(n, 99)}+` : n}</Text>
    </View>
  )
}

export function FilaBandeja({
  nombre,
  detalle,
  previa,
  cuando,
  noLeidos = 0,
  mas = false,
  /** Icono pequeño delante de la vista previa (el tipo de aviso, por ejemplo). */
  icono,
  onPress,
}: {
  nombre: string
  /** Bajo el nombre cuando no hay nada que previsualizar (categoría, género). */
  detalle?: string
  previa?: string | null
  cuando?: string | null
  noLeidos?: number
  mas?: boolean
  icono?: keyof typeof Ionicons.glyphMap
  onPress: () => void
}) {
  const hayNuevos = noLeidos > 0

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        hayNuevos ? `${nombre}, ${noLeidos} sin leer` : nombre
      }
      style={({ pressed }) => [e.fila, pressed ? e.pulsada : null]}
    >
      <Monograma nombre={nombre} />

      <View style={{ flex: 1, gap: 3 }}>
        <View style={e.filaAlta}>
          <Text style={e.nombre} numberOfLines={1}>
            {nombre}
          </Text>
          {cuando ? (
            <Text style={[e.cuando, hayNuevos ? e.cuandoNuevo : null]}>{cuando}</Text>
          ) : null}
        </View>

        <View style={e.filaBaja}>
          {icono ? (
            <Ionicons
              name={icono}
              size={14}
              color={hayNuevos ? color.tinta : color.apagado}
              style={{ marginTop: 1 }}
            />
          ) : null}
          <Text
            style={[e.previa, hayNuevos ? e.previaNueva : null]}
            numberOfLines={1}
          >
            {previa ?? detalle ?? ''}
          </Text>
          <Globito n={noLeidos} mas={mas} />
        </View>
      </View>
    </Pressable>
  )
}

const e = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    paddingVertical: espacio.md,
    paddingHorizontal: espacio.lg,
    backgroundColor: color.blanco,
    minHeight: 72,
  },
  pulsada: { backgroundColor: color.fondo },

  monograma: { alignItems: 'center', justifyContent: 'center' },
  monogramaTexto: { fontWeight: '800', letterSpacing: 0.3 },

  filaAlta: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.sm },
  nombre: { flex: 1, fontSize: 16, fontWeight: '700', color: color.tinta },
  cuando: { fontSize: 11.5, color: color.apagado },
  cuandoNuevo: { color: color.azul, fontWeight: '700' },

  filaBaja: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  previa: { flex: 1, fontSize: 13.5, color: color.apagado, lineHeight: 18 },
  // Sin leer, la vista previa se pone en negro y en negrita: es la señal que
  // se lee antes que el globito al pasar la lista con el pulgar.
  previaNueva: { color: color.tinta, fontWeight: '600' },

  globito: {
    minWidth: 21,
    height: 21,
    borderRadius: radio.pastilla,
    paddingHorizontal: 6,
    backgroundColor: color.azul,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globitoTexto: { color: color.blanco, fontSize: 11.5, fontWeight: '800' },
})

/** La línea de separación entre filas, sangrada bajo el monograma. */
export const SeparadorBandeja = () => <View style={s.separador} />

const s = StyleSheet.create({
  separador: {
    height: 1,
    backgroundColor: color.linea,
    // Empieza donde empieza el texto, no en el borde: así la lista se lee como
    // una columna de conversaciones y no como una tabla de filas sueltas.
    marginLeft: espacio.lg + 50 + espacio.md,
  },
})
