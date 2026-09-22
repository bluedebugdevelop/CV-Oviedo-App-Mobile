// ==========================================================================
// El equipo, de un vistazo.
//
// Sustituye al control segmentado de cuatro posiciones que había arriba de la
// pantalla. Aquel tenía dos problemas y el primero era literal: «Clasificación»
// no cabe en un cuarto del ancho de un móvil y salía cortada, así que había que
// tocar cada pestaña para saber qué era. El segundo es que ocupaba sitio fijo
// para no decir nada — un selector no es información.
//
// Aquí las cuatro secciones son tarjetas grandes con su nombre entero y, cada
// una, el dato que resume lo que hay dentro: cuántos partidos quedan, en qué
// puesto va el equipo, cuántos días entrena, cuánta gente es. Eso convierte la
// navegación en contenido: muchas veces la respuesta que se venía a buscar ya
// está aquí y no hace falta entrar.
//
// Arriba, el próximo partido. Es lo que más se mira y merece el mejor sitio.
//
// Es un COMPONENTE y no una pantalla, igual que `Conversacion` y `ListaAvisos`,
// porque se pinta en dos sitios: en la pestaña de Equipo cuando la persona solo
// tiene uno, y en su propia pantalla cuando llega desde la lista.
//
// Que la pestaña lo pinte DENTRO y no redirija a la otra ruta no es un detalle:
// redirigir sacaba del navegador de pestañas y la barra de abajo desaparecía,
// sin forma de volver.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Pantalla } from '../Pantalla'
import { proximoPartido, useDatosEquipo } from './datos'
import { Etiqueta, Vacio } from '../ui'
import { mandaAqui, useSesion } from '../../contexto/sesion'
import { fechaCorta, hora, relativoDia } from '../../lib/fechas'
import { enCasa, rivalDe } from '../../lib/web/partidos'
import { color, espacio, radio, sombra } from '../../tema'

export function ResumenEquipo({
  equipoId,
  /** Flecha de volver: la lleva la pantalla propia, no la pestaña. */
  atras = false,
}: {
  equipoId: string | null
  atras?: boolean
}) {
  const sesion = useSesion()
  const datos = useDatosEquipo(equipoId)
  const { equipo, competicion } = datos

  if (!equipo) {
    return (
      <Pantalla titulo="Equipo" atras={atras}>
        <Vacio
          icono="people-outline"
          titulo="Este equipo ya no es tuyo"
          texto="O se ha archivado al acabar la temporada, o el club te ha sacado de él."
        />
      </Pantalla>
    )
  }

  const mando = mandaAqui(sesion, equipo)
  const proximo = proximoPartido(datos)
  const tabla = competicion.datos?.clasificacion ?? []
  const miPuesto = tabla.find((f) => f.yo)
  const quedan = competicion.datos
    ? competicion.datos.partidos.filter((p) => p.setsLocal === null).length
    : 0
  const entrenaDias = new Set(datos.entrenamientos.filter((x) => x.activo).map((x) => x.dia)).size

  const ir = (seccion: string) => router.push(`/equipo/${equipo.id}/${seccion}`)

  return (
    <Pantalla
      ante={`${equipo.categoria} · ${equipo.genero}`}
      titulo={equipo.nombre}
      atras={atras}
      refrescando={competicion.refrescando}
      alRefrescar={competicion.recargar}
    >
      {/* --- el próximo partido --- */}
      {proximo ? (
        <Pressable onPress={() => ir('partidos')} style={({ pressed }) => [e.hero, pressed && e.pulsado]}>
          <View style={e.heroAlto}>
            <Etiqueta fondo="rgba(255,255,255,0.18)" texto={color.blanco}>
              {proximo.tipo === 'cita'
                ? 'AMISTOSO'
                : enCasa(proximo.partido, proximo.club ?? '')
                  ? 'EN CASA'
                  : 'FUERA'}
            </Etiqueta>
            <Text style={e.heroCuando}>{relativoDia(proximo.cuando)}</Text>
          </View>

          <Text style={e.heroRival} numberOfLines={2}>
            {proximo.tipo === 'cita'
              ? proximo.evento.titulo
              : rivalDe(proximo.partido, proximo.club ?? '')}
          </Text>

          <Text style={e.heroDetalle} numberOfLines={2}>
            {fechaCorta(proximo.cuando)}
            {proximo.tipo === 'federado' && proximo.partido.hora === null
              ? ' · hora sin confirmar'
              : ` · ${hora(proximo.cuando)}`}
            {proximo.tipo === 'cita'
              ? proximo.evento.lugar
                ? ` · ${proximo.evento.lugar}`
                : ''
              : proximo.partido.sede
                ? ` · ${proximo.partido.sede}`
                : ''}
          </Text>
        </Pressable>
      ) : (
        <View style={e.sinPartido}>
          <Ionicons name="calendar-outline" size={18} color={color.apagado} />
          <Text style={e.sinPartidoTexto}>
            {equipo.claveCompeticion
              ? 'No quedan partidos en el calendario publicado.'
              : 'Este equipo todavía no tiene calendario de competición.'}
          </Text>
        </View>
      )}

      {/* --- las cuatro secciones --- */}
      <View style={e.rejilla}>
        <Celda
          icono="football"
          titulo="Partidos"
          dato={
            competicion.cargando
              ? '…'
              : equipo.claveCompeticion
                ? quedan > 0
                  ? `${quedan} por jugar`
                  : 'Temporada cerrada'
                : 'Sin competición'
          }
          onPress={() => ir('partidos')}
        />
        <Celda
          icono="podium"
          titulo="Clasificación"
          dato={
            competicion.cargando
              ? '…'
              : miPuesto
                ? `${miPuesto.pos}º de ${tabla.length} · ${miPuesto.pts} pts`
                : 'Sin publicar'
          }
          onPress={() => ir('clasificacion')}
        />
        <Celda
          icono="fitness"
          titulo="Horarios"
          dato={
            entrenaDias === 0
              ? 'Sin horario'
              : `${entrenaDias} ${entrenaDias === 1 ? 'día' : 'días'} por semana`
          }
          onPress={() => ir('horarios')}
        />
        <Celda
          icono="people"
          titulo="Plantilla"
          dato={
            datos.plantilla.length === 0
              ? 'Vacía'
              : `${datos.plantilla.length} ${datos.plantilla.length === 1 ? 'persona' : 'personas'}`
          }
          onPress={() => ir('plantilla')}
        />
      </View>

      {mando ? (
        <Pressable
          onPress={() => router.push(`/entrenamientos?equipo=${equipo.id}`)}
          style={({ pressed }) => [e.accion, pressed && e.pulsado]}
        >
          <Ionicons name="create-outline" size={18} color={color.azul} />
          <Text style={e.accionTexto}>Editar horario y citas</Text>
          <Ionicons name="chevron-forward" size={16} color={color.linea} />
        </Pressable>
      ) : null}
    </Pantalla>
  )
}

