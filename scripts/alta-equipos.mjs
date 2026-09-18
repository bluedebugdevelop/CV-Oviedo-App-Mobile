// ==========================================================================
// Alta de los equipos de la temporada y de su horario de entrenamiento.
//
//   npm run alta:equipos                             ve lo que haría, sin tocar nada
//   npm run alta:equipos -- --va                     lo hace
//   npm run alta:equipos -- --va --archivar-viejos   y además archiva las
//                                                    temporadas anteriores
//
// Lee `src/datos/equipos-club.json` —el cartel de horarios del club, escrito
// una vez— y deja en Firestore los equipos que falten con sus entrenamientos.
//
// POR QUÉ UN SCRIPT Y NO LA APP
// Porque esto se hace UNA VEZ al empezar la temporada y para entonces todavía
// no hay nadie dado de alta que pueda entrar a la app a crearlos. Es el
// problema del huevo y la gallina de cualquier alta inicial. De todo lo demás
// —meter jugadores, cambiar una hora, archivar un equipo— se encarga la app o
// el panel de BlueDebug Management, sin publicar versión.
//
// ES IDEMPOTENTE. Se puede correr las veces que haga falta:
//   · Un equipo se reconoce por `nombre` + `temporada`. Si ya está, no se toca
//     ni se duplica: puede que alguien le haya cambiado el nombre o le haya
//     metido gente, y eso manda sobre este fichero.
//   · Un entrenamiento se reconoce por día + hora de inicio. Solo se añaden los
//     que falten, así que un cambio de hora hecho por el entrenador sobrevive.
//
// CREDENCIALES
// La cuenta de servicio de `secretos/` (la misma que usa el panel). No se
// entra por el SDK de cliente a propósito: las reglas de Firestore solo dejan
// crear equipos a un admin con ficha, y aquí todavía no hay ninguna.
//
// Se habla con la API REST de Firestore firmando el JWT a mano con `crypto`,
// que viene en Node. Meter `firebase-admin` —decenas de megas de dependencia—
// para tres peticiones de un script que se corre una vez al año no sale a
// cuenta.
// ==========================================================================

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const VA_DE_VERDAD = process.argv.includes('--va')

/* Archivar lo de temporadas anteriores es OPCIONAL y va apagado.

   Un equipo archivado desaparece de la app de la gente que estaba en él. Eso
   es lo que se quiere en septiembre, pero no lo decide un script: las
   plantillas cambian, y hasta que no está montada la temporada nueva a la
   gente le sigue valiendo ver la vieja. Archivar no borra nada y se deshace
   desde el panel, pero aun así se pide a mano. */
const ARCHIVAR_VIEJOS = process.argv.includes('--archivar-viejos')

// --- credenciales ---------------------------------------------------------

/** La cuenta de servicio, venga de un fichero o de una variable de entorno. */
function cuentaDeServicio() {
  const crudo = process.env.CVO_CUENTA_SERVICIO
  if (crudo) {
    // Admite el JSON entero o una ruta. En CI lo cómodo es lo primero.
    return crudo.trim().startsWith('{')
      ? JSON.parse(crudo)
      : JSON.parse(fs.readFileSync(crudo, 'utf8'))
  }

  const carpeta = path.join(RAIZ, 'secretos')
  const fichero = fs.existsSync(carpeta)
    ? fs.readdirSync(carpeta).find((f) => f.includes('firebase-adminsdk') && f.endsWith('.json'))
    : null

  if (!fichero) {
    throw new Error(
      'No encuentro la cuenta de servicio. Pon el JSON en secretos/ (ver secretos/LEEME.md) ' +
        'o exporta CVO_CUENTA_SERVICIO con su contenido o su ruta.',
    )
  }
  return JSON.parse(fs.readFileSync(path.join(carpeta, fichero), 'utf8'))
}

const base64url = (b) => Buffer.from(b).toString('base64url')

