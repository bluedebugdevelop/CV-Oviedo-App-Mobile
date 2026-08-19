// `getReactNativePersistence` existe en el paquete pero no en los tipos.
//
// @firebase/auth publica un bundle distinto para React Native (la condición
// "react-native" de su package.json) y solo ese exporta la función. Metro sí
// elige ese bundle, pero TypeScript resuelve los tipos por la entrada normal,
// donde no está declarada. Sin esto, el import compila mal aunque en el móvil
// funcione.
//
// Se declara aquí, en vez de repartir @ts-expect-error por el código, para que
// quede en un solo sitio y con la explicación al lado.

import type { Persistence } from 'firebase/auth'

declare module 'firebase/auth' {
  export function getReactNativePersistence(almacen: unknown): Persistence
}
