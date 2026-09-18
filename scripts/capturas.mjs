#!/usr/bin/env node
// ==========================================================================
// Las capturas de la ficha de la App Store.
//
//   npm run capturas
//
// Salen a `tienda/capturas/`: 10 para iPhone (1284x2778, pantalla de 6,5") y
// 10 para iPad (2048x2732, pantalla de 13"). Son las medidas que pide App
// Store Connect; entregarlas exactas evita el rechazo de la subida.
//
// Son capturas a sangre: la pantalla entera y nada mas, sin titulares ni
// marcos, tal y como saldrian del dispositivo.
//
// POR QUE SE DIBUJAN Y NO SE CAPTURAN
// Archivar para iOS necesita un Mac, y las capturas hacen falta antes. Cada
// pantalla se dibuja en SVG con los colores, las medidas y los textos reales
// de `src/tema.ts` y de `src/app/`, a los puntos del dispositivo, y se pinta
// con resvg al x2 o x3 que toca. Si una pantalla cambia de verdad, hay que
// tocarla aqui.
//
// Los iconos son los mismos Ionicons que usa la app: se carga el .ttf del
// paquete y se pintan por su punto de codigo, para que no haya un segundo
// juego de iconos que se desvie del de dentro.
// ==========================================================================

import fs from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'

const RAIZ = path.join(import.meta.dirname, '..')
const DESTINO = path.join(RAIZ, 'tienda', 'capturas')
const VECTOR = path.join(RAIZ, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons')
const IONICONS = path.join(VECTOR, 'Fonts/Ionicons.ttf')
const GLIFOS = JSON.parse(fs.readFileSync(path.join(VECTOR, 'glyphmaps/Ionicons.json'), 'utf8'))
const ESCUDO = path.join(RAIZ, 'assets', 'icono', 'escudo.svg')
const FOTO = (n) => path.join(RAIZ, 'assets', 'tienda', `foto-${n}.jpg`)

// Los colores son los de src/tema.ts. Copiados a mano porque el tema es TS y
// esto es un .mjs suelto: si cambian alli, cambian aqui.
const C = {
  tinta: '#082139',
  azul: '#1560bd',
  azulOscuro: '#0f4a94',
  azulClaro: '#7cc4f7',
  azulHondo: '#0b2c50',
  tinte: '#eaf2fb',
  linea: '#dbe6f2',
  apagado: '#5c6b7d',
  blanco: '#ffffff',
  fondo: '#f7fafd',
  ambarTinte: '#fff4dd',
  rojo: '#dd0a16',
  rojoTinte: '#fdeaeb',
  verde: '#15803d',
  verdeTinte: '#e8f5ec',
  ambarTexto: '#8a5a00',
  rojoTexto: '#9b1c23',
}

const TIPO = 'Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif'

// --- utilidades -----------------------------------------------------------

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Anchura aproximada de un texto. Sin metricas reales no hay exactitud, pero
    basta para partir lineas sin que se salgan de la tarjeta. */
const ESTRECHAS = new Set(['i', 'l', 'j', 't', 'f', 'r', 'I', '.', ',', ':', ';', "'", '!', '|', ' '])
const ANCHAS = new Set(['m', 'w', 'M', 'W', '—', '@'])
function ancho(t, s, peso = 400) {
  const base = peso >= 700 ? 0.545 : 0.505
  let n = 0
  for (const ch of String(t)) {
    if (ESTRECHAS.has(ch)) n += 0.29
    else if (ANCHAS.has(ch)) n += 0.85
    else if (ch >= 'A' && ch <= 'Z') n += base + 0.06
    else n += base
  }
  // El 1,06 es holgura: la estimacion se queda corta con los parrafos largos
  // y una linea de mas es peor que una linea de menos, porque se sale de la
  // tarjeta y se ve.
  return n * s * 1.06
}

/** Parte un texto en lineas que quepan en `max`, con tope de lineas. */
function corta(t, max, s, peso = 400, tope = 99) {
  const lineas = []
  let linea = ''
  for (const p of String(t).split(' ')) {
    const prueba = linea ? `${linea} ${p}` : p
    if (ancho(prueba, s, peso) > max && linea) {
      lineas.push(linea)
      linea = p
    } else linea = prueba
  }
  if (linea) lineas.push(linea)
  if (lineas.length > tope) {
    let recorte = lineas.slice(tope - 1).join(' ')
    lineas.length = tope - 1
    while (ancho(`${recorte}…`, s, peso) > max && recorte.length > 4) recorte = recorte.slice(0, -1)
    lineas.push(`${recorte.trimEnd()}…`)
  }
  return lineas
}

function T(x, y, t, o = {}) {
  const { s = 15, w = 400, fill = C.tinta, anchor = 'start', ls = 0, op = 1, familia = TIPO } = o
  return (
    `<text x="${x}" y="${y}" font-family="${familia}" font-size="${s}" font-weight="${w}" ` +
    `fill="${fill}" text-anchor="${anchor}"${ls ? ` letter-spacing="${ls}"` : ''}` +
    `${op !== 1 ? ` fill-opacity="${op}"` : ''}>${esc(t)}</text>`
  )
}

/** Varias lineas ya cortadas, desde la linea base de la primera. */
function TM(x, y, lineas, paso, o = {}) {
  return lineas.map((l, i) => T(x, y + i * paso, l, o)).join('')
}

/** Un icono de Ionicons, centrado en (x, y). */
function I(nombre, x, y, s, fill) {
  const cp = GLIFOS[nombre]
  if (!cp) throw new Error(`icono desconocido: ${nombre}`)
  return (
    `<text x="${x}" y="${y + s * 0.36}" font-family="Ionicons" font-size="${s}" ` +
    `fill="${fill}" text-anchor="middle">&#${cp};</text>`
  )
}

const R = (x, y, w, h, r, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`

/** Tarjeta blanca con el borde suave de la app. */
const tarjeta = (x, y, w, h, r) =>
  R(x, y, w, h, r, C.blanco, `stroke="${C.linea}" stroke-width="1"`)

/** Pastilla de etiqueta. Devuelve { svg, w }. */
function pastilla(x, y, t, o = {}) {
  const { s = 11, w = 700, fondo = C.tinte, color = C.azulOscuro, ls = 0.8, alto = null } = o
  const h = alto ?? s * 2
  const px = s * 0.85
  const an = ancho(t, s, w) + ls * String(t).length + px * 2
  return {
    w: an,
    svg: R(x, y, an, h, h / 2, fondo) + T(x + px, y + h / 2 + s * 0.35, t, { s, w, fill: color, ls }),
  }
}

const cache = {}
function escudoPng(lado) {
  if (cache[lado]) return cache[lado]
  const r = new Resvg(fs.readFileSync(ESCUDO, 'utf8'), {
    fitTo: { mode: 'width', value: lado },
    font: { loadSystemFonts: true, defaultFontFamily: 'Georgia' },
  })
  cache[lado] = `data:image/png;base64,${r.render().asPng().toString('base64')}`
  return cache[lado]
}
const ESCUDO_PNG = escudoPng(300)
const fotos = {}
function foto(n) {
  if (!fotos[n]) fotos[n] = `data:image/jpeg;base64,${fs.readFileSync(FOTO(n)).toString('base64')}`
  return fotos[n]
}

/** Imagen recortada a un rectangulo redondeado. */
let nClip = 0
function imagenRedonda(href, x, y, w, h, r) {
  const id = `c${nClip++}`
  return (
    `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>` +
    `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" ` +
    `preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`
  )
}

