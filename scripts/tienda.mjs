#!/usr/bin/env node
// ==========================================================================
// Los materiales de la ficha de Google Play.
//
//   npm run tienda
//
// Salen a `tienda/`. Los PNG no se versionan —se rehacen en un segundo desde
// el escudo— pero `descripcion.md` sí: ese es texto escrito a mano.
//
// POR QUÉ RESVG Y NO SHARP
// El escudo es un SVG con el texto «CLUB VOLEIBOL OVIEDO» curvado sobre una
// circunferencia (`<textPath>`). El renderizador que trae sharp —librsvg— se lo
// come en silencio: dibuja el escudo perfecto y sin una letra alrededor, que es
// de esos fallos que solo se ven mirando el resultado. resvg sí lo entiende.
//
// LO QUE PIDE PLAY
//   · Icono: PNG de 512×512. Sin transparencia: Play pone su propia máscara
//     redondeada y su sombra, así que se entrega cuadrado y a sangre. El escudo
//     va al 82% para que la esquina redondeada no le muerda el anillo.
//   · Gráfico de funciones: 1024×500, tampoco con alfa. Play lo recorta por los
//     lados en algunas pantallas, así que nada importante toca los bordes.
// ==========================================================================

import fs from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'

const RAIZ = path.join(import.meta.dirname, '..')
const ESCUDO = path.join(RAIZ, 'assets', 'icono', 'escudo.svg')
const DESTINO = path.join(RAIZ, 'tienda')

const AZUL = '#1560bd'
const AZUL_HONDO = '#0b2c50'

/** El escudo, en PNG y al tamaño que se pida. */
function escudo(lado) {
  const svg = fs.readFileSync(ESCUDO, 'utf8')
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: lado },
    // Sin las fuentes del sistema, el texto curvado del anillo no se dibuja.
    font: { loadSystemFonts: true, defaultFontFamily: 'Georgia' },
  })
  return r.render().asPng()
}

/** Un SVG cualquiera a PNG, con las fuentes del sistema disponibles. */
function pintar(svg, ancho) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: ancho },
    font: { loadSystemFonts: true, defaultFontFamily: 'Arial' },
  })
  return r.render().asPng()
}

// --- 1. el icono ----------------------------------------------------------

async function icono() {
  const lado = 512
  // 82%: deja margen para la máscara redondeada que aplica Play.
  const dentro = Math.round(lado * 0.82)

  return sharp({
    create: { width: lado, height: lado, channels: 3, background: '#ffffff' },
  })
    .composite([{ input: escudo(dentro), gravity: 'center' }])
    .png()
    .toBuffer()
}

// --- 2. el gráfico de funciones -------------------------------------------

/**
 * La imagen de cabecera de la ficha.
 *
 * Un gráfico de funciones no es un cartel: se ve pequeño y a veces recortado.
 * Por eso lleva lo justo —escudo, nombre y de qué va— con mucho contraste y
 * nada pegado a los bordes.
 */
function graficoFunciones() {
  const A = 1024
  const B = 500

  const fondo = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${A}" height="${B}" viewBox="0 0 ${A} ${B}">
      <defs>
        <linearGradient id="cielo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${AZUL}"/>
          <stop offset="100%" stop-color="${AZUL_HONDO}"/>
        </linearGradient>
      </defs>

      <rect width="${A}" height="${B}" fill="url(#cielo)"/>

      <!-- Trazos de pista, muy tenues: dan textura sin competir con el texto. -->
      <g stroke="#ffffff" stroke-opacity="0.07" stroke-width="2" fill="none">
        <path d="M -50 ${B} L 300 -50"/>
        <path d="M 60 ${B} L 410 -50"/>
        <path d="M 700 ${B + 40} L 1100 -40"/>
        <circle cx="880" cy="90" r="150" stroke-opacity="0.06"/>
        <circle cx="880" cy="90" r="230" stroke-opacity="0.05"/>
      </g>

      <!-- El texto. Se listan varias familias porque la que haya instalada
           cambia de una máquina a otra; todas son de palo y sin remates. -->
      <g font-family="Segoe UI, Roboto, Arial, Helvetica, sans-serif">
        <text x="392" y="196" fill="#ffffff" font-size="78" font-weight="700"
              letter-spacing="-1">CV Oviedo</text>
        <text x="396" y="252" fill="#bfdcf8" font-size="31" font-weight="600">
          La app de los equipos del club
        </text>
        <text x="396" y="330" fill="#ffffff" fill-opacity="0.82" font-size="25">
          Calendario · Clasificaciones · Chat
        </text>
        <text x="396" y="368" fill="#ffffff" fill-opacity="0.82" font-size="25">
          Avisos del entrenador · Horarios
        </text>
      </g>
    </svg>`

  return sharp(pintar(fondo, A))
    .composite([{ input: escudo(300), left: 70, top: 100 }])
    // Sin canal alfa: Play rechaza el gráfico de funciones con transparencia.
    .flatten({ background: AZUL_HONDO })
    .png()
    .toBuffer()
}

// --- ejecutar -------------------------------------------------------------

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true })

  const piezas = [
    ['icono-play-512.png', await icono()],
    ['grafico-funciones-1024x500.png', await graficoFunciones()],
  ]

  for (const [nombre, datos] of piezas) {
    const ruta = path.join(DESTINO, nombre)
    fs.writeFileSync(ruta, datos)
    const { width, height, channels } = await sharp(datos).metadata()
    console.log(
      `  ${nombre.padEnd(34)} ${width}x${height}  ${channels} canales  ` +
        `${(datos.length / 1024).toFixed(0)} kB`,
    )
  }

  console.log(`\nEn ${path.relative(RAIZ, DESTINO)}/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
