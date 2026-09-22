// ==========================================================================
// El planning semanal: lo que tiene esta persona cada día.
//
// Va arriba del todo en Inicio porque es lo que se abre la app para mirar. La
// pregunta de un martes a las ocho de la tarde es «¿hoy tengo algo?», y hasta
// ahora había que entrar en Equipo, elegir el equipo y buscar en la pestaña de
// horarios. Ahora está en la primera pantalla, sin tocar nada.
//
// Junta entrenamientos, partidos de la federación y citas sueltas de TODOS sus
// equipos. Quien dobla categoría ve las dos cosas seguidas, que es lo que le
// pasa de verdad el lunes. El reparto por días lo hace `lib/semana.ts`.
//
// SE PUEDE MOVER
// Con las flechas se pasa a la semana siguiente o a la anterior. Es donde se
// mira «¿el finde que viene jugamos en casa?», que es la otra pregunta que
// trae a la gente a esta pantalla.
//
// Y el día elegido arranca en HOY, no en el lunes. Abrir el planning en el
// lunes de una semana que va por el jueves obligaría a un toque antes de ver
// nada útil. Al cambiar de semana sí se va al lunes: ahí no hay «hoy».
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useAgenda } from '../contexto/agenda'
import { fechaLarga, hora } from '../lib/fechas'
import {
  lunesDe,
  mismoDia,
  sumarSemanas,
  type Cita,
  type TipoCita,
} from '../lib/semana'
import { color, espacio, radio, sombra } from '../tema'
import { Cargando } from './ui'

const INICIALES = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const MESES_CORTO = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

const PINTA: Record<
  TipoCita,
  { icono: keyof typeof Ionicons.glyphMap; fondo: string; texto: string; punto: string }
> = {
  entrenamiento: {
    icono: 'fitness',
    fondo: color.tinte,
    texto: color.azulOscuro,
    punto: color.azul,
  },
  partido: { icono: 'trophy', fondo: color.verdeTinte, texto: color.verde, punto: color.verde },
  cita: { icono: 'calendar', fondo: color.ambarTinte, texto: '#8a5a00', punto: color.ambar },
}

