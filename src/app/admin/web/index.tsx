// ==========================================================================
// El panel de la web, desde el móvil.
//
// Aquí se entra con la contraseña DEL PANEL, que no es la cuenta de Firebase.
// Son dos llaves distintas y conviene decirlo en la propia pantalla: quien
// llega ya es admin en la app y le puede extrañar que le pidan otra cosa.
//
// Se mantienen separadas a propósito. La cuenta de la app es de una persona;
// la del panel es del club y da acceso a lo que sale publicado en internet.
// Que un admin nuevo pueda ver el chat de su equipo el primer día no debería
// significar que pueda publicar en la portada el primer día.
//
// El token dura 90 días, así que esto se escribe una vez por trimestre.
// ==========================================================================

import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { Pantalla } from '../../../componentes/Pantalla'
import {
  Banda,
  Boton,
  Campo,
  Cargando,
  Fila,
  Franja,
  Secundario,
  Separador,
  Tarjeta,
} from '../../../componentes/ui'
import { usePanel } from '../../../contexto/panel'
import { WEB_BASE } from '../../../lib/config'
import { espacio } from '../../../tema'

export default function PanelWeb() {
  const { estado, datos, error, salir } = usePanel()

  if (estado === 'comprobando') {
    return (
      <Pantalla titulo="Contenido de la web" atras>
        <Cargando texto="Comprobando la sesión del panel…" />
      </Pantalla>
    )
  }

  if (estado === 'fuera') return <Acceso error={error} />

  return (
    <Pantalla
      ante="Administración"
      titulo="Contenido de la web"
      atras
      accion={{
        icono: 'log-out-outline',
        etiqueta: 'Salir del panel',
        alPulsar: () =>
          Alert.alert('Salir del panel', 'Habrá que volver a escribir la contraseña del panel.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => void salir() },
          ]),
      }}
    >
      <Banda tono="info">
        Lo que cambies aquí sale publicado en {WEB_BASE.replace(/^https?:\/\//, '')} al momento.
      </Banda>

      {datos && !datos.persistente ? (
        <Banda tono="error">
          El servidor de la web NO tiene disco permanente: lo que publiques se perderá en el
          siguiente despliegue. Hay que montar un volumen en Railway antes de escribir nada serio.
        </Banda>
      ) : null}

      <Tarjeta style={e.lista}>
        <Fila
          icono="newspaper"
          titulo="Noticias"
          detalle={contar(datos?.noticias.length, 'noticia', 'noticias')}
          onPress={() => router.push('/admin/web/noticias')}
        />
        <Separador />
        <Fila
          icono="ribbon"
          titulo="Patrocinadores"
          detalle={contar(datos?.patrocinadores.length, 'patrocinador', 'patrocinadores')}
          onPress={() => router.push('/admin/web/patrocinadores')}
        />
        <Separador />
        <Fila
          icono="people"
          titulo="Equipos de la web"
          detalle={contar(datos?.equipos.length, 'ficha', 'fichas')}
          onPress={() => router.push('/admin/web/equipos')}
        />
        <Separador />
        <Fila
          icono="images"
          titulo="Fotos de las secciones"
          detalle={contar(datos?.fotos.length, 'hueco', 'huecos')}
          onPress={() => router.push('/admin/web/fotos')}
        />
      </Tarjeta>

      <Franja titulo="Sesión del panel" />
      <Secundario>
        Entraste como «{datos?.nombre}». La sesión dura 90 días en este móvil.
      </Secundario>
    </Pantalla>
  )
}

const contar = (n: number | undefined, uno: string, varios: string) =>
  n === undefined ? '—' : `${n} ${n === 1 ? uno : varios}`

// --- entrada --------------------------------------------------------------

function Acceso({ error }: { error: string | null }) {
  const { entrar } = usePanel()
  const [usuario, setUsuario] = useState('admin')
  const [clave, setClave] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function probar() {
    if (!clave || entrando) return
    setEntrando(true)
    setFallo(null)
    try {
      await entrar(usuario, clave)
    } catch (err: any) {
      setFallo(err?.message ?? 'No se pudo entrar.')
      setEntrando(false)
    }
  }

  return (
    <Pantalla ante="Administración" titulo="Contenido de la web" atras>
      <Banda tono="info">
        Esta es la contraseña del PANEL de la web, la misma que se usa en
        {' '}
        {WEB_BASE.replace(/^https?:\/\//, '')}/panel. No es la de tu cuenta de la app.
      </Banda>

      {fallo ? <Banda tono="error">{fallo}</Banda> : null}
      {error && !fallo ? <Banda tono="ojo">{error}</Banda> : null}

      <Tarjeta>
        <Campo
          etiqueta="Usuario"
          value={usuario}
          onChangeText={setUsuario}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Campo
          etiqueta="Contraseña del panel"
          value={clave}
          onChangeText={setClave}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={probar}
          returnKeyType="go"
        />
        <Boton onPress={probar} cargando={entrando} desactivado={!clave} ancho icono="key">
          Entrar en el panel
        </Boton>
      </Tarjeta>

      <View style={{ marginTop: espacio.lg }}>
        <Secundario>
          Si no la tienes, la genera quien administre el servidor con `node scripts/clave.mjs` en el
          repositorio de la web. Tras cinco fallos seguidos, el servidor bloquea los intentos
          durante 15 minutos.
        </Secundario>
      </View>
    </Pantalla>
  )
}

const e = StyleSheet.create({
  lista: { paddingVertical: espacio.xs },
})

