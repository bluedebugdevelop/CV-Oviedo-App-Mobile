// ==========================================================================
// La bandeja de chats.
//
// Un grupo por equipo, con el entrenador dentro. Sirve para lo del día a día
// —«¿alguien lleva balones?»— y deja los avisos para lo que tiene que llegar
// sí o sí.
//
// POR QUÉ UNA LISTA Y NO UN SELECTOR
// Antes había un selector de equipos arriba: una fila de pastillas que había
// que ir tocando una a una para descubrir dónde había algo nuevo. Quien juega
// en dos categorías podía tener quince mensajes sin leer en la otra y no
// enterarse. Una lista de conversaciones con su vista previa y su globito lo
// dice todo de un vistazo, que es exactamente el problema que resolvió
// WhatsApp hace quince años; no hacía falta inventar nada.
//
// Con UN solo equipo no se pinta la lista: la pestaña entra directa a la
// conversación. Una bandeja de una fila es un toque de más para no dar a
// elegir nada.
// ==========================================================================

import { router } from 'expo-router'
import { useMemo } from 'react'
import { FlatList } from 'react-native'

import { FilaBandeja, SeparadorBandeja } from '../../componentes/Bandeja'
import { Conversacion } from '../../componentes/Conversacion'
import { Pantalla } from '../../componentes/Pantalla'
import { Cargando, Vacio } from '../../componentes/ui'
import { useChats } from '../../contexto/chats'
import { useSesion } from '../../contexto/sesion'
import { aDate, desde } from '../../lib/fechas'
import type { Equipo, Mensaje } from '../../lib/firebase/modelo'

export default function Chat() {
  const { equipos, perfil } = useSesion()
  const { porEquipo, cargando } = useChats()

  const activos = useMemo(() => equipos.filter((eq) => !eq.archivado), [equipos])

  if (activos.length === 0) {
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

  // Un solo equipo: la conversación, sin pasar por una lista de un elemento.
  if (activos.length === 1) return <Conversacion equipoId={activos[0].id} />

  /* Las conversaciones con novedades arriba, y luego por lo más reciente.

     Es el orden de una bandeja de mensajería: lo que reclama atención primero
     y el resto por antigüedad. Dejarlo en el orden fijo de los equipos haría
     que un mensaje nuevo en el último de la lista siguiera saliendo el último. */
  const ordenados = [...activos].sort((a, b) => {
    const ra = porEquipo[a.id]
    const rb = porEquipo[b.id]
    const dif = (rb?.noLeidos ?? 0) - (ra?.noLeidos ?? 0)
    if (dif !== 0) return dif
    return (cuandoDe(rb?.ultimo) ?? 0) - (cuandoDe(ra?.ultimo) ?? 0)
  })

  // `scroll={false}`: la lista es la que desplaza. Anidarla dentro del
  // ScrollView de `Pantalla` le quitaría el reciclado de filas.
  return (
    <Pantalla ante="Tus equipos" titulo="Chat" scroll={false}>
      {cargando && Object.keys(porEquipo).length === 0 ? (
        <Cargando texto="Cargando conversaciones…" />
      ) : (
        <FlatList
          data={ordenados}
          keyExtractor={(eq) => eq.id}
          ItemSeparatorComponent={SeparadorBandeja}
          renderItem={({ item }) => (
            <FilaChat equipo={item} uid={perfil?.uid ?? ''} />
          )}
        />
      )}
    </Pantalla>
  )
}

function FilaChat({ equipo, uid }: { equipo: Equipo; uid: string }) {
  const { porEquipo } = useChats()
  const resumen = porEquipo[equipo.id]
  const ultimo = resumen?.ultimo ?? null
  const cuando = aDate(ultimo?.creadoEn)

  return (
    <FilaBandeja
      nombre={equipo.nombre}
      detalle={`${equipo.categoria} · ${equipo.genero}`}
      previa={ultimo ? vistaPrevia(ultimo, uid) : 'Todavía no hay mensajes'}
      cuando={cuando ? desde(cuando) : null}
      noLeidos={resumen?.noLeidos ?? 0}
      mas={resumen?.desbordado ?? false}
      onPress={() => router.push(`/chat/${equipo.id}`)}
    />
  )
}

/**
 * La línea que resume el último mensaje: «Nombre: texto».
 *
 * Lo propio sale como «Tú», que es lo que deja ver de un golpe si la pelota
 * está en el tejado de uno o en el del equipo. Solo el nombre de pila: los
 * apellidos se comen el ancho y no distinguen nada dentro de un equipo.
 */
function vistaPrevia(m: Mensaje, uid: string): string {
  const quien = m.autor === uid ? 'Tú' : m.autorNombre.split(' ')[0]
  return `${quien}: ${m.texto}`
}

const cuandoDe = (m: Mensaje | null | undefined): number | null => {
  const f = aDate(m?.creadoEn)
  return f ? f.getTime() : null
}
