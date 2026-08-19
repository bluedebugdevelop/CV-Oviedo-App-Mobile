// ==========================================================================
// Las fichas de equipo de la web.
//
// OJO: esto NO son los equipos de la app. Son dos cosas distintas con el mismo
// nombre y conviene tenerlo claro:
//
//   · Equipos de la app (admin/equipos)  → Firestore. Quién entra, quién ve
//     qué chat, a quién le llegan los avisos.
//   · Fichas de la web (esta pantalla)   → el JSON de la web. Lo que ve un
//     visitante en clubvoleiboloviedo.com/equipos: foto, plantilla publicada,
//     cuerpo técnico.
//
// No están enlazadas a propósito. La plantilla publicada no tiene por qué ser
// la lista de cuentas: hay jugadoras sin cuenta en la app, y en la web se
// publica el dorsal y el nombre de guerra, no el correo de nadie. Mezclarlas
// significaría publicar en internet el censo de la app.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { CampoImagen } from '../../../componentes/CampoImagen'
import { Pantalla } from '../../../componentes/Pantalla'
import {
  Banda,
  BarraPublicar,
  Boton,
  Campo,
  Etiqueta,
  Interruptor,
  Pildoras,
  Secundario,
  Tarjeta,
  Vacio,
} from '../../../componentes/ui'
import { usePanel } from '../../../contexto/panel'
import { slugificar, useListaEditable } from '../../../lib/listaEditable'
import type { EquipoWeb, JugadorWeb } from '../../../lib/web/contenido'
import { color, espacio, radio } from '../../../tema'

const nuevoEquipo = (): EquipoWeb => ({
  slug: '',
  zona: 'cantera',
  enPortada: false,
  nombre: '',
  categoria: '',
  liga: '',
  img: '',
  alt: '',
  resumen: '',
  crumb: '',
  kicker: '',
  sub: '',
  headerImg: '',
  headerFoco: '',
  datos: [],
  squad: [],
  staff: [],
  join: { title: '', text: '' },
})

export default function EquiposWebPanel() {
  const { datos, guardar, subir } = usePanel()
  const lista = useListaEditable<EquipoWeb>(datos?.equipos, (x) => guardar('equipos', x))
  const [abierto, setAbierto] = useState<number | null>(null)

  function borrar(i: number) {
    Alert.alert('Quitar ficha', lista.elementos[i].nombre || 'sin nombre', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          lista.quitar(i)
          setAbierto(null)
        },
      },
    ])
  }

  function crear() {
    lista.anadir(nuevoEquipo())
    setAbierto(0)
  }

  return (
    <Pantalla
      ante="Panel de la web"
      titulo="Equipos de la web"
      atras
      accion={{ icono: 'add-circle', etiqueta: 'Nueva ficha', alPulsar: crear }}
    >
      <Banda tono="info">
        Estas son las fichas públicas de clubvoleiboloviedo.com. Las cuentas y los chats se
        gestionan en Administración → Equipos.
      </Banda>

      {lista.error ? <Banda tono="error">{lista.error}</Banda> : null}

      {lista.sucio ? (
        <BarraPublicar
          guardando={lista.guardando}
          alPublicar={() => void lista.guardar()}
          alDescartar={lista.descartar}
        />
      ) : null}

      {lista.elementos.length === 0 ? (
        <Vacio icono="people-outline" titulo="Sin fichas" texto="Crea la primera ficha de equipo.">
          <Boton icono="add" onPress={crear}>
            Nueva ficha
          </Boton>
        </Vacio>
      ) : (
        <View style={{ gap: espacio.md }}>
          {lista.elementos.map((eq, i) => (
            <Ficha
              key={eq.slug || i}
              equipo={eq}
              abierto={abierto === i}
              alAbrir={() => setAbierto(abierto === i ? null : i)}
              alCambiar={(cambios) => lista.cambiar(i, cambios)}
              alBorrar={() => borrar(i)}
              subir={subir}
            />
          ))}
        </View>
      )}
    </Pantalla>
  )
}

