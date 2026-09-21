// ==========================================================================
// Todo lo de un equipo, traído una vez.
//
// Lo piden dos pantallas —el resumen del equipo y cada una de sus cuatro
// secciones— y con las mismas suscripciones: horario, citas, plantilla y el
// calendario federado. Tenerlo en un hook evita que cada pantalla monte las
// suyas y que el resumen enseñe «3 entrenamientos» mientras la sección de
// horario todavía está cargando.
//
// No va en un contexto como `chats` o `avisos` porque esto es de UN equipo, el
// que se está mirando, y se apaga al salir. Aquellos escuchan todos los equipos
// a la vez porque alimentan un contador que tiene que estar siempre al día.
// ==========================================================================

import { useEffect, useMemo, useState } from 'react'

import { useSesion } from '../../contexto/sesion'
import { escucharEntrenamientos, escucharEventos } from '../../lib/firebase/entrenamientos'
import type { Entrenamiento, Evento, Usuario } from '../../lib/firebase/modelo'
import { escucharUsuariosDeEquipo } from '../../lib/firebase/usuarios'
import { useCompeticion } from '../../lib/hooks'
import { aFecha, repartirPartidos } from '../../lib/web/partidos'

export function useDatosEquipo(equipoId: string | null | undefined) {
  const { equipos } = useSesion()

  const equipo = useMemo(
    () => equipos.find((eq) => eq.id === equipoId) ?? null,
    [equipos, equipoId],
  )

  const [entrenamientos, setEntrenamientos] = useState<Entrenamiento[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [plantilla, setPlantilla] = useState<Usuario[]>([])

  useEffect(() => {
    if (!equipo) return
    return escucharEntrenamientos(equipo.id, setEntrenamientos)
  }, [equipo])

  useEffect(() => {
    if (!equipo) return
    return escucharEventos(equipo.id, setEventos)
  }, [equipo])

  useEffect(() => {
    if (!equipo) return
    return escucharUsuariosDeEquipo(equipo.id, setPlantilla)
  }, [equipo])

  const competicion = useCompeticion(equipo?.claveCompeticion ?? null)

  return { equipo, entrenamientos, eventos, plantilla, competicion }
}

export type DatosEquipo = ReturnType<typeof useDatosEquipo>

/**
 * El próximo partido, o `null`.
 *
 * Mira también las citas del equipo, no solo el calendario federado: para la
 * cantera —que este año no tiene calendario publicado— un amistoso apuntado a
 * mano es LO ÚNICO que hay, y dejarlo fuera haría que su pantalla dijera
 * siempre «no hay partidos» teniendo uno el sábado.
 */
export function proximoPartido(datos: DatosEquipo) {
  const club = datos.competicion.datos?.equipoClub
  const federado = datos.competicion.datos
    ? repartirPartidos(datos.competicion.datos.partidos).proximos[0]
    : null

  const ahora = new Date()
  const amistoso = datos.eventos
    .filter((ev) => ev.tipo === 'partido')
    .map((ev) => ({ ev, cuando: aFecha(ev.iso) }))
    .filter((x) => x.cuando && x.cuando >= ahora)
    .sort((a, b) => a.cuando!.getTime() - b.cuando!.getTime())[0]

  const fFederado = federado ? aFecha(federado.iso) : null
  // Gana el que caiga antes, sea de la federación o del entrenador.
  if (fFederado && (!amistoso?.cuando || fFederado <= amistoso.cuando)) {
    return { tipo: 'federado' as const, partido: federado!, cuando: fFederado, club }
  }
  if (amistoso?.cuando) {
    return { tipo: 'cita' as const, evento: amistoso.ev, cuando: amistoso.cuando, club }
  }
  return null
}