function pintar(svg, anchoPx) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: anchoPx },
    font: { loadSystemFonts: true, fontFiles: [IONICONS], defaultFontFamily: 'Segoe UI' },
  })
  return r.render().asPng()
}

// --- piezas comunes de la app --------------------------------------------

/* Los bordes seguros del dispositivo, que es de donde salen la altura de la
   cabecera y la de la barra de pestañas (`Pantalla.tsx` y `(app)/_layout.tsx`
   los suman a mano con `useSafeAreaInsets`). Los fija `main` segun el formato:
   47 y 34 en un iPhone con isla, 24 y 20 en un iPad. */
let SAT = 47
let SAB = 34

/** Barra de estado de iOS: hora, cobertura, wifi y bateria. */
function barraEstado(W, k) {
  const y = SAT * 0.62 * k
  const d = W - 24 * k
  let s = T(30 * k, y + 5 * k, '9:41', { s: 15 * k, w: 700 })
  for (let i = 0; i < 4; i++) {
    const h = (3.5 + i * 2) * k
    s += R(d - 64 * k + i * 5.4 * k, y - h + 4 * k, 3.4 * k, h, 1 * k, C.tinta)
  }
  s += `<g fill="none" stroke="${C.tinta}" stroke-width="${2 * k}" stroke-linecap="round">
    <path d="M ${d - 39 * k} ${y - 1 * k} a ${7 * k} ${7 * k} 0 0 1 ${11 * k} 0"/>
    <path d="M ${d - 42.5 * k} ${y - 5.5 * k} a ${12.5 * k} ${12.5 * k} 0 0 1 ${18 * k} 0"/></g>`
  s += `<circle cx="${d - 33.5 * k}" cy="${y + 3 * k}" r="${1.7 * k}" fill="${C.tinta}"/>`
  s += R(d - 21 * k, y - 5 * k, 21 * k, 10.5 * k, 3 * k, 'none',
    `stroke="${C.tinta}" stroke-opacity="0.4" stroke-width="${1 * k}"`)
  s += R(d - 19 * k, y - 3 * k, 15 * k, 6.5 * k, 1.5 * k, C.tinta)
  return s
}

/**
 * Cabecera blanca: antetitulo en versalitas, titulo y escudo.
 *
 * Las medidas son las de `Pantalla.tsx`: relleno lateral de 16, borde seguro
 * mas 12 arriba, antetitulo de 11 y titulo de 24 (no 26: el tema tiene 26 pero
 * la cabecera lo baja), escudo de 36 y botones de accion de 38 sobre tinte.
 */
function cabecera(W, k, ante, titulo, o = {}) {
  const arriba = (SAT + 12) * k
  const lineas = corta(titulo, W - (o.atras ? 190 : 130) * k, 24 * k, 800, 2)
  const alto = arriba + 15 * k + lineas.length * 30 * k + 12 * k
  const centro = arriba + (15 * k + lineas.length * 30 * k) / 2
  let s = R(0, 0, W, alto, 0, C.blanco) + R(0, alto - 1, W, 1, 0, C.linea)
  s += barraEstado(W, k)
  let x = 16 * k
  if (o.atras) {
    s += R(x, centro - 19 * k, 38 * k, 38 * k, 12 * k, C.tinte)
    s += I('chevron-back', x + 19 * k, centro, 22 * k, C.tinta)
    x += 46 * k
  }
  s += T(x, arriba + 11 * k, ante, { s: 11 * k, w: 700, fill: C.azul, ls: 1 * k })
  s += TM(x, arriba + 39 * k, lineas, 30 * k, { s: 24 * k, w: 800, ls: -0.5 * k })
  s += `<image href="${ESCUDO_PNG}" x="${W - 52 * k}" y="${centro - 18 * k}" width="${36 * k}" height="${36 * k}"/>`
  if (o.accion) {
    s += R(W - 102 * k, centro - 19 * k, 38 * k, 38 * k, 12 * k, C.tinte)
    s += I(o.accion, W - 83 * k, centro, 21 * k, C.azul)
  }
  return { svg: s, alto }
}

/**
 * Barra de pestañas, con el indicador de inicio de iOS.
 *
 * Alto y iconos son los de `(app)/_layout.tsx`: 58 mas el borde seguro,
 * etiquetas de 11 en seminegrita y los Ionicons a 24.
 */
function tabBar(W, H, k, activo) {
  const alto = (58 + SAB) * k
  const y = H - alto
  const items = [
    ['home', 'Inicio'],
    ['trophy', 'Equipo'],
    ['chatbubbles', 'Chat'],
    ['notifications', 'Avisos'],
    ['ellipsis-horizontal-circle', 'Más'],
  ]
  let s = R(0, y, W, alto, 0, C.blanco) + R(0, y, W, 1, 0, C.linea)
  items.forEach(([ic, et], i) => {
    const cx = (W / items.length) * (i + 0.5)
    const col = i === activo ? C.azul : C.apagado
    s += I(ic, cx, y + 21 * k, 24 * k, col)
    s += T(cx, y + 48 * k, et, { s: 11 * k, w: 600, fill: col, anchor: 'middle' })
  })
  s += R(W / 2 - 67 * k, H - 13 * k, 134 * k, 5 * k, 2.5 * k, C.tinta, 'fill-opacity="0.8"')
  return { svg: s, alto, y }
}

