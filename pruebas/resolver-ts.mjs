// ==========================================================================
// Un enganche de resolución para poder probar el código TypeScript de `src/`
// desde `node --test`, sin compilar nada antes.
//
// Node 22 ya entiende TypeScript él solo: le quita los tipos y ejecuta. Lo que
// NO hace es adivinar la extensión, y todo `src/` importa sin ella
// (`from './web/competicion'`), que es como escriben TypeScript y Metro.
//
// Esto rellena ese hueco: si una ruta relativa no resuelve tal cual, se
// reintenta con `.ts`, con `.tsx` y como carpeta con `index`. Veinte líneas
// que evitan meter ts-node o tsx en las dependencias para correr dos pruebas.
//
// Se engancha desde el script de npm:
//   node --import ./pruebas/resolver-ts.mjs --test pruebas/
// ==========================================================================

import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

const INTENTOS = ['.ts', '.tsx', '/index.ts', '/index.tsx']

export async function resolve(especificador, contexto, siguiente) {
  try {
    return await siguiente(especificador, contexto)
  } catch (fallo) {
    // Solo se reintenta lo que parece una ruta a un fichero nuestro. Un
    // paquete de node_modules que no existe tiene que seguir fallando, y con
    // su mensaje, no con «no encuentro modulo.ts».
    const esRuta = especificador.startsWith('.') || especificador.startsWith('/')
    if (!esRuta || fallo?.code !== 'ERR_MODULE_NOT_FOUND') throw fallo

    for (const sufijo of INTENTOS) {
      try {
        return await siguiente(especificador + sufijo, contexto)
      } catch {
        /* se prueba el siguiente */
      }
    }
    throw fallo
  }
}

register(pathToFileURL(import.meta.filename))
