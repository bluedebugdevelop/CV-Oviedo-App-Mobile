// ==========================================================================
// Las noticias de la web, desde el móvil.
//
// Publicar una noticia es lo que más se hace en el panel: después de un
// partido, con el móvil en la mano y la foto recién hecha. Por eso esta
// pantalla existe.
//
// El cuerpo son párrafos sueltos, no un texto con saltos de línea, porque así
// es como los guarda la web: un array de cadenas que se pintan como <p>. Se
// editan en un solo campo separando por líneas en blanco, que es lo natural al
// escribir, y se parte al guardar.
//
// Nada se publica hasta pulsar «Publicar cambios»: se edita sobre una copia
// (ver lib/listaEditable.ts).
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
  Interruptor,
  Secundario,
  Tarjeta,
  Vacio,
} from '../../../componentes/ui'
import { usePanel } from '../../../contexto/panel'
import { fechaDeHoy, slugificar, useListaEditable } from '../../../lib/listaEditable'
import type { Noticia } from '../../../lib/web/contenido'
import { color, espacio, radio } from '../../../tema'

const nuevaNoticia = (): Noticia => ({
  id: `n-${Date.now().toString(36)}`,
  slug: '',
  destacada: false,
  categoria: 'Club',
  fecha: fechaDeHoy(),
  titulo: '',
  resumen: '',
  img: '',
  foco: '',
  cuerpo: [],
  cta: '',
})