export function SemanaPlanning() {
  const { semanaDe, cargando } = useAgenda()

  const hoy = useMemo(() => new Date(), [])
  const [lunes, setLunes] = useState(() => lunesDe(hoy))
  const [elegido, setElegido] = useState<Date>(() => hoy)

  const dias = semanaDe(lunes)
  const diaElegido = dias.find((d) => mismoDia(d.fecha, elegido)) ?? dias[0]

  function moverSemana(n: number) {
    const siguiente = sumarSemanas(lunes, n)
    setLunes(siguiente)
    /* Al volver a la semana de hoy, se vuelve a hoy.

       Si no, el día elegido se quedaría clavado en el que se estuviera mirando
       de la semana de al lado, y volver «a esta semana» dejaría marcado un
       martes cualquiera en vez del día en el que se está. */
    const esLaDeHoy = mismoDia(siguiente, lunesDe(hoy))
    setElegido(esLaDeHoy ? hoy : siguiente)
  }

  const enLaDeHoy = mismoDia(lunes, lunesDe(hoy))

  return (
    <View style={e.marco}>
      {/* --- de qué semana hablamos --- */}
      <View style={e.cabecera}>
        <Flecha icono="chevron-back" etiqueta="Semana anterior" onPress={() => moverSemana(-1)} />

        <Pressable
          onPress={() => {
            setLunes(lunesDe(hoy))
            setElegido(hoy)
          }}
          disabled={enLaDeHoy}
          accessibilityRole="button"
          accessibilityLabel="Volver a esta semana"
          style={{ flex: 1 }}
        >
          <Text style={e.ante}>{enLaDeHoy ? 'Esta semana' : 'Semana del'}</Text>
          <Text style={e.rango} numberOfLines={1}>
            {rango(dias.map((d) => d.fecha))}
          </Text>
        </Pressable>

        <Flecha icono="chevron-forward" etiqueta="Semana siguiente" onPress={() => moverSemana(1)} />
      </View>

      {/* --- los siete días --- */}
      <View style={e.tira}>
        {dias.map((d) => (
          <Dia
            key={d.fecha.toISOString()}
            fecha={d.fecha}
            citas={d.citas}
            esHoy={mismoDia(d.fecha, hoy)}
            elegido={mismoDia(d.fecha, elegido)}
            onPress={() => setElegido(d.fecha)}
          />
        ))}
      </View>

      {/* --- lo del día elegido --- */}
      <View style={e.detalle}>
        <Text style={e.diaTitulo}>
          {mismoDia(diaElegido.fecha, hoy) ? 'Hoy, ' : ''}
          {fechaLarga(diaElegido.fecha)}
        </Text>

        {cargando && diaElegido.citas.length === 0 ? (
          <Cargando />
        ) : diaElegido.citas.length === 0 ? (
          <View style={e.libre}>
            <Ionicons name="cafe-outline" size={18} color={color.apagado} />
            <Text style={e.libreTexto}>Día libre. Nada en el calendario.</Text>
          </View>
        ) : (
          <View style={{ gap: espacio.sm }}>
            {diaElegido.citas.map((c) => (
              <FilaCita key={c.id} cita={c} />
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

function Flecha({
  icono,
  etiqueta,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap
  etiqueta: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      hitSlop={10}
      style={({ pressed }) => [e.flecha, pressed ? { opacity: 0.5 } : null]}
    >
      <Ionicons name={icono} size={18} color={color.tinta} />
    </Pressable>
  )
}

function Dia({
  fecha,
  citas,
  esHoy,
  elegido,
  onPress,
}: {
  fecha: Date
  citas: Cita[]
  esHoy: boolean
  elegido: boolean
  onPress: () => void
}) {
  /* Un punto por TIPO de cosa, no por cosa.

     Con un punto por cita, un día con tres entrenamientos y un partido salía
     con cuatro puntos iguales y no se distinguía del que tiene cuatro
     entrenamientos. Con un punto por tipo, el color dice qué clase de día es
     —hay partido, hay entrenamiento— que es lo que se busca al pasar la vista
     por la tira. Como mucho tres. */
  const tipos = [...new Set(citas.map((c) => c.tipo))]

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: elegido }}
      accessibilityLabel={`${fechaLarga(fecha)}, ${
        citas.length === 0 ? 'sin nada' : `${citas.length} cosas`
      }`}
      style={[e.dia, elegido ? e.diaElegido : null]}
    >
      <Text style={[e.diaLetra, elegido ? e.diaTextoElegido : null]}>
        {INICIALES[fecha.getDay()]}
      </Text>
      <Text
        style={[
          e.diaNumero,
          esHoy && !elegido ? e.diaHoy : null,
          elegido ? e.diaTextoElegido : null,
        ]}
      >
        {fecha.getDate()}
      </Text>

      {/* Alto fijo, se pinten puntos o no: sin él las columnas de los días
          vacíos quedan más bajas y la tira baila. */}
      <View style={e.puntos}>
        {tipos.map((t) => (
          <View
            key={t}
            style={[
              e.punto,
              { backgroundColor: elegido ? color.blanco : PINTA[t].punto },
            ]}
          />
        ))}
      </View>
    </Pressable>
  )
}

function FilaCita({ cita }: { cita: Cita }) {
  const p = PINTA[cita.tipo]

  return (
    <Pressable
      // Lleva a la pestaña del equipo, que es donde está el detalle: la
      // clasificación del partido o el horario completo.
      onPress={() => router.push('/equipo')}
      style={({ pressed }) => [e.cita, pressed ? { opacity: 0.6 } : null]}
    >
      <View style={e.horaColumna}>
        <Text style={e.horaTexto}>
          {cita.horaPorConfirmar ? '—' : hora(cita.inicio)}
        </Text>
        {cita.fin ? <Text style={e.horaFin}>{hora(cita.fin)}</Text> : null}
      </View>

      <View style={[e.icono, { backgroundColor: p.fondo }]}>
        <Ionicons name={p.icono} size={16} color={p.texto} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={e.citaTitulo} numberOfLines={1}>
          {cita.titulo}
        </Text>
        <Text style={e.citaMeta} numberOfLines={1}>
          {cita.equipoNombre}
          {cita.tipo === 'partido'
            ? cita.enCasa
              ? ' · en casa'
              : ' · fuera'
            : ''}
          {cita.horaPorConfirmar ? ' · hora sin confirmar' : ''}
        </Text>
        {cita.lugar ? (
          <Text style={e.citaLugar} numberOfLines={1}>
            {cita.lugar}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

/** 'Del 15 al 21 de septiembre' — o con los dos meses si la semana los cruza. */
function rango(dias: Date[]): string {
  if (dias.length === 0) return ''
  const a = dias[0]
  const b = dias[dias.length - 1]
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()} – ${b.getDate()} ${MESES_CORTO[a.getMonth()]}`
  }
  return `${a.getDate()} ${MESES_CORTO[a.getMonth()]} – ${b.getDate()} ${MESES_CORTO[b.getMonth()]}`
}

const e = StyleSheet.create({
  marco: {
    backgroundColor: color.blanco,
    borderRadius: radio.lg,
    borderWidth: 1,
    borderColor: color.linea,
    marginBottom: espacio.lg,
    overflow: 'hidden',
    ...sombra,
  },

  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    paddingHorizontal: espacio.md,
    paddingTop: espacio.md,
  },
  flecha: {
    width: 34,
    height: 34,
    borderRadius: radio.md,
    backgroundColor: color.tinte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ante: {
    fontSize: 10.5,
    fontWeight: '700',
    color: color.azul,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  rango: { fontSize: 15, fontWeight: '800', color: color.tinta, textAlign: 'center' },

  tira: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: espacio.md,
    paddingTop: espacio.md,
    paddingBottom: espacio.md,
  },
  dia: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: espacio.sm,
    borderRadius: radio.md,
    gap: 2,
  },
  diaElegido: { backgroundColor: color.azul },
  diaLetra: { fontSize: 10.5, fontWeight: '700', color: color.apagado, letterSpacing: 0.5 },
  diaNumero: { fontSize: 16, fontWeight: '700', color: color.tinta },
  // Hoy sin elegir: el número en azul. Lo justo para encontrarlo sin competir
  // con el fondo del día que sí está elegido.
  diaHoy: { color: color.azul, fontWeight: '800' },
  diaTextoElegido: { color: color.blanco },
  puntos: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  punto: { width: 5, height: 5, borderRadius: 3 },

  detalle: {
    borderTopWidth: 1,
    borderTopColor: color.linea,
    backgroundColor: color.fondo,
    padding: espacio.md,
    gap: espacio.sm,
  },
  diaTitulo: {
    fontSize: 12.5,
    fontWeight: '700',
    color: color.apagado,
    textTransform: 'capitalize',
  },

  libre: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingVertical: espacio.sm },
  libreTexto: { fontSize: 13.5, color: color.apagado },

  cita: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    backgroundColor: color.blanco,
    borderRadius: radio.md,
    borderWidth: 1,
    borderColor: color.linea,
    padding: espacio.sm,
    paddingRight: espacio.md,
  },
  horaColumna: { width: 44, alignItems: 'center' },
  horaTexto: { fontSize: 14, fontWeight: '800', color: color.tinta },
  horaFin: { fontSize: 11, color: color.apagado, marginTop: 1 },
  icono: {
    width: 32,
    height: 32,
    borderRadius: radio.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  citaTitulo: { fontSize: 14.5, fontWeight: '700', color: color.tinta },
  citaMeta: { fontSize: 12, color: color.apagado, marginTop: 1 },
  citaLugar: { fontSize: 11.5, color: color.apagado, marginTop: 1 },
})