/** Fila de pastillas de equipo (Senior / Superliga2). */
function chipsEquipo(x, y, k, activa = 0) {
  let s = ''
  let cx = x
  ;['Senior', 'Superliga2'].forEach((n, i) => {
    const an = ancho(n, 15 * k, 700) + 36 * k
    const on = i === activa
    s += R(cx, y, an, 40 * k, 20 * k, on ? C.tinta : C.blanco, on ? '' : `stroke="${C.linea}"`)
    s += T(cx + an / 2, y + 26 * k, n, { s: 15 * k, w: 700, fill: on ? C.blanco : C.apagado, anchor: 'middle' })
    cx += an + 10 * k
  })
  return { svg: s, alto: 40 * k }
}

/** Pestañas del equipo: Partidos | Clasificación | Plantilla | Horarios. */
function pestanas(x, y, W, k, activa) {
  const et = ['Partidos', 'Clasificación', 'Plantilla', 'Horarios']
  const an = (W - x * 2) / et.length
  let s = R(x, y, W - x * 2, 38 * k, 12 * k, C.tinte)
  s += R(x + 3 * k + activa * an, y + 3 * k, an - 6 * k, 32 * k, 10 * k, C.blanco, `stroke="${C.linea}"`)
  et.forEach((t, i) => {
    s += T(x + an * (i + 0.5), y + 24.5 * k, t, {
      s: 12.5 * k,
      w: i === activa ? 800 : 600,
      fill: i === activa ? C.azulOscuro : C.apagado,
      anchor: 'middle',
    })
  })
  return { svg: s, alto: 38 * k }
}

const seccion = (x, y, t, k) => T(x, y, t, { s: 19 * k, w: 700 })

/** Ficha de un partido: bloque de fecha, rival y hora o marcador. */
function filaPartido(x, y, W, k, p) {
  const w = W - x * 2
  const h = 84 * k
  let s = tarjeta(x, y, w, h, 16 * k)
  s += R(x + 12 * k, y + 12 * k, 56 * k, 60 * k, 12 * k, p.amistoso ? C.ambarTinte : C.tinte)
  s += T(x + 40 * k, y + 42 * k, p.dia, {
    s: 24 * k, w: 800, anchor: 'middle', fill: p.amistoso ? C.ambarTexto : C.azulOscuro,
  })
  s += T(x + 40 * k, y + 60 * k, p.mes, {
    s: 11 * k, w: 700, anchor: 'middle', ls: 0.6 * k, fill: p.amistoso ? C.ambarTexto : C.azulOscuro,
  })
  const tx = x + 80 * k
  const et = pastilla(tx, y + 14 * k, p.etiqueta, {
    s: 9.5 * k,
    fondo: p.etiqueta === 'CASA' ? C.verdeTinte : p.amistoso ? C.ambarTinte : C.tinte,
    color: p.etiqueta === 'CASA' ? C.verde : p.amistoso ? C.ambarTexto : C.azulOscuro,
  })
  s += et.svg
  if (p.jornada) s += T(tx + et.w + 8 * k, y + 26 * k, p.jornada, { s: 11 * k, w: 600, fill: C.apagado })
  const anchoRival = w - 92 * k - (p.marcador ? 62 * k : 0)
  s += T(tx, y + 52 * k, corta(p.rival, anchoRival, 16 * k, 700, 1)[0], { s: 16 * k, w: 700 })
  s += T(tx, y + 70 * k, p.cuando, { s: 12.5 * k, fill: C.apagado })
  if (p.marcador) {
    s += R(x + w - 74 * k, y + 26 * k, 62 * k, 32 * k, 10 * k, p.ganado ? C.verdeTinte : C.rojoTinte)
    s += T(x + w - 43 * k, y + 48 * k, p.marcador, {
      s: 16 * k, w: 800, anchor: 'middle', fill: p.ganado ? C.verde : C.rojo,
    })
  }
  return { svg: s, alto: h }
}

// --- las diez pantallas ---------------------------------------------------
// Cada una dibuja la app a tamaño de puntos del dispositivo (W x H) con el
// factor k, que es 1 en iPhone y mayor en iPad.

function inicio(W, H, k) {
  const c = cabecera(W, k, 'BUENAS TARDES', 'Adrián')
  let s = R(0, 0, W, H, 0, C.fondo) + c.svg
  const x = 16 * k
  const w = W - 32 * k
  let y = c.alto + 34 * k
  s += seccion(x + 4 * k, y, 'Noticias del club', k)
  s += T(W - 20 * k, y, '3', { s: 17 * k, w: 600, fill: C.apagado, anchor: 'end' })
  y += 18 * k

  const noticias = [
    {
      n: 1,
      cat: 'Cantera',
      fecha: '10 ago 2026',
      titulo: 'Abierta la preinscripción para la 26/27',
      cuerpo: 'Desde alevín hasta juvenil. El plazo es del 10 al 25 de agosto y el formulario está en la web.',
    },
    {
      n: 2,
      cat: 'Sénior',
      fecha: '2 ago 2026',
      titulo: 'El sénior masculino arranca la pretemporada',
      cuerpo: 'Primer entrenamiento el lunes 18 en Colloto, con toda la plantilla.',
    },
  ]
  for (const nt of noticias) {
    const hFoto = 168 * k // la foto de la tarjeta de noticia va a 168 fijos
    const tit = corta(nt.titulo, w - 48 * k, 20 * k, 800, 2)
    const cue = corta(nt.cuerpo, w - 48 * k, 14.5 * k, 400, 2)
    const h = hFoto + 40 * k + tit.length * 26 * k + cue.length * 21 * k + 64 * k
    s += tarjeta(x, y, w, h, 18 * k)
    s += imagenRedonda(foto(nt.n), x + 1, y + 1, w - 2, hFoto, 17 * k)
    s += R(x + 1, y + hFoto - 18 * k, w - 2, 20 * k, 0, C.blanco)
    let yy = y + hFoto + 22 * k
    const p = pastilla(x + 20 * k, yy, nt.cat, { s: 12 * k, alto: 26 * k, ls: 0 })
    s += p.svg
    s += T(x + 30 * k + p.w, yy + 18 * k, nt.fecha, { s: 14 * k, w: 500, fill: C.apagado })
    yy += 46 * k
    s += TM(x + 20 * k, yy, tit, 26 * k, { s: 20 * k, w: 800 })
    yy += tit.length * 26 * k + 6 * k
    s += TM(x + 20 * k, yy, cue, 21 * k, { s: 14.5 * k, fill: C.apagado })
    yy += cue.length * 21 * k + 20 * k
    s += T(x + 20 * k, yy, 'Leer', { s: 15 * k, w: 700, fill: C.azul })
    s += I('arrow-forward', x + 20 * k + ancho('Leer', 15 * k, 700) + 14 * k, yy - 5 * k, 16 * k, C.azul)
    y += h + 16 * k
  }
  s += tabBar(W, H, k, 0).svg
  return s
}

