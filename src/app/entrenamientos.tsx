// ==========================================================================
// El horario del equipo, desde el lado del entrenador.
//
// Dos listas en la misma pantalla porque se piensan juntas: los entrenamientos
// fijos de la semana y las citas sueltas (un amistoso, un torneo, la comida de
// fin de temporada). Ver modelo.ts para por qué son cosas distintas.
//
// Se edita en línea, sin pantallas aparte. Un entrenamiento son cuatro campos
// y abrir una pantalla nueva para cambiar una hora de las 20:00 a las 20:30 es
// más navegación que trabajo.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import { Pantalla } from '../componentes/Pantalla'
import {
  Banda,
  Boton,
  Campo,
  Franja,
  Pildoras,
  Secundario,
  Tarjeta,
  Vacio,
} from '../componentes/ui'
import { mandaAqui, useSesion } from '../contexto/sesion'
import { fechaLarga, hora, horaValida, normalizaHora } from '../lib/fechas'
import {
  actualizarEntrenamiento,
  borrarEntrenamiento,
  borrarEvento,
  crearEntrenamiento,
  crearEvento,
  escucharEntrenamientos,
  escucharEventos,
} from '../lib/firebase/entrenamientos'
import { DIAS, DIAS_ORDEN, type DiaSemana, type Entrenamiento, type Evento } from '../lib/firebase/modelo'
import { aFecha } from '../lib/web/competicion'
import { color, espacio, radio } from '../tema'

export default function Entrenamientos() {
  const sesion = useSesion()
  const { equipoActivo } = sesion
  const puede = mandaAqui(sesion, equipoActivo)

  const [entrenos, setEntrenos] = useState<Entrenamiento[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])

  useEffect(() => {
    if (!equipoActivo) return
    return escucharEntrenamientos(equipoActivo.id, setEntrenos)
  }, [equipoActivo])

  useEffect(() => {
    if (!equipoActivo) return
    return escucharEventos(equipoActivo.id, setEventos)
  }, [equipoActivo])

  if (!equipoActivo || !puede) {
    return (
      <Pantalla titulo="Horario" atras>
        <Banda tono="error">
          Solo el entrenador del equipo (o un administrador) puede tocar el horario.
        </Banda>
      </Pantalla>
    )
  }

  function quitarEntreno(x: Entrenamiento) {
    Alert.alert('Quitar entrenamiento', `${DIAS[x.dia]} de ${x.inicio} a ${x.fin}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => void borrarEntrenamiento(equipoActivo!.id, x.id).catch(() => {}),
      },
    ])
  }

  function quitarEvento(ev: Evento) {
    Alert.alert('Quitar cita', ev.titulo, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => void borrarEvento(equipoActivo!.id, ev.id).catch(() => {}),
      },
    ])
  }

  return (
    <Pantalla ante={equipoActivo.nombre} titulo="Horario y citas" atras>
      <Franja titulo="Entrenamientos" />
      <Secundario>Se repiten todas las semanas. Tu equipo los ve en su pantalla de equipo.</Secundario>

      <View style={{ gap: espacio.md, marginTop: espacio.md }}>
        {entrenos.length === 0 ? (
          <Vacio
            icono="calendar-outline"
            titulo="Sin entrenamientos"
            texto="Añade abajo los días y las horas."
          />
        ) : (
          entrenos.map((x) => (
            <Tarjeta key={x.id} style={e.fila}>
              <View style={[e.dia, !x.activo ? { backgroundColor: color.linea } : null]}>
                <Text style={e.diaTexto}>{DIAS[x.dia].slice(0, 3).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[e.horas, !x.activo ? e.tachado : null]}>
                  {x.inicio} – {x.fin}
                </Text>
                {x.lugar ? <Text style={e.mini}>{x.lugar}</Text> : null}
                {x.notas ? <Text style={e.mini}>{x.notas}</Text> : null}
              </View>

              <Pressable
                onPress={() =>
                  void actualizarEntrenamiento(equipoActivo.id, x.id, { activo: !x.activo })
                }
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={x.activo ? 'Desactivar' : 'Activar'}
                style={e.iconoBoton}
              >
                <Ionicons
                  name={x.activo ? 'eye-outline' : 'eye-off-outline'}
                  size={19}
                  color={color.apagado}
                />
              </Pressable>

              <Pressable
                onPress={() => quitarEntreno(x)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Quitar"
                style={e.iconoBoton}
              >
                <Ionicons name="trash-outline" size={19} color={color.rojo} />
              </Pressable>
            </Tarjeta>
          ))
        )}
      </View>

      <NuevoEntrenamiento equipoId={equipoActivo.id} />

      <Franja titulo="Citas sueltas" />
      <Secundario>
        Amistosos, torneos o cualquier cosa que no salga del calendario de la federación.
      </Secundario>

      <View style={{ gap: espacio.md, marginTop: espacio.md }}>
        {eventos.length === 0 ? (
          <Secundario>Ninguna cita apuntada.</Secundario>
        ) : (
          eventos.map((ev) => {
            const f = aFecha(ev.iso)
            return (
              <Tarjeta key={ev.id} style={e.fila}>
                <View style={{ flex: 1 }}>
                  <Text style={e.horas}>{ev.titulo}</Text>
                  <Text style={e.mini}>
                    {f ? `${fechaLarga(f)} · ${hora(f)}` : 'Sin fecha'}
                    {ev.lugar ? ` · ${ev.lugar}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => quitarEvento(ev)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Quitar cita"
                  style={e.iconoBoton}
                >
                  <Ionicons name="trash-outline" size={19} color={color.rojo} />
                </Pressable>
              </Tarjeta>
            )
          })
        )}
      </View>

      <NuevaCita equipoId={equipoActivo.id} />
    </Pantalla>
  )
}

