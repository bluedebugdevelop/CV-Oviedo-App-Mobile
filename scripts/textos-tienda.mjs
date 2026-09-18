#!/usr/bin/env node
// ==========================================================================
// Comprobar que los textos de las fichas caben.
//
//   npm run tienda:textos
//
// Play y App Store cortan por lo sano al pegar un texto que se pasa del
// límite, y lo hacen sin avisar: te enteras al ver la ficha publicada con la
// frase a medias. Esto lo dice antes.
//
// Se mide con `[...cadena]` y no con `.length`, que cuenta unidades UTF-16: una
// eñe compuesta o un emoji contarían de más y el aviso sería falso.
// ==========================================================================

import fs from 'node:fs'
import path from 'node:path'

const TIENDA = path.join(import.meta.dirname, '..', 'tienda')

// Los bloques ``` de cada fichero, en orden, con su tope.
const FICHAS = [
  {
    fichero: 'descripcion.md',
    tienda: 'Google Play',
    limites: [
      ['Nombre', 30],
      ['Descripción breve', 80],
      ['Descripción completa', 4000],
    ],
  },
  {
    fichero: 'app-store.md',
    tienda: 'App Store',
    limites: [
      ['Nombre', 30],
      ['Subtítulo', 30],
      ['Texto promocional', 170],
      ['Descripción', 4000],
      ['Palabras clave', 100],
    ],
  },
]

let mal = 0

for (const { fichero, tienda, limites } of FICHAS) {
  const md = fs.readFileSync(path.join(TIENDA, fichero), 'utf8')
  const bloques = [...md.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => m[1])

  console.log(`\n${tienda}  (${fichero})`)

  if (bloques.length < limites.length) {
    console.error(`  Se esperaban ${limites.length} bloques y hay ${bloques.length}.`)
    mal++
    continue
  }

  limites.forEach(([etiqueta, tope], i) => {
    const n = [...bloques[i]].length
    const ok = n <= tope
    if (!ok) mal++
    console.log(`  ${ok ? 'OK ' : 'MAL'}  ${etiqueta.padEnd(22)} ${String(n).padStart(4)} / ${tope}`)
  })
}

console.log()
process.exit(mal > 0 ? 1 : 0)
