// ==========================================================================
// La ficha de una noticia.
//
// Se busca por `slug` dentro del contenido que ya trae la app, no con una
// petición por noticia: `/api/contenido` las devuelve todas de golpe y son
// unas pocas decenas. Una llamada menos y funciona al instante al tocar la
// tarjeta.
//
// Que se llegue por `slug` y no por `id` es a propósito: es la misma dirección
// que en la web (`/noticias/lo-que-sea`), así que un enlace compartido de la
// web puede abrir esta pantalla el día que se enganchen los deep links.
// ==========================================================================

import { Image } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'
import { Share, StyleSheet, Text, View } from 'react-native'

import { Pantalla } from '../../componentes/Pantalla'
import { Banda, Cargando, Etiqueta, Vacio } from '../../componentes/ui'
import { WEB_BASE, urlWeb } from '../../lib/config'
import { encuadre } from '../../lib/imagen'
import { useContenido } from '../../lib/hooks'
import { color, espacio, radio } from '../../tema'

export default function FichaNoticia() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { datos, cargando, error } = useContenido()

  const noticia = useMemo(
    () => datos?.noticias.find((n) => n.slug === slug) ?? null,
    [datos, slug],
  )

  if (cargando) {
    return (
      <Pantalla titulo="Noticia" atras>
        <Cargando />
      </Pantalla>
    )
  }

  if (error) {
    return (
      <Pantalla titulo="Noticia" atras>
        <Banda tono="error">{error}</Banda>
      </Pantalla>
    )
  }

  if (!noticia) {
    return (
      <Pantalla titulo="Noticia" atras>
        <Vacio
          icono="newspaper-outline"
          titulo="No encontrada"
          texto="Puede que el club la haya quitado o cambiado de sitio."
        />
      </Pantalla>
    )
  }

  const foto = urlWeb(noticia.img)

  return (
    <Pantalla
      ante={noticia.categoria || 'Noticia'}
      titulo={noticia.titulo}
      atras
      accion={{
        icono: 'share-outline',
        etiqueta: 'Compartir',
        alPulsar: () =>
          void Share.share({
            message: `${noticia.titulo} — ${WEB_BASE}/noticias/${noticia.slug}`,
          }),
      }}
    >
      {foto ? (
        <Image
          source={{ uri: foto }}
          style={e.foto}
          contentFit="cover"
          contentPosition={encuadre(noticia.foco)}
          transition={200}
        />
      ) : null}

      <View style={e.meta}>
        {noticia.categoria ? <Etiqueta>{noticia.categoria}</Etiqueta> : null}
        {noticia.fecha ? <Text style={e.fecha}>{noticia.fecha}</Text> : null}
      </View>

      {noticia.resumen ? <Text style={e.entradilla}>{noticia.resumen}</Text> : null}

      {noticia.cuerpo.map((parrafo, i) => (
        <Text key={i} style={e.parrafo}>
          {parrafo}
        </Text>
      ))}
    </Pantalla>
  )
}

const e = StyleSheet.create({
  foto: {
    width: '100%',
    height: 210,
    borderRadius: radio.lg,
    backgroundColor: color.tinte,
    marginBottom: espacio.lg,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, marginBottom: espacio.md },
  fecha: { fontSize: 13, color: color.apagado },
  entradilla: {
    fontSize: 17,
    lineHeight: 25,
    color: color.tinta,
    fontWeight: '600',
    marginBottom: espacio.lg,
  },
  parrafo: { fontSize: 16, lineHeight: 25, color: color.tinta, marginBottom: espacio.lg },
})
