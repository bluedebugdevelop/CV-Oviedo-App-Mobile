// ==========================================================================
// La ficha de un equipo, desde administración.
//
// Aquí se hace lo que pidió el club: montar el equipo con sus jugadores y su
// entrenador para que luego puedan entrar. Tres cosas:
//
//   · Cambiar los datos del equipo (nombre, categoría, competición).
//   · Meter y sacar gente. La lista de candidatos son todos los usuarios del
//     club, así que primero hay que darlos de alta en «Usuarios».
//   · Archivarlo al acabar la temporada.
//
// Archivar y no borrar: un equipo borrado se lleva por delante su chat, sus
// avisos y su horario, y con ellos el histórico de la temporada. Archivado
// desaparece de la lista de la gente pero sigue estando.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { Pantalla } from '../../../componentes/Pantalla'
import {
  Banda,
  Boton,
  Campo,
  Cargando,
  Etiqueta,
  Franja,
  Pildoras,
  Secundario,
  Separador,
  Tarjeta,
  Vacio,
} from '../../../componentes/ui'
import {
  actualizarEquipo,
  anadirAEquipo,
  escucharEquipo,
  quitarDeEquipo,
} from '../../../lib/firebase/equipos'
import { escucharTodosLosUsuarios } from '../../../lib/firebase/usuarios'
import {
  CATEGORIAS,
  puedeEntrenar,
  puedeJugar,
  resumenRoles,
  type Equipo,
  type Genero,
  type Usuario,
} from '../../../lib/firebase/modelo'
import { cargarIndiceCompeticion, type ResumenCompeticion } from '../../../lib/web/competicion'
import { colorRol, color, espacio, radio } from '../../../tema'

export default function FichaEquipoAdmin() {
  const { id } = useLocalSearchParams<{ id: string }>()

  const [equipo, setEquipo] = useState<Equipo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [todos, setTodos] = useState<Usuario[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    return escucharEquipo(id, (eq) => {
      setEquipo(eq)
      setCargando(false)
    })
  }, [id])

  useEffect(() => escucharTodosLosUsuarios(setTodos), [])

  const miembros = useMemo(() => {
    if (!equipo) return { entrenadores: [], jugadores: [] }
    const dentro = (uid: string) => todos.find((u) => u.uid === uid)
    return {
      entrenadores: equipo.entrenadores.map(dentro).filter(Boolean) as Usuario[],
      jugadores: equipo.jugadores.map(dentro).filter(Boolean) as Usuario[],
    }
  }, [equipo, todos])

  if (cargando) {
    return (
      <Pantalla titulo="Equipo" atras>
        <Cargando />
      </Pantalla>
    )
  }

  if (!equipo) {
    return (
      <Pantalla titulo="Equipo" atras>
        <Vacio icono="alert-circle-outline" titulo="No existe" texto="Este equipo ya no está." />
      </Pantalla>
    )
  }

  function archivar() {
    const volver = equipo!.archivado
    Alert.alert(
      volver ? 'Recuperar equipo' : 'Archivar equipo',
      volver
        ? 'Volverá a aparecer en la app de sus jugadores.'
        : 'Desaparecerá de la app de sus jugadores, pero no se borra nada: el chat, los avisos y el horario se quedan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: volver ? 'Recuperar' : 'Archivar',
          style: volver ? 'default' : 'destructive',
          onPress: () =>
            void actualizarEquipo(equipo!.id, { archivado: !volver }).catch((err) =>
              setError(err?.message ?? 'No se pudo guardar.'),
            ),
        },
      ],
    )
  }

  return (
    <Pantalla ante="Administración" titulo={equipo.nombre} atras>
      {error ? <Banda tono="error">{error}</Banda> : null}

      {equipo.archivado ? (
        <Banda tono="ojo">
          Este equipo está archivado: su gente no lo ve en la app.
        </Banda>
      ) : null}

      <DatosEquipo equipo={equipo} alFallar={setError} />

      {/* --- cuerpo técnico --- */}
      <Franja titulo={`Entrenadores (${miembros.entrenadores.length})`} />
      {miembros.entrenadores.length === 0 ? (
        <Banda tono="ojo">
          Sin entrenador, nadie puede mandar avisos a este equipo ni poner su horario.
        </Banda>
      ) : (
        <View style={{ gap: espacio.sm }}>
          {miembros.entrenadores.map((u) => (
            <Miembro key={u.uid} usuario={u} equipoId={equipo.id} papel="entrenador" />
          ))}
        </View>
      )}

      {/* --- jugadores --- */}
      <Franja titulo={`Jugadores (${miembros.jugadores.length})`} />
      {miembros.jugadores.length === 0 ? (
        <Secundario>Todavía no hay jugadores en este equipo.</Secundario>
      ) : (
        <View style={{ gap: espacio.sm }}>
          {miembros.jugadores.map((u) => (
            <Miembro key={u.uid} usuario={u} equipoId={equipo.id} papel="jugador" />
          ))}
        </View>
      )}

      <Anadir equipo={equipo} todos={todos} alFallar={setError} />

      <Franja titulo="Temporada" />
      <Boton
        tono={equipo.archivado ? 'secundario' : 'peligro'}
        icono={equipo.archivado ? 'refresh' : 'archive-outline'}
        ancho
        onPress={archivar}
      >
        {equipo.archivado ? 'Recuperar equipo' : 'Archivar equipo'}
      </Boton>
    </Pantalla>
  )
}

