// ==========================================================================
// Elegir fecha y hora con el selector del sistema.
//
// Antes se escribían a mano y la app iba metiendo las barras y los dos puntos.
// Funcionaba, pero se prestaba a teclear un 31 de febrero, y sobre todo obliga
// a saber en qué día de la semana cae el 27 — que es justo lo que se mira al
// poner un amistoso.
//
// El selector nativo lo resuelve: en Android abre el calendario y el reloj de
// Material, en iOS la rueda de siempre. Es el que la gente ya sabe usar.
//
// La diferencia entre plataformas está aquí dentro y no en cada pantalla:
//   · Android abre un diálogo aparte y avisa una vez ('set' o 'dismissed').
//   · iOS pinta el selector en línea y avisa a cada giro de la rueda.
// ==========================================================================

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { fechaLarga, hora as formatoHora } from '../lib/fechas'
import { color, espacio, radio } from '../tema'

interface Props {
  etiqueta: string
  ayuda?: string
  /** El valor actual. `null` = todavía sin elegir. */
  valor: Date | null
  alElegir: (v: Date) => void
  modo: 'fecha' | 'hora'
  /** Para no poder poner un amistoso el mes pasado. */
  minimo?: Date
}

export function CampoFecha({ etiqueta, ayuda, valor, alElegir, modo, minimo }: Props) {
  const [abierto, setAbierto] = useState(false)

  // Con qué fecha se abre el selector cuando aún no hay nada elegido.
  const partida = valor ?? (modo === 'fecha' ? proximaHoraRedonda() : proximaHoraRedonda())

  function alCambiar(evento: DateTimePickerEvent, elegida?: Date) {
    // En Android el diálogo es de un solo uso: se cierre como se cierre, se
    // cierra. En iOS el selector vive dentro de la pantalla y no se toca.
    if (Platform.OS === 'android') setAbierto(false)
    if (evento.type === 'dismissed' || !elegida) return
    alElegir(elegida)
  }

  const texto = valor
    ? modo === 'fecha'
      ? mayuscula(fechaLarga(valor))
      : formatoHora(valor)
    : modo === 'fecha'
      ? 'Elegir fecha'
      : 'Elegir hora'

  return (
    <View style={e.marco}>
      <Text style={e.etiqueta}>{etiqueta}</Text>

      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${texto}`}
        style={({ pressed }) => [e.boton, pressed ? { opacity: 0.7 } : null]}
      >
        <Ionicons
          name={modo === 'fecha' ? 'calendar-outline' : 'time-outline'}
          size={19}
          color={color.azul}
        />
        <Text style={[e.valor, !valor ? e.placeholder : null]} numberOfLines={1}>
          {texto}
        </Text>
        <Ionicons name="chevron-down" size={17} color={color.linea} />
      </Pressable>

      {ayuda ? <Text style={e.ayuda}>{ayuda}</Text> : null}

      {abierto || Platform.OS === 'ios' ? (
        <View style={Platform.OS === 'ios' && !abierto ? e.oculto : undefined}>
          <DateTimePicker
            value={partida}
            mode={modo === 'fecha' ? 'date' : 'time'}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimo}
            // 24 horas: aquí nadie dice que el partido es a las 7 de la tarde.
            is24Hour
            locale="es-ES"
            onChange={alCambiar}
          />
          {Platform.OS === 'ios' && abierto ? (
            <Pressable onPress={() => setAbierto(false)} style={e.hecho}>
              <Text style={e.hechoTexto}>Hecho</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

/** Hoy a la siguiente hora en punto: un punto de partida razonable. */
function proximaHoraRedonda(ahora = new Date()): Date {
  const f = new Date(ahora)
  f.setMinutes(0, 0, 0)
  f.setHours(f.getHours() + 1)
  return f
}

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const e = StyleSheet.create({
  marco: { marginBottom: espacio.lg },
  etiqueta: { fontSize: 13, fontWeight: '700', color: color.tinta, marginBottom: espacio.sm },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    borderWidth: 1,
    borderColor: color.linea,
    borderRadius: radio.md,
    paddingHorizontal: espacio.md,
    paddingVertical: 12,
    backgroundColor: color.blanco,
    minHeight: 48,
  },
  valor: { flex: 1, fontSize: 16, color: color.tinta },
  placeholder: { color: color.apagado },
  ayuda: { fontSize: 12, color: color.apagado, marginTop: espacio.xs },
  // En iOS el selector va en línea; se mantiene montado y solo se esconde para
  // que no salte el layout al abrirlo y cerrarlo.
  oculto: { height: 0, overflow: 'hidden' },
  hecho: { alignSelf: 'flex-end', padding: espacio.md },
  hechoTexto: { fontSize: 15, fontWeight: '700', color: color.azul },
})