function Ficha({
  equipo: eq,
  abierto,
  alAbrir,
  alCambiar,
  alBorrar,
  subir,
}: {
  equipo: EquipoWeb
  abierto: boolean
  alAbrir: () => void
  alCambiar: (cambios: Partial<EquipoWeb>) => void
  alBorrar: () => void
  subir: (uri: string, tipo: string, nombre: string) => Promise<string>
}) {
  return (
    <Tarjeta>
      <Pressable onPress={alAbrir} accessibilityRole="button" style={e.cabecera}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={e.etiquetas}>
            <Etiqueta
              fondo={eq.zona === 'nacional' ? color.rojoTinte : color.tinte}
              texto={eq.zona === 'nacional' ? color.rojo : color.azulOscuro}
            >
              {eq.zona === 'nacional' ? 'NACIONAL' : 'CANTERA'}
            </Etiqueta>
            {eq.enPortada ? (
              <Etiqueta fondo={color.ambarTinte} texto="#8a5a00">
                EN PORTADA
              </Etiqueta>
            ) : null}
          </View>
          <Text style={e.titulo}>{eq.nombre || 'Ficha nueva'}</Text>
          <Text style={e.meta}>
            {eq.squad.length} jugadores · {eq.staff.length} técnicos
          </Text>
        </View>
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={18} color={color.linea} />
      </Pressable>

      {abierto ? (
        <View style={e.cuerpo}>
          <Campo
            etiqueta="Nombre"
            value={eq.nombre}
            onChangeText={(v) =>
              alCambiar({
                nombre: v,
                slug: eq.slug && eq.slug !== slugificar(eq.nombre) ? eq.slug : slugificar(v),
                // El texto alternativo se rellena solo si nadie lo ha escrito:
                // una foto sin alt es inaccesible, y el servidor pone uno
                // genérico igualmente.
                alt: eq.alt || (v ? `Equipo ${v} del CV Oviedo` : ''),
              })
            }
            placeholder="Cadete Femenino A"
            maxLength={80}
          />

          <Pildoras
            etiqueta="Dónde va"
            valor={eq.zona}
            alElegir={(v) => alCambiar({ zona: v })}
            opciones={[
              { valor: 'cantera', etiqueta: 'Cantera' },
              { valor: 'nacional', etiqueta: 'Competición nacional' },
            ]}
          />

          <View style={e.dos}>
            <View style={{ flex: 1 }}>
              <Campo
                etiqueta="Categoría"
                value={eq.categoria}
                onChangeText={(v) => alCambiar({ categoria: v })}
                placeholder="Cantera"
                maxLength={60}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Campo
                etiqueta="Liga"
                value={eq.liga}
                onChangeText={(v) => alCambiar({ liga: v })}
                placeholder="Primera División A1"
                maxLength={80}
              />
            </View>
          </View>

          <Campo
            etiqueta="Resumen de la tarjeta"
            value={eq.resumen}
            onChangeText={(v) => alCambiar({ resumen: v })}
            placeholder="14 jugadoras · Grupo A"
            maxLength={120}
          />

          <CampoImagen
            etiqueta="Foto de la tarjeta"
            ruta={eq.img}
            proporcion={[4, 3]}
            subir={subir}
            alCambiar={(ruta) => alCambiar({ img: ruta })}
          />

          <Campo
            etiqueta="Texto alternativo de la foto"
            value={eq.alt}
            onChangeText={(v) => alCambiar({ alt: v })}
            ayuda="Lo que lee un lector de pantalla. Describe la foto en una frase."
            maxLength={160}
          />

          <CampoImagen
            etiqueta="Foto de cabecera"
            ayuda="La banda ancha de detrás del título en su página."
            ruta={eq.headerImg}
            proporcion={[21, 9]}
            subir={subir}
            alCambiar={(ruta) => alCambiar({ headerImg: ruta })}
          />

          <Campo
            etiqueta="Antetítulo"
            value={eq.kicker}
            onChangeText={(v) => alCambiar({ kicker: v })}
            placeholder="Temporada 2026/27"
            maxLength={140}
          />

          <Campo
            etiqueta="Entradilla"
            value={eq.sub}
            onChangeText={(v) => alCambiar({ sub: v })}
            multiline
            maxLength={400}
          />

          <Interruptor
            etiqueta="Enseñar en la portada"
            ayuda="Sale entre los equipos destacados de la página de inicio."
            valor={eq.enPortada}
            alCambiar={(v) => alCambiar({ enPortada: v })}
          />

          <Plantilla
            titulo="Plantilla publicada"
            jugadores={eq.squad}
            alCambiar={(squad) => alCambiar({ squad })}
          />

          <Tecnicos staff={eq.staff} alCambiar={(staff) => alCambiar({ staff })} />

          <Datos datos={eq.datos} alCambiar={(d) => alCambiar({ datos: d })} />

          <View style={{ marginTop: espacio.lg }}>
            <Boton tono="peligro" icono="trash-outline" ancho onPress={alBorrar}>
              Quitar ficha
            </Boton>
          </View>
        </View>
      ) : null}
    </Tarjeta>
  )
}

// --- sublistas ------------------------------------------------------------

