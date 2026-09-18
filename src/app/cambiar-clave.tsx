// ==========================================================================
// Cambiar la contraseña, desde dentro.
//
// Pide la actual aunque ya haya sesión. No es desconfianza: Firebase no deja
// cambiarla si el inicio de sesión es de hace más de unos minutos
// (`auth/requires-recent-login`), y en una app que no se cierra nunca eso es
// siempre. Volver a autenticar con la actual justo antes lo resuelve, y de paso
// evita que quien coja un móvil desbloqueado se quede con la cuenta.
//
// Si no se acuerda de la actual, el mismo correo de recuperación que en la
// pantalla de entrar. Aquí sí se puede decir «enviado» sin rodeos: el correo
// es el de la sesión, no uno que haya escrito cualquiera.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth'
import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { Pantalla } from '../componentes/Pantalla'
import { Banda, Boton, Tarjeta } from '../componentes/ui'
import { useSesionActiva } from '../contexto/sesion'
import { auth } from '../lib/firebase/app'
import { color, espacio, radio } from '../tema'

/** Lo mínimo que acepta Firebase Auth. */
const MINIMO = 6

function mensajeDe(codigo: string): string {
  switch (codigo) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'La contraseña actual no es correcta.'
    case 'auth/weak-password':
      return `La nueva contraseña es demasiado débil. Usa al menos ${MINIMO} caracteres.`
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera un rato antes de volver a probar.'
    case 'auth/network-request-failed':
      return 'Sin conexión. Comprueba los datos o la wifi.'
    default:
      return 'No se ha podido cambiar la contraseña. Inténtalo de nuevo.'
  }
}

export default function CambiarClave() {
  const { perfil } = useSesionActiva()

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const noCoinciden = repetida.length > 0 && repetida !== nueva
  const puede =
    actual.length > 0 && nueva.length >= MINIMO && repetida === nueva && !enviando

  async function guardar() {
    const cuenta = auth.currentUser
    if (!puede || !cuenta?.email) return
    if (nueva === actual) {
      setError('La nueva contraseña es igual que la actual.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await reauthenticateWithCredential(
        cuenta,
        EmailAuthProvider.credential(cuenta.email, actual),
      )
      await updatePassword(cuenta, nueva)
      Alert.alert('Contraseña cambiada', 'La próxima vez que entres, usa la nueva.', [
        { text: 'Vale', onPress: () => router.back() },
      ])
    } catch (e: any) {
      setError(mensajeDe(e?.code ?? ''))
    } finally {
      setEnviando(false)
    }
  }

  async function recuperar() {
    const destino = auth.currentUser?.email ?? perfil.email
    try {
      await sendPasswordResetEmail(auth, destino)
      Alert.alert(
        'Correo enviado',
        `Te hemos mandado a ${destino} un enlace para poner una contraseña nueva. Mira también en spam.`,
      )
    } catch (e: any) {
      Alert.alert('No se ha podido enviar', mensajeDe(e?.code ?? ''))
    }
  }

  return (
    <Pantalla ante="Mi perfil" titulo="Cambiar contraseña" atras>
      <Tarjeta>
        {error ? <Banda tono="error">{error}</Banda> : null}

        <CampoClave
          etiqueta="Contraseña actual"
          valor={actual}
          alCambiar={setActual}
          autoComplete="current-password"
        />
        <CampoClave
          etiqueta="Nueva contraseña"
          valor={nueva}
          alCambiar={setNueva}
          autoComplete="new-password"
          ayuda={`Al menos ${MINIMO} caracteres.`}
        />
        <CampoClave
          etiqueta="Repite la nueva"
          valor={repetida}
          alCambiar={setRepetida}
          autoComplete="new-password"
          error={noCoinciden ? 'No coincide con la nueva contraseña.' : undefined}
          alTerminar={guardar}
        />

        <Boton onPress={guardar} cargando={enviando} desactivado={!puede} ancho>
          Cambiar contraseña
        </Boton>

        <Pressable onPress={recuperar} hitSlop={8} style={e.olvido}>
          <Text style={e.olvidoTexto}>No recuerdo la actual</Text>
        </Pressable>
      </Tarjeta>
    </Pantalla>
  )
}

/** El campo de contraseña con el ojo para verla, el mismo que en entrar. */
function CampoClave({
  etiqueta,
  valor,
  alCambiar,
  autoComplete,
  ayuda,
  error,
  alTerminar,
}: {
  etiqueta: string
  valor: string
  alCambiar: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  ayuda?: string
  error?: string
  alTerminar?: () => void
}) {
  const [ver, setVer] = useState(false)

  return (
    <View style={e.campo}>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <View style={e.fila}>
        <TextInput
          value={valor}
          onChangeText={alCambiar}
          secureTextEntry={!ver}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          returnKeyType={alTerminar ? 'go' : 'next'}
          onSubmitEditing={alTerminar}
          style={[e.entrada, error ? { borderColor: color.rojo } : null]}
        />
        <Pressable
          onPress={() => setVer((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={ver ? 'Ocultar contraseña' : 'Ver contraseña'}
          hitSlop={10}
          style={e.ojo}
        >
          <Ionicons name={ver ? 'eye-off-outline' : 'eye-outline'} size={20} color={color.apagado} />
        </Pressable>
      </View>
      {error ? (
        <Text style={e.error}>{error}</Text>
      ) : ayuda ? (
        <Text style={e.ayuda}>{ayuda}</Text>
      ) : null}
    </View>
  )
}

const e = StyleSheet.create({
  campo: { marginBottom: espacio.lg },
  etiqueta: { fontSize: 13, fontWeight: '700', color: color.tinta, marginBottom: espacio.sm },
  fila: { flexDirection: 'row', alignItems: 'center' },
  entrada: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.linea,
    borderRadius: radio.md,
    paddingHorizontal: espacio.md,
    paddingRight: 46,
    paddingVertical: 12,
    fontSize: 16,
    color: color.tinta,
    backgroundColor: color.blanco,
    minHeight: 48,
  },
  ojo: { position: 'absolute', right: espacio.md, padding: 4 },
  ayuda: { fontSize: 12, color: color.apagado, marginTop: espacio.xs },
  error: { fontSize: 12, color: color.rojo, marginTop: espacio.xs, fontWeight: '600' },

  olvido: { alignSelf: 'center', marginTop: espacio.lg, padding: espacio.sm },
  olvidoTexto: { fontSize: 14, color: color.azul, fontWeight: '600' },
})