/**
 * Un token de acceso a Firestore a partir de la cuenta de servicio.
 *
 * Es el baile estándar de OAuth para cuentas de servicio: se firma un JWT con
 * la clave privada y Google lo cambia por un token de una hora.
 */
async function token(cuenta) {
  const ahora = Math.floor(Date.now() / 1000)
  const cabecera = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const cuerpo = base64url(
    JSON.stringify({
      iss: cuenta.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: ahora,
      exp: ahora + 3600,
    }),
  )

  const firma = crypto
    .createSign('RSA-SHA256')
    .update(`${cabecera}.${cuerpo}`)
    .sign(cuenta.private_key)
    .toString('base64url')

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabecera}.${cuerpo}.${firma}`,
    }),
  })

  const datos = await r.json()
  if (!r.ok) throw new Error(`Google rechazó la cuenta de servicio: ${JSON.stringify(datos)}`)
  return datos.access_token
}

// --- Firestore por REST ---------------------------------------------------

/**
 * Un valor de JavaScript en el envoltorio que quiere la API REST.
 *
 * Firestore por REST no acepta `{campo: "hola"}` sino
 * `{campo: {stringValue: "hola"}}`: el tipo va explícito porque el protocolo no
 * es JSON puro, es JSON describiendo tipos de Firestore.
 */
function valor(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } }
  return { stringValue: String(v) }
}

const campos = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, valor(v)]))

/** Y la vuelta: de lo que devuelve la API a algo que se pueda mirar. */
function leerCampo(v) {
  if (!v) return null
  if ('stringValue' in v) return v.stringValue
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('nullValue' in v) return null
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(leerCampo)
  return null
}

function crearApi(proyecto, acceso) {
  const raiz = `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents`

  async function llamar(ruta, opciones = {}) {
    const r = await fetch(`${raiz}${ruta}`, {
      ...opciones,
      headers: {
        authorization: `Bearer ${acceso}`,
        'content-type': 'application/json',
        ...(opciones.headers ?? {}),
      },
    })
    const cuerpo = await r.json().catch(() => null)
    if (!r.ok) {
      throw new Error(`Firestore ${r.status} en ${ruta}: ${cuerpo?.error?.message ?? 'sin detalle'}`)
    }
    return cuerpo
  }

  return {
    /** Todos los documentos de una colección, paginando hasta el final. */
    async listar(coleccion) {
      const salida = []
      let pagina = null
      do {
        const sufijo = pagina ? `&pageToken=${encodeURIComponent(pagina)}` : ''
        const r = await llamar(`/${coleccion}?pageSize=300${sufijo}`)
        for (const d of r.documents ?? []) {
          salida.push({
            id: d.name.split('/').pop(),
            datos: Object.fromEntries(
              Object.entries(d.fields ?? {}).map(([k, v]) => [k, leerCampo(v)]),
            ),
          })
        }
        pagina = r.nextPageToken ?? null
      } while (pagina)
      return salida
    },

    async crear(coleccion, datos) {
      const r = await llamar(`/${coleccion}`, {
        method: 'POST',
        body: JSON.stringify({ fields: campos(datos) }),
      })
      return r.name.split('/').pop()
    },

    /**
     * Cambia unos campos sueltos de un documento.
     *
     * El `updateMask` es lo que convierte el PATCH de Firestore en un «cambia
     * solo esto»: sin él, la API sustituye el documento entero por lo que se
     * mande y el equipo se quedaría sin plantilla.
     */
    async parchear(ruta, datos) {
      const mascara = Object.keys(datos)
        .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
        .join('&')
      await llamar(`/${ruta}?${mascara}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: campos(datos) }),
      })
    },
  }
}

// --- lo que hay que dejar puesto ------------------------------------------

const plantilla = JSON.parse(
  fs.readFileSync(path.join(RAIZ, 'src', 'datos', 'equipos-club.json'), 'utf8'),
)

/** Para comparar nombres que pueden venir con otra tilde o en otra caja. */
const llave = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

