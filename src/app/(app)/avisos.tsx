// ==========================================================================
// Avisos.
//
// Lo que el entrenador quiere que llegue seguro: convocatorias, cambios de
// hora, «mañana traed rodilleras». A diferencia del chat, un aviso se marca
// como leído y puede pedir confirmación de asistencia.
//
// Un aviso se da por leído al desplegarlo, no al abrir la pantalla. Si bastara
// con entrar, el contador se vaciaría con solo mirar la lista y el entrenador
// vería «leído por 15» sin que nadie lo hubiera abierto.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import { Pantalla } from '../../componentes/Pantalla'
import { SelectorEquipo } from '../../componentes/SelectorEquipo'
import { Boton, Cargando, Etiqueta, Tarjeta, Vacio } from '../../componentes/ui'
import { useAvisos } from '../../contexto/avisos'
import { mandaAqui, useSesion } from '../../contexto/sesion'
import { aDate, desde } from '../../lib/fechas'
import { borrarAviso, marcarLeido, responder } from '../../lib/firebase/avisos'
import { escucharUsuariosDeEquipo } from '../../lib/firebase/usuarios'
import type { Aviso, TipoAviso, Usuario } from '../../lib/firebase/modelo'
import { color, espacio, radio } from '../../tema'

const PINTA: Record<
  TipoAviso,
  { fondo: string; texto: string; icono: keyof typeof Ionicons.glyphMap; etiqueta: string }
> = {
  general: { fondo: color.tinte, texto: color.azulOscuro, icono: 'megaphone', etiqueta: 'AVISO' },
  partido: { fondo: color.verdeTinte, texto: color.verde, icono: 'trophy', etiqueta: 'PARTIDO' },
  entrenamiento: {
    fondo: color.ambarTinte,
    texto: '#8a5a00',
    icono: 'fitness',
    etiqueta: 'ENTRENAMIENTO',
  },
  urgente: { fondo: color.rojoTinte, texto: color.rojo, icono: 'alert-circle', etiqueta: 'URGENTE' },
}

export default function Avisos() {
  const sesion = useSesion()
  const { equipoActivo, perfil } = sesion
  const { avisos, cargando } = useAvisos()
  const mando = mandaAqui(sesion, equipoActivo)

  const [plantilla, setPlantilla] = useState<Usuario[]>([])
  useEffect(() => {
    if (!equipoActivo || !mando) return
    return escucharUsuariosDeEquipo(equipoActivo.id, setPlantilla)
  }, [equipoActivo, mando])

  if (!equipoActivo) {
    return (
      <Pantalla titulo="Avisos">
        <Vacio
          icono="notifications-outline"
          titulo="Sin equipo"
          texto="Los avisos los manda el entrenador a su equipo. Cuando estés en uno, aparecerán aquí."
        />
      </Pantalla>
    )
  }

  return (
    <Pantalla
      ante="Avisos del equipo"
      titulo={equipoActivo.nombre}
      accion={
        mando
          ? { icono: 'add-circle', alPulsar: () => router.push('/aviso-nuevo'), etiqueta: 'Nuevo aviso' }
          : undefined
      }
    >
      <SelectorEquipo />

      {mando ? (
        <Boton icono="megaphone" onPress={() => router.push('/aviso-nuevo')} ancho>
          Mandar un aviso
        </Boton>
      ) : null}

      <View style={{ height: espacio.lg }} />

      {cargando ? (
        <Cargando texto="Cargando avisos…" />
      ) : avisos.length === 0 ? (
        <Vacio
          icono="notifications-off-outline"
          titulo="Ningún aviso"
          texto={
            mando
              ? 'Cuando mandes un aviso, le llegará a todo el equipo.'
              : 'Tu entrenador todavía no ha mandado ningún aviso.'
          }
        />
      ) : (
        <View style={{ gap: espacio.md }}>
          {avisos.map((a) => (
            <TarjetaAviso
              key={a.id}
              aviso={a}
              uid={perfil!.uid}
              equipoId={equipoActivo.id}
              mando={mando}
              plantilla={plantilla}
              jugadoresDelEquipo={equipoActivo.jugadores}
            />
          ))}
        </View>
      )}
    </Pantalla>
  )
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
    <Tarjeta style={noLeido ? e.sinLeer : undefined}>
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
              {noLeido ? <View style={e.punto} /> : null}
            </View>
            <Text style={e.titulo}>{aviso.titulo}</Text>
            <Text style={e.meta}>
              {aviso.autorNombre}
              {cuando ? ` · ${desde(cuando)}` : ''}
            </Text>
          </View>

          <Ionicons
            name={abierto ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={color.linea}
          />
        </View>
      </Pressable>

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
                <View style={e.recuento}>
                  <Text style={e.recuentoTexto}>
                    <Text style={{ color: color.verde, fontWeight: '800' }}>
                      {aviso.confirmados.length}
                    </Text>{' '}
                    van ·{' '}
                    <Text style={{ color: color.rojo, fontWeight: '800' }}>
                      {aviso.rechazados.length}
                    </Text>{' '}
                    no ·{' '}
                    <Text style={{ fontWeight: '800' }}>{sinResponder.length}</Text> sin
                    contestar
                  </Text>
                  {sinResponder.length > 0 ? (
                    <Text style={e.pendientes} numberOfLines={3}>
                      Falta: {sinResponder.map((x) => x.nombre.split(' ')[0]).join(', ')}
                    </Text>
                  ) : null}
                </View>
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
    </Tarjeta>
  )
}

const e = StyleSheet.create({
  sinLeer: { borderColor: color.azul, borderWidth: 1.5 },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.md },
  icono: {
    width: 38,
    height: 38,
    borderRadius: radio.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.rojo },
  titulo: { fontSize: 16, fontWeight: '700', color: color.tinta, marginTop: 4 },
  meta: { fontSize: 12, color: color.apagado, marginTop: 2 },

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
    gap: 4,
  },
  recuentoTexto: { fontSize: 13, color: color.tinta },
  pendientes: { fontSize: 12, color: color.apagado, lineHeight: 17 },

  pieMando: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  borrar: { fontSize: 13, color: color.rojo, fontWeight: '700' },
})
