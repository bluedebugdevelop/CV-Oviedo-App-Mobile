// ==========================================================================
// La conversación de un equipo.
//
// Está aquí, como componente, porque se pinta en DOS sitios:
//
//   · En su propia pantalla (`app/chat/[equipoId].tsx`), abierta desde la
//     bandeja, como en cualquier app de mensajería: la lista queda detrás y el
//     chat ocupa la pantalla entera.
//   · Y directamente en la pestaña de Chat cuando la persona solo tiene un
//     equipo. Ahí una bandeja de una sola fila sería un toque de más para no
//     dar a elegir nada.
//
// La única diferencia entre los dos casos es el hueco de abajo, y lo resuelve
// `BarraEscribir` mirando la ruta.
//
// La lista va invertida: los datos llegan del más nuevo al más viejo y la
// FlatList los pinta de abajo arriba. Es la forma de que un chat arranque
// pegado al último mensaje sin medir alturas ni hacer scroll a mano después de
// pintar, que es de donde salen los saltos y los parpadeos.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { useSegments } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Pantalla } from './Pantalla'
import { Vacio } from './ui'
import { useSesion } from '../contexto/sesion'
import { aDate, selloChat } from '../lib/fechas'
import { LIMITE_MENSAJE, enviarMensaje, escucharMensajes } from '../lib/firebase/chat'
import type { Mensaje, Usuario } from '../lib/firebase/modelo'
import { avisarMensaje } from '../lib/firebase/notificar'
import { escucharUsuariosDeEquipo, marcarChatLeido } from '../lib/firebase/usuarios'
import { ponerChatAbierto } from '../lib/foco'
import { color, espacio, radio } from '../tema'

export function Conversacion({
  equipoId,
  /** Flecha de volver: la lleva la pantalla propia, no la pestaña. */
  atras = false,
}: {
  equipoId: string | null
  atras?: boolean
}) {
  const { equipos, perfil } = useSesion()

  const equipo = useMemo(
    () => equipos.find((eq) => eq.id === equipoId) ?? null,
    [equipos, equipoId],
  )

  /* Los mensajes viajan con el id del equipo del que son.

     Al entrar en otra conversación no se ve un fotograma de la anterior, que
     en un chat es de lo más desconcertante. */
  const [recibido, setRecibido] = useState<{ equipoId: string | null; lista: Mensaje[] }>({
    equipoId: null,
    lista: [],
  })
  const [borrador, setBorrador] = useState('')
  const [enviando, setEnviando] = useState(false)
  // Para los tokens de quien tiene que recibir la notificación.
  const [plantilla, setPlantilla] = useState<Usuario[]>([])

  const alDia = recibido.equipoId === (equipo?.id ?? null)
  const mensajes = alDia ? recibido.lista : []
  const cargando = Boolean(equipo) && !alDia

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
    if (!equipo) return
    const id = equipo.id
    return escucharMensajes(id, (lista) => setRecibido({ equipoId: id, lista }))
  }, [equipo])

  useEffect(() => {
    if (!equipo) return
    return escucharUsuariosDeEquipo(equipo.id, setPlantilla)
  }, [equipo])

  /* Mientras esta pantalla esté delante, los mensajes de ESTE equipo no
     suenan: se están viendo llegar. Es lo que hace cualquier app de
     mensajería y sin ello escribir con el equipo es una ristra de pitidos.

     Se apunta al montar y se borra al salir. El manejador que lo consulta
     vive fuera de React, de ahí el módulo suelto (lib/foco.ts). */
  useEffect(() => {
    ponerChatAbierto(equipo?.id ?? null)
    return () => ponerChatAbierto(null)
  }, [equipo])

  /* Visto.

     Se apunta con el último mensaje que hay a la vista, no solo al entrar: si
     llega uno mientras se tiene la conversación abierta, ya se está leyendo y
     no tiene sentido que la bandeja lo cuente como nuevo al salir.

     Un fallo aquí no se enseña: como mucho el globito tarda un rato más en
     apagarse, y no hay nada que la persona pueda hacer al respecto. */
  const ultimoId = mensajes[0]?.id ?? null
  useEffect(() => {
    if (!equipo || !perfil) return
    void marcarChatLeido(perfil.uid, equipo.id).catch(() => {})
  }, [equipo, perfil, ultimoId])

  async function mandar() {
    const texto = borrador.trim()
    if (!texto || !equipo || !perfil || enviando) return

    setEnviando(true)
    // Se vacía antes de que confirme el servidor: el mensaje ya aparece en la
    // lista por el snapshot local de Firestore, así que se ve al instante.
    setBorrador('')
    try {
      await enviarMensaje(
        equipo.id,
        {
          uid: perfil.uid,
          nombre: perfil.nombre,
          // El papel EN ESTE equipo, no los roles de club: quien entrena aquí
          // y juega en el sénior sale como entrenador aquí y como jugador allí.
          rol: equipo.entrenadores.includes(perfil.uid) ? 'entrenador' : 'jugador',
        },
        texto,
      )

      /* El aviso al resto va DESPUÉS y sin esperarlo.

         El mensaje ya está guardado y ya se ve en el chat de todos; que la
         notificación salga o no es un extra. Esperarla solo conseguiría que
         el campo se quedara bloqueado un segundo por algo que al que
         escribe no le importa. */
      void avisarMensaje(equipo, plantilla, perfil, texto)
    } catch {
      // Si no se pudo mandar, se devuelve el texto al campo en vez de perderlo.
      if (montado.current) setBorrador(texto)
    } finally {
      if (montado.current) setEnviando(false)
    }
  }

  if (!equipo) {
    return (
      <Pantalla titulo="Chat" atras={atras}>
        <Vacio
          icono="chatbubbles-outline"
          titulo="Este chat ya no es tuyo"
          texto="O el equipo se ha archivado, o el club te ha sacado de él."
        />
      </Pantalla>
    )
  }

  const cuantos = equipo.jugadores.length + equipo.entrenadores.length

  return (
    <Pantalla
      ante={cuantos === 1 ? '1 persona' : `${cuantos} personas`}
      titulo={equipo.nombre}
      atras={atras}
      scroll={false}
    >
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

        {/* Aquí sí hace falta el borde seguro de abajo.

            La conversación NO es una pestaña: no hay barra de navegación
            debajo que reserve el hueco de la barra de gestos del móvil, así
            que lo tiene que reservar el campo de escribir o queda medio
            tapado. Es al revés que en la bandeja, que sí es una pestaña. */}
        <BarraEscribir
          valor={borrador}
          alCambiar={setBorrador}
          alMandar={mandar}
          bloqueado={enviando}
        />
      </KeyboardAvoidingView>
    </Pantalla>
  )
}

