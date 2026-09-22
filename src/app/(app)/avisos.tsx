// ==========================================================================
// La bandeja de avisos.
//
// Misma idea y misma pinta que la de chats, a propósito: son las dos pantallas
// donde la pregunta es «¿hay algo nuevo, y dónde?». Aprender una es aprender
// la otra.
//
// Antes tenía el mismo selector de equipos en pastillas que el chat, con el
// mismo problema: quien está en dos equipos tenía que ir tocando para ver si
// había una convocatoria esperando en el otro. Ahora el globito de la pestaña
// cuenta los de TODOS los equipos (ver `contexto/avisos`) y esta lista dice en
// cuál están.
//
// Con UN solo equipo se entra directo a sus avisos, sin lista intermedia.
// ==========================================================================

import { router } from 'expo-router'
import { useMemo } from 'react'
import { FlatList } from 'react-native'

import { FilaBandeja, SeparadorBandeja } from '../../componentes/Bandeja'
import { ListaAvisos, PINTA } from '../../componentes/ListaAvisos'
import { Pantalla } from '../../componentes/Pantalla'
import { Cargando, Vacio } from '../../componentes/ui'
import { useAvisos } from '../../contexto/avisos'
import { useSesion } from '../../contexto/sesion'
import { aDate, desde } from '../../lib/fechas'
import type { Aviso, Equipo } from '../../lib/firebase/modelo'

export default function Avisos() {
  const { equipos } = useSesion()
  const { porEquipo, cargando } = useAvisos()

  const activos = useMemo(() => equipos.filter((eq) => !eq.archivado), [equipos])

  if (activos.length === 0) {
    return (
      <Pantalla titulo="Avisos">
        <Vacio
          icono="notifications-outline"
          titulo="Sin equipo"
          texto="Los avisos los manda el entrenador a su equipo. Cuando estés en uno, aparecerán aquí."
        />
      </Pantalla>
    )
  }

  // Un solo equipo: sus avisos, sin pasar por una lista de un elemento.
  if (activos.length === 1) return <ListaAvisos equipoId={activos[0].id} />

  // Lo que reclama atención arriba y luego por lo más reciente, igual que en
  // la bandeja de chats.
  const ordenados = [...activos].sort((a, b) => {
    const ra = porEquipo[a.id]
    const rb = porEquipo[b.id]
    const dif = (rb?.noLeidos ?? 0) - (ra?.noLeidos ?? 0)
    if (dif !== 0) return dif
    return (cuandoDe(rb?.ultimo) ?? 0) - (cuandoDe(ra?.ultimo) ?? 0)
  })

  return (
    <Pantalla ante="Tus equipos" titulo="Avisos" scroll={false}>
      {cargando && Object.keys(porEquipo).length === 0 ? (
        <Cargando texto="Cargando avisos…" />
      ) : (
        <FlatList
          data={ordenados}
          keyExtractor={(eq) => eq.id}
          ItemSeparatorComponent={SeparadorBandeja}
          renderItem={({ item }) => <FilaAvisos equipo={item} />}
        />
      )}
    </Pantalla>
  )
}

function FilaAvisos({ equipo }: { equipo: Equipo }) {
  const { porEquipo } = useAvisos()
  const resumen = porEquipo[equipo.id]
  const ultimo = resumen?.ultimo ?? null
  const cuando = aDate(ultimo?.creadoEn)

  return (
    <FilaBandeja
      nombre={equipo.nombre}
      detalle={`${equipo.categoria} · ${equipo.genero}`}
      previa={ultimo ? ultimo.titulo : 'Ningún aviso todavía'}
      // El icono del tipo delante de la vista previa: un «urgente» se ve sin
      // abrir nada, que es de lo que va un aviso urgente.
      icono={ultimo ? PINTA[ultimo.tipo].icono : undefined}
      cuando={cuando ? desde(cuando) : null}
      noLeidos={resumen?.noLeidos ?? 0}
      onPress={() => router.push(`/avisos/${equipo.id}`)}
    />
  )
}

const cuandoDe = (a: Aviso | null | undefined): number | null => {
  const f = aDate(a?.creadoEn)
  return f ? f.getTime() : null
}