function equipoPartidos(W, H, k) {
  const c = cabecera(W, k, 'EQUIPO', 'Senior')
  let s = R(0, 0, W, H, 0, C.fondo) + c.svg
  const x = 16 * k
  let y = c.alto + 16 * k
  s += chipsEquipo(x, y, k).svg
  y += 54 * k
  s += pestanas(x, y, W, k, 0).svg
  y += 60 * k
  s += seccion(x + 4 * k, y, 'Próximos partidos', k)
  y += 16 * k
  const proximos = [
    { dia: '11', mes: 'OCT', etiqueta: 'CASA', jornada: 'J3', rival: 'CV Gijón', cuando: 'Sáb · 12:00 · Pabellón de Colloto' },
    { dia: '18', mes: 'OCT', etiqueta: 'FUERA', jornada: 'J4', rival: 'Grupo Covadonga', cuando: 'Sáb · 18:30 · Corredoria' },
    { dia: '25', mes: 'OCT', etiqueta: 'AMISTOSO', amistoso: true, rival: 'Universidad de Oviedo', cuando: 'Sáb · 11:00 · Los Catalanes' },
  ]
  for (const p of proximos) {
    const f = filaPartido(x, y, W, k, p)
    s += f.svg
    y += f.alto + 12 * k
  }
  y += 18 * k
  s += seccion(x + 4 * k, y, 'Resultados', k)
  y += 16 * k
  const hechos = [
    { dia: '4', mes: 'OCT', etiqueta: 'CASA', jornada: 'J2', rival: 'Oviedo Roma', cuando: '25-20 · 25-18 · 22-25 · 25-21', marcador: '3–1', ganado: true },
    { dia: '27', mes: 'SEP', etiqueta: 'FUERA', jornada: 'J1', rival: 'CV Avilés', cuando: '22-25 · 25-23 · 18-25 · 20-25', marcador: '1–3' },
  ]
  for (const p of hechos) {
    const f = filaPartido(x, y, W, k, p)
    s += f.svg
    y += f.alto + 12 * k
  }
  s += I('open-outline', x + 12 * k, y + 14 * k, 15 * k, C.azul)
  s += T(x + 26 * k, y + 19 * k, 'Datos de la Federación de Voleibol del Principado', {
    s: 13 * k, w: 600, fill: C.azul,
  })
  s += tabBar(W, H, k, 1).svg
  return s
}

function equipoClasificacion(W, H, k) {
  const c = cabecera(W, k, 'EQUIPO', 'Senior')
  let s = R(0, 0, W, H, 0, C.fondo) + c.svg
  const x = 16 * k
  const w = W - 32 * k
  let y = c.alto + 16 * k
  s += chipsEquipo(x, y, k).svg
  y += 54 * k
  s += pestanas(x, y, W, k, 1).svg
  y += 60 * k
  s += seccion(x + 4 * k, y, 'Primera División · Grupo B', k)
  y += 18 * k

  const filas = [
    [1, 'CV Gijón', 7, '21-6', 20],
    [2, 'CV Oviedo', 7, '19-9', 18, true],
    [3, 'Grupo Covadonga', 7, '17-11', 16],
    [4, 'CV Avilés', 7, '15-13', 14],
    [5, 'Oviedo Roma', 7, '13-14', 12],
    [6, 'Universidad de Oviedo', 7, '11-16', 9],
    [7, 'CV Mieres', 7, '8-19', 6],
    [8, 'CV Langreo', 7, '5-21', 3],
  ]
  const hFila = 46 * k
  const alto = 44 * k + filas.length * hFila + 8 * k
  s += tarjeta(x, y, w, alto, 16 * k)
  const cols = [x + 26 * k, x + 52 * k, x + w - 148 * k, x + w - 96 * k, x + w - 30 * k]
  s += R(x + 1, y + 1, w - 2, 43 * k, 0, C.tinte)
  s += R(x, y, w, 44 * k, 16 * k, 'none')
  s += `<clipPath id="cab"><rect x="${x}" y="${y}" width="${w}" height="${44 * k}" rx="${16 * k}"/></clipPath>`
  s += `<g clip-path="url(#cab)">${R(x, y, w, 44 * k, 0, C.tinte)}</g>`
  const cab = { s: 11 * k, w: 700, fill: C.azulOscuro, ls: 0.6 * k }
  s += T(cols[0], y + 28 * k, '#', { ...cab, anchor: 'middle' })
  s += T(cols[1], y + 28 * k, 'EQUIPO', cab)
  s += T(cols[2], y + 28 * k, 'PJ', { ...cab, anchor: 'middle' })
  s += T(cols[3], y + 28 * k, 'SETS', { ...cab, anchor: 'middle' })
  s += T(cols[4], y + 28 * k, 'PTS', { ...cab, anchor: 'middle', w: 800 })
  filas.forEach(([pos, eq, pj, sets, pts, mia], i) => {
    const fy = y + 44 * k + i * hFila
    if (mia) s += R(x + 1, fy, w - 2, hFila, 0, C.tinte)
    else if (i) s += R(x + 16 * k, fy, w - 32 * k, 1, 0, C.linea)
    const base = { s: 14 * k, w: mia ? 800 : 500, fill: mia ? C.azulOscuro : C.tinta }
    const by = fy + 29 * k
    s += T(cols[0], by, String(pos), { ...base, anchor: 'middle', fill: mia ? C.azulOscuro : C.apagado })
    s += T(cols[1], by, corta(eq, w - 200 * k, 14 * k, mia ? 800 : 600, 1)[0], { ...base, w: mia ? 800 : 600 })
    s += T(cols[2], by, String(pj), { ...base, anchor: 'middle', fill: mia ? C.azulOscuro : C.apagado })
    s += T(cols[3], by, sets, { ...base, anchor: 'middle', fill: mia ? C.azulOscuro : C.apagado })
    s += T(cols[4], by, String(pts), { ...base, w: 800, anchor: 'middle' })
  })
  y += alto + 18 * k
  s += I('refresh', x + 12 * k, y + 8 * k, 15 * k, C.apagado)
  s += T(x + 26 * k, y + 13 * k, 'Actualizado tras la jornada del 4 de octubre', { s: 13 * k, fill: C.apagado })
  s += tabBar(W, H, k, 1).svg
  return s
}

