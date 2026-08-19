// ==========================================================================
// Los patrocinadores de la web.
//
// Cada uno tiene dos caras: la tarjeta del listado (logo, nombre, lema) y su
// ficha propia (foto grande, descripción, párrafos). Se editan juntas porque
// se dan de alta a la vez, cuando se firma el patrocinio.
//
// El `color` es el de la marca del patrocinador y la web lo usa para el fondo
// de su ficha. Va como hexadecimal porque es lo que valida el servidor; si se
// escribe cualquier otra cosa, la descarta y la ficha sale con el azul del
// club, que tampoco está mal pero no es lo que se pidió.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import { CampoImagen } from '../../../componentes/CampoImagen'
import { Pantalla } from '../../../componentes/Pantalla'
import {
  Banda,
  BarraPublicar,
  Boton,
  Campo,
  Etiqueta,
  Secundario,
  Tarjeta,
  Vacio,
} from '../../../componentes/ui'
import { usePanel } from '../../../contexto/panel'
import { slugificar, useListaEditable } from '../../../lib/listaEditable'
import type { Patrocinador } from '../../../lib/web/contenido'
import { color, espacio, radio } from '../../../tema'

const nuevoPatrocinador = (): Patrocinador => ({
  slug: '',
  nombre: '',
  logo: '',
  foto: '',
  tagline: '',
  web: '',
  webTexto: '',
  color: '',
  descripcion: '',
  parrafos: [],
})

const HEX = /^#[0-9a-f]{3,8}$/i

