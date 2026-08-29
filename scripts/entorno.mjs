#!/usr/bin/env node
// ==========================================================================
// Comprueba que `.env.local` está y está completo.
//
//   npm run entorno
//
// POR QUÉ EXISTE
// Las claves de Firebase no se leen en tiempo de ejecución: Metro las mete
// DENTRO del paquete al compilar, sustituyendo cada `process.env.EXPO_PUBLIC_*`
// por su valor. Si al compilar no están, el paquete sale con `undefined` en su
// sitio y la app arranca sin poder hablar con Firebase.
//
// En Android eso se nota enseguida porque se compila aquí. El problema es iOS:
// se archiva en un Mac que acaba de clonar el repositorio, y `.env.local` NO
// está en el repositorio (ni debe: es la configuración de un entorno). Sin este
// aviso, lo normal es descubrirlo cuando la app ya está subida.
//
// No comprueba que las claves sean CORRECTAS —para eso hay que arrancar la
// app— solo que estén y no vengan vacías, que es el fallo real.
// ==========================================================================

import fs from 'node:fs'
import path from 'node:path'

const RAIZ = path.join(import.meta.dirname, '..')
const FICHERO = path.join(RAIZ, '.env.local')

// Las que hacen falta sí o sí. `EXPO_PUBLIC_WEB_BASE` no está aquí porque
// tiene un valor por defecto razonable en el código.
const OBLIGATORIAS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
]

function leer(ruta) {
  const valores = {}
  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith('#')) continue
    const corte = limpia.indexOf('=')
    if (corte < 0) continue
    valores[limpia.slice(0, corte).trim()] = limpia
      .slice(corte + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return valores
}

if (!fs.existsSync(FICHERO)) {
  console.error('Falta .env.local\n')
  console.error('  cp .env.example .env.local')
  console.error('\nY dentro, las claves del proyecto de Firebase `cv-oviedo`:')
  console.error('  Consola de Firebase → Configuración del proyecto → Tus apps → App web.')
  process.exit(1)
}

const valores = leer(FICHERO)
const faltan = OBLIGATORIAS.filter((k) => !valores[k])

if (faltan.length > 0) {
  console.error('.env.local está, pero le faltan valores:\n')
  for (const k of faltan) console.error(`  ${k}`)
  console.error('\nSe sacan de: Consola de Firebase → Configuración del proyecto → Tus apps → App web.')
  process.exit(1)
}

console.log('.env.local completo. Las', OBLIGATORIAS.length, 'claves de Firebase están puestas.')
if (!valores.EXPO_PUBLIC_WEB_BASE) {
  console.log('(EXPO_PUBLIC_WEB_BASE sin poner: se usará clubvoleiboloviedo.com)')
}
