// ==========================================================================
// Las fotos fijas de la web: las bandas de cabecera de cada sección.
//
// A diferencia de las otras tres listas, aquí no se crea ni se borra nada. Los
// huecos los fija el código de la web (`src/data/fotosSitio.js`); lo único que
// se hace es decir qué foto va en cada uno.
//
// Por eso se pinta el catálogo entero y no la lista guardada: si la web añade
// una cabecera nueva, aparece aquí sola, con la foto que trae por defecto y
// lista para cambiar. Si se pintara solo lo guardado, un hueco nuevo sería
// invisible hasta que alguien lo tocara.
//
// «Quitar» no deja el hueco vacío: lo devuelve a la foto que trae el código.
// Una cabecera en blanco es una página rota, así que no hay forma de dejarla
// así desde aquí.
// ==========================================================================

import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { CampoImagen } from '../../../componentes/CampoImagen'
import { Pantalla } from '../../../componentes/Pantalla'
import { Banda, BarraPublicar, Cargando, Etiqueta, Tarjeta } from '../../../componentes/ui'
import { usePanel } from '../../../contexto/panel'
import type { FotoSitio } from '../../../lib/web/contenido'
import { color, espacio } from '../../../tema'

export default function FotosPanel() {
  const { datos, catalogoFotos, guardar, guardando, subir } = usePanel()

  // Copia de trabajo, indexada por clave: publicar manda la lista entera.
  const [cambios, setCambios] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const guardadas = useMemo(() => {
    const mapa: Record<string, string> = {}
    for (const f of datos?.fotos ?? []) mapa[f.clave] = f.ruta
    return mapa
  }, [datos])

  const sucio = Object.keys(cambios).length > 0

  /** La ruta que hay que enseñar: lo tocado, lo guardado o lo que trae el código. */
  const rutaDe = (clave: string, porDefecto: string) =>
    cambios[clave] ?? guardadas[clave] ?? porDefecto

  async function publicar() {
    setError(null)
    const lista: FotoSitio[] = catalogoFotos.map((h) => ({
      clave: h.clave,
      // Cadena vacía = «vuelve a la del código». El servidor lo entiende así.
      ruta: rutaDe(h.clave, h.porDefecto) === h.porDefecto ? '' : rutaDe(h.clave, h.porDefecto),
    }))

    try {
      await guardar('fotos', lista)
      setCambios({})
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo publicar.')
    }
  }

  if (catalogoFotos.length === 0) {
    return (
      <Pantalla ante="Panel de la web" titulo="Fotos" atras>
        <Cargando texto="Cargando los huecos de foto…" />
      </Pantalla>
    )
  }

  return (
    <Pantalla ante="Panel de la web" titulo="Fotos de las secciones" atras>
      <Banda tono="info">
        Estos huecos los fija el código de la web. Aquí solo se cambia qué foto va en cada uno.
      </Banda>

      {error ? <Banda tono="error">{error}</Banda> : null}

      {sucio ? (
        <BarraPublicar
          guardando={guardando}
          alPublicar={() => void publicar()}
          alDescartar={() => setCambios({})}
        />
      ) : null}

      <View style={{ gap: espacio.md }}>
        {catalogoFotos.map((hueco) => {
          const actual = rutaDe(hueco.clave, hueco.porDefecto)
          const propia = actual !== hueco.porDefecto

          return (
            <Tarjeta key={hueco.clave}>
              <View style={e.cabecera}>
                <View style={{ flex: 1 }}>
                  <Text style={e.titulo}>{hueco.titulo}</Text>
                  <Text style={e.meta}>{hueco.donde}</Text>
                </View>
                {propia ? (
                  <Etiqueta fondo={color.verdeTinte} texto={color.verde}>
                    CAMBIADA
                  </Etiqueta>
                ) : (
                  <Etiqueta>POR DEFECTO</Etiqueta>
                )}
              </View>

              <View style={{ marginTop: espacio.md }}>
                <CampoImagen
                  etiqueta={`Formato: ${hueco.formato}`}
                  ruta={actual}
                  proporcion={proporcionDe(hueco.formato)}
                  subir={subir}
                  alCambiar={(ruta) =>
                    // Vacío al quitar significa «la del código», así que se
                    // guarda esa ruta y el hueco vuelve a su estado original.
                    setCambios((c) => ({ ...c, [hueco.clave]: ruta || hueco.porDefecto }))
                  }
                  ayuda={propia ? 'Quitar la devuelve a la original.' : undefined}
                />
              </View>
            </Tarjeta>
          )
        })}
      </View>
    </Pantalla>
  )
}

/**
 * El recorte que pide cada formato de la web.
 *
 * Los nombres son los de `components/formatosImagen.js` en CVOWeb. Si aparece
 * uno nuevo, cae en apaisado, que es lo que menos daño hace.
 */
function proporcionDe(formato: string): [number, number] {
  switch (formato) {
    case 'hero':
      return [16, 9]
    case 'cabecera':
      return [21, 9]
    case 'cuadrada':
      return [1, 1]
    case 'retrato':
      return [3, 4]
    default:
      return [16, 9]
  }
}

const e = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.md },
  titulo: { fontSize: 15.5, fontWeight: '700', color: color.tinta },
  meta: { fontSize: 12.5, color: color.apagado, marginTop: 2, lineHeight: 18 },
})
