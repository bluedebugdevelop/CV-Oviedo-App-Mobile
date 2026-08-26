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

import { CampoFecha } from '../componentes/CampoFecha'
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
import { fechaLarga, hora } from '../lib/fechas'
import {
  actualizarEntrenamiento,
  borrarEntrenamiento,
  borrarEvento,
  crearEntrenamiento,
  crearEvento,
  escucharEntrenamientos,
  escucharEventos,
} from '../lib/firebase/entrenamientos'
import {
  DIAS,
  DIAS_ORDEN,
  type DiaSemana,
  type Entrenamiento,
  type Evento,
  type Usuario,
} from '../lib/firebase/modelo'
import { avisarHorario } from '../lib/firebase/notificar'
import { escucharUsuariosDeEquipo } from '../lib/firebase/usuarios'
import { aFecha } from '../lib/web/competicion'
import { color, espacio, radio } from '../tema'

/**
 * Dónde entrena el club.
 *
 * Todos los equipos entrenan en el mismo sitio, así que preguntarlo en cada
 * entrenamiento era teclear siempre lo mismo y arriesgarse a que cada
 * entrenador lo escribiera de una forma. El modelo sigue guardando el lugar en
 * cada entrenamiento: si algún día el club usa dos pabellones, se vuelve a
 * poner el campo y lo que ya esté escrito sigue valiendo.
 */
const SEDE_CLUB = 'Polideportivo José Manuel Fuente (Colloto)'

export default function Entrenamientos() {
  const sesion = useSesion()
  const { equipoActivo, perfil } = sesion
  const puede = mandaAqui(sesion, equipoActivo)

  const [entrenos, setEntrenos] = useState<Entrenamiento[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  // Para los tokens de a quién avisar del cambio.
  const [plantilla, setPlantilla] = useState<Usuario[]>([])

  useEffect(() => {
    if (!equipoActivo) return
    return escucharEntrenamientos(equipoActivo.id, setEntrenos)
  }, [equipoActivo])

  useEffect(() => {
    if (!equipoActivo) return
    return escucharEventos(equipoActivo.id, setEventos)
  }, [equipoActivo])

  useEffect(() => {
    if (!equipoActivo) return
    return escucharUsuariosDeEquipo(equipoActivo.id, setPlantilla)
  }, [equipoActivo])

  /* Avisar al equipo de un cambio de horario.

     Va sin esperar y sin poder fallar hacia fuera: el cambio ya está
     guardado y ya se ve en la app de todos. Que salga la notificación es un
     extra, y bloquear la pantalla por ella solo conseguiría que el
     entrenador dudara de si el cambio se guardó. */
  const avisar = (detalle: string) => {
    if (!equipoActivo || !perfil) return
    void avisarHorario(equipoActivo, plantilla, perfil, detalle)
  }

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
        onPress: () => {
          void borrarEntrenamiento(equipoActivo!.id, x.id).catch(() => {})
          avisar(`Se quita el entrenamiento de los ${DIAS[x.dia].toLowerCase()} (${x.inicio}–${x.fin})`)
        },
      },
    ])
  }

  function quitarEvento(ev: Evento) {
    Alert.alert('Quitar cita', ev.titulo, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          void borrarEvento(equipoActivo!.id, ev.id).catch(() => {})
          avisar(`Se anula: ${ev.titulo}`)
        },
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
                onPress={() => {
                  void actualizarEntrenamiento(equipoActivo.id, x.id, { activo: !x.activo })
                  // Para el equipo esto no es «ocultar una fila»: es que ese
                  // día se suspende el entrenamiento, o que vuelve.
                  avisar(
                    x.activo
                      ? `Se suspende el entrenamiento de los ${DIAS[x.dia].toLowerCase()} (${x.inicio}–${x.fin})`
                      : `Vuelve el entrenamiento de los ${DIAS[x.dia].toLowerCase()} (${x.inicio}–${x.fin})`,
                  )
                }}
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

      <NuevoEntrenamiento equipoId={equipoActivo.id} alAvisar={avisar} />

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

      <NuevaCita equipoId={equipoActivo.id} alAvisar={avisar} />
    </Pantalla>
  )
}

// --- alta de entrenamiento ------------------------------------------------

