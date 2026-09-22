// ==========================================================================
// Mi perfil (Más, para un admin): la cuenta de quien está dentro y las puertas
// a lo que no es del día a día.
//
// Es donde acaban las pantallas de entrenador y de administración. Podrían
// haber sido pestañas propias, pero se usan de vez en cuando: un entrenador
// pone el horario en septiembre y lo toca tres veces al año, y el admin publica
// una noticia a la semana. Las pestañas son para lo que se abre a diario.
//
// Cada bloque aparece solo si el rol lo permite. No es seguridad —eso está en
// firestore.rules— sino no enseñarle a un jugador tres botones que le van a
// decir que no puede.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, AppState, Linking, StyleSheet, Text, View } from 'react-native'

import { Pantalla } from '../../componentes/Pantalla'
import { Banda, Etiqueta, Fila, Franja, Separador, Tarjeta } from '../../componentes/ui'
import { useSesion } from '../../contexto/sesion'
import { WEB_BASE } from '../../lib/config'
import { ChipsRoles } from '../../componentes/Roles'
import { esAdmin, puedeEntrenar } from '../../lib/firebase/modelo'
import { estadoPermisoPush, type EstadoPermisoPush } from '../../lib/push'
import { color, espacio, radio } from '../../tema'

const DETALLE_PERMISO: Record<EstadoPermisoPush, string> = {
  activadas: 'Activadas en este móvil',
  'sin-preguntar': 'Desactivadas · toca para activarlas',
  denegadas: 'Desactivadas · toca para activarlas en los ajustes',
  'no-disponible': 'Solo funcionan en un móvil real',
}

/**
 * El permiso de notificaciones, leído del sistema y no de la sesión.
 *
 * Se vuelve a leer cada vez que la app pasa a primer plano: el caso normal es
 * que la persona vaya a los ajustes del móvil, lo active y vuelva, y la fila
 * tiene que enterarse sin salir de la pantalla. Si al volver ya hay permiso,
 * se registra el token en ese momento — si no, los avisos no llegarían hasta
 * el siguiente arranque.
 */
function usePermisoPush(activarPush: () => Promise<boolean>, avisoPush: string | null) {
  const [permiso, setPermiso] = useState<EstadoPermisoPush | null>(null)

  const releer = useCallback(
    () =>
      estadoPermisoPush().then((actual) => {
        setPermiso(actual)
        return actual
      }),
    [],
  )

  useEffect(() => {
    let viva = true
    const leer = () =>
      void estadoPermisoPush().then((actual) => {
        if (viva) setPermiso(actual)
      })
    leer()
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') leer()
    })
    return () => {
      viva = false
      sub.remove()
    }
  }, [])

  useEffect(() => {
    if (permiso === 'activadas' && avisoPush) void activarPush()
  }, [permiso, avisoPush, activarPush])

  return { permiso, releer }
}

