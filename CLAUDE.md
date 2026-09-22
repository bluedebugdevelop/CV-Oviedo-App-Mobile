# CVOApp — app móvil del Club Voleibol Oviedo

App iOS/Android del club: calendario, resultados, horarios, chat de equipo y
avisos. Expo (React Native 0.86) + Firebase. Repo `bluedebugdevelop/CV-Oviedo-App-Mobile`.
El README del repo explica el producto; esto es la capa operativa.

## Comandos

```bash
npm start                  # expo start
npm run android / ios
npm run tipos              # tsc --noEmit  <- correr antes de dar nada por bueno
npm run lint               # expo lint
npm run pruebas            # las dos tandas de abajo
npm run pruebas:reglas     # tests de las reglas de Firestore contra el emulador
npm run pruebas:semana     # tests del planning semanal (Node pelado, sin Expo)
npm run reglas:desplegar   # firebase deploy --only firestore:rules,firestore:indexes
npm run alta:equipos       # siembra los equipos de la temporada (--va para escribir)
npm run apk                # APK de release, arm64 + x86_64 (para instalar a mano)
npm run bundle             # AAB de release para Play, con las CUATRO ABIs
npm run nativo             # expo prebuild --platform android --clean
npm run ios:preparar       # entorno.mjs + prebuild ios
npm run tienda             # material de ficha de tienda (Play)
npm run capturas           # capturas de la App Store (iPhone 6,5" e iPad 13")
npm run tienda:textos      # comprueba los límites de los textos de ficha
```

## Dónde está qué

- `src/app/` — pantallas (enrutado de Expo Router)
- `src/componentes/` — componentes compartidos
- `src/contexto/` — estado global
- `src/lib/` — acceso a Firebase y utilidades
- `src/tareas/` — trabajo en segundo plano
- `src/tema.ts` — colores y tipografía. Los estilos salen de aquí.
- `src/tipos/` — tipos compartidos
- `src/datos/equipos-club.json` — la **semilla** de equipos y horarios de la
  temporada. No es la fuente de verdad: lo es Firestore. Ver `scripts/alta-equipos.mjs`.
- `firestore.rules` + `pruebas/` — **las reglas son la capa de seguridad real**
- `secretos/`, `google-services.json` — credenciales. **Nunca commitear.**

## Convenciones

- **Código, carpetas y nombres en español** (`componentes`, `tareas`, `tipos`,
  `pruebas`). Es deliberado, igual que en CVOWeb y BlueDebug Management. Mantenerlo.
- TypeScript estricto. `npm run tipos` tiene que pasar limpio.

## Lo que no se puede romper

**Los permisos se garantizan en las reglas de Firestore, no en la interfaz.**
Ocultar un botón no es seguridad. Cualquier cambio de permisos toca
`firestore.rules` y se prueba con `npm run pruebas:reglas` contra el emulador
(proyecto `cvo-pruebas`), que es justo para lo que existe.

**Los roles son una lista, no uno solo.** La misma persona puede entrenar al
infantil y jugar en el sénior, o llevar el club y además entrenar. Cualquier
código que asuma `usuario.rol` en singular está mal: son `roles[]` y además van
por equipo. Los tres niveles son jugador / entrenador / administrador.

**El chat y los avisos escuchan TODOS los equipos, no el «equipo activo».**
`contexto/chats`, `contexto/avisos` y `contexto/agenda` se suscriben a cada
equipo de la persona y viven en la raíz (`app/_layout.tsx`), no en las pestañas.
Los tres siguen el mismo patrón: lo guardado va junto con la firma de los
equipos de los que es, y si no coincide se descarta **al pintar**. Vaciarlo
desde el efecto enseña un fotograma de un equipo del que ya se ha salido, y el
linter lo rechaza.

**Ya no hay «equipo activo».** Equipo, Chat y Avisos son una lista cuando hay
varios y entran directas cuando hay uno; el resto se abre por ruta con el id
dentro (`/equipo/[equipoId]/[seccion]`, `/chat/[equipoId]`,
`/avisos/[equipoId]`, `/aviso-nuevo?equipo=`, `/entrenamientos?equipo=`).
`equipoActivo` solo sobrevive como respaldo. Evita que quien entrena a dos mande
el aviso —o edite el horario— del equipo equivocado.

