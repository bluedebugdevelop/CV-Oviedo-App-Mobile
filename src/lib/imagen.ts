// ==========================================================================
// El encuadre de las fotos de la web, traducido a lo que entiende expo-image.
//
// En la web, el campo `foco` de una noticia o de un equipo es un
// `object-position` de CSS: '50% 30%', 'top', 'center 20%'. Sirve para que al
// recortar una foto apaisada a un hueco cuadrado no se corte la cabeza de
// nadie, y lo elige el club desde el panel.
//
// `contentPosition` de expo-image quiere otra cosa: o una de sus palabras
// sueltas, o un objeto con lados. Sin traducir, TypeScript lo rechaza y —peor—
// las fotos saldrían todas centradas, ignorando el encuadre que alguien se
// molestó en ajustar.
// ==========================================================================

import type { ImageContentPosition } from 'expo-image'

/** Las que expo-image acepta tal cual. */
const PALABRAS = new Set(['center', 'top', 'bottom', 'left', 'right'])

/**
 * '50% 30%' → { left: '50%', top: '30%' }
 * 'top'     → 'top'
 * ''        → 'center'
 *
 * Con un solo porcentaje ('30%'), CSS entiende que es el horizontal y que el
 * vertical queda al 50%; aquí se hace lo mismo para no cambiar cómo se ve una
 * foto al pasar de la web a la app.
 */
export function encuadre(foco?: string | null): ImageContentPosition {
  const limpio = (foco ?? '').trim().toLowerCase()
  if (!limpio) return 'center'

  const trozos = limpio.split(/\s+/)

  // 'top', 'left'… y también 'top left', que ya es válido para expo-image.
  if (trozos.every((t) => PALABRAS.has(t))) return limpio as ImageContentPosition

  const [x, y = '50%'] = trozos
  if (!esMedida(x) || !esMedida(y)) return 'center'

  return { left: x, top: y }
}

const esMedida = (v: string) => /^-?\d+(\.\d+)?(%|px)?$/.test(v)
