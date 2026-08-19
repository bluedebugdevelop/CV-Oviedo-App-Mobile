// ==========================================================================
// Entrar.
//
// No hay «crear cuenta» ni la habrá: las cuentas las da de alta el club desde
// la pantalla de administración. Es lo que se pidió, y en una app con menores
// dentro tiene sentido — nadie llega al chat de un equipo por su cuenta.
//
// Sí hay «he olvidado la contraseña»: manda el correo de recuperación de
// Firebase. Sin eso, cada contraseña perdida acabaría siendo una llamada al
// club, y son unas cuantas al año.
//
// Al escribir mal la contraseña se dice «correo o contraseña incorrectos», sin
// precisar cuál de los dos: si dijera «ese correo no existe» estaría contando
// quién tiene cuenta en el club a cualquiera que pruebe.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { sendPasswordResetEmail } from 'firebase/auth'
import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Banda, Boton } from '../componentes/ui'
import { useSesion } from '../contexto/sesion'
import { auth, errorFirebase, firebaseListo } from '../lib/firebase/app'
import { color, espacio, radio } from '../tema'

/** Los códigos de Firebase, en algo que se pueda leer. */
function mensajeDe(codigo: string): string {
  switch (codigo) {
    case 'auth/invalid-email':
      return 'Ese correo no tiene buena pinta. Revísalo.'
    case 'auth/user-disabled':
      return 'Esta cuenta está desactivada. Avisa al club.'
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera un rato antes de volver a probar.'
    case 'auth/network-request-failed':
      return 'Sin conexión. Comprueba los datos o la wifi.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      // A propósito el mismo mensaje para los tres: distinguirlos diría si un
      // correo tiene cuenta en el club.
      return 'Correo o contraseña incorrectos.'
    default:
      return 'No se ha podido entrar. Inténtalo de nuevo.'
  }
}

export default function Entrar() {
  const { entrar, expulsion, limpiarExpulsion } = useSesion()
  const bordes = useSafeAreaInsets()

  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const puede = email.trim().length > 3 && clave.length >= 6

  async function alEntrar() {
    if (!puede || enviando) return
    setEnviando(true)
    setError(null)
    limpiarExpulsion()
    try {
      await entrar(email, clave)
      // No se navega aquí: el portero del _layout ve la sesión nueva y mueve.
    } catch (e: any) {
      setError(mensajeDe(e?.code ?? ''))
    } finally {
      setEnviando(false)
    }
  }

  async function recuperar() {
    const destino = email.trim().toLowerCase()
    if (!destino) {
      Alert.alert('Escribe tu correo', 'Pon arriba el correo con el que entras y vuelve a pulsar.')
      return
    }
    try {
      await sendPasswordResetEmail(auth, destino)
    } catch {
      /* se ignora a propósito, ver el mensaje de abajo */
    }
    // El mismo mensaje exista o no la cuenta: si solo se confirmara cuando
    // existe, esto sería una forma de averiguar quién está en el club.
    Alert.alert(
      'Correo enviado',
      `Si ${destino} tiene cuenta, le llegará un enlace para cambiar la contraseña. Mira también en spam.`,
    )
  }

  return (
    <View style={e.raiz}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            e.contenido,
            { paddingTop: bordes.top + espacio.xxl, paddingBottom: bordes.bottom + espacio.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={e.marca}>
            <Image
              source={require('../../assets/icono/splash.png')}
              style={e.escudo}
              contentFit="contain"
            />
            <Text style={e.nombre}>Club Voleibol Oviedo</Text>
            <Text style={e.lema}>La app de los equipos del club</Text>
          </View>

          <View style={e.caja}>
            {!firebaseListo ? (
              <Banda tono="error">
                {errorFirebase ?? 'Falta la configuración de Firebase.'}
              </Banda>
            ) : null}

            {expulsion ? <Banda tono="ojo">{expulsion}</Banda> : null}
            {error ? <Banda tono="error">{error}</Banda> : null}

            <Text style={e.etiqueta}>Correo</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="nombre@correo.com"
              placeholderTextColor={color.apagado}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              returnKeyType="next"
              style={e.entrada}
            />

            <Text style={[e.etiqueta, { marginTop: espacio.lg }]}>Contraseña</Text>
            <View style={e.claveFila}>
              <TextInput
                value={clave}
                onChangeText={setClave}
                placeholder="Tu contraseña"
                placeholderTextColor={color.apagado}
                secureTextEntry={!verClave}
                autoCapitalize="none"
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={alEntrar}
                style={[e.entrada, { flex: 1, paddingRight: 46 }]}
              />
              <Pressable
                onPress={() => setVerClave((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
                hitSlop={10}
                style={e.ojo}
              >
                <Ionicons
                  name={verClave ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={color.apagado}
                />
              </Pressable>
            </View>

            <Boton
              onPress={alEntrar}
              cargando={enviando}
              desactivado={!puede || !firebaseListo}
              ancho
              style={{ marginTop: espacio.xl }}
            >
              Entrar
            </Boton>

            <Pressable onPress={recuperar} hitSlop={8} style={e.olvido}>
              <Text style={e.olvidoTexto}>He olvidado la contraseña</Text>
            </Pressable>
          </View>

          <Text style={e.pie}>
            Las cuentas las crea el club. Si eres jugador o entrenador y no tienes uno, pídeselo a
            tu entrenador.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const e = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: color.azul },
  contenido: { flexGrow: 1, paddingHorizontal: espacio.lg, justifyContent: 'center' },

  marca: { alignItems: 'center', marginBottom: espacio.xl },
  escudo: { width: 108, height: 108 },
  nombre: {
    fontSize: 22,
    fontWeight: '800',
    color: color.blanco,
    marginTop: espacio.md,
    letterSpacing: -0.4,
  },
  lema: { fontSize: 14, color: '#cfe4f8', marginTop: 2 },

  caja: {
    backgroundColor: color.blanco,
    borderRadius: radio.lg,
    padding: espacio.xl,
  },
  etiqueta: { fontSize: 13, fontWeight: '700', color: color.tinta, marginBottom: espacio.sm },
  entrada: {
    borderWidth: 1,
    borderColor: color.linea,
    borderRadius: radio.md,
    paddingHorizontal: espacio.md,
    paddingVertical: 12,
    fontSize: 16,
    color: color.tinta,
    minHeight: 48,
  },
  claveFila: { flexDirection: 'row', alignItems: 'center' },
  ojo: { position: 'absolute', right: espacio.md, padding: 4 },

  olvido: { alignSelf: 'center', marginTop: espacio.lg, padding: espacio.sm },
  olvidoTexto: { fontSize: 14, color: color.azul, fontWeight: '600' },

  pie: {
    color: '#cfe4f8',
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: espacio.xl,
    lineHeight: 18,
  },
})
