// ==========================================================================
// Más: el perfil de quien está dentro y las puertas a lo que no es del día a
// día.
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
import { router } from 'expo-router'
import { Alert, Linking, StyleSheet, Text, View } from 'react-native'

import { Pantalla } from '../../componentes/Pantalla'
import { Banda, Etiqueta, Fila, Franja, Separador, Tarjeta } from '../../componentes/ui'
import { useSesion } from '../../contexto/sesion'
import { WEB_BASE } from '../../lib/config'
import { ChipsRoles } from '../../componentes/Roles'
import { esAdmin, puedeEntrenar } from '../../lib/firebase/modelo'
import { color, espacio, radio } from '../../tema'

export default function Mas() {
  const { perfil, equipos, salir, avisoPush } = useSesion()
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

  return (
    <Pantalla ante="Tu cuenta" titulo="Más">
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

      {avisoPush ? (
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

      <Text style={e.version}>Club Voleibol Oviedo · versión 1.0.0</Text>
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