export default function NoticiasPanel() {
  const { datos, guardar, subir } = usePanel()
  const lista = useListaEditable<Noticia>(datos?.noticias, (x) => guardar('noticias', x))
  const [abierta, setAbierta] = useState<number | null>(null)

  function borrar(i: number) {
    Alert.alert('Quitar noticia', `«${lista.elementos[i].titulo || 'sin título'}»`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          lista.quitar(i)
          setAbierta(null)
        },
      },
    ])
  }

  function crear() {
    lista.anadir(nuevaNoticia())
    setAbierta(0)
  }

  return (
    <Pantalla
      ante="Panel de la web"
      titulo="Noticias"
      atras
      accion={{ icono: 'add-circle', etiqueta: 'Nueva noticia', alPulsar: crear }}
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
          icono="newspaper-outline"
          titulo="Sin noticias"
          texto="Crea la primera y se verá en la portada de la web."
        >
          <Boton icono="add" onPress={crear}>
            Nueva noticia
          </Boton>
        </Vacio>
      ) : (
        <View style={{ gap: espacio.md }}>
          {lista.elementos.map((n, i) => (
            <FichaNoticia
              key={n.id || i}
              noticia={n}
              abierta={abierta === i}
              primera={i === 0}
              ultima={i === lista.elementos.length - 1}
              alAbrir={() => setAbierta(abierta === i ? null : i)}
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

function FichaNoticia({
  noticia,
  abierta,
  primera,
  ultima,
  alAbrir,
  alCambiar,
  alMover,
  alBorrar,
  subir,
}: {
  noticia: Noticia
  abierta: boolean
  primera: boolean
  ultima: boolean
  alAbrir: () => void
  alCambiar: (cambios: Partial<Noticia>) => void
  alMover: (salto: 1 | -1) => void
  alBorrar: () => void
  subir: (uri: string, tipo: string, nombre: string) => Promise<string>
}) {
  return (
    <Tarjeta>
      <Pressable onPress={alAbrir} accessibilityRole="button" style={e.cabecera}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={e.etiquetas}>
            {noticia.destacada ? (
              <Etiqueta fondo={color.ambarTinte} texto="#8a5a00">
                DESTACADA
              </Etiqueta>
            ) : null}
            {noticia.categoria ? <Etiqueta>{noticia.categoria.toUpperCase()}</Etiqueta> : null}
            {!noticia.titulo ? (
              <Etiqueta fondo={color.rojoTinte} texto={color.rojo}>
                SIN TÍTULO
              </Etiqueta>
            ) : null}
          </View>
          <Text style={e.titulo}>{noticia.titulo || 'Noticia nueva'}</Text>
          <Text style={e.meta}>
            {noticia.fecha}
            {noticia.cuerpo.length > 0 ? ` · ${noticia.cuerpo.length} párrafos` : ' · solo tarjeta'}
          </Text>
        </View>
        <Ionicons name={abierta ? 'chevron-up' : 'chevron-down'} size={18} color={color.linea} />
      </Pressable>

      {abierta ? (
        <View style={e.cuerpo}>
          <Campo
            etiqueta="Titular"
            value={noticia.titulo}
            onChangeText={(v) =>
              // El slug se genera del titular mientras nadie lo haya tocado a
              // mano. Cambiarlo después rompería el enlace de una noticia ya
              // compartida, así que en cuanto tiene valor propio no se toca.
              alCambiar({
                titulo: v,
                slug: noticia.slug && noticia.slug !== slugificar(noticia.titulo)
                  ? noticia.slug
                  : slugificar(v),
              })
            }
            placeholder="El cadete femenino se lleva el derbi"
            maxLength={160}
          />

          <Campo
            etiqueta="Entradilla"
            value={noticia.resumen}
            onChangeText={(v) => alCambiar({ resumen: v })}
            placeholder="Lo que se lee en la tarjeta del listado."
            multiline
            maxLength={600}
          />

          <View style={e.dos}>
            <View style={{ flex: 1 }}>
              <Campo
                etiqueta="Categoría"
                value={noticia.categoria}
                onChangeText={(v) => alCambiar({ categoria: v })}
                placeholder="Club"
                maxLength={60}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Campo
                etiqueta="Fecha"
                value={noticia.fecha}
                onChangeText={(v) => alCambiar({ fecha: v })}
                placeholder="19 ago 2026"
                maxLength={40}
              />
            </View>
          </View>

          <CampoImagen
            etiqueta="Imagen"
            ayuda="Apaisada. Es la que sale en la tarjeta y en la cabecera de la noticia."
            ruta={noticia.img}
            proporcion={[16, 9]}
            subir={subir}
            alCambiar={(ruta) => alCambiar({ img: ruta })}
          />

          <Campo
            etiqueta="Texto de la noticia"
            value={noticia.cuerpo.join('\n\n')}
            onChangeText={(v) =>
              // Separa por líneas en blanco: cada bloque será un párrafo en la
              // web. Sin texto, la noticia se queda como tarjeta sin ficha.
              alCambiar({ cuerpo: v.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) })
            }
            placeholder={'Primer párrafo.\n\nSegundo párrafo.'}
            multiline
            style={{ minHeight: 200 }}
          />
          <Secundario>
            Deja una línea en blanco entre párrafos. Si lo dejas vacío, la noticia sale solo como
            tarjeta, sin página propia.
          </Secundario>

          <Interruptor
            etiqueta="Destacada"
            ayuda="Sale la primera y más grande en la portada."
            valor={noticia.destacada}
            alCambiar={(v) => alCambiar({ destacada: v })}
          />

          <Interruptor
            etiqueta="Botón de preinscripción"
            ayuda="Añade el botón que lleva al formulario de la cantera."
            valor={noticia.cta === 'preinscripcion'}
            alCambiar={(v) => alCambiar({ cta: v ? 'preinscripcion' : '' })}
          />

          <View style={e.acciones}>
            <Pressable
              onPress={() => alMover(-1)}
              disabled={primera}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Subir"
              style={[e.iconoAccion, primera ? { opacity: 0.3 } : null]}
            >
              <Ionicons name="arrow-up" size={19} color={color.azul} />
            </Pressable>
            <Pressable
              onPress={() => alMover(1)}
              disabled={ultima}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Bajar"
              style={[e.iconoAccion, ultima ? { opacity: 0.3 } : null]}
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