export default function PatrocinadoresPanel() {
  const { datos, guardar, subir } = usePanel()
  const lista = useListaEditable<Patrocinador>(datos?.patrocinadores, (x) =>
    guardar('patrocinadores', x),
  )
  const [abierto, setAbierto] = useState<number | null>(null)

  function borrar(i: number) {
    Alert.alert('Quitar patrocinador', lista.elementos[i].nombre || 'sin nombre', [
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
    lista.anadir(nuevoPatrocinador())
    setAbierto(0)
  }

  return (
    <Pantalla
      ante="Panel de la web"
      titulo="Patrocinadores"
      atras
      accion={{ icono: 'add-circle', etiqueta: 'Nuevo patrocinador', alPulsar: crear }}
    >
      {lista.error ? <Banda tono="error">{lista.error}</Banda> : null}

      {lista.sucio ? (
        <BarraPublicar
          guardando={lista.guardando}
          alPublicar={() => void lista.guardar()}
          alDescartar={lista.descartar}
        />
      ) : null}

      {lista.elementos.length === 0 ? (
        <Vacio
          icono="ribbon-outline"
          titulo="Sin patrocinadores"
          texto="Añade el primero y saldrá en la web con su ficha."
        >
          <Boton icono="add" onPress={crear}>
            Nuevo patrocinador
          </Boton>
        </Vacio>
      ) : (
        <View style={{ gap: espacio.md }}>
          {lista.elementos.map((p, i) => (
            <Ficha
              key={p.slug || i}
              patrocinador={p}
              abierto={abierto === i}
              primero={i === 0}
              ultimo={i === lista.elementos.length - 1}
              alAbrir={() => setAbierto(abierto === i ? null : i)}
              alCambiar={(cambios) => lista.cambiar(i, cambios)}
              alMover={(salto) => lista.mover(i, salto)}
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
  patrocinador: p,
  abierto,
  primero,
  ultimo,
  alAbrir,
  alCambiar,
  alMover,
  alBorrar,
  subir,
}: {
  patrocinador: Patrocinador
  abierto: boolean
  primero: boolean
  ultimo: boolean
  alAbrir: () => void
  alCambiar: (cambios: Partial<Patrocinador>) => void
  alMover: (salto: 1 | -1) => void
  alBorrar: () => void
  subir: (uri: string, tipo: string, nombre: string) => Promise<string>
}) {
  const colorMal = Boolean(p.color) && !HEX.test(p.color)
  const webMal = Boolean(p.web) && !/^https?:\/\//i.test(p.web)

  return (
    <Tarjeta>
      <Pressable onPress={alAbrir} accessibilityRole="button" style={e.cabecera}>
        {p.color && !colorMal ? (
          <View style={[e.muestra, { backgroundColor: p.color }]} />
        ) : (
          <View style={[e.muestra, { backgroundColor: color.tinte }]} />
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={e.titulo}>{p.nombre || 'Patrocinador nuevo'}</Text>
          <Text style={e.meta} numberOfLines={1}>
            {p.tagline || 'sin lema'}
          </Text>
          {!p.logo ? (
            <Etiqueta fondo={color.ambarTinte} texto="#8a5a00">
              SIN LOGO
            </Etiqueta>
          ) : null}
        </View>
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={18} color={color.linea} />
      </Pressable>

      {abierto ? (
        <View style={e.cuerpo}>
          <Campo
            etiqueta="Nombre"
            value={p.nombre}
            onChangeText={(v) =>
              alCambiar({
                nombre: v,
                slug: p.slug && p.slug !== slugificar(p.nombre) ? p.slug : slugificar(v),
              })
            }
            placeholder="Sidrería Güelita"
            maxLength={80}
          />

          <Campo
            etiqueta="Lema"
            value={p.tagline}
            onChangeText={(v) => alCambiar({ tagline: v })}
            placeholder="Cocina asturiana de siempre"
            maxLength={140}
          />

          <CampoImagen
            etiqueta="Logo"
            ayuda="Sale en la tira de patrocinadores. Fondo transparente si se puede."
            ruta={p.logo}
            proporcion={[3, 2]}
            subir={subir}
            alCambiar={(ruta) => alCambiar({ logo: ruta })}
          />

          <CampoImagen
            etiqueta="Foto de la ficha"
            ayuda="La imagen grande de su página propia."
            ruta={p.foto}
            proporcion={[16, 9]}
            subir={subir}
            alCambiar={(ruta) => alCambiar({ foto: ruta })}
          />

          <Campo
            etiqueta="Página web"
            value={p.web}
            onChangeText={(v) => alCambiar({ web: v })}
            placeholder="https://www.ejemplo.com"
            autoCapitalize="none"
            keyboardType="url"
            inputMode="url"
            error={webMal ? 'Tiene que empezar por http:// o https://' : undefined}
          />

          <Campo
            etiqueta="Texto del enlace"
            value={p.webTexto}
            onChangeText={(v) => alCambiar({ webTexto: v })}
            placeholder="www.ejemplo.com"
            maxLength={120}
          />

          <Campo
            etiqueta="Color de marca"
            value={p.color}
            onChangeText={(v) => alCambiar({ color: v })}
            placeholder="#c8102e"
            autoCapitalize="none"
            maxLength={9}
            error={colorMal ? 'Tiene que ser un hexadecimal, como #c8102e' : undefined}
            ayuda="La web lo usa de fondo en su ficha."
          />

          <Campo
            etiqueta="Descripción corta"
            value={p.descripcion}
            onChangeText={(v) => alCambiar({ descripcion: v })}
            multiline
            maxLength={600}
          />

          <Campo
            etiqueta="Texto de la ficha"
            value={p.parrafos.join('\n\n')}
            onChangeText={(v) =>
              alCambiar({ parrafos: v.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean) })
            }
            placeholder={'Primer párrafo.\n\nSegundo párrafo.'}
            multiline
            style={{ minHeight: 160 }}
          />
          <Secundario>Deja una línea en blanco entre párrafos.</Secundario>

          <View style={e.acciones}>
            <Pressable
              onPress={() => alMover(-1)}
              disabled={primero}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Subir"
              style={[e.iconoAccion, primero ? { opacity: 0.3 } : null]}
            >
              <Ionicons name="arrow-up" size={19} color={color.azul} />
            </Pressable>
            <Pressable
              onPress={() => alMover(1)}
              disabled={ultimo}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Bajar"
              style={[e.iconoAccion, ultimo ? { opacity: 0.3 } : null]}
            >
              <Ionicons name="arrow-down" size={19} color={color.azul} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Boton tono="peligro" icono="trash-outline" onPress={alBorrar}>
              Quitar
            </Boton>
          </View>
        </View>
      ) : null}
    </Tarjeta>
  )
}

const e = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
  muestra: { width: 38, height: 38, borderRadius: radio.md },
  titulo: { fontSize: 16, fontWeight: '700', color: color.tinta },
  meta: { fontSize: 12.5, color: color.apagado },
  cuerpo: {
    marginTop: espacio.lg,
    paddingTop: espacio.lg,
    borderTopWidth: 1,
    borderTopColor: color.linea,
  },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, marginTop: espacio.md },
  iconoAccion: {
    width: 40,
    height: 40,
    borderRadius: radio.md,
    backgroundColor: color.tinte,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
