// ==========================================================================
// El cambiador de equipo.
//
// Mucha gente del club está en más de un equipo: un jugador que dobla cadete y
// juvenil, un entrenador con tres categorías. Todas las pantallas de equipo
// —calendario, chat, avisos, horarios— miran al mismo equipo activo, y este es
// el único sitio donde se cambia.
//
// Si solo hay un equipo no se pinta nada: enseñar un selector de una opción es
// ocupar sitio para no dar a elegir.
// ==========================================================================

import { ScrollView, StyleSheet, Pressable, Text } from 'react-native'

import { useSesion } from '../contexto/sesion'
import { color, espacio, radio } from '../tema'

export function SelectorEquipo() {
  const { equipos, equipoActivo, cambiarEquipo } = useSesion()

  if (equipos.length < 2) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={e.fila}
      style={e.marco}
    >
      {equipos.map((eq) => {
        const activo = eq.id === equipoActivo?.id
        return (
          <Pressable
            key={eq.id}
            onPress={() => cambiarEquipo(eq.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            style={[e.pildora, activo ? e.activa : null]}
          >
            <Text style={[e.texto, activo ? e.textoActivo : null]} numberOfLines={1}>
              {eq.nombre}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const e = StyleSheet.create({
  marco: { flexGrow: 0, marginBottom: espacio.lg },
  fila: { gap: espacio.sm },
  pildora: {
    paddingHorizontal: espacio.lg,
    paddingVertical: espacio.sm,
    borderRadius: radio.pastilla,
    backgroundColor: color.blanco,
    borderWidth: 1,
    borderColor: color.linea,
    maxWidth: 220,
  },
  activa: { backgroundColor: color.tinta, borderColor: color.tinta },
  texto: { fontSize: 13, fontWeight: '700', color: color.apagado },
  textoActivo: { color: color.blanco },
})
