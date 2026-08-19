// ==========================================================================
// Mi equipo: partidos, clasificación, entrenamientos y plantilla.
//
// Cuatro pestañas dentro de una pantalla en vez de cuatro pantallas: es todo
// lo mismo —«lo de mi equipo»— y así se pasa de la clasificación al horario
// sin volver atrás. La barra de abajo ya tiene cinco pestañas; meter más sería
// una app de menús.
//
// De dónde sale cada cosa:
//   · Partidos y clasificación → federaciones, vía /api/competicion. Solo se
//     leen; ni el entrenador ni el admin los tocan aquí, porque el que manda
//     es el acta de la federación.
//   · Entrenamientos y eventos → Firestore, los pone el entrenador.
//   · Plantilla → los usuarios que tienen este equipo asignado.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Pantalla } from '../../componentes/Pantalla'
import { SelectorEquipo } from '../../componentes/SelectorEquipo'
import {
  Banda,
  Boton,
  Cargando,
  Etiqueta,
  Secundario,
  Tarjeta,
  Vacio,
} from '../../componentes/ui'
import { mandaAqui, useSesion } from '../../contexto/sesion'
import { fechaCorta, hora, relativoDia } from '../../lib/fechas'
import { escucharEntrenamientos, escucharEventos } from '../../lib/firebase/entrenamientos'
import { DIAS, type Entrenamiento, type Evento, type Usuario } from '../../lib/firebase/modelo'
import { escucharUsuariosDeEquipo } from '../../lib/firebase/usuarios'
import { useCompeticion } from '../../lib/hooks'
import {
  aFecha,
  enCasa,
  jugado,
  repartirPartidos,
  resultado,
  rivalDe,
  type Partido,
} from '../../lib/web/competicion'
import { color, espacio, radio } from '../../tema'

type Vista = 'partidos' | 'tabla' | 'horario' | 'plantilla'

const VISTAS: { valor: Vista; etiqueta: string }[] = [
  { valor: 'partidos', etiqueta: 'Partidos' },
  { valor: 'tabla', etiqueta: 'Clasificación' },
  { valor: 'horario', etiqueta: 'Horarios' },
  { valor: 'plantilla', etiqueta: 'Plantilla' },
]

