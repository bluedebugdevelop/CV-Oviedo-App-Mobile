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
npm run pruebas:reglas     # tests de las reglas de Firestore contra el emulador
npm run reglas:desplegar   # firebase deploy --only firestore:rules,firestore:indexes
npm run apk                # build release arm64 + x86_64
npm run nativo             # expo prebuild --platform android --clean
npm run ios:preparar       # entorno.mjs + prebuild ios
npm run tienda             # material de ficha de tienda
```

## Dónde está qué

- `src/app/` — pantallas (enrutado de Expo Router)
- `src/componentes/` — componentes compartidos
- `src/contexto/` — estado global
- `src/lib/` — acceso a Firebase y utilidades
- `src/tareas/` — trabajo en segundo plano
- `src/tema.ts` — colores y tipografía. Los estilos salen de aquí.
- `src/tipos/` — tipos compartidos
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

**Depende de la web del club** (`bluedebugdevelop/ClubVoleibolOviedoWeb`) para
noticias y datos de competición. Si cambia el formato de `competicion.json` allí,
esto se entera. Ver el CLAUDE.md de CVOWeb.

## Estado

- Se distribuye con **EAS**. `eas.json` tiene los perfiles de build.
- 11 equipos federados en el club.