function equipoPlantilla(W, H, k) {
  const c = cabecera(W, k, 'EQUIPO', 'Senior')
  let s = R(0, 0, W, H, 0, C.fondo) + c.svg
  const x = 16 * k
  const w = W - 32 * k
  let y = c.alto + 16 * k
  s += chipsEquipo(x, y, k).svg
  y += 54 * k
  s += pestanas(x, y, W, k, 2).svg
  y += 60 * k

  s += seccion(x + 4 * k, y, 'Cuerpo técnico', k)
  y += 16 * k
  const tecnicos = [['Adrián Estrada', 'Entrenador'], ['Marta Solís', 'Segunda entrenadora']]
  let alto = tecnicos.length * 62 * k + 8 * k
  s += tarjeta(x, y, w, alto, 16 * k)
  tecnicos.forEach(([n, r], i) => {
    const fy = y + 4 * k + i * 62 * k
    if (i) s += R(x + 68 * k, fy, w - 84 * k, 1, 0, C.linea)
    s += `<circle cx="${x + 40 * k}" cy="${fy + 31 * k}" r="${20 * k}" fill="${C.azul}"/>`
    s += T(x + 40 * k, fy + 37 * k, n.split(' ').map((p) => p[0]).join('').slice(0, 2), {
      s: 15 * k, w: 800, fill: C.blanco, anchor: 'middle',
    })
    s += T(x + 70 * k, fy + 28 * k, n, { s: 16 * k, w: 700 })
    s += T(x + 70 * k, fy + 46 * k, r, { s: 13 * k, fill: C.apagado })
  })
  y += alto + 22 * k

  s += seccion(x + 4 * k, y, 'Jugadores (12)', k)
  y += 16 * k
  const jugadores = [
    ['4', 'Lucas Fernández', 'Colocador'],
    ['7', 'Diego Álvarez', 'Receptor'],
    ['9', 'Pablo Muñiz', 'Central'],
    ['12', 'Hugo Solares', 'Opuesto'],
    ['15', 'Iván Rodríguez', 'Líbero'],
    ['18', 'Marcos Cueto', 'Receptor'],
  ]
  alto = jugadores.length * 56 * k + 8 * k
  s += tarjeta(x, y, w, alto, 16 * k)
  jugadores.forEach(([d, n, p], i) => {
    const fy = y + 4 * k + i * 56 * k
    if (i) s += R(x + 68 * k, fy, w - 84 * k, 1, 0, C.linea)
    s += `<circle cx="${x + 40 * k}" cy="${fy + 28 * k}" r="${18 * k}" fill="${C.tinte}"/>`
    s += T(x + 40 * k, fy + 34 * k, d, { s: 15 * k, w: 800, fill: C.azulOscuro, anchor: 'middle' })
    s += T(x + 70 * k, fy + 26 * k, n, { s: 15.5 * k, w: 700 })
    s += T(x + 70 * k, fy + 43 * k, p, { s: 13 * k, fill: C.apagado })
  })
  s += tabBar(W, H, k, 1).svg
  return s
}

function chat(W, H, k) {
  const c = cabecera(W, k, 'CHAT DEL EQUIPO', 'Senior')
  let s = R(0, 0, W, H, 0, C.fondo) + c.svg
  const tb = tabBar(W, H, k, 2)
  const x = 16 * k

  const mensajes = [
    { de: 'Adrián Estrada', rol: ' · entrenador', t: 'Mañana entrenamos a las 20:00, que hay partido el sábado.', h: '18:42' },
    { de: 'Lucas Fernández', t: 'Recibido. Llevo yo los balones.', h: '18:44' },
    { de: 'Marta Solís', rol: ' · entrenadora', t: 'Acordaos de las rodilleras, que la pista de Colloto está dura.', h: '18:47' },
    { de: 'Diego Álvarez', t: 'Yo llego diez minutos tarde, salgo de clase a las 19:45.', h: '18:51' },
    { mio: true, t: 'Sin problema. Calentamos y te incorporas.', h: '18:52' },
    { de: 'Hugo Solares', t: '¿Alguien pasa por la Corredoria y me recoge?', h: '19:03' },
  ]

  // La conversacion se apoya en la barra de escribir: se calcula desde abajo.
  const yInput = tb.y - 64 * k
  let alturas = []
  for (const m of mensajes) {
    const maxT = W * 0.62
    const lineas = corta(m.t, maxT, 15 * k, 400)
    alturas.push((m.de ? 20 * k : 0) + lineas.length * 21 * k + 30 * k)
  }
  let y = yInput - 16 * k - alturas.reduce((a, b) => a + b + 10 * k, 0)
  mensajes.forEach((m, i) => {
    const maxT = W * 0.62
    const lineas = corta(m.t, maxT, 15 * k, 400)
    const anT = Math.max(...lineas.map((l) => ancho(l, 15 * k)), m.de ? ancho(m.de + (m.rol || ''), 12 * k, 700) : 0)
    const bw = anT + 28 * k
    const bh = alturas[i]
    const bx = m.mio ? W - 16 * k - bw : x
    s += R(bx, y, bw, bh, 16 * k, m.mio ? C.azul : C.blanco, m.mio ? '' : `stroke="${C.linea}"`)
    let ty = y + 22 * k
    if (m.de) {
      // Nombre y rol van en el mismo <text> con un tspan: asi el rol arranca
      // donde acaba el nombre de verdad y no donde diga la estimacion.
      s +=
        `<text x="${bx + 14 * k}" y="${ty}" font-family="${TIPO}" font-size="${12 * k}" ` +
        `font-weight="800" fill="${C.azulOscuro}">${esc(m.de)}` +
        (m.rol ? `<tspan font-weight="600" fill="${C.apagado}">${esc(m.rol)}</tspan>` : '') +
        `</text>`
      ty += 20 * k
    }
    s += TM(bx + 14 * k, ty, lineas, 21 * k, { s: 15 * k, fill: m.mio ? C.blanco : C.tinta })
    ty += (lineas.length - 1) * 21 * k
    s += T(bx + bw - 14 * k, ty + 17 * k, m.h, {
      s: 11 * k, anchor: 'end', fill: m.mio ? '#cfe4f8' : C.apagado,
    })
    y += bh + 10 * k
  })

  s += R(0, yInput - 12 * k, W, tb.y - yInput + 12 * k, 0, C.blanco)
  s += R(0, yInput - 12 * k, W, 1, 0, C.linea)
  s += R(x, yInput, W - 78 * k, 48 * k, 24 * k, C.fondo, `stroke="${C.linea}"`)
  s += T(x + 20 * k, yInput + 30 * k, 'Escribe al equipo…', { s: 15 * k, fill: C.apagado })
  s += `<circle cx="${W - 40 * k}" cy="${yInput + 24 * k}" r="${24 * k}" fill="${C.azul}"/>`
  s += I('send', W - 41 * k, yInput + 24 * k, 20 * k, C.blanco)
  s += tb.svg
  return s
}