/** Una de las cuatro. Nombre entero y, debajo, lo que hay dentro. */
function Celda({
  icono,
  titulo,
  dato,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap
  titulo: string
  dato: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}, ${dato}`}
      style={({ pressed }) => [e.celda, pressed && e.pulsado]}
    >
      <View style={e.celdaIcono}>
        <Ionicons name={icono} size={19} color={color.azul} />
      </View>
      {/* Sin numberOfLines: el nombre cabe entero y esa es media gracia de
          esta rejilla. Con dos por fila hay ancho de sobra para la palabra
          más larga, que es «Clasificación». */}
      <Text style={e.celdaTitulo}>{titulo}</Text>
      <Text style={e.celdaDato} numberOfLines={2}>
        {dato}
      </Text>
    </Pressable>
  )
}

const e = StyleSheet.create({
  pulsado: { opacity: 0.7 },

  hero: {
    backgroundColor: color.tinta,
    borderRadius: radio.lg,
    padding: espacio.lg,
    gap: espacio.sm,
    marginBottom: espacio.lg,
    ...sombra,
  },
  heroAlto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroCuando: { color: color.azulClaro, fontSize: 12.5, fontWeight: '700' },
  heroRival: { color: color.blanco, fontSize: 21, fontWeight: '800', lineHeight: 27 },
  heroDetalle: { color: '#aac4dd', fontSize: 13, lineHeight: 19 },

  sinPartido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    backgroundColor: color.blanco,
    borderRadius: radio.lg,
    borderWidth: 1,
    borderColor: color.linea,
    padding: espacio.lg,
    marginBottom: espacio.lg,
  },
  sinPartidoTexto: { flex: 1, fontSize: 13.5, color: color.apagado, lineHeight: 19 },

  // Dos por fila: es lo que deja escribir «Clasificación» sin cortarla.
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.md },
  celda: {
    // 48% y no 50%: el hueco del medio lo pone el `gap`.
    width: '48%',
    flexGrow: 1,
    backgroundColor: color.blanco,
    borderRadius: radio.lg,
    borderWidth: 1,
    borderColor: color.linea,
    padding: espacio.lg,
    gap: espacio.xs,
    minHeight: 116,
    ...sombra,
  },
  celdaIcono: {
    width: 36,
    height: 36,
    borderRadius: radio.md,
    backgroundColor: color.tinte,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacio.xs,
  },
  celdaTitulo: { fontSize: 15, fontWeight: '700', color: color.tinta },
  celdaDato: { fontSize: 12.5, color: color.apagado, lineHeight: 17 },

  accion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    backgroundColor: color.tinte,
    borderRadius: radio.md,
    padding: espacio.lg,
    marginTop: espacio.lg,
  },
  accionTexto: { flex: 1, fontSize: 14.5, fontWeight: '700', color: color.azulOscuro },
})