// --- datos del equipo -----------------------------------------------------

const GENEROS: { valor: Genero; etiqueta: string }[] = [
  { valor: 'Femenino', etiqueta: 'Femenino' },
  { valor: 'Masculino', etiqueta: 'Masculino' },
  { valor: 'Mixto', etiqueta: 'Mixto' },
]

function DatosEquipo({
  equipo,
  alFallar,
}: {
  equipo: Equipo
  alFallar: (m: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(equipo.nombre)
  const [categoria, setCategoria] = useState(equipo.categoria || CATEGORIAS[0])
  const [genero, setGenero] = useState<Genero>(equipo.genero)
  const [clave, setClave] = useState<string | null>(equipo.claveCompeticion)
  const [guardando, setGuardando] = useState(false)

  const [competiciones, setCompeticiones] = useState<ResumenCompeticion[]>([])
  useEffect(() => {
    if (!editando) return
    let vivo = true
    void cargarIndiceCompeticion()
      .then((r) => vivo && setCompeticiones(r.equipos))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [editando])

  const nombreCompeticion = useMemo(() => {
    if (!equipo.claveCompeticion) return 'sin competición federada'
    const c = competiciones.find((x) => x.clave === equipo.claveCompeticion)
    // Antes de que llegue el índice no se puede traducir la clave; se enseña
    // ella misma, que al menos dice algo.
    return c ? `${c.division}${c.grupo ? ` · ${c.grupo}` : ''}` : equipo.claveCompeticion
  }, [equipo.claveCompeticion, competiciones])

  async function guardar() {
    if (guardando) return
    setGuardando(true)
    try {
      await actualizarEquipo(equipo.id, {
        nombre: nombre.trim(),
        categoria,
        genero,
        claveCompeticion: clave,
      })
      setEditando(false)
    } catch (err: any) {
      alFallar(err?.message ?? 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  if (!editando) {
    return (
      <Tarjeta style={{ gap: espacio.sm }}>
        <View style={e.filaEntre}>
          <Text style={e.tituloTarjeta}>Datos del equipo</Text>
          <Pressable onPress={() => setEditando(true)} hitSlop={10} accessibilityRole="button">
            <Text style={e.enlace}>Editar</Text>
          </Pressable>
        </View>
        <Text style={e.dato}>
          <Text style={e.datoEtiqueta}>Categoría: </Text>
          {equipo.categoria} · {equipo.genero}
        </Text>
        <Text style={e.dato}>
          <Text style={e.datoEtiqueta}>Temporada: </Text>
          {equipo.temporada}
        </Text>
        <Text style={e.dato}>
          <Text style={e.datoEtiqueta}>Competición: </Text>
          {nombreCompeticion}
        </Text>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta>
      <Text style={[e.tituloTarjeta, { marginBottom: espacio.lg }]}>Datos del equipo</Text>

      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} maxLength={60} />
      <Pildoras
        etiqueta="Categoría"
        valor={categoria}
        alElegir={setCategoria}
        opciones={CATEGORIAS.map((c) => ({ valor: c, etiqueta: c }))}
      />
      <Pildoras etiqueta="Género" valor={genero} alElegir={setGenero} opciones={GENEROS} />

      <Text style={e.datoEtiqueta}>Competición</Text>
      <View style={{ gap: espacio.sm, marginTop: espacio.sm, marginBottom: espacio.lg }}>
        <Pressable
          onPress={() => setClave(null)}
          style={[e.opcion, clave === null ? e.opcionElegida : null]}
        >
          <Ionicons
            name={clave === null ? 'radio-button-on' : 'radio-button-off'}
            size={18}
            color={clave === null ? color.azul : color.linea}
          />
          <Text style={e.opcionTexto}>Sin competición</Text>
        </Pressable>

        {competiciones.map((c) => (
          <Pressable
            key={c.clave}
            onPress={() => setClave(c.clave)}
            style={[e.opcion, clave === c.clave ? e.opcionElegida : null]}
          >
            <Ionicons
              name={clave === c.clave ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={clave === c.clave ? color.azul : color.linea}
            />
            <View style={{ flex: 1 }}>
              <Text style={e.opcionTexto}>
                {c.categoria} {c.genero}
              </Text>
              <Text style={e.meta}>
                {c.division}
                {c.grupo ? ` · ${c.grupo}` : ''} · {c.ente}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: espacio.md }}>
        <Boton tono="fantasma" onPress={() => setEditando(false)} style={{ flex: 1 }}>
          Cancelar
        </Boton>
        <Boton onPress={guardar} cargando={guardando} style={{ flex: 1 }}>
          Guardar
        </Boton>
      </View>
    </Tarjeta>
  )
}

// --- miembros -------------------------------------------------------------

function Miembro({
  usuario,
  equipoId,
  papel,
}: {
  usuario: Usuario
  equipoId: string
  /** Lo que es EN ESTE equipo, que puede no ser lo mismo que en otro. */
  papel: 'jugador' | 'entrenador'
}) {
  function quitar() {
    Alert.alert('Sacar del equipo', `¿Sacar a ${usuario.nombre} de este equipo?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sacar',
        style: 'destructive',
        onPress: () => void quitarDeEquipo(equipoId, usuario.uid).catch(() => {}),
      },
    ])
  }

  return (
    <Tarjeta style={e.miembro}>
      <View style={e.avatar}>
        <Text style={e.avatarTexto}>{usuario.dorsal || inicial(usuario.nombre)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={e.miembroNombre}>{usuario.nombre}</Text>
        <Text style={e.meta} numberOfLines={1}>
          {usuario.posicion || usuario.email}
        </Text>
      </View>
      {/* El papel en ESTE equipo, no sus roles de club: quien aquí entrena
          puede ser jugador en otro, y en esa otra ficha saldrá como tal. */}
      <Etiqueta
        fondo={colorRol[papel].fondo}
        texto={colorRol[papel].texto}
      >
        {papel === 'entrenador' ? 'ENTRENA' : 'JUEGA'}
      </Etiqueta>
      <Pressable onPress={quitar} hitSlop={8} accessibilityRole="button" accessibilityLabel="Sacar">
        <Ionicons name="remove-circle-outline" size={22} color={color.rojo} />
      </Pressable>
    </Tarjeta>
  )
}

const inicial = (n: string) => (n.trim()[0] ?? '?').toUpperCase()

// --- añadir gente ---------------------------------------------------------

function Anadir({
  equipo,
  todos,
  alFallar,
}: {
  equipo: Equipo
  todos: Usuario[]
  alFallar: (m: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const dentro = useMemo(
    () => new Set([...equipo.entrenadores, ...equipo.jugadores]),
    [equipo],
  )

  const candidatos = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return todos
      .filter((u) => u.activo && !dentro.has(u.uid))
      .filter((u) => !q || u.nombre.toLowerCase().includes(q) || u.email.includes(q))
      .slice(0, 30)
  }, [todos, dentro, busqueda])

  async function meter(u: Usuario, papel: 'jugador' | 'entrenador') {
    try {
      await anadirAEquipo(equipo.id, u.uid, papel)
    } catch (err: any) {
      alFallar(err?.message ?? 'No se pudo añadir.')
    }
  }

  /**
   * Con qué papel entra alguien en este equipo.
   *
   * Si por sus roles solo puede hacer una cosa, se hace y ya. Si puede las dos
   * —quien entrena y además juega, que es justo lo que se quería permitir— se
   * pregunta, porque el equipo guarda dos listas separadas y de ahí sale quién
   * puede mandar avisos aquí.
   */
  function anadir(u: Usuario) {
    const juega = puedeJugar(u)
    const entrena = puedeEntrenar(u)

    if (juega && !entrena) return void meter(u, 'jugador')
    if (entrena && !juega) return void meter(u, 'entrenador')

    Alert.alert(`Añadir a ${u.nombre.split(' ')[0]}`, '¿Con qué papel entra en este equipo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Como jugador', onPress: () => void meter(u, 'jugador') },
      { text: 'Como entrenador', onPress: () => void meter(u, 'entrenador') },
    ])
  }

  if (!abierto) {
    return (
      <Boton
        tono="secundario"
        icono="person-add"
        ancho
        style={{ marginTop: espacio.lg }}
        onPress={() => setAbierto(true)}
      >
        Añadir gente al equipo
      </Boton>
    )
  }

  return (
    <Tarjeta style={{ marginTop: espacio.lg }}>
      <View style={[e.filaEntre, { marginBottom: espacio.md }]}>
        <Text style={e.tituloTarjeta}>Añadir al equipo</Text>
        <Pressable onPress={() => setAbierto(false)} hitSlop={10} accessibilityRole="button">
          <Ionicons name="close" size={20} color={color.apagado} />
        </Pressable>
      </View>

      <TextInput
        value={busqueda}
        onChangeText={setBusqueda}
        placeholder="Buscar por nombre o correo"
        placeholderTextColor={color.apagado}
        autoCapitalize="none"
        style={e.buscador}
      />

      {candidatos.length === 0 ? (
        <View style={{ paddingVertical: espacio.lg, gap: espacio.md }}>
          <Secundario>
            {busqueda
              ? 'Nadie coincide con esa búsqueda.'
              : 'Todos los usuarios del club ya están en este equipo.'}
          </Secundario>
          <Boton tono="fantasma" icono="person-add" onPress={() => router.push('/admin/usuarios')}>
            Dar de alta a alguien nuevo
          </Boton>
        </View>
      ) : (
        <View style={{ marginTop: espacio.md }}>
          {candidatos.map((u, i) => (
            <View key={u.uid}>
              {i > 0 ? <Separador /> : null}
              <Pressable
                onPress={() => anadir(u)}
                style={({ pressed }) => [e.candidato, pressed ? { opacity: 0.6 } : null]}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={e.miembroNombre}>{u.nombre}</Text>
                  <Text style={e.meta} numberOfLines={1}>
                    {resumenRoles(u.roles)} · {u.email}
                  </Text>
                </View>
                <Ionicons name="add-circle" size={24} color={color.azul} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </Tarjeta>
  )
}

const e = StyleSheet.create({
  filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tituloTarjeta: { fontSize: 16, fontWeight: '800', color: color.tinta },
  enlace: { fontSize: 14, color: color.azul, fontWeight: '700' },
  dato: { fontSize: 14, color: color.tinta, lineHeight: 21 },
  datoEtiqueta: { fontWeight: '700', color: color.apagado },
  meta: { fontSize: 12.5, color: color.apagado },

  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    padding: espacio.md,
    borderRadius: radio.md,
    borderWidth: 1,
    borderColor: color.linea,
  },
  opcionElegida: { borderColor: color.azul, backgroundColor: color.tinte },
  opcionTexto: { fontSize: 14.5, fontWeight: '600', color: color.tinta },

  miembro: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, padding: espacio.md },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radio.pastilla,
    backgroundColor: color.tinte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { fontSize: 14, fontWeight: '800', color: color.azulOscuro },
  miembroNombre: { fontSize: 15, fontWeight: '600', color: color.tinta },

  buscador: {
    borderWidth: 1,
    borderColor: color.linea,
    borderRadius: radio.md,
    paddingHorizontal: espacio.md,
    paddingVertical: 11,
    fontSize: 16,
    color: color.tinta,
    minHeight: 46,
  },
  candidato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    paddingVertical: espacio.md,
  },
})