// --- alta de entrenamiento ------------------------------------------------

function NuevoEntrenamiento({ equipoId }: { equipoId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [dia, setDia] = useState<DiaSemana>(1)
  const [inicio, setInicio] = useState('')
  const [fin, setFin] = useState('')
  const [lugar, setLugar] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  const horasOk = horaValida(inicio) && horaValida(fin)
  // Un entrenamiento que acaba antes de empezar es un dedazo, no un turno de
  // noche: se avisa en vez de guardarlo.
  const ordenOk = !horasOk || inicio < fin

  async function guardar() {
    if (!horasOk || !ordenOk || guardando) return
    setGuardando(true)
    try {
      await crearEntrenamiento(equipoId, {
        dia,
        inicio,
        fin,
        lugar: lugar.trim(),
        notas: notas.trim(),
        activo: true,
      })
      setInicio('')
      setFin('')
      setLugar('')
      setNotas('')
      setAbierto(false)
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) {
    return (
      <Boton
        tono="secundario"
        icono="add"
        ancho
        style={{ marginTop: espacio.lg }}
        onPress={() => setAbierto(true)}
      >
        Añadir entrenamiento
      </Boton>
    )
  }

  return (
    <Tarjeta style={{ marginTop: espacio.lg }}>
      <Pildoras
        etiqueta="Día"
        valor={String(dia)}
        alElegir={(v) => setDia(Number(v) as DiaSemana)}
        opciones={DIAS_ORDEN.map((d) => ({ valor: String(d), etiqueta: DIAS[d].slice(0, 3) }))}
      />

      <View style={e.dosCampos}>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Empieza"
            value={inicio}
            onChangeText={(v) => setInicio(normalizaHora(v))}
            placeholder="20:00"
            keyboardType="number-pad"
            maxLength={5}
            error={inicio && !horaValida(inicio) ? 'Hora no válida' : undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Acaba"
            value={fin}
            onChangeText={(v) => setFin(normalizaHora(v))}
            placeholder="21:30"
            keyboardType="number-pad"
            maxLength={5}
            error={
              fin && !horaValida(fin)
                ? 'Hora no válida'
                : !ordenOk
                  ? 'Acaba antes de empezar'
                  : undefined
            }
          />
        </View>
      </View>

      <Campo
        etiqueta="Lugar"
        value={lugar}
        onChangeText={setLugar}
        placeholder="Polideportivo de Pumarín"
        maxLength={80}
      />
      <Campo
        etiqueta="Notas (opcional)"
        value={notas}
        onChangeText={setNotas}
        placeholder="Traer rodilleras"
        maxLength={140}
      />

      <View style={e.dosCampos}>
        <Boton tono="fantasma" onPress={() => setAbierto(false)} style={{ flex: 1 }}>
          Cancelar
        </Boton>
        <Boton
          onPress={guardar}
          cargando={guardando}
          desactivado={!horasOk || !ordenOk}
          style={{ flex: 1 }}
        >
          Guardar
        </Boton>
      </View>
    </Tarjeta>
  )
}

// --- alta de cita ---------------------------------------------------------

function NuevaCita({ equipoId }: { equipoId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState('')
  const [horaTexto, setHoraTexto] = useState('')
  const [lugar, setLugar] = useState('')
  const [guardando, setGuardando] = useState(false)

  const fechaOk = /^\d{2}\/\d{2}\/\d{4}$/.test(fecha) && aIso(fecha, horaTexto) !== null
  const listo = titulo.trim().length >= 3 && fechaOk && horaValida(horaTexto)

  async function guardar() {
    const iso = aIso(fecha, horaTexto)
    if (!listo || !iso || guardando) return
    setGuardando(true)
    try {
      await crearEvento(equipoId, {
        titulo: titulo.trim(),
        tipo: 'otro',
        iso,
        lugar: lugar.trim(),
        rival: '',
        notas: '',
        convocados: [],
      })
      setTitulo('')
      setFecha('')
      setHoraTexto('')
      setLugar('')
      setAbierto(false)
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) {
    return (
      <Boton
        tono="secundario"
        icono="add"
        ancho
        style={{ marginTop: espacio.lg }}
        onPress={() => setAbierto(true)}
      >
        Añadir cita
      </Boton>
    )
  }

  return (
    <Tarjeta style={{ marginTop: espacio.lg }}>
      <Campo
        etiqueta="Qué es"
        value={titulo}
        onChangeText={setTitulo}
        placeholder="Amistoso contra el Gijón"
        maxLength={100}
      />

      <View style={e.dosCampos}>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Fecha"
            value={fecha}
            onChangeText={(v) => setFecha(normalizaFecha(v))}
            placeholder="12/09/2026"
            keyboardType="number-pad"
            maxLength={10}
            error={fecha.length === 10 && !fechaOk ? 'Fecha no válida' : undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Hora"
            value={horaTexto}
            onChangeText={(v) => setHoraTexto(normalizaHora(v))}
            placeholder="18:00"
            keyboardType="number-pad"
            maxLength={5}
            error={horaTexto && !horaValida(horaTexto) ? 'Hora no válida' : undefined}
          />
        </View>
      </View>

      <Campo
        etiqueta="Lugar (opcional)"
        value={lugar}
        onChangeText={setLugar}
        placeholder="Palacio de los Deportes"
        maxLength={80}
      />

      <View style={e.dosCampos}>
        <Boton tono="fantasma" onPress={() => setAbierto(false)} style={{ flex: 1 }}>
          Cancelar
        </Boton>
        <Boton onPress={guardar} cargando={guardando} desactivado={!listo} style={{ flex: 1 }}>
          Guardar
        </Boton>
      </View>
    </Tarjeta>
  )
}

/** Mete las barras solas: '12092026' → '12/09/2026'. */
function normalizaFecha(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 8)
  if (n.length <= 2) return n
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`
}

/**
 * 'DD/MM/AAAA' + 'HH:MM' → el ISO local que guarda el evento.
 *
 * Devuelve `null` si el día no existe (un 31 de febrero). Se comprueba
 * reconstruyendo la fecha: `new Date(2026, 1, 31)` no falla, se va al 3 de
 * marzo, así que hay que mirar si los números siguen siendo los mismos.
 */
function aIso(fecha: string, horaTexto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha)
  if (!m || !horaValida(horaTexto)) return null
  const [, dd, mm, aaaa] = m
  const prueba = new Date(+aaaa, +mm - 1, +dd)
  if (prueba.getDate() !== +dd || prueba.getMonth() !== +mm - 1) return null
  return `${aaaa}-${mm}-${dd}T${horaTexto}`
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, padding: espacio.md },
  dia: {
    width: 52,
    height: 44,
    borderRadius: radio.md,
    backgroundColor: color.tinta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaTexto: { color: color.blanco, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  horas: { fontSize: 16, fontWeight: '700', color: color.tinta },
  tachado: { textDecorationLine: 'line-through', color: color.apagado },
  mini: { fontSize: 12.5, color: color.apagado, lineHeight: 18 },
  iconoBoton: { padding: 6 },
  dosCampos: { flexDirection: 'row', gap: espacio.md },
})
