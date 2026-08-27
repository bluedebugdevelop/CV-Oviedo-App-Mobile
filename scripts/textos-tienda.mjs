#!/usr/bin/env node
// ==========================================================================
// Comprobar que los textos de la ficha caben.
//
//   npm run tienda:textos
//
// Play corta por lo sano al pegar un texto que se pasa del límite, y lo hace
// sin avisar: te enteras al ver la ficha publicada con la frase a medias. Esto
// lo dice antes.
//
// Se mide con `[...cadena]` y no con `.length`, que cuenta unidades UTF-16: una
// eñe compuesta o un emoji contarían de más y el aviso sería falso.
// ==========================================================================

import fs from 'node:fs'
import path from 'node:path'

const FICHERO = path.join(import.meta.dirname, '..', 'tienda', 'descripcion.md')

const LIMITES = [
  ['Nombre', 30],
  ['Descripción breve', 80],
  ['Descripción completa', 4000],
]

const md = fs.readFileSync(FICHERO, 'utf8')
const bloques = [...md.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => m[1])

if (bloques.length < LIMITES.length) {
  console.error(`Se esperaban ${LIMITES.length} bloques y hay ${bloques.length}.`)
  process.exit(1)
}

let mal = 0
LIMITES.forEach(([etiqueta, tope], i) => {
  const n = [...bloques[i]].length
  const ok = n <= tope
  if (!ok) mal++
  console.log(
    `${ok ? 'OK ' : 'MAL'}  ${etiqueta.padEnd(22)} ${String(n).padStart(4)} / ${tope}`,
  )
})

process.exit(mal > 0 ? 1 : 0)
