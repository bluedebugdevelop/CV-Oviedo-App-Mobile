// ==========================================================================
// Tus equipos.
//
// Quien está en más de uno —jugar en dos categorías, entrenar a una y jugar en
// otra— elige aquí. Antes se elegía con una fila de pastillas arriba de la
// pantalla del equipo, el mismo patrón que ya se quitó del chat y de los
// avisos y por las mismas razones: había que tocar una a una para ver qué
// había dentro, y con tres o cuatro equipos los nombres se cortaban.
//
// Con UN solo equipo no se pinta la lista: la pestaña entra directa a su
// pantalla. Es la misma regla que en Chat y en Avisos, y lo que hace que las
// tres pestañas se comporten igual.
//
// Cada fila trae lo suyo puesto: la categoría, si compite federado y cuándo es
// su próximo partido. Elegir equipo deja de ser un paso a ciegas.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Monograma } from '../../componentes/Bandeja'
import { Pantalla } from '../../componentes/Pantalla'
import { proximoPartido, useDatosEquipo } from '../../componentes/equipo/datos'
import { ResumenEquipo } from '../../componentes/equipo/Resumen'
import { Etiqueta, Vacio } from '../../componentes/ui'
import { useSesion } from '../../contexto/sesion'
import { relativoDia } from '../../lib/fechas'
import type { Equipo } from '../../lib/firebase/modelo'
import { enCasa, rivalDe } from '../../lib/web/partidos'
import { color, espacio, radio, sombra } from '../../tema'

export default function MisEquipos() {
  const { equipos } = useSesion()

  // `equipos` ya viene sin archivados de la sesión: los de temporadas
  // anteriores no tienen nada que hacer aquí.
  const mios = useMemo(() => [...equipos].sort((a, b) => a.nombre.localeCompare(b.nombre)), [equipos])

  if (mios.length === 0) {
    return (
      <Pantalla titulo="Mi equipo">
        <Vacio
          icono="people-outline"
          titulo="Sin equipo"
          texto="Cuando el club te asigne a un equipo, aquí verás sus partidos, su horario y su plantilla."
        />
      </Pantalla>
    )
  }

  /* Un solo equipo: su resumen aquí mismo, sin lista de una fila.

     Se PINTA dentro de la pestaña, no se redirige a la otra ruta. Redirigir
     sacaba del navegador de pestañas y la barra de abajo desaparecía nada más
     entrar, sin forma de volver. Es la misma solución que ya usaban Chat y
     Avisos para su caso de un solo equipo. */
  if (mios.length === 1) return <ResumenEquipo equipoId={mios[0].id} />

  return (
    <Pantalla ante="Tus equipos" titulo="Mi equipo">
      <View style={{ gap: espacio.md }}>
        {mios.map((eq) => (
          <FilaEquipo key={eq.id} equipo={eq} />
        ))}
      </View>
    </Pantalla>
  )
}

function FilaEquipo({ equipo }: { equipo: Equipo }) {
  const datos = useDatosEquipo(equipo.id)
  const proximo = proximoPartido(datos)

  return (
    <Pressable
      onPress={() => router.push(`/equipo/${equipo.id}`)}
      accessibilityRole="button"
      accessibilityLabel={equipo.nombre}
      style={({ pressed }) => [e.tarjeta, pressed && { opacity: 0.7 }]}
    >
      <View style={e.alto}>
        <Monograma nombre={equipo.nombre} size={46} />

        <View style={{ flex: 1, gap: 3 }}>
          <Text style={e.nombre} numberOfLines={2}>
            {equipo.nombre}
          </Text>
          <Text style={e.meta}>
            {equipo.categoria} · {equipo.genero}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={color.linea} />
      </View>

      <View style={e.bajo}>
        {equipo.claveCompeticion ? (
          <Etiqueta fondo={color.verdeTinte} texto={color.verde}>
            COMPETICIÓN
          </Etiqueta>
        ) : (
          <Etiqueta>SOLO ENTRENAMIENTOS</Etiqueta>
        )}

        {proximo ? (
          <Text style={e.proximo} numberOfLines={1}>
            {relativoDia(proximo.cuando)} ·{' '}
            {proximo.tipo === 'cita'
              ? proximo.evento.titulo
              : `${enCasa(proximo.partido, proximo.club ?? '') ? 'vs' : 'en'} ${rivalDe(
                  proximo.partido,
                  proximo.club ?? '',
                )}`}
          </Text>
        ) : (
          <Text style={e.proximoVacio}>Sin próximo partido</Text>
        )}
      </View>
    </Pressable>
  )
}

const e = StyleSheet.create({
  tarjeta: {
    backgroundColor: color.blanco,
    borderRadius: radio.lg,
    borderWidth: 1,
    borderColor: color.linea,
    padding: espacio.lg,
    gap: espacio.md,
    ...sombra,
  },
  alto: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
  nombre: { fontSize: 17, fontWeight: '700', color: color.tinta, lineHeight: 22 },
  meta: { fontSize: 12.5, color: color.apagado },

  bajo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    borderTopWidth: 1,
    borderTopColor: color.linea,
    paddingTop: espacio.md,
  },
  proximo: { flex: 1, fontSize: 12.5, color: color.tinta, fontWeight: '600' },
  proximoVacio: { flex: 1, fontSize: 12.5, color: color.apagado },
})
