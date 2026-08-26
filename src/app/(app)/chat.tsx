// ==========================================================================
// El chat del equipo.
//
// Un grupo por equipo, con el entrenador dentro. Sirve para lo del día a día
// —«¿alguien lleva balones?»— y deja los avisos para lo que tiene que llegar
// sí o sí.
//
// La lista va invertida: los datos llegan del más nuevo al más viejo y la
// FlatList los pinta de abajo arriba. Es la forma de que un chat arranque
// pegado al último mensaje sin medir alturas ni hacer scroll a mano después de
// pintar, que es de donde salen los saltos y los parpadeos.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Pantalla } from '../../componentes/Pantalla'
import { SelectorEquipo } from '../../componentes/SelectorEquipo'
import { Vacio } from '../../componentes/ui'
import { useSesion } from '../../contexto/sesion'
import { aDate, selloChat } from '../../lib/fechas'
import { LIMITE_MENSAJE, enviarMensaje, escucharMensajes } from '../../lib/firebase/chat'
import type { Mensaje, Usuario } from '../../lib/firebase/modelo'
import { avisarMensaje } from '../../lib/firebase/notificar'
import { escucharUsuariosDeEquipo } from '../../lib/firebase/usuarios'
import { ponerChatAbierto } from '../../lib/foco'
import { color, espacio, radio } from '../../tema'

export default function Chat() {
  const { equipoActivo, perfil } = useSesion()
  const bordes = useSafeAreaInsets()

  /* Igual que en el contexto de avisos: los mensajes viajan con el id del
     equipo del que son. Al cambiar de equipo no se ve un fotograma de la
     conversación anterior, que en un chat es de lo más desconcertante. */
  const [recibido, setRecibido] = useState<{ equipoId: string | null; lista: Mensaje[] }>({
    equipoId: null,
    lista: [],
  })
  const [borrador, setBorrador] = useState('')
  const [enviando, setEnviando] = useState(false)
  // Para los tokens de quien tiene que recibir la notificación.
  const [plantilla, setPlantilla] = useState<Usuario[]>([])

  const alDia = recibido.equipoId === (equipoActivo?.id ?? null)
  const mensajes = alDia ? recibido.lista : []
  const cargando = Boolean(equipoActivo) && !alDia

  // Para no dejar el campo bloqueado si el envío falla y el componente sigue
  // vivo, pero tampoco escribir estado si ya se salió de la pantalla.
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  useEffect(() => {
    if (!equipoActivo) return
    const id = equipoActivo.id
    return escucharMensajes(id, (lista) => setRecibido({ equipoId: id, lista }))
  }, [equipoActivo])

  useEffect(() => {
    if (!equipoActivo) return
    return escucharUsuariosDeEquipo(equipoActivo.id, setPlantilla)
  }, [equipoActivo])

  /* Mientras esta pantalla esté delante, los mensajes de ESTE equipo no
     suenan: se están viendo llegar. Es lo que hace cualquier app de
     mensajería y sin ello escribir con el equipo es una ristra de pitidos.

     Se apunta al montar y se borra al salir. El manejador que lo consulta
     vive fuera de React, de ahí el módulo suelto (lib/foco.ts). */
  useEffect(() => {
    ponerChatAbierto(equipoActivo?.id ?? null)
    return () => ponerChatAbierto(null)
  }, [equipoActivo])

  async function mandar() {
    const texto = borrador.trim()
    if (!texto || !equipoActivo || !perfil || enviando) return

    setEnviando(true)
    // Se vacía antes de que confirme el servidor: el mensaje ya aparece en la
    // lista por el snapshot local de Firestore, así que se ve al instante.
    setBorrador('')
    try {
      await enviarMensaje(
        equipoActivo.id,
        {
          uid: perfil.uid,
          nombre: perfil.nombre,
          // El papel EN ESTE equipo, no los roles de club: quien entrena aquí
          // y juega en el sénior sale como entrenador aquí y como jugador allí.
          rol: equipoActivo.entrenadores.includes(perfil.uid) ? 'entrenador' : 'jugador',
        },
        texto,
      )

      /* El aviso al resto va DESPUÉS y sin esperarlo.

         El mensaje ya está guardado y ya se ve en el chat de todos; que la
         notificación salga o no es un extra. Esperarla solo conseguiría que
         el campo se quedara bloqueado un segundo por algo que al que
         escribe no le importa. */
      void avisarMensaje(equipoActivo, plantilla, perfil, texto)
    } catch {
      // Si no se pudo mandar, se devuelve el texto al campo en vez de perderlo.
      if (montado.current) setBorrador(texto)
    } finally {
      if (montado.current) setEnviando(false)
    }
  }

  if (!equipoActivo) {
    return (
      <Pantalla titulo="Chat">
        <Vacio
          icono="chatbubbles-outline"
          titulo="Sin equipo"
          texto="El chat es de cada equipo. Cuando el club te asigne uno, podrás escribir aquí."
        />
      </Pantalla>
    )
  }

  return (
    <Pantalla ante="Chat del equipo" titulo={equipoActivo.nombre} scroll={false}>
      <View style={e.marcoSelector}>
        <SelectorEquipo />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // Mismo motivo que en Pantalla.tsx: con edge-to-edge la ventana no
        // encoge, así que el relleno lo tiene que poner este componente.
        behavior="padding"
      >
        <FlatList
          data={mensajes}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={e.lista}
          keyboardDismissMode="interactive"
          renderItem={({ item, index }) => (
            <Burbuja
              m={item}
              mio={item.autor === perfil?.uid}
              // Invertida, el "anterior" en pantalla es el siguiente del array.
              pegado={mensajes[index + 1]?.autor === item.autor}
            />
          )}
        />

        {/* Fuera de la FlatList a propósito.

            Como `ListEmptyComponent`, el texto salía ESPEJADO. Una lista
            invertida se dibuja dándole la vuelta a todo lo que lleva dentro, y
            el componente de lista vacía no se libra. Se intentó compensar con
            otro `scaleY: -1` encima, pero en React Native 0.86 el volteo no es
            el que se suponía y quedaba al revés igualmente.

            Sacarlo de la lista quita el problema de raíz en vez de pelearse con
            transformaciones que dependen de la versión. */}
        {!cargando && mensajes.length === 0 ? (
          <View style={e.vacio} pointerEvents="none">
            <Vacio
              icono="chatbubble-ellipses-outline"
              titulo="Todavía no hay mensajes"
              texto="Escribe el primero. Lo verá todo el equipo y el entrenador."
            />
          </View>
        ) : null}

        <View style={[e.barra, { paddingBottom: Math.max(bordes.bottom, espacio.md) }]}>
          <TextInput
            value={borrador}
            onChangeText={setBorrador}
            placeholder="Escribe al equipo…"
            placeholderTextColor={color.apagado}
            multiline
            maxLength={LIMITE_MENSAJE}
            style={e.entrada}
          />
          <Pressable
            onPress={mandar}
            disabled={!borrador.trim() || enviando}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            style={[e.enviar, !borrador.trim() || enviando ? e.enviarApagado : null]}
          >
            <Ionicons name="send" size={18} color={color.blanco} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Pantalla>
  )
}

