// ==========================================================================
// Firmar la build de release con la clave de subida del club.
//
// POR QUÉ HACE FALTA
// Expo genera el proyecto con la release firmada por la clave de DEPURACIÓN
// (`signingConfig signingConfigs.debug`, con el aviso «Caution!» al lado). Sirve
// para instalar un APK a mano, pero Play Console rechaza cualquier cosa firmada
// así: el certificado de depuración lo comparte medio mundo y no identifica a
// nadie.
//
// POR QUÉ UN PLUGIN Y NO EDITAR EL FICHERO
// `android/` lo genera `expo prebuild` y no está en el repositorio: cualquier
// cosa que se edite ahí a mano desaparece en la siguiente generación. Justo
// antes de una subida a la tienda es el peor momento para descubrir que la
// firma volvió a ser la de depuración.
//
// DÓNDE VIVEN LAS CONTRASEÑAS
// En `secretos/firma.json`, que está en .gitignore. De ahí las copia este
// plugin a `android/gradle.properties`, que también queda fuera del repositorio
// por estar dentro de `android/`. Al repositorio no llega ninguna.
//
// SI NO HAY CLAVE, NO PASA NADA
// Sin `secretos/firma.json` el plugin se aparta y la release sigue firmándose
// como antes. Así el proyecto se puede clonar y compilar para probar sin tener
// que repartir la clave del club.
// ==========================================================================

const fs = require('fs')
const path = require('path')
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins')

const CARPETA = 'secretos'
const DATOS = 'firma.json'

function leerFirma(raizProyecto) {
  const ruta = path.join(raizProyecto, CARPETA, DATOS)
  if (!fs.existsSync(ruta)) return null
  try {
    const f = JSON.parse(fs.readFileSync(ruta, 'utf8'))
    if (!f.almacen || !f.alias || !f.contrasena) return null
    // La ruta se resuelve desde `android/app/`, que es donde corre Gradle.
    return { ...f, rutaDesdeApp: path.posix.join('..', '..', CARPETA, f.almacen) }
  } catch {
    return null
  }
}

function fijar(propiedades, clave, valor) {
  const existente = propiedades.find((p) => p.type === 'property' && p.key === clave)
  if (existente) {
    existente.value = valor
    return propiedades
  }
  return [...propiedades, { type: 'property', key: clave, value: valor }]
}

module.exports = function firmaRelease(config) {
  const firma = leerFirma(process.cwd())
  if (!firma) return config

  config = withGradleProperties(config, (cfg) => {
    let props = cfg.modResults
    props = fijar(props, 'CVO_ALMACEN', firma.rutaDesdeApp)
    props = fijar(props, 'CVO_ALIAS', firma.alias)
    /* La misma contraseña para el almacén y para la clave.

       No es un descuido: el formato PKCS12 —el que usa keytool desde Java 9—
       NO admite que sean distintas. Si se le pasan dos, ignora la de la clave
       en silencio y luego Gradle falla al firmar con un error que no lo
       explica. */
    props = fijar(props, 'CVO_CONTRASENA', firma.contrasena)
    cfg.modResults = props
    return cfg
  })

  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents

    // 1. Declarar la firma de subida junto a la de depuración.
    const anclaConfigs = '    signingConfigs {\n'
    if (!gradle.includes('subida {')) {
      gradle = gradle.replace(
        anclaConfigs,
        anclaConfigs +
          '        subida {\n' +
          "            storeFile file(project.property('CVO_ALMACEN'))\n" +
          "            storePassword project.property('CVO_CONTRASENA')\n" +
          "            keyAlias project.property('CVO_ALIAS')\n" +
          "            keyPassword project.property('CVO_CONTRASENA')\n" +
          '        }\n',
      )
    }

    /* 2. Que la release la use.

       Se busca el comentario de aviso que Expo deja encima, y no solo la línea
       `signingConfig signingConfigs.debug`: esa línea aparece DOS veces —en
       debug y en release— y sustituir la primera dejaría la release sin tocar y
       la depuración sin poder firmar. */
    const bloqueRelease =
      '            // Caution! In production, you need to generate your own keystore file.\n' +
      '            // see https://reactnative.dev/docs/signed-apk-android.\n' +
      '            signingConfig signingConfigs.debug\n'

    if (gradle.includes(bloqueRelease)) {
      gradle = gradle.replace(
        bloqueRelease,
        '            // Firmada con la clave de subida del club (plugins/firma-release.js).\n' +
          '            signingConfig signingConfigs.subida\n',
      )
    }

    cfg.modResults.contents = gradle
    return cfg
  })
}
