#!/usr/bin/env node
// ==========================================================================
// Genera los iconos de la app a partir del escudo del club.
//
//   npm run assets
//
// Las fuentes son dos SVG en `assets/icono/`:
//
//   escudo.svg        el escudo completo, el mismo que usa la web
//   notificacion.svg  el monograma CVO suelto, para el icono pequeño
//
// POR QUÉ RESVG Y NO EL RENDERIZADOR DE SHARP
// El escudo lleva «CLUB VOLEIBOL OVIEDO» curvado sobre una circunferencia
// (`<textPath>`). El renderizador que trae sharp —librsvg— se lo come EN
// SILENCIO: dibuja el escudo perfecto, con su anillo y sus balones, y sin una
// sola letra alrededor. No da error; solo se ve mirando el resultado.
//
// CADA SITIO QUIERE EL ICONO DE UNA FORMA
//   · iOS no admite transparencia. Un icono con alfa sale con el fondo negro en
//     el dispositivo, así que va aplanado sobre blanco.
//   · Android recorta el icono adaptativo a la forma del lanzador (círculo,
//     cuadrado redondeado, gota…). Solo el 66% central está a salvo, de ahí el
//     margen extra en la capa de delante.
//   · Las NOTIFICACIONES llevan dos piezas distintas. La pequeña —la de la
//     barra de estado— Android la pinta a 24 dp y sin color, así que es el
//     monograma CVO a secas: a ese tamaño caben las tres letras o un disco
//     alrededor, no las dos cosas. La grande sí sale en color y es el escudo
//     entero. Ver `notificacion.svg`.
//
// Regenerar es idempotente: mismos SVG, mismos ficheros.
// ==========================================================================

import fs from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'

const RAIZ = path.join(import.meta.dirname, '..')
const CARPETA = path.join(RAIZ, 'assets', 'icono')

// Azul del club (--blue en el index.css de la web).
const AZUL = '#1560bd'
const BLANCO = '#ffffff'

const salida = (nombre) => path.join(CARPETA, nombre)

/** Un SVG del proyecto, rasterizado al ancho que se pida. */
function rasterizar(fichero, ancho) {
  const svg = fs.readFileSync(path.join(CARPETA, fichero), 'utf8')
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: ancho },
    // Sin las fuentes del sistema, el texto curvado del anillo no se dibuja.
    font: { loadSystemFonts: true, defaultFontFamily: 'Georgia' },
  })
  return r.render().asPng()
}

/**
 * Coloca una pieza centrada en un lienzo cuadrado.
 *
 * @param ocupacion cuánto del lado ocupa (1 = pegada a los bordes)
 * @param fondo     color de fondo, o `null` para dejarlo transparente
 */
async function componer(png, lado, ocupacion, fondo) {
  const dentro = Math.round(lado * ocupacion)
  const capa = await sharp(png).resize(dentro, dentro, { fit: 'contain' }).toBuffer()

  return sharp({
    create: {
      width: lado,
      height: lado,
      channels: 4,
      background: fondo ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: capa, gravity: 'center' }])
    .png()
    .toBuffer()
}

async function main() {
  for (const f of ['escudo.svg', 'notificacion.svg']) {
    if (!fs.existsSync(path.join(CARPETA, f))) {
      console.error(`Falta ${f} en assets/icono/`)
      process.exit(1)
    }
  }

  const escudo = rasterizar('escudo.svg', 1024)
  const monograma = rasterizar('notificacion.svg', 512)

  const piezas = [
    // Icono de tienda y de app. Sobre blanco porque iOS no admite alfa.
    ['icon.png', await componer(escudo, 1024, 0.86, BLANCO)],
    // Android adaptativo: la capa de delante solo puede fiarse del 66% central.
    ['adaptive-foreground.png', await componer(escudo, 1024, 0.62, null)],
    // Pantalla de arranque: el escudo suelto sobre el azul que pone app.json.
    ['splash.png', await componer(escudo, 1024, 0.62, null)],
    /* Icono pequeño: el monograma, no el escudo en color.

       Android se queda solo con el alfa y lo rellena con el color de acento
       (app.json). Va casi a sangre porque la guía pide la tinta dentro de 22
       de los 24 dp: encogerlo más es lo que dejaba una mancha en medio del
       hueco, y con el hueco vacío algunas capas de Android caen de vuelta al
       icono de la app —el escudo con su aro amarillo— que es de donde salía
       el amarillo que no venía a cuento. */
    ['notificacion.png', await componer(monograma, 256, 0.92, null)],
    /* El escudo EN COLOR, para el icono grande de la notificación.

       Este sí sale tal cual, a la derecha de la tarjeta: el icono grande no
       lo tiñe nadie. Va sobre transparente y al 94% porque hay capas de
       Android que lo recortan a un círculo, y así el borde negro del escudo
       no se queda fuera. Lo instala plugins/icono-grande.js. */
    ['notificacion-grande.png', await componer(escudo, 256, 0.94, null)],
    // Icono monocromo del tema de Android 13+: mismo criterio, más margen.
    ['adaptive-monochrome.png', await componer(monograma, 1024, 0.55, null)],
    // Favicon de la versión web de Expo.
    ['favicon.png', await componer(escudo, 96, 0.92, BLANCO)],
  ]

  for (const [nombre, datos] of piezas) {
    fs.writeFileSync(salida(nombre), datos)
    const { width, height } = await sharp(datos).metadata()
    console.log(`  ${nombre.padEnd(28)} ${width}x${height}  ${(datos.length / 1024).toFixed(0)} kB`)
  }

  console.log(`\nListo. Azul de marca: ${AZUL}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