function Plantilla({
  titulo,
  jugadores,
  alCambiar,
}: {
  titulo: string
  jugadores: JugadorWeb[]
  alCambiar: (j: JugadorWeb[]) => void
}) {
  const cambiar = (i: number, cambios: Partial<JugadorWeb>) =>
    alCambiar(jugadores.map((x, k) => (k === i ? { ...x, ...cambios } : x)))

  return (
    <View style={e.sublista}>
      <Text style={e.subtitulo}>{titulo}</Text>
      <Secundario>Lo que se publica en internet: dorsal, nombre y posición. Nada más.</Secundario>

      {jugadores.map((j, i) => (
        <View key={i} style={e.filaSub}>
          <TextInput
            value={j.numero}
            onChangeText={(v) => cambiar(i, { numero: v.replace(/\D/g, '').slice(0, 3) })}
            placeholder="Nº"
            placeholderTextColor={color.apagado}
            keyboardType="number-pad"
            style={[e.miniEntrada, { width: 48, textAlign: 'center' }]}
          />
          <TextInput
            value={j.nombre}
            onChangeText={(v) => cambiar(i, { nombre: v })}
            placeholder="Nombre"
            placeholderTextColor={color.apagado}
            style={[e.miniEntrada, { flex: 2 }]}
          />
          <TextInput
            value={j.posicion}
            onChangeText={(v) => cambiar(i, { posicion: v })}
            placeholder="Posición"
            placeholderTextColor={color.apagado}
            style={[e.miniEntrada, { flex: 1.4 }]}
          />
          <Pressable
            onPress={() => alCambiar(jugadores.filter((_, k) => k !== i))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Quitar jugador"
          >
            <Ionicons name="close-circle" size={22} color={color.rojo} />
          </Pressable>
        </View>
      ))}

      <Boton
        tono="fantasma"
        icono="add"
        onPress={() => alCambiar([...jugadores, { numero: '', nombre: '', posicion: '' }])}
      >
        Añadir jugador
      </Boton>
    </View>
  )
}

function Tecnicos({
  staff,
  alCambiar,
}: {
  staff: { nombre: string; rol: string }[]
  alCambiar: (s: { nombre: string; rol: string }[]) => void
}) {
  const cambiar = (i: number, cambios: Partial<{ nombre: string; rol: string }>) =>
    alCambiar(staff.map((x, k) => (k === i ? { ...x, ...cambios } : x)))

  return (
    <View style={e.sublista}>
      <Text style={e.subtitulo}>Cuerpo técnico</Text>

      {staff.map((t, i) => (
        <View key={i} style={e.filaSub}>
          <TextInput
            value={t.nombre}
            onChangeText={(v) => cambiar(i, { nombre: v })}
            placeholder="Nombre"
            placeholderTextColor={color.apagado}
            style={[e.miniEntrada, { flex: 2 }]}
          />
          <TextInput
            value={t.rol}
            onChangeText={(v) => cambiar(i, { rol: v })}
            placeholder="Entrenador"
            placeholderTextColor={color.apagado}
            style={[e.miniEntrada, { flex: 1.4 }]}
          />
          <Pressable
            onPress={() => alCambiar(staff.filter((_, k) => k !== i))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Quitar técnico"
          >
            <Ionicons name="close-circle" size={22} color={color.rojo} />
          </Pressable>
        </View>
      ))}

      <Boton
        tono="fantasma"
        icono="add"
        onPress={() => alCambiar([...staff, { nombre: '', rol: '' }])}
      >
        Añadir técnico
      </Boton>
    </View>
  )
}

function Datos({
  datos,
  alCambiar,
}: {
  datos: { label: string; valor: string }[]
  alCambiar: (d: { label: string; valor: string }[]) => void
}) {
  const cambiar = (i: number, cambios: Partial<{ label: string; valor: string }>) =>
    alCambiar(datos.map((x, k) => (k === i ? { ...x, ...cambios } : x)))

  return (
    <View style={e.sublista}>
      <Text style={e.subtitulo}>Datos de la ficha</Text>
      <Secundario>Los pares que salen en la cabecera: «Entrenador — Juan», «Sede — Pumarín».</Secundario>

      {datos.map((d, i) => (
        <View key={i} style={e.filaSub}>
          <TextInput
            value={d.label}
            onChangeText={(v) => cambiar(i, { label: v })}
            placeholder="Etiqueta"
            placeholderTextColor={color.apagado}
            style={[e.miniEntrada, { flex: 1 }]}
          />
          <TextInput
            value={d.valor}
            onChangeText={(v) => cambiar(i, { valor: v })}
            placeholder="Valor"
            placeholderTextColor={color.apagado}
            style={[e.miniEntrada, { flex: 1.6 }]}
          />
          <Pressable
            onPress={() => alCambiar(datos.filter((_, k) => k !== i))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Quitar dato"
          >
            <Ionicons name="close-circle" size={22} color={color.rojo} />
          </Pressable>
        </View>
      ))}

      <Boton
        tono="fantasma"
        icono="add"
        onPress={() => alCambiar([...datos, { label: '', valor: '' }])}
      >
        Añadir dato
      </Boton>
    </View>
  )
}

const e = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm },
  titulo: { fontSize: 16, fontWeight: '700', color: color.tinta },
  meta: { fontSize: 12.5, color: color.apagado },
  cuerpo: {
    marginTop: espacio.lg,
    paddingTop: espacio.lg,
    borderTopWidth: 1,
    borderTopColor: color.linea,
  },
  dos: { flexDirection: 'row', gap: espacio.md },

  sublista: {
    marginBottom: espacio.lg,
    padding: espacio.md,
    backgroundColor: color.fondo,
    borderRadius: radio.md,
    gap: espacio.sm,
  },
  subtitulo: { fontSize: 14, fontWeight: '800', color: color.tinta },
  filaSub: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  miniEntrada: {
    borderWidth: 1,
    borderColor: color.linea,
    borderRadius: radio.sm,
    paddingHorizontal: espacio.sm,
    paddingVertical: 9,
    fontSize: 15,
    color: color.tinta,
    backgroundColor: color.blanco,
    minHeight: 42,
  },
})
