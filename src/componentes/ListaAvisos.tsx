// ==========================================================================
// Los avisos de un equipo.
//
// Lo que el entrenador quiere que llegue seguro: convocatorias, cambios de
// hora, «mañana traed rodilleras». A diferencia del chat, un aviso se marca
// como leído y puede pedir confirmación de asistencia.
//
// Un aviso se da por leído al desplegarlo, no al abrir la pantalla. Si bastara
// con entrar, el contador se vaciaría con solo mirar la lista y el entrenador
// vería «leído por 15» sin que nadie lo hubiera abierto.
//
// Igual que `Conversacion`, esto es un componente y no una pantalla porque se
// pinta en dos sitios: en la pestaña de Avisos cuando la persona tiene un solo
// equipo, y en su propia pantalla cuando llega desde la bandeja.
//
// EL DISEÑO
// Cada aviso lleva una banda de color a la izquierda con su tipo. Antes el tipo
// solo se veía en una etiqueta dentro de la tarjeta, así que había que leer
// para distinguir un «urgente» de un «general»; con la banda se distinguen sin
// leer, que es lo que se hace al pasar una lista con el pulgar.
//
// Y van agrupados por cuándo son —hoy, esta semana, antes— en vez de ser una
// columna seguida de tarjetas. Un aviso caduca: el de anteayer y el de hace un
// mes no piden lo mismo, y verlos en el mismo bloque los iguala.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native'

import { Pantalla } from './Pantalla'
import { Boton, Cargando, Etiqueta, Tarjeta, Vacio } from './ui'
import { useAvisos } from '../contexto/avisos'
import { mandaAqui, useSesion } from '../contexto/sesion'
import { aDate, desde } from '../lib/fechas'
import { borrarAviso, marcarLeido, responder } from '../lib/firebase/avisos'
import { escucharUsuariosDeEquipo } from '../lib/firebase/usuarios'
import type { Aviso, TipoAviso, Usuario } from '../lib/firebase/modelo'
import { color, espacio, radio } from '../tema'

export const PINTA: Record<
  TipoAviso,
  { fondo: string; texto: string; barra: string; icono: keyof typeof Ionicons.glyphMap; etiqueta: string }
> = {
  general: {
    fondo: color.tinte,
    texto: color.azulOscuro,
    barra: color.azul,
    icono: 'megaphone',
    etiqueta: 'AVISO',
  },
  partido: {
    fondo: color.verdeTinte,
    texto: color.verde,
    barra: color.verde,
    icono: 'trophy',
    etiqueta: 'PARTIDO',
  },
  entrenamiento: {
    fondo: color.ambarTinte,
    texto: '#8a5a00',
    barra: color.ambar,
    icono: 'fitness',
    etiqueta: 'ENTRENAMIENTO',
  },
  urgente: {
    fondo: color.rojoTinte,
    texto: color.rojo,
    barra: color.rojo,
    icono: 'alert-circle',
    etiqueta: 'URGENTE',
  },
}