function BarraEscribir({
  valor,
  alCambiar,
  alMandar,
  bloqueado,
}: {
  valor: string
  alCambiar: (v: string) => void
  alMandar: () => void
  bloqueado: boolean
}) {
  const vacio = !valor.trim()
  const bordes = useSafeAreaInsets()
  const [tecladoAbierto, setTecladoAbierto] = useState(false)
  // En una pestaña, la barra de pestañas ya ocupa el borde seguro; fuera de
  // ella no hay nada debajo. Mismo criterio que en `Pantalla.tsx`.
  const enPestanas = useSegments()[0] === '(app)'

  /* El hueco de la barra de gestos, solo cuando hace falta.

     Sin barra de pestañas debajo, el campo de escribir quedaría medio tapado
     por la barra de gestos del móvil.

     Pero con el teclado abierto el teclado se pinta POR ENCIMA de esa barra, y
     sumar el inset dejaría una franja vacía entre el campo y las teclas. De ahí
     las dos condiciones: es el mismo vacío que ya se quitó una vez entre el
     campo y las pestañas, y volvería si el relleno fuera fijo. */
  useEffect(() => {
    const abre = Keyboard.addListener('keyboardDidShow', () => setTecladoAbierto(true))
    const cierra = Keyboard.addListener('keyboardDidHide', () => setTecladoAbierto(false))
    return () => {
      abre.remove()
      cierra.remove()
    }
  }, [])

  return (
    <View
      style={[
        e.barra,
        {
          paddingBottom:
            espacio.md + (tecladoAbierto || enPestanas ? 0 : bordes.bottom),
        },
      ]}
    >
      <TextInput
        value={valor}
        onChangeText={alCambiar}
        placeholder="Escribe al equipo…"
        placeholderTextColor={color.apagado}
        multiline
        maxLength={LIMITE_MENSAJE}
        style={e.entrada}
      />
      <Pressable
        onPress={alMandar}
        disabled={vacio || bloqueado}
        accessibilityRole="button"
        accessibilityLabel="Enviar mensaje"
        style={[e.enviar, vacio || bloqueado ? e.enviarApagado : null]}
      >
        <Ionicons name="send" size={18} color={color.blanco} />
      </Pressable>
    </View>
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
    paddingBottom: espacio.md,
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
