#!/usr/bin/env node
// ==========================================================================
// Genera los iconos de la app a partir del escudo del club.
//
//   npm run assets
//
// La fuente es `assets/icono/escudo.png`, el mismo fichero que usa la web
// (public/media/escudo.png). Se copia aquí a propósito en vez de leerlo del
// otro repo: la app tiene que poder compilar sin CVOWeb al lado.
//
// Cada tienda quiere el icono de una forma distinta y ninguna admite el PNG
// tal cual:
//
//   · iOS no deja transparencia. Un icono con alfa se ve con el fondo negro
//     en el dispositivo, así que va aplanado sobre blanco.
//   · Android recorta el icono adaptativo a la forma que tenga el lanzador
//     (círculo, cuadrado redondeado, gota...). Solo el 66% central está a
//     salvo, de ahí el margen extra en la capa de delante.
//   · El icono de notificación de Android se pinta como una silueta: el
//     sistema tira todo el color y deja solo el alfa. Si se le pasa el escudo
//     en color, sale un borrón blanco. Se genera aparte, ya en blanco puro.
//
// Regenerar es idempotente: mismo escudo, mismos ficheros.
// ==========================================================================

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const RAIZ = path.join(import.meta.dirname, '..')
const DESTINO = path.join(RAIZ, 'assets', 'icono')
const ESCUDO = path.join(DESTINO, 'escudo.png')

// Azul del club (--blue en el index.css de la web).
const AZUL = '#1560bd'
const BLANCO = '#ffffff'

const salida = (nombre) => path.join(DESTINO, nombre)

/** El escudo recortado a su contenido, para controlar el margen nosotros. */
async function escudoLimpio() {
  return sharp(ESCUDO).trim({ threshold: 1 }).toBuffer()
}

/**
 * Coloca el escudo centrado en un lienzo cuadrado.
 *
 * @param ocupacion cuánto del lado ocupa el escudo (1 = pegado a los bordes)
 * @param fondo     color de fondo, o `null` para dejarlo transparente
 */
async function componer(escudo, lado, ocupacion, fondo) {
  const dentro = Math.round(lado * ocupacion)
  const capa = await sharp(escudo).resize(dentro, dentro, { fit: 'contain' }).toBuffer()
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

/**
 * Silueta blanca sobre transparente: lo único que entiende la barra de estado.
 *
 * No vale con quedarse con el alfa del escudo. El escudo es un disco lleno, así
 * que su alfa es un círculo macizo y en la barra de estado saldría una pelota
 * blanca sin más, indistinguible de cualquier otra app.
 *
 * Lo que sí identifica al escudo son sus trazos negros: el aro de fuera, el
 * "CLUB VOLEIBOL OVIEDO" que lo rodea y las letras CVO del centro. Así que la
 * máscara se saca de la LUMINANCIA: lo oscuro pasa a blanco opaco y todo lo
 * demás —amarillo, cian, naranja, el fondo— se va a transparente. Queda el
 * dibujo del escudo en negativo, que es justo lo que Android va a pintar.
 */
async function silueta(escudo, lado) {
  const dentro = Math.round(lado * 0.94)

  const base = sharp(escudo).resize(dentro, dentro, { fit: 'contain' }).ensureAlpha()

  // Lo oscuro del escudo: negro tras el umbral, blanco el resto.
  const oscuro = await base
    .clone()
    .flatten({ background: BLANCO }) // fuera del escudo es fondo, no trazo
    .greyscale()
    .threshold(110)
    .toBuffer()

  // `threshold` deja los trazos en negro (0) y el resto en blanco (255). Como
  // máscara de opacidad hace falta al revés, de ahí el negado.
  const mascara = await sharp(oscuro).negate({ alpha: false }).extractChannel(0).toBuffer()

  const blanco = await sharp({
    create: { width: dentro, height: dentro, channels: 3, background: BLANCO },
  })
    .png()
    .toBuffer()

  const capa = await sharp(blanco).joinChannel(mascara).png().toBuffer()

  return sharp({
    create: { width: lado, height: lado, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: capa, gravity: 'center' }])
    .png()
    .toBuffer()
}

async function main() {
  if (!fs.existsSync(ESCUDO)) {
    console.error(`No está el escudo en ${ESCUDO}`)
    process.exit(1)
  }

  const escudo = await escudoLimpio()

  const piezas = [
    // Icono de tienda y de app. Sobre blanco porque iOS no admite alfa.
    ['icon.png', await componer(escudo, 1024, 0.86, BLANCO)],
    // Android adaptativo: la capa de delante solo puede fiarse del 66% central.
    ['adaptive-foreground.png', await componer(escudo, 1024, 0.62, null)],
    // Pantalla de arranque: el escudo suelto sobre el azul del club, que lo pone
    // app.json. El anillo amarillo es lo que hace que se lea sobre ese fondo.
    ['splash.png', await componer(escudo, 1024, 0.62, null)],
    // Notificaciones de Android: silueta, no escudo.
    ['notificacion.png', await silueta(escudo, 256)],
    // Icono monocromo del tema de Android 13+.
    ['adaptive-monochrome.png', await silueta(escudo, 1024)],
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