export function ListaAvisos({
  equipoId,
  atras = false,
}: {
  equipoId: string | null
  atras?: boolean
}) {
  const sesion = useSesion()
  const { perfil, equipos } = sesion
  const { avisosDe, cargando } = useAvisos()

  const equipo = useMemo(
    () => equipos.find((eq) => eq.id === equipoId) ?? null,
    [equipos, equipoId],
  )
  const mando = mandaAqui(sesion, equipo)
  const avisos = avisosDe(equipo?.id)

  /* Por id y no por objeto: ver el mismo comentario en `Conversacion`.
     Con el objeto como dependencia esto se resuscribía solo cada vez que la
     sesión refrescaba los equipos, y la lista parpadeaba. */
  const idEquipo = equipo?.id ?? null

  const [plantilla, setPlantilla] = useState<Usuario[]>([])
  useEffect(() => {
    if (!idEquipo || !mando) return
    return escucharUsuariosDeEquipo(idEquipo, setPlantilla)
  }, [idEquipo, mando])

  if (!equipo) {
    return (
      <Pantalla titulo="Avisos" atras={atras}>
        <Vacio
          icono="notifications-outline"
          titulo="Sin equipo"
          texto="Los avisos los manda el entrenador a su equipo. Cuando estés en uno, aparecerán aquí."
        />
      </Pantalla>
    )
  }

  const grupos = agrupar(avisos)

  return (
    <Pantalla
      ante="Avisos del equipo"
      titulo={equipo.nombre}
      atras={atras}
      accion={
        mando
          ? {
              icono: 'add-circle',
              alPulsar: () => router.push(`/aviso-nuevo?equipo=${equipo.id}`),
              etiqueta: 'Nuevo aviso',
            }
          : undefined
      }
    >
      {/* El botón grande solo cuando hay algo escrito ya.

          Con la lista vacía el hueco lo ocupa el estado vacío, que trae su
          propia llamada a la acción; poner los dos era pedir lo mismo dos
          veces en la misma pantalla. */}
      {mando && avisos.length > 0 ? (
        <Boton
          icono="megaphone"
          onPress={() => router.push(`/aviso-nuevo?equipo=${equipo.id}`)}
          ancho
          style={{ marginBottom: espacio.lg }}
        >
          Mandar un aviso
        </Boton>
      ) : null}

      {cargando && avisos.length === 0 ? (
        <Cargando texto="Cargando avisos…" />
      ) : avisos.length === 0 ? (
        <Vacio
          icono="notifications-off-outline"
          titulo="Ningún aviso"
          texto={
            mando
              ? 'Cuando mandes un aviso, le llegará a todo el equipo al móvil.'
              : 'Tu entrenador todavía no ha mandado ningún aviso.'
          }
        >
          {mando ? (
            <Boton
              icono="megaphone"
              onPress={() => router.push(`/aviso-nuevo?equipo=${equipo.id}`)}
            >
              Mandar el primero
            </Boton>
          ) : null}
        </Vacio>
      ) : (
        grupos.map((grupo) => (
          <View key={grupo.titulo}>
            <Text style={e.grupo}>{grupo.titulo}</Text>
            <View style={{ gap: espacio.md }}>
              {grupo.avisos.map((a) => (
                <TarjetaAviso
                  key={a.id}
                  aviso={a}
                  uid={perfil!.uid}
                  equipoId={equipo.id}
                  mando={mando}
                  plantilla={plantilla}
                  jugadoresDelEquipo={equipo.jugadores}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </Pantalla>
  )
}

/* --------------------------------------------------------------------------
   Agrupar por cuándo.

   Un aviso caduca: el de hoy pide algo y el de hace un mes es histórico. Las
   tres cestas son las que de verdad se distinguen al mirar («esto es de hoy»,
   «esto es de esta semana», «esto ya pasó»); más cestas serían más líneas de
   título que avisos dentro.

   Los que aún no tienen hora del servidor —los que acaba de mandar este mismo
   móvil— van con los de hoy, que es cuando son.
   -------------------------------------------------------------------------- */
function agrupar(avisos: Aviso[], ahora = new Date()) {
  const hoy: Aviso[] = []
  const semana: Aviso[] = []
  const antes: Aviso[] = []

  const arranqueDelDia = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate(),
  ).getTime()
  const haceUnaSemana = arranqueDelDia - 6 * 24 * 60 * 60 * 1000

  for (const a of avisos) {
    const f = aDate(a.creadoEn)
    if (!f || f.getTime() >= arranqueDelDia) hoy.push(a)
    else if (f.getTime() >= haceUnaSemana) semana.push(a)
    else antes.push(a)
  }

  return [
    { titulo: 'Hoy', avisos: hoy },
    { titulo: 'Esta semana', avisos: semana },
    { titulo: 'Antes', avisos: antes },
  ].filter((g) => g.avisos.length > 0)
}

function TarjetaAviso({
  aviso,
  uid,
  equipoId,
  mando,
  plantilla,
  jugadoresDelEquipo,
}: {
  aviso: Aviso
  uid: string
  equipoId: string
  mando: boolean
  plantilla: Usuario[]
  /** uid de quienes juegan en ESTE equipo, que son los convocables. */
  jugadoresDelEquipo: string[]
}) {
  const [abierto, setAbierto] = useState(false)
  const p = PINTA[aviso.tipo]
  const noLeido = !aviso.leidoPor.includes(uid)
  const cuando = aDate(aviso.creadoEn)

  const voy = aviso.confirmados.includes(uid)
  const noVoy = aviso.rechazados.includes(uid)

  function desplegar() {
    const siguiente = !abierto
    setAbierto(siguiente)
    if (siguiente && noLeido) void marcarLeido(equipoId, aviso.id, uid).catch(() => {})
  }

  function confirmarBorrado() {
    Alert.alert('Borrar aviso', `¿Seguro que quieres borrar «${aviso.titulo}»?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => void borrarAviso(equipoId, aviso.id).catch(() => {}),
      },
    ])
  }

  // Solo cuentan los jugadores DE ESTE equipo: el entrenador no se convoca a
  // sí mismo, y quien aquí entrena puede ser jugador en otro equipo.
  const jugadores = plantilla.filter((x) => jugadoresDelEquipo.includes(x.uid))
  const sinResponder = jugadores.filter(
    (j) => !aviso.confirmados.includes(j.uid) && !aviso.rechazados.includes(j.uid),
  )

  return (
    <Tarjeta style={e.tarjeta}>
      {/* La banda de color: el tipo de aviso sin leer nada. */}
      <View style={[e.barra, { backgroundColor: p.barra }]} />

      <View style={e.dentro}>
        <Pressable onPress={desplegar} accessibilityRole="button">
          <View style={e.cabecera}>
            <View style={[e.icono, { backgroundColor: p.fondo }]}>
              <Ionicons name={p.icono} size={18} color={p.texto} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={e.metaFila}>
                <Etiqueta fondo={p.fondo} texto={p.texto}>
                  {p.etiqueta}
                </Etiqueta>
                {aviso.requiereConfirmacion ? (
                  <Etiqueta fondo={color.fondo} texto={color.apagado}>
                    CONFIRMAR
                  </Etiqueta>
                ) : null}
                {noLeido ? <View style={e.punto} /> : null}
              </View>

              <Text style={[e.titulo, noLeido ? e.tituloNuevo : null]} numberOfLines={2}>
                {aviso.titulo}
              </Text>
              <Text style={e.meta}>
                {aviso.autorNombre}
                {cuando ? ` · ${desde(cuando)}` : ''}
              </Text>
            </View>

            <Ionicons
              name={abierto ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={color.apagado}
            />
          </View>
        </Pressable>

        {/* Plegado, la primera línea del cuerpo: lo justo para saber si hace
            falta abrirlo. Antes había que desplegar para ver de qué iba. */}
        {!abierto && aviso.cuerpo ? (
          <Text style={e.adelanto} numberOfLines={1}>
            {aviso.cuerpo}
          </Text>
        ) : null}

        {abierto ? (
          <View style={e.cuerpo}>
            {aviso.cuerpo ? <Text style={e.texto}>{aviso.cuerpo}</Text> : null}

            {aviso.requiereConfirmacion ? (
              <View style={e.confirmacion}>
                <Text style={e.confirmacionTitulo}>¿Vas a ir?</Text>
                <View style={e.botonesConfirmar}>
                  <Pressable
                    onPress={() => void responder(equipoId, aviso.id, uid, true).catch(() => {})}
                    style={[e.respuesta, voy ? e.respuestaSi : null]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: voy }}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={17}
                      color={voy ? color.blanco : color.verde}
                    />
                    <Text style={[e.respuestaTexto, voy ? { color: color.blanco } : null]}>
                      Voy
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => void responder(equipoId, aviso.id, uid, false).catch(() => {})}
                    style={[e.respuesta, noVoy ? e.respuestaNo : null]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: noVoy }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={17}
                      color={noVoy ? color.blanco : color.rojo}
                    />
                    <Text style={[e.respuestaTexto, noVoy ? { color: color.blanco } : null]}>
                      No puedo
                    </Text>
                  </Pressable>
                </View>

                {mando ? (
                  <Recuento
                    van={aviso.confirmados.length}
                    no={aviso.rechazados.length}
                    faltan={sinResponder.map((x) => x.nombre.split(' ')[0])}
                  />
                ) : null}
              </View>
            ) : null}

            {mando ? (
              <View style={e.pieMando}>
                <Text style={e.meta}>Leído por {aviso.leidoPor.length}</Text>
                <Pressable onPress={confirmarBorrado} hitSlop={8} accessibilityRole="button">
                  <Text style={e.borrar}>Borrar</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Tarjeta>
  )
}

/**
 * Cómo va la convocatoria, en una barra.
 *
 * Antes era una línea de números. Un entrenador lo que mira es «¿tengo doce o
 * me falta medio equipo?», y eso una proporción lo dice antes que tres cifras
 * que hay que restar mentalmente.
 */
function Recuento({ van, no, faltan }: { van: number; no: number; faltan: string[] }) {
  const total = van + no + faltan.length
  // Sin nadie a quien convocar no hay proporción que pintar: una barra vacía
  // haría pensar que no ha contestado nadie, y es que no hay nadie.
  const parte = (n: number): DimensionValue =>
    total > 0 ? `${Math.round((n / total) * 100)}%` : 0

  return (
    <View style={e.recuento}>
      <View style={e.barraRecuento}>
        <View style={[e.trozo, { width: parte(van), backgroundColor: color.verde }]} />
        <View style={[e.trozo, { width: parte(no), backgroundColor: color.rojo }]} />
      </View>

      <Text style={e.recuentoTexto}>
        <Text style={{ color: color.verde, fontWeight: '800' }}>{van}</Text> van ·{' '}
        <Text style={{ color: color.rojo, fontWeight: '800' }}>{no}</Text> no ·{' '}
        <Text style={{ fontWeight: '800' }}>{faltan.length}</Text> sin contestar
      </Text>

      {faltan.length > 0 ? (
        <Text style={e.pendientes} numberOfLines={3}>
          Falta: {faltan.join(', ')}
        </Text>
      ) : null}
    </View>
  )
}

const e = StyleSheet.create({
  grupo: {
    fontSize: 12,
    fontWeight: '800',
    color: color.apagado,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: espacio.lg,
    marginBottom: espacio.md,
  },

  // Sin relleno: lo pone `dentro`, para que la banda de color llegue de arriba
  // abajo de la tarjeta sin un margen blanco que la despegue del borde.
  tarjeta: { padding: 0, overflow: 'hidden', flexDirection: 'row' },
  barra: { width: 4 },
  dentro: { flex: 1, padding: espacio.lg },

  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.md },
  icono: {
    width: 38,
    height: 38,
    borderRadius: radio.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.rojo },
  titulo: { fontSize: 16, fontWeight: '600', color: color.tinta, marginTop: 5, lineHeight: 21 },
  tituloNuevo: { fontWeight: '800' },
  meta: { fontSize: 12, color: color.apagado, marginTop: 3 },
  adelanto: {
    fontSize: 13.5,
    color: color.apagado,
    marginTop: espacio.sm,
    // Alineado con el título, no con el icono.
    marginLeft: 38 + espacio.md,
  },

  cuerpo: {
    marginTop: espacio.md,
    paddingTop: espacio.md,
    borderTopWidth: 1,
    borderTopColor: color.linea,
    gap: espacio.md,
  },
  texto: { fontSize: 15, color: color.tinta, lineHeight: 22 },

  confirmacion: { gap: espacio.sm },
  confirmacionTitulo: { fontSize: 13, fontWeight: '800', color: color.tinta },
  botonesConfirmar: { flexDirection: 'row', gap: espacio.sm },
  respuesta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radio.md,
    borderWidth: 1,
    borderColor: color.linea,
    minHeight: 44,
  },
  respuestaSi: { backgroundColor: color.verde, borderColor: color.verde },
  respuestaNo: { backgroundColor: color.rojo, borderColor: color.rojo },
  respuestaTexto: { fontSize: 14, fontWeight: '700', color: color.tinta },

  recuento: {
    backgroundColor: color.fondo,
    borderRadius: radio.md,
    padding: espacio.md,
    gap: espacio.sm,
  },
  barraRecuento: {
    flexDirection: 'row',
    height: 6,
    borderRadius: radio.pastilla,
    backgroundColor: color.linea,
    overflow: 'hidden',
  },
  trozo: { height: '100%' },
  recuentoTexto: { fontSize: 13, color: color.tinta },
  pendientes: { fontSize: 12, color: color.apagado, lineHeight: 17 },

  pieMando: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  borrar: { fontSize: 13, color: color.rojo, fontWeight: '700' },
})
