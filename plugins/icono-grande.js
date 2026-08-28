// ==========================================================================
// El escudo, en color, dentro de la notificación.
//
// EL PROBLEMA
// Una notificación de Android lleva DOS iconos y no se parecen en nada:
//
//   · El pequeño, el de la barra de estado. Android le borra el color: se
//     queda con el canal alfa y lo rellena entero con el color de acento. Por
//     mucho que se le pase el escudo, sale una mancha de un solo tono. De ahí
//     que `assets/icono/notificacion.svg` sea una silueta y no el escudo.
//   · El grande, el de la derecha de la tarjeta. Este SÍ sale tal cual, con
//     sus colores. Es el sitio donde el escudo se ve como es.
//
// expo-notifications sabe leerlo —busca la meta-data
// `expo.modules.notifications.large_notification_icon` y lo pone en cada
// notificación que construye— pero su plugin no lo escribe: en el código está
// como un pendiente. Así que lo escribe este.
//
// POR QUÉ UN PLUGIN Y NO EDITAR `android/`
// `android/` lo genera `expo prebuild` y no está en el repositorio. Cualquier
// cosa puesta ahí a mano desaparece en la siguiente generación.
//
// UNA SOLA DENSIDAD
// El PNG va únicamente a `drawable-xxxhdpi`. El icono grande son 64 dp, que a
// xxxhdpi (×4) son 256 px, justo el tamaño del fichero. En un móvil de menos
// densidad Android coge ese mismo recurso y lo reduce, que para una foto es lo
// correcto; repetirlo en cinco carpetas solo engordaría el paquete.
// ==========================================================================

const fs = require('fs')
const path = require('path')
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins')

const ORIGEN = path.join('assets', 'icono', 'notificacion-grande.png')
const RECURSO = 'notificacion_grande'
const CARPETA = path.join('android', 'app', 'src', 'main', 'res', 'drawable-xxxhdpi')
const META = 'expo.modules.notifications.large_notification_icon'

module.exports = function iconoGrande(config) {
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const origen = path.join(cfg.modRequest.projectRoot, ORIGEN)
      // Sin el PNG no se rompe la generación: simplemente no habrá icono
      // grande y la notificación saldrá solo con la silueta, como antes.
      if (!fs.existsSync(origen)) {
        console.warn(`[icono-grande] falta ${ORIGEN}; la notificación irá sin icono grande`)
        return cfg
      }
      const destino = path.join(cfg.modRequest.projectRoot, CARPETA)
      fs.mkdirSync(destino, { recursive: true })
      fs.copyFileSync(origen, path.join(destino, `${RECURSO}.png`))
      return cfg
    },
  ])

  return withAndroidManifest(config, (cfg) => {
    const aplicacion = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults)
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      aplicacion,
      META,
      `@drawable/${RECURSO}`,
      'resource',
    )
    return cfg
  })
}