async function main() {
  const cuenta = cuentaDeServicio()
  const proyecto = cuenta.project_id
  const api = crearApi(proyecto, await token(cuenta))

  console.log(`Proyecto: ${proyecto}`)
  console.log(`Temporada: ${plantilla.temporada}`)
  console.log(VA_DE_VERDAD ? 'Modo: ESCRIBIENDO\n' : 'Modo: ensayo (añade --va para escribir)\n')

  const existentes = await api.listar('equipos')
  const porNombre = new Map(
    existentes
      .filter((e) => llave(e.datos.temporada) === llave(plantilla.temporada))
      .map((e) => [llave(e.datos.nombre), e]),
  )

  let equiposCreados = 0
  let entrenosCreados = 0

  for (const def of plantilla.equipos) {
    const yaEsta = porNombre.get(llave(def.nombre))
    let equipoId = yaEsta?.id ?? null

    if (!equipoId) {
      console.log(`+ equipo  ${def.nombre}`)
      if (VA_DE_VERDAD) {
        equipoId = await api.crear('equipos', {
          nombre: def.nombre,
          categoria: def.categoria,
          genero: def.genero,
          temporada: plantilla.temporada,
          claveCompeticion: def.claveCompeticion,
          // Se enlaza a mano desde la ficha del equipo: ver `slugWeb` en el
          // modelo de la app.
          slugWeb: null,
          entrenadores: [],
          jugadores: [],
          archivado: false,
          creadoEn: new Date(),
          creadoPor: 'script:alta-equipos',
        })
      }
      equiposCreados++
    } else {
      console.log(`= equipo  ${def.nombre} (ya estaba)`)
    }

    // En ensayo no hay id, así que tampoco hay subcolección que mirar: se
    // cuentan todos los entrenamientos como pendientes, que es lo que serían.
    const puestos = equipoId
      ? await api.listar(`equipos/${equipoId}/entrenamientos`)
      : []
    const yaPuesto = new Set(puestos.map((x) => `${x.datos.dia}-${x.datos.inicio}`))

    for (const ent of def.entrenamientos) {
      if (yaPuesto.has(`${ent.dia}-${ent.inicio}`)) continue

      console.log(`  + ${DIAS[ent.dia]} ${ent.inicio}–${ent.fin}`)
      if (VA_DE_VERDAD && equipoId) {
        await api.crear(`equipos/${equipoId}/entrenamientos`, {
          dia: ent.dia,
          inicio: ent.inicio,
          fin: ent.fin,
          lugar: plantilla.sede,
          notas: '',
          activo: true,
        })
      }
      entrenosCreados++
    }
  }

  const verbo = VA_DE_VERDAD ? 'Creados' : 'Se crearían'
  console.log(`\n${verbo} ${equiposCreados} equipos y ${entrenosCreados} entrenamientos.`)

  // --- temporadas anteriores ---
  const viejos = existentes.filter(
    (e) => llave(e.datos.temporada) !== llave(plantilla.temporada) && e.datos.archivado !== true,
  )

  if (viejos.length > 0 && !ARCHIVAR_VIEJOS) {
    console.log(
      `\nQuedan ${viejos.length} equipos de temporadas anteriores sin archivar. ` +
        'Siguen saliendo en la app de quien esté en ellos.\n' +
        'Para archivarlos: npm run alta:equipos -- --va --archivar-viejos',
    )
  } else if (viejos.length > 0) {
    console.log(`\nArchivando ${viejos.length} equipos de temporadas anteriores:`)
    for (const e of viejos) {
      console.log(`  · ${e.datos.nombre} (${e.datos.temporada})`)
      if (VA_DE_VERDAD) await api.parchear(`equipos/${e.id}`, { archivado: true })
    }
  }

  if (!VA_DE_VERDAD) console.log('\nNada se ha escrito. Repite con --va para hacerlo.')
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`)
  process.exit(1)
})