function Burbuja({ m, mio, pegado }: { m: Mensaje; mio: boolean; pegado: boolean }) {
  const cuando = aDate(m.creadoEn)

  return (
    <View style={[e.fila, mio ? e.filaMia : null, pegado ? { marginTop: 2 } : null]}>
      <View style={[e.burbuja, mio ? e.burbujaMia : null]}>
        {/* El nombre solo en el primero de una tanda: repetirlo en cada
            mensaje seguido del mismo autor llena la pantalla de ruido. */}
        {!mio && !pegado ? (
          <Text style={e.autor}>
            {m.autorNombre}
            {m.autorRol !== 'jugador' ? ' · entrenador' : ''}
          </Text>
        ) : null}

        <Text style={[e.texto, mio ? e.textoMio : null]}>{m.texto}</Text>

        <Text style={[e.hora, mio ? e.horaMia : null]}>
          {cuando ? selloChat(cuando) : 'enviando…'}
        </Text>
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  marcoSelector: { paddingHorizontal: espacio.lg, paddingTop: espacio.md },
  lista: { padding: espacio.lg, gap: espacio.sm, flexGrow: 1 },
  // Encima de la lista vacía, sin transformaciones: ver el comentario de arriba.
  vacio: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
  },

  fila: { flexDirection: 'row' },
  filaMia: { justifyContent: 'flex-end' },
  burbuja: {
    maxWidth: '82%',
    backgroundColor: color.blanco,
    borderRadius: radio.lg,
    borderTopLeftRadius: 4,
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.sm,
    borderWidth: 1,
    borderColor: color.linea,
  },
  burbujaMia: {
    backgroundColor: color.azul,
    borderColor: color.azul,
    borderTopLeftRadius: radio.lg,
    borderTopRightRadius: 4,
  },
  autor: { fontSize: 11.5, fontWeight: '800', color: color.azul, marginBottom: 2 },
  texto: { fontSize: 15, color: color.tinta, lineHeight: 21 },
  textoMio: { color: color.blanco },
  hora: { fontSize: 10.5, color: color.apagado, marginTop: 3, alignSelf: 'flex-end' },
  horaMia: { color: '#cfe4f8' },

  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espacio.sm,
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.md,
    backgroundColor: color.blanco,
    borderTopWidth: 1,
    borderTopColor: color.linea,
  },
  entrada: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.linea,
    borderRadius: radio.lg,
    paddingHorizontal: espacio.md,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 16,
    color: color.tinta,
    maxHeight: 120,
    backgroundColor: color.fondo,
  },
  enviar: {
    width: 46,
    height: 46,
    borderRadius: radio.pastilla,
    backgroundColor: color.azul,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enviarApagado: { backgroundColor: color.linea },
})
