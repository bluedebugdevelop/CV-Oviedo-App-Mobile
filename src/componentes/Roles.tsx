// ==========================================================================
// Las etiquetas de rol de una persona.
//
// Desde que los roles son varios, «ADMIN» a secas ya no vale: la misma persona
// puede ser administradora del club y jugar en el sénior, y las dos cosas
// tienen que verse. Se pintan en el mismo orden siempre —admin, entrenador,
// jugador— para que la vista se acostumbre a leerlas de un vistazo.
// ==========================================================================

import { StyleSheet, View } from 'react-native'

import { Etiqueta } from './ui'
import { ROLES, etiquetaRol, type Rol } from '../lib/firebase/modelo'
import { colorRol, espacio } from '../tema'

export function ChipsRoles({
  roles,
  corto = false,
}: {
  roles: Rol[]
  /** Solo la inicial del rol: para listas donde no cabe el nombre entero. */
  corto?: boolean
}) {
  // Se recorre ROLES y no `roles` para que el orden no dependa de cómo se
  // guardaron en Firestore.
  const ordenados = ROLES.filter((r) => roles.includes(r.valor))
  if (ordenados.length === 0) return null

  return (
    <View style={e.fila}>
      {ordenados.map((r) => {
        const paleta = colorRol[r.valor]
        const texto = etiquetaRol(r.valor).toUpperCase()
        return (
          <Etiqueta key={r.valor} fondo={paleta.fondo} texto={paleta.texto}>
            {corto ? texto.slice(0, 4) : texto}
          </Etiqueta>
        )
      })}
    </View>
  )
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm },
})