function NuevoEntrenamiento({
  equipoId,
  alAvisar,
}: {
  equipoId: string
  alAvisar: (detalle: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [dia, setDia] = useState<DiaSemana>(1)
  const [inicio, setInicio] = useState<Date | null>(null)
  const [fin, setFin] = useState<Date | null>(null)
  const [notas, setNotas] = useState<string>("")
  const [guardando, setGuardando] = useState(false)

  const horasPuestas = inicio !== null && fin !== null
  /* Un entrenamiento que acaba antes de empezar es un dedazo, no un turno de
     noche: se avisa en vez de guardarlo. */
  const ordenOk = !horasPuestas || hora(inicio!) < hora(fin!)

  async function guardar() {
    if (!horasPuestas || !ordenOk || guardando) return
    setGuardando(true)
    try {
      await crearEntrenamiento(equipoId, {
        dia,
        inicio: hora(inicio!),
        fin: hora(fin!),
        lugar: SEDE_CLUB,
        notas: notas.trim(),
        activo: true,
      })
      alAvisar(
        `Nuevo entrenamiento los ${DIAS[dia].toLowerCase()} de ${hora(inicio!)} a ${hora(fin!)}`,
      )
      setInicio(null)
      setFin(null)
      setNotas("")
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
          <CampoFecha etiqueta="Empieza" modo="hora" valor={inicio} alElegir={setInicio} />
        </View>
        <View style={{ flex: 1 }}>
          <CampoFecha
            etiqueta="Acaba"
            modo="hora"
            valor={fin}
            alElegir={setFin}
            ayuda={!ordenOk ? "Acaba antes de empezar" : undefined}
          />
        </View>
      </View>

      {/* El lugar no se pregunta: todo el club entrena en el mismo sitio.
          Si algún día deja de ser así, se cambia SEDE_CLUB —arriba— o vuelve
          a ponerse el campo; el modelo sigue guardando el lugar de cada
          entrenamiento, así que los que ya estén escritos no se tocan. */}
      <View style={e.sede}>
        <Ionicons name="location-outline" size={17} color={color.azul} />
        <Text style={e.sedeTexto}>{SEDE_CLUB}</Text>
      </View>

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
          desactivado={!horasPuestas || !ordenOk}
          style={{ flex: 1 }}
        >
          Guardar
        </Boton>
      </View>
    </Tarjeta>
  )
}

// --- alta de cita ---------------------------------------------------------

function NuevaCita({
  equipoId,
  alAvisar,
}: {
  equipoId: string
  alAvisar: (detalle: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [titulo, setTitulo] = useState("")
  /* Una sola fecha con su hora dentro, y dos selectores que la tocan.

     Antes eran dos textos que se validaban juntos, y ahí estaba el fallo: la
     comprobación de la fecha pasaba por la de la hora, así que una fecha
     perfectamente válida salía marcada en rojo mientras el campo de hora
     estuviera vacío. Con un Date no hay nada que cruzar. */
  const [cuando, setCuando] = useState<Date | null>(null)
  const [lugar, setLugar] = useState<string>(SEDE_CLUB)
  const [guardando, setGuardando] = useState(false)

  const listo = titulo.trim().length >= 3 && cuando !== null

  /** Cambia el día dejando la hora como estaba, y al revés. */
  function ponerDia(elegido: Date) {
    setCuando((actual) => {
      const f = new Date(elegido)
      if (actual) f.setHours(actual.getHours(), actual.getMinutes(), 0, 0)
      else f.setSeconds(0, 0)
      return f
    })
  }

  function ponerHora(elegida: Date) {
    setCuando((actual) => {
      const f = new Date(actual ?? elegida)
      f.setHours(elegida.getHours(), elegida.getMinutes(), 0, 0)
      return f
    })
  }

  async function guardar() {
    if (!listo || guardando) return
    setGuardando(true)
    try {
      await crearEvento(equipoId, {
        titulo: titulo.trim(),
        tipo: "otro",
        iso: aIso(cuando!),
        lugar: lugar.trim(),
        rival: "",
        notas: "",
        convocados: [],
      })
      alAvisar(`${titulo.trim()} — ${fechaLarga(cuando!)} a las ${hora(cuando!)}`)
      setTitulo("")
      setCuando(null)
      setLugar(SEDE_CLUB)
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

      <CampoFecha
        etiqueta="Día"
        modo="fecha"
        valor={cuando}
        alElegir={ponerDia}
        minimo={new Date()}
      />

      <CampoFecha etiqueta="Hora" modo="hora" valor={cuando} alElegir={ponerHora} />

      {/* En las citas el lugar sí se pregunta: un amistoso fuera se juega en
          el pabellón del rival. Viene relleno con el del club porque es lo
          más habitual. */}
      <Campo
        etiqueta="Lugar"
        value={lugar}
        onChangeText={setLugar}
        placeholder={SEDE_CLUB}
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

/**
 * Un Date al texto que guarda el evento: "YYYY-MM-DDTHH:MM".
 *
 * A mano y no con `toISOString()`, que pasa a UTC: un amistoso a las 00:30
 * de un sábado acabaría guardado el viernes. Aquí los números son los que se
 * eligieron, en la hora de aquí, igual que los lee `aFecha`.
 */
function aIso(f: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0")
  return (
    `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}` +
    `T${dos(f.getHours())}:${dos(f.getMinutes())}`
  )
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
  sede: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    backgroundColor: color.tinte,
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.lg,
  },
  sedeTexto: { flex: 1, fontSize: 13.5, color: color.azulOscuro, fontWeight: '600' },
})