export default function MiEquipo() {
  const sesion = useSesion()
  const { equipoActivo } = sesion
  const [vista, setVista] = useState<Vista>('partidos')

  const competicion = useCompeticion(equipoActivo?.claveCompeticion ?? null)
  const mando = mandaAqui(sesion, equipoActivo)

  const [entrenamientos, setEntrenamientos] = useState<Entrenamiento[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [plantilla, setPlantilla] = useState<Usuario[]>([])

  useEffect(() => {
    if (!equipoActivo) return
    return escucharEntrenamientos(equipoActivo.id, setEntrenamientos)
  }, [equipoActivo])

  useEffect(() => {
    if (!equipoActivo) return
    return escucharEventos(equipoActivo.id, setEventos)
  }, [equipoActivo])

  useEffect(() => {
    if (!equipoActivo) return
    return escucharUsuariosDeEquipo(equipoActivo.id, setPlantilla)
  }, [equipoActivo])

  if (!equipoActivo) {
    return (
      <Pantalla titulo="Mi equipo">
        <Vacio
          icono="people-outline"
          titulo="Sin equipo"
          texto="Cuando el club te asigne a un equipo, aquí verás sus partidos, su horario y su plantilla."
        />
      </Pantalla>
    )
  }

  return (
    <Pantalla
      ante={`${equipoActivo.categoria} · ${equipoActivo.genero}`}
      titulo={equipoActivo.nombre}
      refrescando={competicion.refrescando}
      alRefrescar={competicion.recargar}
    >
      <SelectorEquipo />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={e.pestanas}
      >
        {VISTAS.map((v) => {
          const activa = v.valor === vista
          return (
            <Pressable
              key={v.valor}
              onPress={() => setVista(v.valor)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              style={[e.pestana, activa ? e.pestanaActiva : null]}
            >
              <Text style={[e.pestanaTexto, activa ? e.pestanaTextoActivo : null]}>
                {v.etiqueta}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {vista === 'partidos' ? (
        <Partidos competicion={competicion} eventos={eventos} />
      ) : vista === 'tabla' ? (
        <Clasificacion competicion={competicion} />
      ) : vista === 'horario' ? (
        <Horario entrenamientos={entrenamientos} eventos={eventos} mando={mando} />
      ) : (
        <Plantilla gente={plantilla} />
      )}
    </Pantalla>
  )
}

// --- partidos -------------------------------------------------------------

function Partidos({
  competicion,
  eventos,
}: {
  competicion: ReturnType<typeof useCompeticion>
  eventos: Evento[]
}) {
  const { equipoActivo } = useSesion()

  const reparto = useMemo(
    () => (competicion.datos ? repartirPartidos(competicion.datos.partidos) : null),
    [competicion.datos],
  )

  const amistosos = useMemo(
    () => eventos.filter((ev) => aFecha(ev.iso) && aFecha(ev.iso)! >= new Date()),
    [eventos],
  )

  if (!equipoActivo?.claveCompeticion) {
    return (
      <>
        {amistosos.length > 0 ? (
          <>
            <Text style={e.subtitulo}>Próximas citas</Text>
            <View style={{ gap: espacio.md }}>
              {amistosos.map((ev) => (
                <TarjetaEvento key={ev.id} evento={ev} />
              ))}
            </View>
          </>
        ) : null}
        <Banda tono="info">
          Este equipo no está enlazado con ninguna competición federada, así que no hay calendario
          oficial. Un administrador puede enlazarlo desde la ficha del equipo.
        </Banda>
      </>
    )
  }

  if (competicion.cargando) return <Cargando texto="Cargando calendario…" />
  if (competicion.error) {
    return (
      <Tarjeta>
        <Banda tono="error">{competicion.error}</Banda>
        <Boton tono="fantasma" icono="refresh" onPress={competicion.recargar}>
          Reintentar
        </Boton>
      </Tarjeta>
    )
  }
  if (!reparto || !competicion.datos) return null

  const club = competicion.datos.equipoClub

  return (
    <View style={{ gap: espacio.md }}>
      {amistosos.length > 0 ? (
        <>
          <Text style={e.subtitulo}>Citas del equipo</Text>
          {amistosos.map((ev) => (
            <TarjetaEvento key={ev.id} evento={ev} />
          ))}
        </>
      ) : null}

      <Text style={e.subtitulo}>Próximos partidos</Text>
      {reparto.proximos.length === 0 ? (
        <Tarjeta>
          <Secundario>No quedan partidos por jugar en el calendario publicado.</Secundario>
        </Tarjeta>
      ) : (
        reparto.proximos.slice(0, 8).map((p) => <TarjetaPartido key={p.id} p={p} club={club} />)
      )}

      <Text style={e.subtitulo}>Resultados</Text>
      {reparto.pasados.length === 0 ? (
        <Tarjeta>
          <Secundario>Todavía no se ha jugado ningún partido.</Secundario>
        </Tarjeta>
      ) : (
        reparto.pasados.slice(0, 12).map((p) => <TarjetaPartido key={p.id} p={p} club={club} />)
      )}

      <Pressable onPress={() => Linking.openURL(competicion.datos!.url)} style={e.enlaceFed}>
        <Ionicons name="open-outline" size={15} color={color.azul} />
        <Text style={e.enlaceFedTexto}>
          Ver en la web de {competicion.datos.ente}
        </Text>
      </Pressable>
    </View>
  )
}

function TarjetaPartido({ p, club }: { p: Partido; club: string }) {
  const f = aFecha(p.iso)
  const casa = enCasa(p, club)
  const res = resultado(p, club)
  const ya = jugado(p)

  return (
    <Tarjeta style={e.partido}>
      <View style={e.partidoFecha}>
        <Text style={e.partidoDia}>{f ? String(f.getDate()) : '—'}</Text>
        <Text style={e.partidoMes}>{f ? fechaCorta(f).split(' ')[2] : ''}</Text>
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <View style={e.filaMeta}>
          <Etiqueta
            fondo={casa ? color.verdeTinte : color.tinte}
            texto={casa ? color.verde : color.azulOscuro}
          >
            {casa ? 'CASA' : 'FUERA'}
          </Etiqueta>
          {p.jornada ? <Text style={e.mini}>J{p.jornada}</Text> : null}
        </View>

        <Text style={e.partidoRival} numberOfLines={2}>
          {rivalDe(p, club)}
        </Text>

        <Text style={e.mini}>
          {f ? (ya ? fechaCorta(f) : `${relativoDia(f)}${horaSi(p.iso, f)}`) : 'Sin fecha'}
          {p.sede ? ` · ${p.sede}` : ''}
        </Text>

        {ya && p.parciales.length > 0 ? (
          <Text style={e.parciales} numberOfLines={1}>
            {p.parciales.join('  ')}
          </Text>
        ) : null}
      </View>

      {ya ? (
        <View
          style={[
            e.marcador,
            { backgroundColor: res === 'ganado' ? color.verdeTinte : color.rojoTinte },
          ]}
        >
          <Text
            style={[e.marcadorTexto, { color: res === 'ganado' ? color.verde : color.rojo }]}
          >
            {casa ? p.setsLocal : p.setsVisitante}–{casa ? p.setsVisitante : p.setsLocal}
          </Text>
        </View>
      ) : null}
    </Tarjeta>
  )
}

const horaSi = (iso: string, f: Date) =>
  /T\d{2}:\d{2}/.test(iso) && !iso.endsWith('T00:00') ? ` · ${hora(f)}` : ''

function TarjetaEvento({ evento }: { evento: Evento }) {
  const f = aFecha(evento.iso)
  return (
    <Tarjeta style={e.partido}>
      <View style={[e.partidoFecha, { backgroundColor: color.ambarTinte }]}>
        <Text style={[e.partidoDia, { color: '#8a5a00' }]}>{f ? String(f.getDate()) : '—'}</Text>
        <Text style={[e.partidoMes, { color: '#8a5a00' }]}>
          {f ? fechaCorta(f).split(' ')[2] : ''}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Etiqueta fondo={color.ambarTinte} texto="#8a5a00">
          {evento.tipo === 'partido' ? 'AMISTOSO' : 'EQUIPO'}
        </Etiqueta>
        <Text style={e.partidoRival}>{evento.titulo}</Text>
        <Text style={e.mini}>
          {f ? `${relativoDia(f)} · ${hora(f)}` : 'Sin fecha'}
          {evento.lugar ? ` · ${evento.lugar}` : ''}
        </Text>
        {evento.notas ? <Text style={e.mini}>{evento.notas}</Text> : null}
      </View>
    </Tarjeta>
  )
}

// --- clasificación --------------------------------------------------------

function Clasificacion({ competicion }: { competicion: ReturnType<typeof useCompeticion> }) {
  const { equipoActivo } = useSesion()

  if (!equipoActivo?.claveCompeticion) {
    return (
      <Banda tono="info">
        Este equipo no compite en una liga federada, así que no tiene clasificación.
      </Banda>
    )
  }
  if (competicion.cargando) return <Cargando texto="Cargando clasificación…" />
  if (competicion.error) return <Banda tono="error">{competicion.error}</Banda>

  const tabla = competicion.datos?.clasificacion ?? []
  if (tabla.length === 0) {
    return (
      <Vacio
        icono="podium-outline"
        titulo="Todavía sin clasificación"
        texto="La federación aún no ha publicado la tabla de esta competición."
      />
    )
  }

  return (
    <Tarjeta style={{ padding: 0, overflow: 'hidden' }}>
      <View style={[e.tablaFila, e.tablaCabecera]}>
        <Text style={[e.tablaPos, e.tablaCabeceraTexto]}>#</Text>
        <Text style={[e.tablaEquipo, e.tablaCabeceraTexto]}>Equipo</Text>
        <Text style={[e.tablaNum, e.tablaCabeceraTexto]}>PJ</Text>
        <Text style={[e.tablaNum, e.tablaCabeceraTexto]}>Sets</Text>
        <Text style={[e.tablaNum, e.tablaCabeceraTexto, { fontWeight: '800' }]}>Pts</Text>
      </View>

      {tabla.map((fila) => (
        <View
          key={`${fila.pos}-${fila.equipo}`}
          style={[e.tablaFila, fila.yo ? e.tablaMia : null]}
        >
          <Text style={[e.tablaPos, fila.yo ? e.tablaMiaTexto : null]}>{fila.pos}</Text>
          <Text
            style={[e.tablaEquipo, fila.yo ? e.tablaMiaTexto : null]}
            numberOfLines={1}
          >
            {fila.equipo}
          </Text>
          <Text style={[e.tablaNum, fila.yo ? e.tablaMiaTexto : null]}>{fila.pj}</Text>
          <Text style={[e.tablaNum, fila.yo ? e.tablaMiaTexto : null]}>
            {fila.sf}-{fila.sc}
          </Text>
          <Text
            style={[e.tablaNum, { fontWeight: '800' }, fila.yo ? e.tablaMiaTexto : null]}
          >
            {fila.pts}
          </Text>
        </View>
      ))}
    </Tarjeta>
  )
}

// --- horario --------------------------------------------------------------

function Horario({
  entrenamientos,
  eventos,
  mando,
}: {
  entrenamientos: Entrenamiento[]
  eventos: Evento[]
  mando: boolean
}) {
  const activos = entrenamientos.filter((x) => x.activo)

  return (
    <View style={{ gap: espacio.md }}>
      {mando ? (
        <Boton icono="create-outline" tono="secundario" onPress={() => router.push('/entrenamientos')}>
          Editar horario y citas
        </Boton>
      ) : null}

      <Text style={e.subtitulo}>Entrenamientos</Text>

      {activos.length === 0 ? (
        <Vacio
          icono="calendar-outline"
          titulo="Sin horario"
          texto={
            mando
              ? 'Añade los días y horas de entrenamiento para que tu equipo los tenga a mano.'
              : 'Tu entrenador todavía no ha puesto el horario de entrenamientos.'
          }
        />
      ) : (
        activos.map((x) => (
          <Tarjeta key={x.id} style={e.entreno}>
            <View style={e.entrenoDia}>
              <Text style={e.entrenoDiaTexto}>{DIAS[x.dia].slice(0, 3).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={e.entrenoHora}>
                {x.inicio} – {x.fin}
              </Text>
              {x.lugar ? <Text style={e.mini}>{x.lugar}</Text> : null}
              {x.notas ? <Text style={e.mini}>{x.notas}</Text> : null}
            </View>
          </Tarjeta>
        ))
      )}

      {eventos.length > 0 ? (
        <>
          <Text style={e.subtitulo}>Otras citas</Text>
          {eventos.map((ev) => (
            <TarjetaEvento key={ev.id} evento={ev} />
          ))}
        </>
      ) : null}
    </View>
  )
}

// --- plantilla ------------------------------------------------------------

function Plantilla({ gente }: { gente: Usuario[] }) {
  const tecnicos = gente.filter((g) => g.rol !== 'jugador')
  const jugadores = gente.filter((g) => g.rol === 'jugador')

  if (gente.length === 0) {
    return (
      <Vacio
        icono="people-outline"
        titulo="Plantilla vacía"
        texto="Todavía no hay nadie asignado a este equipo."
      />
    )
  }

  return (
    <View style={{ gap: espacio.md }}>
      {tecnicos.length > 0 ? (
        <>
          <Text style={e.subtitulo}>Cuerpo técnico</Text>
          {tecnicos.map((t) => (
            <Tarjeta key={t.uid} style={e.persona}>
              <View style={[e.dorsal, { backgroundColor: color.ambarTinte }]}>
                <Ionicons name="clipboard" size={17} color="#8a5a00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={e.personaNombre}>{t.nombre}</Text>
                <Text style={e.mini}>{t.rol === 'admin' ? 'Club' : 'Entrenador'}</Text>
              </View>
            </Tarjeta>
          ))}
        </>
      ) : null}

      <Text style={e.subtitulo}>Jugadores ({jugadores.length})</Text>
      {jugadores.map((j) => (
        <Tarjeta key={j.uid} style={e.persona}>
          <View style={e.dorsal}>
            <Text style={e.dorsalTexto}>{j.dorsal || '–'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={e.personaNombre}>{j.nombre}</Text>
            {j.posicion ? <Text style={e.mini}>{j.posicion}</Text> : null}
          </View>
        </Tarjeta>
      ))}
    </View>
  )
}

const e = StyleSheet.create({
  pestanas: { gap: espacio.sm, paddingBottom: espacio.lg },
  pestana: {
    paddingHorizontal: espacio.lg,
    paddingVertical: espacio.sm,
    borderRadius: radio.pastilla,
    backgroundColor: color.blanco,
    borderWidth: 1,
    borderColor: color.linea,
    minHeight: 38,
    justifyContent: 'center',
  },
  pestanaActiva: { backgroundColor: color.azul, borderColor: color.azul },
  pestanaTexto: { fontSize: 14, fontWeight: '600', color: color.apagado },
  pestanaTextoActivo: { color: color.blanco },

  subtitulo: {
    fontSize: 12,
    fontWeight: '800',
    color: color.azul,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: espacio.md,
  },
  mini: { fontSize: 12.5, color: color.apagado, lineHeight: 18 },

  partido: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, padding: espacio.md },
  partidoFecha: {
    width: 50,
    height: 54,
    borderRadius: radio.md,
    backgroundColor: color.tinte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partidoDia: { fontSize: 21, fontWeight: '800', color: color.azulOscuro, lineHeight: 24 },
  partidoMes: { fontSize: 10, fontWeight: '700', color: color.azul },
  partidoRival: { fontSize: 15.5, fontWeight: '700', color: color.tinta },
  filaMeta: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  parciales: { fontSize: 11.5, color: color.apagado, fontVariant: ['tabular-nums'] },
  marcador: {
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.sm,
    borderRadius: radio.sm,
    minWidth: 52,
    alignItems: 'center',
  },
  marcadorTexto: { fontSize: 16, fontWeight: '800' },

  enlaceFed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.sm,
    paddingVertical: espacio.lg,
  },
  enlaceFedTexto: { fontSize: 13, color: color.azul, fontWeight: '600' },

  tablaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: espacio.md,
    paddingHorizontal: espacio.md,
    borderBottomWidth: 1,
    borderBottomColor: color.linea,
    gap: espacio.sm,
  },
  tablaCabecera: { backgroundColor: color.tinte },
  tablaCabeceraTexto: { fontSize: 11, fontWeight: '700', color: color.azulOscuro },
  tablaPos: { width: 22, fontSize: 13, color: color.apagado, fontWeight: '700' },
  tablaEquipo: { flex: 1, fontSize: 13.5, color: color.tinta },
  tablaNum: {
    width: 42,
    textAlign: 'right',
    fontSize: 13,
    color: color.tinta,
    fontVariant: ['tabular-nums'],
  },
  tablaMia: { backgroundColor: color.tinte },
  tablaMiaTexto: { fontWeight: '800', color: color.azulOscuro },

  entreno: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, padding: espacio.md },
  entrenoDia: {
    width: 52,
    height: 44,
    borderRadius: radio.md,
    backgroundColor: color.tinta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entrenoDiaTexto: { color: color.blanco, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  entrenoHora: { fontSize: 16, fontWeight: '700', color: color.tinta },

  persona: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, padding: espacio.md },
  dorsal: {
    width: 40,
    height: 40,
    borderRadius: radio.pastilla,
    backgroundColor: color.tinte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dorsalTexto: { fontSize: 15, fontWeight: '800', color: color.azulOscuro },
  personaNombre: { fontSize: 15.5, fontWeight: '600', color: color.tinta },
})
