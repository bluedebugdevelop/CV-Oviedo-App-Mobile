// ==========================================================================
// Más memoria para Gradle y para el compilador de Kotlin.
//
// El proyecto de Android lo genera `expo prebuild` y NO está en el
// repositorio, así que cualquier cosa que se edite a mano en
// `android/gradle.properties` desaparece en la siguiente generación. Por eso
// esto es un config plugin y no un apaño: se aplica solo, cada vez.
//
// EL PORQUÉ
// Expo genera el proyecto con `-Xmx2048m`. Compilando desde cero —React Native
// más una docena de módulos nativos, con CMake para dos arquitecturas a la vez—
// el compilador de Kotlin se queda sin sitio y el demonio se muere. Lo peor es
// cómo se manifiesta: la tarea sale como FAILED y el build termina SIN ningún
// mensaje de error, así que parece un fallo de código y no lo es.
//
// 4 GB es de sobra en cualquier máquina de desarrollo actual, y el demonio de
// Kotlin necesita los suyos aparte: hereda de Gradle solo si no se le dicen.
// ==========================================================================

const { withGradleProperties } = require('expo/config-plugins')

/** Deja una propiedad puesta, exista ya o no. */
function fijar(propiedades, clave, valor) {
  const existente = propiedades.find((p) => p.type === 'property' && p.key === clave)
  if (existente) {
    existente.value = valor
    return propiedades
  }
  return [...propiedades, { type: 'property', key: clave, value: valor }]
}

module.exports = function memoriaGradle(config) {
  return withGradleProperties(config, (cfg) => {
    let props = cfg.modResults
    props = fijar(props, 'org.gradle.jvmargs', '-Xmx4096m -XX:MaxMetaspaceSize=1024m')
    // El demonio de Kotlin es un proceso aparte con su propio montón.
    props = fijar(props, 'kotlin.daemon.jvmargs', '-Xmx2048m')
    cfg.modResults = props
    return cfg
  })
}
