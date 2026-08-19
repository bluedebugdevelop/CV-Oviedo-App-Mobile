// ==========================================================================
// Inicio.
//
// Lo que alguien quiere saber al abrir la app en diez segundos: si hay algún
// aviso sin leer, cuándo es el próximo partido y qué se cuenta en el club.
//
// El orden no es casual. Primero lo que le pide algo (avisos), luego lo suyo
// (el partido), y al final lo del club (noticias). Las noticias son lo que más
// bonito queda y lo que menos urge, así que van abajo.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Pantalla } from '../../componentes/Pantalla'
import { Banda, Boton, Cargando, Etiqueta, Franja, Tarjeta, Vacio } from '../../componentes/ui'
import { useAvisos } from '../../contexto/avisos'
import { useSesion } from '../../contexto/sesion'
import { urlWeb } from '../../lib/config'
import { encuadre } from '../../lib/imagen'
import { fechaCorta, hora, relativoDia } from '../../lib/fechas'
import { useCompeticion, useContenido } from '../../lib/hooks'
import { aFecha, enCasa, repartirPartidos, rivalDe } from '../../lib/web/competicion'
import type { Noticia } from '../../lib/web/contenido'
import { color, espacio, radio, sombra } from '../../tema'

export default function Inicio() {
  const { perfil, equipoActivo, equipos } = useSesion()
  const { noLeidos } = useAvisos()
  const contenido = useContenido()
  const competicion = useCompeticion(equipoActivo?.claveCompeticion ?? null)

  const proximo = useMemo(() => {
    if (!competicion.datos) return null
    return repartirPartidos(competicion.datos.partidos).proximos[0] ?? null
  }, [competicion.datos])

  const noticias = useMemo(() => contenido.datos?.noticias ?? [], [contenido.datos])
  // La destacada primero: es la que el club ha marcado como la importante.
  const ordenadas = useMemo(
    () => [...noticias].sort((a, b) => Number(b.destacada) - Number(a.destacada)),
    [noticias],
  )

  const nombreCorto = perfil?.nombre.split(' ')[0] ?? ''

  return (
    <Pantalla
      ante={saludo()}
      titulo={nombreCorto || 'Club Voleibol Oviedo'}
      refrescando={contenido.refrescando}
      alRefrescar={contenido.recargar}
    >
      {/* El selector de equipo NO va aquí: Inicio es la pantalla del club
          —noticias, lo que viene— y no la de ningún equipo en concreto. Se
          cambia de equipo en las pestañas que sí son suyas. */}
      {equipos.length === 0 ? (
        <Banda tono="ojo">
          Todavía no estás en ningún equipo. En cuanto el club te asigne uno verás aquí su
          calendario, su chat y sus avisos.
        </Banda>
      ) : null}

      {noLeidos > 0 ? (
        <Pressable onPress={() => router.push('/avisos')}>
          <View style={e.alerta}>
            <View style={e.alertaIcono}>
              <Ionicons name="notifications" size={20} color={color.blanco} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={e.alertaTitulo}>
                {noLeidos === 1 ? 'Tienes 1 aviso sin leer' : `Tienes ${noLeidos} avisos sin leer`}
              </Text>
              <Text style={e.alertaTexto}>Toca para verlos</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={color.blanco} />
          </View>
        </Pressable>
      ) : null}

      {/* --- próximo partido --- */}
      {equipoActivo?.claveCompeticion ? (
        <>
          <Franja titulo="Próximo partido" />
          {competicion.cargando ? (
            <Tarjeta>
              <Cargando />
            </Tarjeta>
          ) : proximo && competicion.datos ? (
            <Tarjeta onPress={() => router.push('/equipo')}>
              <View style={e.partidoFila}>
                <View style={e.fecha}>
                  <Text style={e.fechaDia}>{fechaDia(proximo.iso)}</Text>
                  <Text style={e.fechaMes}>{fechaMes(proximo.iso)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Etiqueta
                    fondo={enCasa(proximo, competicion.datos.equipoClub) ? color.verdeTinte : color.tinte}
                    texto={enCasa(proximo, competicion.datos.equipoClub) ? color.verde : color.azulOscuro}
                  >
                    {enCasa(proximo, competicion.datos.equipoClub) ? 'EN CASA' : 'FUERA'}
                  </Etiqueta>
                  <Text style={e.rival} numberOfLines={2}>
                    {rivalDe(proximo, competicion.datos.equipoClub)}
                  </Text>
                  <Text style={e.cuando}>
                    {cuando(proximo.iso)}
                    {proximo.sede ? ` · ${proximo.sede}` : ''}
                  </Text>
                </View>
              </View>
            </Tarjeta>
          ) : (
            <Tarjeta>
              <Text style={e.suave}>
                {competicion.error
                  ? 'No se ha podido cargar el calendario.'
                  : 'No hay más partidos en el calendario de la federación.'}
              </Text>
            </Tarjeta>
          )}
        </>
      ) : null}

      {/* --- noticias --- */}
      <Franja
        titulo="Noticias del club"
        extra={
          noticias.length > 0 ? (
            <Text style={e.contador}>{noticias.length}</Text>
          ) : null
        }
      />

      {contenido.cargando ? (
        <Cargando texto="Cargando noticias…" />
      ) : contenido.error ? (
        <Tarjeta>
          <Banda tono="error">{contenido.error}</Banda>
          <Boton tono="fantasma" icono="refresh" onPress={contenido.recargar}>
            Reintentar
          </Boton>
        </Tarjeta>
      ) : ordenadas.length === 0 ? (
        <Vacio icono="newspaper-outline" titulo="Sin noticias" texto="El club no ha publicado nada todavía." />
      ) : (
        <View style={{ gap: espacio.md }}>
          {ordenadas.map((n) => (
            <TarjetaNoticia key={n.id} noticia={n} />
          ))}
        </View>
      )}
    </Pantalla>
  )
}

function TarjetaNoticia({ noticia }: { noticia: Noticia }) {
  const imagen = urlWeb(noticia.img)
  // Sin cuerpo no hay ficha que abrir: la noticia es solo la tarjeta. Es la
  // misma regla que usa `enlaceNoticia` en la web.
  const abrible = noticia.cuerpo.length > 0

  return (
    <Tarjeta
      style={e.noticia}
      onPress={abrible ? () => router.push(`/noticia/${noticia.slug}`) : undefined}
    >
      {imagen ? (
        <Image
          source={{ uri: imagen }}
          style={e.noticiaFoto}
          contentFit="cover"
          contentPosition={encuadre(noticia.foco)}
          transition={180}
        />
      ) : null}
      <View style={e.noticiaTexto}>
        <View style={e.noticiaMeta}>
          {noticia.categoria ? <Etiqueta>{noticia.categoria}</Etiqueta> : null}
          {noticia.fecha ? <Text style={e.suave}>{noticia.fecha}</Text> : null}
        </View>
        <Text style={e.noticiaTitulo}>{noticia.titulo}</Text>
        {noticia.resumen ? (
          <Text style={e.suave} numberOfLines={3}>
            {noticia.resumen}
          </Text>
        ) : null}
        {abrible ? (
          <View style={e.leerMas}>
            <Text style={e.leerMasTexto}>Leer</Text>
            <Ionicons name="arrow-forward" size={14} color={color.azul} />
          </View>
        ) : null}
      </View>
    </Tarjeta>
  )
}

// --- ayudas de fecha ------------------------------------------------------

function saludo(ahora = new Date()): string {
  const h = ahora.getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 14) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

const fechaDia = (iso: string) => String(aFecha(iso)?.getDate() ?? '—')

const fechaMes = (iso: string) => {
  const f = aFecha(iso)
  return f ? fechaCorta(f).split(' ')[2] : ''
}

function cuando(iso: string): string {
  const f = aFecha(iso)
  if (!f) return 'Fecha por confirmar'
  // Si la federación no ha puesto hora, el ISO viene a medianoche: enseñar
  // «00:00» haría pensar que el partido es de madrugada.
  const conHora = /T\d{2}:\d{2}/.test(iso) && !iso.endsWith('T00:00')
  return conHora ? `${relativoDia(f)} · ${hora(f)}` : `${relativoDia(f)} · hora sin confirmar`
}

const e = StyleSheet.create({
  suave: { fontSize: 13, color: color.apagado, lineHeight: 19 },
  contador: { fontSize: 13, color: color.apagado, fontWeight: '600' },

  alerta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    backgroundColor: color.azul,
    borderRadius: radio.lg,
    padding: espacio.lg,
    marginBottom: espacio.sm,
    ...sombra,
  },
  alertaIcono: {
    width: 40,
    height: 40,
    borderRadius: radio.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertaTitulo: { color: color.blanco, fontSize: 15, fontWeight: '700' },
  alertaTexto: { color: '#cfe4f8', fontSize: 12.5, marginTop: 1 },

  partidoFila: { flexDirection: 'row', gap: espacio.lg, alignItems: 'center' },
  fecha: {
    width: 58,
    height: 62,
    borderRadius: radio.md,
    backgroundColor: color.tinte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fechaDia: { fontSize: 24, fontWeight: '800', color: color.azulOscuro, lineHeight: 27 },
  fechaMes: { fontSize: 11, fontWeight: '700', color: color.azul, letterSpacing: 0.5 },
  rival: { fontSize: 17, fontWeight: '700', color: color.tinta, marginTop: espacio.sm },
  cuando: { fontSize: 13, color: color.apagado, marginTop: 2 },

  noticia: { padding: 0, overflow: 'hidden' },
  noticiaFoto: { width: '100%', height: 168, backgroundColor: color.tinte },
  noticiaTexto: { padding: espacio.lg, gap: espacio.sm },
  noticiaMeta: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
  noticiaTitulo: { fontSize: 17, fontWeight: '700', color: color.tinta, lineHeight: 23 },
  leerMas: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: espacio.xs },
  leerMasTexto: { fontSize: 13, fontWeight: '700', color: color.azul },
})
