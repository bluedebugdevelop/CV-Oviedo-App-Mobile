// ==========================================================================
// Publicar la plantilla de un equipo en la web del club.
//
// LA DIRECCIÓN IMPORTA
// Los datos van en UN solo sentido: de la app a la web. Las personas se
// gestionan donde viven sus cuentas —Firestore— y la web recibe una copia de
// lo que ve un visitante.
//
// Se decidió así frente a lo contrario (que la web fuera la fuente y la app
// creara cuentas a partir de ella) por un motivo concreto: para crear una
// cuenta hace falta un correo, y meter los correos de los jugadores —muchos
// menores— en el JSON del servidor de la web es exponerlos sin necesidad. En
// esta dirección, a la web solo llega dorsal, nombre y posición. Ni correos, ni
// teléfonos, ni identificadores.
//
// EL ENLACE
// Cada equipo de la app apunta a una ficha de la web por su `slug`. No se
// adivina por el nombre: el club llama «Sénior Masculino» al equipo en la app y
// «Superliga 2 Masculino» a la ficha de la web, y las dos cosas son correctas.
//
// PISA LO QUE HAYA
// Publicar sustituye la plantilla de esa ficha. Es lo que se quiere —la app
// pasa a ser la fuente— pero se avisa antes, porque si alguien había escrito la
// plantilla a mano en el panel, esto se la lleva por delante.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { useMemo, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'

import { Banda, Boton, Pildoras, Secundario, Tarjeta } from './ui'
import { usePanel } from '../contexto/panel'
import { actualizarEquipo } from '../lib/firebase/equipos'
import type { Equipo, Usuario } from '../lib/firebase/modelo'
import type { EquipoWeb } from '../lib/web/contenido'
import { color, espacio, radio } from '../tema'

export function PublicarPlantilla({
  equipo,
  jugadores,
  entrenadores,
}: {
  equipo: Equipo
  jugadores: Usuario[]
  entrenadores: Usuario[]
}) {
  const { estado, datos, guardar, guardando } = usePanel()
  const [error, setError] = useState<string | null>(null)
  const [publicado, setPublicado] = useState(false)

  // Con useMemo para que la lista vacía no sea un array nuevo en cada render:
  // si lo fuera, arrastraría a recalcular la ficha enlazada sin parar.
  const fichas = useMemo(() => datos?.equipos ?? [], [datos])
  const ficha = useMemo(
    () => fichas.find((x) => x.slug === equipo.slugWeb) ?? null,
    [fichas, equipo.slugWeb],
  )

  /* Lo que se manda: exactamente lo que se publica en internet.

     El dorsal va como texto porque así lo guarda la web —hay equipos de base
     sin dorsal asignado— y la posición puede ir vacía sin romper nada. */
  const squad = jugadores.map((j) => ({
    numero: j.dorsal ?? '',
    nombre: j.nombre,
    posicion: j.posicion ?? '',
  }))
  const staff = entrenadores.map((t) => ({ nombre: t.nombre, rol: 'Entrenador' }))

  async function publicar() {
    if (!ficha || guardando) return
    setError(null)

    const actualizada: EquipoWeb = { ...ficha, squad, staff }
    const lista = fichas.map((x) => (x.slug === ficha.slug ? actualizada : x))

    try {
      await guardar('equipos', lista)
      setPublicado(true)
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo publicar.')
    }
  }

  function confirmar() {
    if (!ficha) return
    Alert.alert(
      'Publicar en la web',
      `La ficha «${ficha.nombre}» pasará a tener ${squad.length} ` +
        `${squad.length === 1 ? 'jugador' : 'jugadores'} y ${staff.length} ` +
        `${staff.length === 1 ? 'técnico' : 'técnicos'}.\n\n` +
        'Sustituye lo que hubiera escrito a mano en el panel. Solo se publica ' +
        'dorsal, nombre y posición: ningún correo sale de la app.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Publicar', onPress: () => void publicar() },
      ],
    )
  }

  // Sin sesión del panel no hay nada que hacer aquí; se dice dónde se consigue.
  if (estado !== 'dentro') {
    return (
      <Tarjeta style={e.marco}>
        <Cabecera />
        <Secundario>
          Para publicar hace falta entrar en el panel de la web, en Administración → Contenido de
          la web. La sesión dura 90 días.
        </Secundario>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta style={e.marco}>
      <Cabecera />

      {error ? <Banda tono="error">{error}</Banda> : null}
      {publicado ? (
        <Banda tono="exito">Publicada. Ya se ve en clubvoleiboloviedo.com.</Banda>
      ) : null}

      {fichas.length === 0 ? (
        <Secundario>La web todavía no tiene ninguna ficha de equipo publicada.</Secundario>
      ) : (
        <>
          <Pildoras
            etiqueta="Ficha de la web"
            valor={equipo.slugWeb}
            alElegir={(slug) =>
              void actualizarEquipo(equipo.id, {
                // Volver a tocar la misma la desenlaza: es la forma de deshacer
                // un enlace puesto por error sin otro botón para ello.
                slugWeb: slug === equipo.slugWeb ? null : slug,
              }).catch((err) => setError(err?.message ?? 'No se pudo enlazar.'))
            }
            opciones={fichas.map((x) => ({ valor: x.slug, etiqueta: x.nombre || x.slug }))}
          />

          {ficha ? (
            <>
              <Text style={e.resumen}>
                Se publicarán {squad.length}{' '}
                {squad.length === 1 ? 'jugador' : 'jugadores'} y {staff.length}{' '}
                {staff.length === 1 ? 'técnico' : 'técnicos'}, con su dorsal y su posición.
              </Text>
              <Boton
                icono="cloud-upload-outline"
                ancho
                cargando={guardando}
                desactivado={squad.length === 0 && staff.length === 0}
                onPress={confirmar}
              >
                Publicar plantilla
              </Boton>
            </>
          ) : (
            <Secundario>
              Elige a qué ficha de la web corresponde este equipo. Se guarda, así que solo hay que
              hacerlo una vez.
            </Secundario>
          )}
        </>
      )}
    </Tarjeta>
  )
}

function Cabecera() {
  return (
    <View style={e.cabecera}>
      <View style={e.icono}>
        <Ionicons name="globe-outline" size={20} color={color.azul} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={e.titulo}>Plantilla en la web</Text>
        <Text style={e.meta}>La app manda; la web publica lo que ve un visitante.</Text>
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  marco: { marginTop: espacio.lg, gap: espacio.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radio.md,
    backgroundColor: color.tinte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { fontSize: 16, fontWeight: '800', color: color.tinta },
  meta: { fontSize: 12.5, color: color.apagado, lineHeight: 18 },
  resumen: { fontSize: 13.5, color: color.tinta, lineHeight: 20 },
})