**Un efecto NUNCA depende de un objeto que venga de un `onSnapshot`.** Ni de
`equipo`, ni de `perfil`, ni de `equipos`: Firestore devuelve objetos nuevos en
cada snapshot, así que como dependencia valen lo mismo que no poner ninguna. Se
depende del `id`, del `uid` o de una firma en texto (`ids.join(',')`).

Costó una versión entera. `marcarChatLeido` escribe `lecturasChat` en la ficha
propia → la ficha se escucha → vuelve un `perfil` nuevo → el efecto que marca
como leído se disparaba otra vez → escribía otra vez. Un bucle infinito de
escrituras a Firestore mientras el chat estuviera abierto. Y de rebote, como el
efecto de los equipos dependía de `perfil`, cada vuelta volvía a suscribir los
listeners de TODOS los equipos, que devolvían `Equipo` nuevos, que hacían
resuscribirse a todo lo demás. Eso era el parpadeo.

**Una pestaña no redirige fuera del grupo `(app)`.** Cuando hay un solo equipo,
la pestaña PINTA el componente (`<ResumenEquipo …/>`), no hace `Redirect` a
`/equipo/[id]`. Redirigir desmonta el navegador de pestañas: desaparece la barra
de abajo y el botón de atrás se sale de la app. Chat y Avisos hacen lo mismo con
`<Conversacion>` y `<ListaAvisos>`.

**Los equipos archivados se filtran UNA vez, en `contexto/sesion`.** `equipos`
sale de ahí ya sin ellos. Antes lo filtraba cada consumidor por su cuenta y el
selector de equipo y `equipoActivo` se lo saltaban: al empezar la temporada
aparecían los equipos del año pasado, vacíos y sin calendario, mezclados con los
de esta. La administración sigue viéndolos con `escucharTodosLosEquipos`.

**Las cuatro secciones del equipo no van en un control segmentado.**
«Clasificación» no cabe en un cuarto de pantalla y salía cortada. Son tarjetas
en rejilla de dos en dos, cada una con el dato que resume lo que hay dentro.

**`lib/semana.ts` y `lib/web/partidos.ts` no importan nada de Expo.** Son lógica
pura y se prueban en Node sin bundler (`npm run pruebas:semana`). Por eso
`partidos.ts` está separado de `competicion.ts`, que arrastra el cliente HTTP y
con él `expo-constants`. Tampoco vale sintaxis de TypeScript que genere código
(*parameter properties*): Node solo quita tipos.

**El AAB de Play va SIN `-PreactNativeArchitectures`** (usa `npm run bundle`).
Ese parámetro está en `npm run apk` para que el APK que se pasa a mano no pese
de más; en el bundle recorta las ABIs y deja fuera los móviles de 32 bits.
Comprobar: `unzip -l entregas/CVOviedo-*.aab | grep -o "base/lib/[a-z0-9_-]*" |
sort -u` tiene que dar cuatro líneas.

**Depende de la web del club** (`bluedebugdevelop/ClubVoleibolOviedoWeb`) para
noticias y datos de competición. Si cambia el formato de `competicion.json` allí,
esto se entera. Ver el CLAUDE.md de CVOWeb.

## Estado

- Se distribuye con **EAS**. `eas.json` tiene los perfiles de build.
- **13 equipos** en la temporada 2026/27 (ver `src/datos/equipos-club.json`).
  Solo dos compiten en competición nacional y por tanto tienen calendario y
  clasificación: Superliga 2 Masculina y Primera Nacional Femenina. La web del
  club no publica el calendario de las categorías de base, así que el resto va
  con `claveCompeticion: null` y solo tiene horario de entrenamiento.
- Las altas de jugadores y entrenadores **no requieren publicar versión**: se
  hacen desde Administración en la app o desde el panel de BlueDebug Management
  (conector `cvo`), y los equipos y horarios se leen de Firestore en vivo.