function avisos(W, H, k) {
  const c = cabecera(W, k, 'AVISOS DEL EQUIPO', 'Senior', { accion: 'add-circle' })
  let s = R(0, 0, W, H, 0, C.fondo) + c.svg
  const x = 16 * k
  const w = W - 32 * k
  let y = c.alto + 16 * k
  s += chipsEquipo(x, y, k).svg
  y += 56 * k
  s += R(x, y, w, 58 * k, 16 * k, C.azul)
  const et = 'Mandar un aviso'
  const anBoton = ancho(et, 19 * k, 700) + 34 * k
  s += I('megaphone', W / 2 - anBoton / 2 + 12 * k, y + 29 * k, 22 * k, C.blanco)
  s += T(W / 2 + 14 * k, y + 36 * k, et, { s: 19 * k, w: 700, fill: C.blanco, anchor: 'middle' })
  y += 74 * k

  const lista = [
    { ic: 'fitness', tipo: 'ENTRENAMIENTO', fondo: C.ambarTinte, color: C.ambarTexto, tit: 'Cambio de pista el miércoles', meta: 'Adrián Estrada · hace 3 h' },
    { ic: 'trophy', tipo: 'PARTIDO', fondo: C.verdeTinte, color: C.verde, tit: 'Convocatoria del sábado', meta: 'Adrián Estrada · JUE 9 OCT' },
    { ic: 'alert-circle', tipo: 'URGENTE', fondo: C.rojoTinte, color: C.rojoTexto, tit: 'Se adelanta la salida a las 10:15', meta: 'Marta Solís · MIÉ 8 OCT' },
    { ic: 'megaphone', tipo: 'AVISO', fondo: C.tinte, color: C.azulOscuro, tit: 'Fotos de equipo el lunes', meta: 'Club Voleibol Oviedo · LUN 6 OCT' },
  ]
  for (const a of lista) {
    const alto = 96 * k
    s += tarjeta(x, y, w, alto, 16 * k)
    s += R(x + 14 * k, y + 20 * k, 44 * k, 44 * k, 13 * k, a.fondo)
    s += I(a.ic, x + 36 * k, y + 42 * k, 22 * k, a.color)
    const p = pastilla(x + 70 * k, y + 18 * k, a.tipo, { s: 10.5 * k, fondo: a.fondo, color: a.color })
    s += p.svg
    s += T(x + 70 * k, y + 62 * k, corta(a.tit, w - 110 * k, 17 * k, 700, 1)[0], { s: 17 * k, w: 700 })
    s += T(x + 70 * k, y + 82 * k, a.meta, { s: 13 * k, fill: C.apagado })
    s += I('chevron-down', x + w - 26 * k, y + 40 * k, 18 * k, C.apagado)
    y += alto + 12 * k
  }
  s += tabBar(W, H, k, 3).svg
  return s
}

function avisoConfirmacion(W, H, k) {
  const c = cabecera(W, k, 'AVISOS DEL EQUIPO', 'Senior', { accion: 'add-circle' })
  let s = R(0, 0, W, H, 0, C.fondo) + c.svg
  const x = 16 * k
  const w = W - 32 * k
  let y = c.alto + 16 * k
  s += chipsEquipo(x, y, k).svg
  y += 56 * k

  // El aviso abierto, con la confirmacion de asistencia.
  const cuerpo = corta(
    'Sábado 11 de octubre contra el CV Gijón, en Colloto. Quedamos a las 11:00 en el pabellón para calentar. Traed las dos equipaciones.',
    w - 40 * k, 15 * k, 400,
  )
  const alto = 300 * k + cuerpo.length * 22 * k
  s += tarjeta(x, y, w, alto, 18 * k)
  s += R(x + 14 * k, y + 20 * k, 44 * k, 44 * k, 13 * k, C.verdeTinte)
  s += I('trophy', x + 36 * k, y + 42 * k, 22 * k, C.verde)
  s += pastilla(x + 70 * k, y + 18 * k, 'PARTIDO', { s: 10.5 * k, fondo: C.verdeTinte, color: C.verde }).svg
  s += T(x + 70 * k, y + 62 * k, 'Convocatoria del sábado', { s: 17 * k, w: 700 })
  s += T(x + 70 * k, y + 82 * k, 'Adrián Estrada · JUE 9 OCT', { s: 13 * k, fill: C.apagado })
  s += I('chevron-up', x + w - 26 * k, y + 40 * k, 18 * k, C.apagado)
  let yy = y + 116 * k
  s += TM(x + 20 * k, yy, cuerpo, 22 * k, { s: 15 * k })
  yy += cuerpo.length * 22 * k + 14 * k
  s += R(x + 20 * k, yy - 8 * k, w - 40 * k, 1, 0, C.linea)
  s += T(x + 20 * k, yy + 22 * k, '¿Vas a ir?', { s: 13 * k, w: 800 })
  yy += 36 * k
  const anB = (w - 50 * k) / 2
  s += R(x + 20 * k, yy, anB, 48 * k, 14 * k, C.verde)
  s += I('checkmark-circle', x + 20 * k + anB / 2 - 26 * k, yy + 24 * k, 20 * k, C.blanco)
  s += T(x + 20 * k + anB / 2 + 12 * k, yy + 30 * k, 'Voy', { s: 15.5 * k, w: 700, fill: C.blanco, anchor: 'middle' })
  s += R(x + 30 * k + anB, yy, anB, 48 * k, 14 * k, C.blanco, `stroke="${C.linea}"`)
  s += I('close-circle', x + 30 * k + anB + anB / 2 - 34 * k, yy + 24 * k, 20 * k, C.rojo)
  s += T(x + 30 * k + anB + anB / 2 + 10 * k, yy + 30 * k, 'No voy', { s: 15.5 * k, w: 700, fill: C.tinta, anchor: 'middle' })
  yy += 68 * k
  s += I('people-outline', x + 26 * k, yy + 2 * k, 16 * k, C.apagado)
  s += T(x + 42 * k, yy + 7 * k, '9 de 12 han confirmado · faltan 3 por contestar', { s: 13 * k, w: 600, fill: C.apagado })
  y += alto + 12 * k

  const alto2 = 96 * k
  s += tarjeta(x, y, w, alto2, 16 * k)
  s += R(x + 14 * k, y + 20 * k, 44 * k, 44 * k, 13 * k, C.ambarTinte)
  s += I('fitness', x + 36 * k, y + 42 * k, 22 * k, C.ambarTexto)
  s += pastilla(x + 70 * k, y + 18 * k, 'ENTRENAMIENTO', { s: 10.5 * k, fondo: C.ambarTinte, color: C.ambarTexto }).svg
  s += T(x + 70 * k, y + 62 * k, 'Cambio de pista el miércoles', { s: 17 * k, w: 700 })
  s += T(x + 70 * k, y + 82 * k, 'Adrián Estrada · hace 3 h', { s: 13 * k, fill: C.apagado })
  s += I('chevron-down', x + w - 26 * k, y + 40 * k, 18 * k, C.apagado)
  s += tabBar(W, H, k, 3).svg
  return s
}

