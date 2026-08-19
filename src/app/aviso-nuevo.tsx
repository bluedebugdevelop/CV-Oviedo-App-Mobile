// ==========================================================================
// Mandar un aviso.
//
// Dos cosas pasan al pulsar «Enviar», y en este orden:
//
//   1. Se guarda el aviso en Firestore. Esto es lo que importa: a partir de
//      aquí está en la app de todo el equipo, con su punto rojo.
//   2. Se intenta la notificación al móvil. Si falla —sin cobertura, alguien
//      sin permiso de notificaciones, tokens caducados— el aviso YA está dado.
//
// Por eso el push va después y sin bloquear: si se hiciera al revés, un fallo
// de red dejaría al entrenador creyendo que no ha mandado nada cuando el aviso
// ya estaba puesto, y lo escribiría dos veces.
//
// El envío lo hace este móvil, no un servidor (ver lib/push.ts).
// ==========================================================================

import { useEffect, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'

import { Pantalla } from '../componentes/Pantalla'
import { Banda, Boton, Campo, Interruptor, Pildoras, Tarjeta } from '../componentes/ui'
import { mandaAqui, useSesion } from '../contexto/sesion'
import { crearAviso } from '../lib/firebase/avisos'
import { TIPOS_AVISO, type TipoAviso, type Usuario } from '../lib/firebase/modelo'
import { escucharUsuariosDeEquipo } from '../lib/firebase/usuarios'
import { enviarPush } from '../lib/push'
import { color, espacio } from '../tema'

export default function AvisoNuevo() {
  const sesion = useSesion()
  const { equipoActivo, perfil } = sesion
  const puede = mandaAqui(sesion, equipoActivo)

  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [tipo, setTipo] = useState<TipoAviso>('general')
  const [confirmar, setConfirmar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // La plantilla hace falta para los tokens de push. Se pide aquí y no al
  // enviar para poder decir de antemano a cuánta gente va a llegar.
  const [plantilla, setPlantilla] = useState<Usuario[]>([])
  useEffect(() => {
    if (!equipoActivo) return
    return escucharUsuariosDeEquipo(equipoActivo.id, setPlantilla)
  }, [equipoActivo])

  if (!equipoActivo || !puede || !perfil) {
    return (
      <Pantalla titulo="Nuevo aviso" atras>
        <Banda tono="error">
          Solo el entrenador del equipo (o un administrador) puede mandar avisos.
        </Banda>
      </Pantalla>
    )
  }

  const destinatarios = plantilla.filter((x) => x.uid !== perfil.uid)
  const conMovil = destinatarios.filter((x) => x.tokensPush.length > 0).length
  const listo = titulo.trim().length >= 3

  async function enviar() {
    if (!listo || enviando) return
    setEnviando(true)
    setError(null)

    try {
      await crearAviso(
        equipoActivo!.id,
        { titulo: titulo.trim(), cuerpo: cuerpo.trim(), tipo, requiereConfirmacion: confirmar },
        { uid: perfil!.uid, nombre: perfil!.nombre },
      )

      // A partir de aquí el aviso ya está dado. Lo del push es un extra.
      const tokens = destinatarios.flatMap((x) => x.tokensPush)
      const entregados = await enviarPush(tokens, {
        titulo: `${equipoActivo!.nombre}: ${titulo.trim()}`,
        cuerpo: cuerpo.trim() || 'Nuevo aviso de tu entrenador',
        datos: { equipoId: equipoActivo!.id, tipo: 'aviso' },
      })

      router.back()
      Alert.alert(
        'Aviso enviado',
        entregados > 0
          ? `Ya lo tiene todo el equipo en la app. Se ha avisado al móvil de ${entregados} ${
              entregados === 1 ? 'persona' : 'personas'
            }.`
          : 'Ya lo tiene todo el equipo en la app. Nadie tenía el móvil disponible para la notificación, pero lo verán al abrirla.',
      )
    } catch (e: any) {
      setError(e?.message ?? 'No se ha podido guardar el aviso.')
      setEnviando(false)
    }
  }

  return (
    <Pantalla ante={equipoActivo.nombre} titulo="Nuevo aviso" atras>
      {error ? <Banda tono="error">{error}</Banda> : null}

      <Campo
        etiqueta="Título"
        value={titulo}
        onChangeText={setTitulo}
        placeholder="Cambio de hora del sábado"
        maxLength={120}
        ayuda="Es lo que se lee en la notificación del móvil."
      />

      <Campo
        etiqueta="Mensaje"
        value={cuerpo}
        onChangeText={setCuerpo}
        placeholder="Quedamos a las 17:00 en el polideportivo, no a las 18:00."
        multiline
        maxLength={2000}
      />

      <Pildoras
        etiqueta="Tipo"
        valor={tipo}
        alElegir={setTipo}
        opciones={TIPOS_AVISO.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }))}
      />

      <Tarjeta style={{ marginBottom: espacio.lg }}>
        <Interruptor
          etiqueta="Pedir confirmación"
          ayuda="Cada jugador tendrá que decir si va o no, y verás quién falta por contestar."
          valor={confirmar}
          alCambiar={setConfirmar}
        />
      </Tarjeta>

      <View style={e.resumen}>
        <Text style={e.resumenTexto}>
          Va a {destinatarios.length}{' '}
          {destinatarios.length === 1 ? 'persona' : 'personas'} del equipo.
          {conMovil > 0
            ? ` ${conMovil} ${conMovil === 1 ? 'recibirá' : 'recibirán'} también la notificación en el móvil.`
            : ' Nadie tiene todavía las notificaciones activadas, así que lo verán al abrir la app.'}
        </Text>
      </View>

      <Boton onPress={enviar} cargando={enviando} desactivado={!listo} icono="send" ancho>
        Enviar aviso
      </Boton>
    </Pantalla>
  )
}

const e = StyleSheet.create({
  resumen: { marginBottom: espacio.lg },
  resumenTexto: { fontSize: 13, color: color.apagado, lineHeight: 19 },
})
