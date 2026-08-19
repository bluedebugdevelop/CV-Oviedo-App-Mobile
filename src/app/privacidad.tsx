// ==========================================================================
// Privacidad, dentro de la app.
//
// Las dos tiendas piden una política de privacidad accesible desde la ficha de
// la app, y App Store Connect además obliga a declarar qué datos se recogen.
// Tenerla también aquí dentro es lo que evita que alguien tenga que salir a
// buscarla, y en un club con menores es lo primero que preguntan los padres.
//
// El texto de referencia es el de la web (clubvoleiboloviedo.com/legal); esto
// es el resumen de lo que hace la app en concreto. Si cambia lo que se guarda,
// cambia aquí y en la declaración de las tiendas.
// ==========================================================================

import { Linking, StyleSheet, Text, View } from 'react-native'

import { Pantalla } from '../componentes/Pantalla'
import { Boton, Tarjeta } from '../componentes/ui'
import { WEB_BASE } from '../lib/config'
import { color, espacio } from '../tema'

const BLOQUES: { titulo: string; parrafos: string[] }[] = [
  {
    titulo: 'Quién trata tus datos',
    parrafos: [
      'El Club Voleibol Oviedo. La app la usa solo gente del club: jugadores, entrenadores y la junta directiva. No se puede crear una cuenta desde fuera.',
    ],
  },
  {
    titulo: 'Qué se guarda',
    parrafos: [
      'Tu nombre, tu correo y el equipo o equipos a los que perteneces. Si eres jugador, también el dorsal y la posición si el club los rellena.',
      'Los mensajes que escribes en el chat de tu equipo y las respuestas que das a las convocatorias.',
      'Un identificador del dispositivo para poder mandarte las notificaciones. No es un número de teléfono ni sirve para localizarte: solo para que llegue el aviso a este móvil.',
    ],
  },
  {
    titulo: 'Qué NO se guarda',
    parrafos: [
      'No se pide acceso a la ubicación, ni a la agenda, ni al micrófono ni a la cámara.',
      'Las fotos solo se leen si eres administrador y eliges una para publicarla en la web del club. Se sube esa foto y ninguna otra.',
      'No hay publicidad ni rastreo de terceros. Nada de lo que haces aquí se vende ni se comparte con anunciantes.',
    ],
  },
  {
    titulo: 'Quién puede ver lo tuyo',
    parrafos: [
      'Tu nombre, dorsal y posición los ve el resto de tu equipo y tu entrenador.',
      'Lo que escribes en el chat lo ve tu equipo y tu entrenador. No hay chats privados entre dos personas.',
      'Los administradores del club ven el censo de usuarios y los equipos, porque son quienes los gestionan.',
    ],
  },
  {
    titulo: 'Dónde se guarda',
    parrafos: [
      'En Firebase (Google Cloud), en servidores de la Unión Europea. Las noticias y los datos del club salen de la web del club.',
    ],
  },
  {
    titulo: 'Tus derechos',
    parrafos: [
      'Puedes pedir ver, corregir o borrar tus datos escribiendo al club. Al darte de baja, tu cuenta se desactiva y dejas de tener acceso.',
      'Si eres menor de 14 años, quien da el consentimiento es tu madre, tu padre o tu tutor, y es también quien puede pedir el borrado.',
    ],
  },
]

export default function Privacidad() {
  return (
    <Pantalla ante="Club Voleibol Oviedo" titulo="Privacidad" atras>
      <Text style={e.entradilla}>
        Esta app es una herramienta interna del club para organizar los equipos. Esto es todo lo
        que hace con tus datos, en corto.
      </Text>

      <View style={{ gap: espacio.md }}>
        {BLOQUES.map((b) => (
          <Tarjeta key={b.titulo} style={{ gap: espacio.sm }}>
            <Text style={e.titulo}>{b.titulo}</Text>
            {b.parrafos.map((p, i) => (
              <Text key={i} style={e.parrafo}>
                {p}
              </Text>
            ))}
          </Tarjeta>
        ))}
      </View>

      <Boton
        tono="fantasma"
        icono="open-outline"
        ancho
        style={{ marginTop: espacio.xl }}
        onPress={() => void Linking.openURL(`${WEB_BASE}/legal`)}
      >
        Aviso legal completo del club
      </Boton>
    </Pantalla>
  )
}

const e = StyleSheet.create({
  entradilla: {
    fontSize: 15.5,
    lineHeight: 23,
    color: color.tinta,
    marginBottom: espacio.lg,
  },
  titulo: { fontSize: 15, fontWeight: '800', color: color.tinta },
  parrafo: { fontSize: 14, lineHeight: 21, color: color.apagado },
})