function horarios(W, H, k) {
  // `entrenamientos.tsx` va fuera de las pestañas: cabecera con flecha, el
  // nombre del equipo de antetitulo y sin barra abajo.
  const c = cabecera(W, k, 'SENIOR', 'Horario y citas', { atras: true })
  let s = R(0, 0, W, H, 0, C.fondo) + c.svg
  const x = 16 * k
  const w = W - 32 * k
  let y = c.alto + 30 * k
  s += seccion(x + 4 * k, y, 'Entrenamientos', k)
  y += 20 * k
  const nota = corta(
    'Se repiten todas las semanas. Tu equipo los ve en su pantalla de equipo.',
    w - 8 * k, 13 * k, 400,
  )
  s += TM(x + 4 * k, y, nota, 19 * k, { s: 13 * k, fill: C.apagado })
  y += (nota.length - 1) * 19 * k + 14 * k
  const entrenos = [
    ['LUN', '19:00 – 20:30', 'Pol. José Manuel Fuente · Colloto'],
    ['MIÉ', '20:00 – 21:30', 'Pol. José Manuel Fuente · Colloto'],
    ['VIE', '19:00 – 20:30', 'Pabellón de Los Catalanes'],
  ]
  for (const [dia, hora, lugar] of entrenos) {
    const alto = 80 * k
    s += tarjeta(x, y, w, alto, 16 * k)
    s += R(x + 14 * k, y + 18 * k, 54 * k, 44 * k, 13 * k, C.azul)
    s += T(x + 41 * k, y + 46 * k, dia, { s: 13 * k, w: 800, fill: C.blanco, anchor: 'middle', ls: 0.5 * k })
    s += T(x + 82 * k, y + 38 * k, hora, { s: 16.5 * k, w: 700 })
    s += I('location-outline', x + 89 * k, y + 55 * k, 13 * k, C.apagado)
    s += T(x + 99 * k, y + 60 * k, corta(lugar, w - 120 * k, 13 * k, 400, 1)[0], { s: 13 * k, fill: C.apagado })
    y += alto + 12 * k
  }
  y += 20 * k
  s += seccion(x + 4 * k, y, 'Otras citas', k)
  y += 16 * k
  const citas = [
    { dia: '25', mes: 'OCT', etiqueta: 'AMISTOSO', amistoso: true, rival: 'Amistoso contra el Gijón', cuando: 'Sáb · 11:00 · Los Catalanes' },
    { dia: '31', mes: 'OCT', etiqueta: 'CONVOCATORIA', amistoso: true, rival: 'Foto de equipo', cuando: 'Vie · 18:30 · Colloto · Traer equipación' },
  ]
  for (const p of citas) {
    const f = filaPartido(x, y, W, k, p)
    s += f.svg
    y += f.alto + 12 * k
  }
  y += 16 * k
  s += R(x, y, w, 56 * k, 16 * k, C.tinte)
  s += I('calendar-outline', x + 32 * k, y + 28 * k, 20 * k, C.azul)
  s += T(x + 54 * k, y + 33 * k, 'Los cambios llegan al móvil de todo el equipo', { s: 14 * k, w: 600, fill: C.azulOscuro })
  s += R(W / 2 - 67 * k, H - 13 * k, 134 * k, 5 * k, 2.5 * k, C.tinta, 'fill-opacity="0.8"')
  return s
}

function noticia(W, H, k) {
  // Medidas de `noticia/[slug].tsx`: cabecera con flecha y compartir, foto de
  // 210 con esquinas de 16, meta, entradilla de 17 y parrafos de 16/25.
  const c = cabecera(W, k, 'Sénior masculino', 'El sénior gana en casa y se coloca segundo', {
    atras: true,
    accion: 'share-outline',
  })
  let s = R(0, 0, W, H, 0, C.fondo) + c.svg
  const x = 16 * k
  let y = c.alto + 16 * k
  s += imagenRedonda(foto(2), x, y, W - 32 * k, 210 * k, 16 * k)
  y += 226 * k
  const p = pastilla(x, y, 'Sénior masculino', { s: 12 * k, alto: 28 * k, ls: 0 })
  s += p.svg
  s += T(x + p.w + 12 * k, y + 19 * k, '5 oct 2026', { s: 13 * k, fill: C.apagado })
  y += 44 * k
  const entradilla = corta(
    'Victoria por 3-1 ante el Oviedo Roma en un partido que se decidió en el cuarto set.',
    W - 32 * k, 17 * k, 600,
  )
  s += TM(x, y + 17 * k, entradilla, 25 * k, { s: 17 * k, w: 600 })
  y += entradilla.length * 25 * k + 32 * k
  const parrafos = [
    'El pabellón de Colloto se llenó para ver un partido que se torció en el tercer set y que el equipo enderezó con un parcial de 25-21, apoyado en el saque y en un bloqueo que subió una marcha en el tramo final.',
    'Con esta victoria el sénior encadena dos jornadas ganando y se coloca segundo del grupo, a dos puntos del líder. La próxima jornada visita la Corredoria el sábado a las 18:30.',
    'El club agradece a la afición que llenó la grada y recuerda que la entrada es libre en todos los partidos de casa.',
  ]
  for (const t of parrafos) {
    const lineas = corta(t, W - 32 * k, 16 * k, 400)
    s += TM(x, y + 16 * k, lineas, 25 * k, { s: 16 * k })
    y += lineas.length * 25 * k + 16 * k
  }
  // La noticia vive fuera del grupo de pestañas: no lleva barra abajo.
  s += R(W / 2 - 67 * k, H - 13 * k, 134 * k, 5 * k, 2.5 * k, C.tinta, 'fill-opacity="0.8"')
  return s
}