export default function Mas() {
  const { perfil, equipos, salir, avisoPush, activarPush } = useSesion()
  const { permiso, releer } = usePermisoPush(activarPush, avisoPush)
  const [activando, setActivando] = useState(false)
  if (!perfil) return null

  const admin = esAdmin(perfil)
  // Se enseñan las herramientas de entrenador a quien PUEDE entrenar, aunque
  // hoy no lleve ningún equipo: si no, un entrenador recién dado de alta no ve
  // nada y parece que la app está rota.
  const tecnico = puedeEntrenar(perfil)

  function confirmarSalida() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => void salir() },
    ])
  }

  function abrirAjustes() {
    Alert.alert(
      'Notificaciones desactivadas',
      'El móvil ya no deja volver a preguntar desde la app. Entra en los ajustes, toca «Notificaciones» y actívalas.',
      [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Abrir ajustes', onPress: () => void Linking.openSettings() },
      ],
    )
  }

  async function alPulsarNotificaciones() {
    if (activando || permiso === 'no-disponible') return
    // Ya activadas: desde aquí solo se pueden ajustar (o quitar) en el sistema.
    if (permiso === 'activadas') {
      void Linking.openSettings()
      return
    }
    if (permiso === 'denegadas') {
      abrirAjustes()
      return
    }
    setActivando(true)
    try {
      const ok = await activarPush()
      const tras = await releer()
      // Android deja de enseñar el diálogo a la segunda negativa, y entonces
      // `requestPermissionsAsync` vuelve al instante con un «no» sin que la
      // persona haya visto nada. Si pasa eso, el único camino son los ajustes.
      if (!ok && tras === 'denegadas') abrirAjustes()
    } finally {
      setActivando(false)
    }
  }

  return (
    <Pantalla ante="Tu cuenta" titulo={admin ? 'Más' : 'Mi perfil'}>
      {/* --- quién eres --- */}
      <Tarjeta style={e.perfil}>
        <View style={e.avatar}>
          <Text style={e.iniciales}>{iniciales(perfil.nombre)}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={e.nombre}>{perfil.nombre}</Text>
          <Text style={e.correo} numberOfLines={1}>
            {perfil.email}
          </Text>
          <View style={e.etiquetas}>
            <ChipsRoles roles={perfil.roles} />
            {perfil.dorsal ? <Etiqueta>DORSAL {perfil.dorsal}</Etiqueta> : null}
          </View>
        </View>
      </Tarjeta>

      {perfil.posicion || equipos.length > 0 ? (
        <Tarjeta style={{ marginTop: espacio.md, gap: espacio.sm }}>
          {perfil.posicion ? (
            <Text style={e.dato}>
              <Text style={e.datoEtiqueta}>Posición: </Text>
              {perfil.posicion}
            </Text>
          ) : null}
          <Text style={e.dato}>
            <Text style={e.datoEtiqueta}>
              {equipos.length === 1 ? 'Equipo: ' : 'Equipos: '}
            </Text>
            {equipos.length > 0 ? equipos.map((x) => x.nombre).join(', ') : 'ninguno'}
          </Text>
        </Tarjeta>
      ) : null}

      {/* --- la cuenta --- */}
      <Franja titulo="Cuenta" />
      <Tarjeta style={e.lista}>
        <Fila
          icono="key-outline"
          titulo="Cambiar contraseña"
          detalle="Necesitas la actual, o te mandamos un correo"
          onPress={() => router.push('/cambiar-clave')}
        />
        <Separador />
        <Fila
          icono={permiso === 'activadas' ? 'notifications' : 'notifications-off-outline'}
          titulo="Notificaciones"
          detalle={permiso ? DETALLE_PERMISO[permiso] : 'Comprobando…'}
          tono={permiso === 'sin-preguntar' || permiso === 'denegadas' ? color.rojo : undefined}
          onPress={permiso && permiso !== 'no-disponible' ? alPulsarNotificaciones : undefined}
          derecha={
            activando ? (
              <ActivityIndicator size="small" color={color.azul} />
            ) : permiso === 'activadas' ? (
              <Ionicons name="checkmark-circle" size={20} color={color.verde} />
            ) : undefined
          }
        />
      </Tarjeta>

      {/* El permiso ya lo explica la fila de arriba. Esto queda para los otros
          motivos, los que no se arreglan desde el móvil (token, proyecto). */}
      {avisoPush && permiso === 'activadas' ? (
        <View style={{ marginTop: espacio.lg }}>
          <Banda tono="ojo">
            No llegarán avisos al móvil con la app cerrada: {avisoPush}
          </Banda>
        </View>
      ) : null}

      {/* --- entrenador --- */}
      {tecnico ? (
        <>
          <Franja titulo="Mi equipo" />
          <Tarjeta style={e.lista}>
            <Fila
              icono="megaphone"
              titulo="Mandar un aviso"
              detalle="Llega a todo el equipo, también al móvil"
              onPress={() => router.push('/aviso-nuevo')}
            />
            <Separador />
            <Fila
              icono="calendar"
              titulo="Horario y citas"
              detalle="Entrenamientos semanales, amistosos y convocatorias"
              onPress={() => router.push('/entrenamientos')}
            />
          </Tarjeta>
        </>
      ) : null}

      {/* --- administración --- */}
      {admin ? (
        <>
          <Franja titulo="Administración del club" />
          <Tarjeta style={e.lista}>
            <Fila
              icono="people"
              titulo="Equipos"
              detalle="Crear equipos y asignar jugadores y entrenadores"
              onPress={() => router.push('/admin/equipos')}
            />
            <Separador />
            <Fila
              icono="person-add"
              titulo="Usuarios"
              detalle="Dar de alta cuentas y cambiar roles"
              onPress={() => router.push('/admin/usuarios')}
            />
            <Separador />
            <Fila
              icono="globe"
              titulo="Contenido de la web"
              detalle="Noticias, patrocinadores, equipos y fotos"
              onPress={() => router.push('/admin/web')}
            />
          </Tarjeta>
        </>
      ) : null}

      {/* --- club --- */}
      <Franja titulo="El club" />
      <Tarjeta style={e.lista}>
        <Fila
          icono="globe-outline"
          titulo="clubvoleiboloviedo.com"
          detalle="La web del club"
          onPress={() => void Linking.openURL(WEB_BASE)}
        />
        <Separador />
        <Fila
          icono="shield-checkmark-outline"
          titulo="Privacidad"
          detalle="Qué datos guarda la app y para qué"
          onPress={() => router.push('/privacidad')}
        />
      </Tarjeta>

      <Franja titulo="Sesión" />
      <Tarjeta style={e.lista}>
        <Fila
          icono="log-out-outline"
          titulo="Cerrar sesión"
          tono={color.rojo}
          onPress={confirmarSalida}
          derecha={<Ionicons name="chevron-forward" size={18} color={color.linea} />}
        />
      </Tarjeta>

      <Text style={e.version}>
        Club Voleibol Oviedo · versión {Constants.expoConfig?.version ?? '—'}
      </Text>
    </Pantalla>
  )
}

/** 'Adrián Estrada' → 'AE'. Con un solo nombre, las dos primeras letras. */
function iniciales(nombre: string): string {
  const trozos = nombre.trim().split(/\s+/).filter(Boolean)
  if (trozos.length === 0) return '?'
  if (trozos.length === 1) return trozos[0].slice(0, 2).toUpperCase()
  return (trozos[0][0] + trozos[1][0]).toUpperCase()
}

const e = StyleSheet.create({
  perfil: { flexDirection: 'row', alignItems: 'center', gap: espacio.lg },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radio.pastilla,
    backgroundColor: color.azul,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iniciales: { color: color.blanco, fontSize: 21, fontWeight: '800' },
  nombre: { fontSize: 19, fontWeight: '800', color: color.tinta },
  correo: { fontSize: 13, color: color.apagado },
  etiquetas: { flexDirection: 'row', gap: espacio.sm, marginTop: 2 },

  dato: { fontSize: 14, color: color.tinta, lineHeight: 20 },
  datoEtiqueta: { fontWeight: '700', color: color.apagado },

  lista: { paddingVertical: espacio.xs },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: color.apagado,
    marginTop: espacio.xl,
  },
})