function mas(W, H, k) {
  const c = cabecera(W, k, 'TU CUENTA', 'Más')
  let s = R(0, 0, W, H, 0, C.fondo) + c.svg
  const x = 16 * k
  const w = W - 32 * k
  let y = c.alto + 16 * k

  s += tarjeta(x, y, w, 108 * k, 18 * k)
  s += `<circle cx="${x + 54 * k}" cy="${y + 54 * k}" r="${34 * k}" fill="${C.azul}"/>`
  s += T(x + 54 * k, y + 63 * k, 'AE', { s: 24 * k, w: 800, fill: C.blanco, anchor: 'middle' })
  s += T(x + 100 * k, y + 42 * k, 'Adrián Estrada', { s: 20 * k, w: 800 })
  s += T(x + 100 * k, y + 64 * k, 'adrian@clubvoleiboloviedo.com', { s: 13.5 * k, fill: C.apagado })
  s += pastilla(x + 100 * k, y + 74 * k, 'ADMINISTRADOR', { s: 11 * k, fondo: C.rojoTinte, color: C.rojoTexto }).svg
  const anP = pastilla(0, 0, 'ADMINISTRADOR', { s: 11 * k }).w
  s += pastilla(x + 108 * k + anP, y + 74 * k, 'ENTRENADOR', { s: 11 * k, fondo: C.ambarTinte, color: C.ambarTexto }).svg
  y += 122 * k

  s += tarjeta(x, y, w, 56 * k, 16 * k)
  s += T(x + 20 * k, y + 34 * k, 'Equipos:', { s: 15 * k, w: 700, fill: C.apagado })
  s += T(x + 20 * k + ancho('Equipos: ', 15 * k, 700), y + 34 * k, 'Senior, Superliga2, Infantil', { s: 15 * k, w: 600 })
  y += 76 * k

  const grupos = [
    ['Mi equipo', [
      ['megaphone', 'Mandar un aviso', 'Llega a todo el equipo, también al móvil'],
      ['calendar-outline', 'Horario y citas', 'Entrenamientos, amistosos y convocatorias'],
    ]],
    ['Administración del club', [
      ['people-outline', 'Equipos', 'Crear equipos y asignar jugadores y entrenadores'],
      ['person-outline', 'Usuarios', 'Altas, contraseñas y roles'],
      ['newspaper-outline', 'Web del club', 'Noticias, patrocinadores y fotos'],
    ]],
  ]
  for (const [titulo, filas] of grupos) {
    s += seccion(x + 4 * k, y, titulo, k)
    y += 16 * k
    const hFila = 72 * k
    s += tarjeta(x, y, w, filas.length * hFila + 8 * k, 16 * k)
    filas.forEach(([ic, t, sub], i) => {
      const fy = y + 4 * k + i * hFila
      if (i) s += R(x + 76 * k, fy, w - 92 * k, 1, 0, C.linea)
      s += R(x + 16 * k, fy + 16 * k, 44 * k, 40 * k, 12 * k, C.tinte)
      s += I(ic, x + 38 * k, fy + 36 * k, 20 * k, C.azul)
      s += T(x + 74 * k, fy + 32 * k, t, { s: 17 * k, w: 700 })
      s += T(x + 74 * k, fy + 52 * k, corta(sub, w - 110 * k, 13.5 * k, 400, 1)[0], { s: 13.5 * k, fill: C.apagado })
      s += I('chevron-forward', x + w - 26 * k, fy + 36 * k, 17 * k, C.apagado)
    })
    y += filas.length * hFila + 30 * k
  }
  s += tabBar(W, H, k, 4).svg
  return s
}
// --- las capturas ---------------------------------------------------------

const PANTALLAS = [
  ['01-inicio', inicio],
  ['02-partidos', equipoPartidos],
  ['03-clasificacion', equipoClasificacion],
  ['04-avisos', avisos],
  ['05-confirmar', avisoConfirmacion],
  ['06-chat', chat],
  ['07-horarios', horarios],
  ['08-plantilla', equipoPlantilla],
  ['09-noticia', noticia],
  ['10-mas', mas],
]

// Las medidas que pide App Store Connect, y los puntos del dispositivo que las
// dan: 1284x2778 son los 428x926 de un iPhone 6,5" a x3, y 2048x2732 los
// 1024x1366 de un iPad Pro de 13" a x2.
//
// El factor es 1 en los dos: la app no tiene disposicion propia de tableta
// (no hay isPad ni useWindowDimensions en src/), asi que en iPad se estira a
// lo ancho manteniendo los tamaños de letra. Dibujarla mas grande quedaria
// mejor de cartel, pero no seria lo que ve quien la abre.
const FORMATOS = {
  iphone: { px: [1284, 2778], puntos: [428, 926] },
  ipad: { px: [2048, 2732], puntos: [1024, 1366] },
}

/** La pantalla entera, a sangre: lo mismo que saldria de pulsar los botones. */
function captura(formato, dibuja) {
  const [W, H] = FORMATOS[formato].puntos
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${dibuja(W, H, 1)}
</svg>`
}

// --- ejecutar -------------------------------------------------------------

async function main() {
  const soloFormato = process.argv[2]
  const soloPantalla = process.argv[3]

  // Se vacia la carpeta solo cuando se rehace todo. Con filtro
  // (`node scripts/capturas.mjs iphone 06`) se rehace esa pieza y se dejan
  // las demas donde estaban.
  if (!soloFormato && !soloPantalla) fs.rmSync(DESTINO, { recursive: true, force: true })
  fs.mkdirSync(DESTINO, { recursive: true })

  for (const [formato, f] of Object.entries(FORMATOS)) {
    if (soloFormato && soloFormato !== formato) continue
    const carpeta = path.join(DESTINO, formato)
    fs.mkdirSync(carpeta, { recursive: true })
    ;[SAT, SAB] = formato === 'ipad' ? [24, 20] : [47, 34]

    for (const [id, dibuja] of PANTALLAS) {
      if (soloPantalla && !id.startsWith(soloPantalla)) continue
      nClip = 0
      const png = pintar(captura(formato, dibuja), f.px[0])
      const ruta = path.join(carpeta, `${id}.png`)
      // Sin canal alfa: App Store Connect rechaza los PNG con transparencia.
      await sharp(png).flatten({ background: C.blanco }).png({ compressionLevel: 9 }).toFile(ruta)
      const { width, height, channels } = await sharp(ruta).metadata()
      const kb = (fs.statSync(ruta).size / 1024).toFixed(0)
      const marca = width === f.px[0] && height === f.px[1] ? ' ' : '!'
      console.log(`${marca} ${formato}/${id}.png`.padEnd(38) + `${width}x${height}  ${channels} canales  ${kb} kB`)
    }
  }

  console.log(`\nEn ${path.relative(RAIZ, DESTINO)}/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
