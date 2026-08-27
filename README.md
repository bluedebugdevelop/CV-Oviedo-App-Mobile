# CV Oviedo — app del club

App móvil del [Club Voleibol Oviedo](https://clubvoleiboloviedo.com) para iOS y
Android. Sirve para que cada entrenador organice a su equipo y lo tenga avisado:
calendario, horarios, chat y avisos, más la administración del club y del
contenido de la web.

Está hecha con Expo (React Native) y Firebase, y se apoya en la web del club
—[bluedebugdevelop/ClubVoleibolOviedoWeb](https://github.com/bluedebugdevelop/ClubVoleibolOviedoWeb)—
para las noticias y los datos de competición.

---

## Qué hace

**Los tres niveles de usuario** que pidió el club:

Los roles son una **lista**, no uno solo: la misma persona puede entrenar al
infantil y jugar en el sénior, o llevar el club y además entrenar a un equipo.

| | Jugador | Entrenador | Administrador |
|---|:---:|:---:|:---:|
| Noticias del club | ✅ | ✅ | ✅ |
| Calendario, resultados y clasificación de su equipo | ✅ | ✅ | ✅ |
| Horario de entrenamientos | ver | ver y editar | ver y editar |
| Chat del equipo | ✅ | ✅ | ✅ |
| Avisos | recibir y confirmar | mandar | mandar |
| Crear equipos y asignar plantilla | — | — | ✅ |
| Dar de alta cuentas | — | — | ✅ |
| Publicar en la web del club | — | — | ✅ |

Y hay **dos niveles** que conviene no mezclar:

- **Roles de club** (en la ficha del usuario): lo que alguien *puede* ser. Es
  lo que abre o cierra la administración.
- **Listas del equipo** (`entrenadores` y `jugadores`): lo que es *en ese
  equipo*. Es lo que decide quién manda avisos y toca el horario en cada sitio.

Por eso ser «entrenador» de club no da mando sobre un equipo al que no
perteneces, y por eso alguien puede salir como jugador en la plantilla de un
equipo y como entrenador en la de otro.

**No hay registro abierto.** En la app no existe pantalla de «crear cuenta»: las
cuentas las da de alta un administrador desde *Más → Usuarios*, con una
contraseña inicial que se entrega a la persona. Quien no tenga ficha en el club
no puede leer ni escribir nada, aunque se cree una cuenta de Firebase por su
cuenta. Eso lo garantizan las reglas de [`firestore.rules`](firestore.rules), no
la interfaz.

---

## Puesta en marcha

### 1. Dependencias

```bash
npm install
```

### 2. Proyecto de Firebase

En la [consola de Firebase](https://console.firebase.google.com):

1. Crear un proyecto (p. ej. `cv-oviedo`), con la región en **europe-west**.
2. **Authentication → Sign-in method → Correo electrónico/contraseña**: activar.
3. **Firestore Database**: crear la base de datos en modo producción.
4. **Configuración del proyecto → Tus apps → Web (`</>`)**: registrar una app y
   copiar la configuración.

Luego, en la raíz del repositorio:

```bash
cp .env.example .env.local
```

y rellenar `.env.local` con esos valores. Esas claves **no son secretas** —van
dentro de cualquier app compilada— así que lo que protege los datos son las
reglas, no esconderlas.

### 3. Reglas e índices

```bash
npx firebase login
npx firebase use --add
npm run reglas:desplegar
```

Sin esto, la app entra pero no lee nada: la base de datos está cerrada por
defecto, que es como tiene que estar.

### 4. El primer administrador

Es el huevo y la gallina: solo un admin puede crear cuentas, y todavía no hay
ninguno. Se hace a mano, una única vez:

1. **Authentication → Users → Add user**: correo y contraseña del admin. Copiar
   el UID que aparece.
2. **Firestore → Iniciar colección** `usuarios`, con ese UID como id del
   documento y estos campos:

   ```
   nombre      (string)  Adrián Estrada
   email       (string)  adrian@ejemplo.com
   roles       (array)   ["admin"]
   equipos     (array)   []
   activo      (boolean) true
   tokensPush  (array)   []
   ```

   La consola obliga a meter un elemento al crear un array; en `equipos` y
   `tokensPush` bórralo luego con la papelera para que queden vacíos. La app
   ignora los elementos vacíos igualmente, pero así queda limpio.

   Las fichas antiguas con `rol` (string, en singular) siguen valiendo: tanto
   la app como las reglas leen los dos formatos.

A partir de ahí, todo lo demás se hace desde la app.

### 5. Arrancar

```bash
npx expo start
```

Para probar el chat y las notificaciones hace falta una *development build*
(ver abajo): Expo Go ya no entrega notificaciones push.

---

## Cómo está montado

```
src/
  app/                  rutas (expo-router)
    entrar.tsx          login — no hay registro
    (app)/              las cinco pestañas
      index.tsx           inicio: avisos, próximo partido, noticias
      equipo.tsx          partidos, clasificación, horario y plantilla
      chat.tsx            chat del equipo
      avisos.tsx          avisos y confirmaciones
      mas.tsx             perfil y accesos de entrenador/admin
    aviso-nuevo.tsx     mandar un aviso (entrenador)
    entrenamientos.tsx  horario y citas (entrenador)
    noticia/[slug].tsx  ficha de noticia
    privacidad.tsx
    admin/              solo administradores
      equipos.tsx         crear equipos
      equipo/[id].tsx     plantilla: meter y sacar gente
      usuarios.tsx        altas y bajas de cuentas
      web/                el panel de la web del club
  lib/
    firebase/           modelo de datos y consultas
    web/                cliente de clubvoleiboloviedo.com
    push.ts             notificaciones
  contexto/             sesión, avisos y panel
  componentes/          la interfaz compartida
  tema.ts               colores y medidas, sacados de la web
```

### De dónde sale cada dato

| Qué | De dónde | Quién lo cambia |
|---|---|---|
| Noticias, patrocinadores, fichas de equipo, fotos | la web (`/api/contenido`) | admin, desde *Contenido de la web* |
| Partidos, resultados, clasificación | federaciones FVBPA y RFEVB, vía `/api/competicion` | nadie: lo scrapea la web |
| Cuentas, equipos, chat, avisos, horarios | Firestore | admin y entrenadores |

Las noticias y los partidos no se duplican en Firebase a propósito: se publican
una vez en la web y salen en los dos sitios.

### Los dos «equipos»

Hay dos cosas con el mismo nombre y conviene no mezclarlas:

- **Equipos de la app** (*Administración → Equipos*, en Firestore): quién entra,
  quién ve qué chat, a quién le llegan los avisos.
- **Fichas de equipo de la web** (*Contenido de la web → Equipos*): lo que ve un
  visitante en clubvoleiboloviedo.com.

No están enlazadas: en la web se publica el dorsal y el nombre, no el censo de
cuentas de la app.

---

## Lo que hubo que tocar en la web

La app necesitaba dos cosas que la web no daba. Están en la rama `feat/api-app`
de `ClubVoleibolOviedoWeb`:

- **`POST /api/panel/token`** — la app no puede usar la cookie del panel (no hay
  navegador que la guarde), así que se cambia usuario y contraseña por un token
  Bearer de 90 días. Va firmado con el mismo secreto que la cookie pero sobre un
  texto distinto, así que una cookie robada no vale como token ni al revés. El
  token no se entrega nunca a cambio de una sesión ya abierta: hay que presentar
  la contraseña.
- **`GET /api/competicion`** — la web trae los datos de las federaciones dentro
  del bundle de Vite; la app no pasa por Vite. Con `?clave=` devuelve solo una
  competición, unos pocos kB en vez de 100.

Hay que desplegar esa rama antes de que la app pueda publicar contenido.

---

## Notificaciones

Dos capas que conviene no confundir:

- **El aviso dentro de la app** es un documento de Firestore. Llega siempre,
  también sin permiso de notificaciones.
- **El aviso del sistema** (el que suena con la app cerrada) va por Expo Push y
  necesita permiso, móvil de verdad y una build de desarrollo o de tienda.

### Qué dispara cada notificación

| Cuándo | Quién la manda | Canal de Android |
|---|---|---|
| Mensaje en el chat del equipo | el móvil de quien escribe | Chat del equipo |
| Aviso del entrenador | el móvil del entrenador | Avisos del entrenador |
| Cambio de horario o cita nueva | el móvil del entrenador | Horarios y partidos |
| Noticia nueva del club | el móvil del admin, previa confirmación | Noticias del club |
| Cambio en el calendario federado | **el propio móvil**, al detectarlo | Horarios y partidos |

Los cuatro primeros los provoca alguien y se envían desde su dispositivo por
Expo Push (ver `lib/firebase/notificar.ts`). El quinto no lo provoca nadie: los
partidos vienen de la FVBPA y la RFEVB, y cuando la federación mueve uno nadie
toca la app.

Sin servidor, la única forma honesta de enterarse es que cada móvil compruebe
de vez en cuando y se compare con lo que vio la última vez. Eso hace
`tareas/calendario.ts`, y la notificación que sale es **local**. Conviene saber
lo que eso NO es: Android suele ejecutarlo cada pocas horas, iOS decide por su
cuenta y puede tardar un día. Es un extra sobre mirar la app, no un sustituto.

Que haya cuatro canales de Android y no uno es a propósito: el sistema deja
silenciarlos por separado, así que quien no quiera el pitido de cada mensaje
puede callarlo sin perderse una convocatoria.

Dos detalles que se notan al usarla: el chat que tienes abierto no suena (ver
`lib/foco.ts`), y las noticias solo avisan de las **nuevas** — el panel manda
la lista entera en cada publicación, así que sin esa comparación el club
recibiría una notificación cada vez que alguien corrige una tilde.

### Los dos ficheros de Firebase que se confunden

Configurar el push falla casi siempre por dar uno donde va el otro:

| Fichero | Qué es | ¿A git? |
|---|---|:---:|
| `google-services.json` (raíz) | Configuración **pública**: viaja dentro de la app y es lo que deja al móvil registrarse en FCM. | Sí |
| `secretos/…-firebase-adminsdk-….json` | Clave de **cuenta de servicio**. Se sube a Expo para que pueda enviar. Da acceso al proyecto entero. | **Nunca** |

La clave de cuenta de servicio se descarga en **Consola de Firebase → ⚙️
Configuración del proyecto → Cuentas de servicio → Generar nueva clave
privada**, y se entrega a Expo con:

```bash
npx eas credentials
```

→ *Android* → *production* → *Google Service Account* → *Manage your Google
Service Account Key for Push Notifications (FCM V1)* → *Set up*.

No hace falta recompilar después: esa clave vive en el servidor de Expo, no en
la app.

La segunda es un extra sobre la primera: si falla el push, el aviso sigue ahí al
abrir la app.

El envío lo hace el móvil del entrenador llamando a la API de Expo con los
tokens que lee de Firestore, sin servidor de por medio. Es lo que permite que
todo esto viva en el plan gratuito de Firebase. El precio es que el entrenador
de un equipo puede leer los tokens de su equipo — un token de Expo no sirve para
leer nada, solo para mandarle una notificación a ese aparato. Para cerrarlo del
todo habría que mover el envío a una Cloud Function (plan Blaze) y quitar
`tokensPush` de la regla de lectura.

---

## Comandos

```bash
npm start                  # arrancar en desarrollo
npm run tipos              # comprobar tipos (TypeScript)
npm run pruebas:reglas     # probar firestore.rules en el emulador
npm run assets             # regenerar los iconos desde el escudo
npm run reglas:desplegar   # subir reglas e índices a Firebase
```

Las pruebas de reglas necesitan Java. `firebase-tools` está fijado a la v13
porque la v14 exige JDK 21; para desplegar vale cualquiera.

---

## Publicar en las tiendas

### Antes de la primera build

```bash
npm install -g eas-cli
eas login
eas init          # rellena extra.eas.projectId en app.json
```

Ese `projectId` es el que usan las notificaciones: mientras siga el
`00000000-...` de partida, la app avisa de que no puede registrar el token.

Hay que poner las variables de `.env.local` también en EAS, o la build saldrá
sin Firebase:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..."
# ...y así con las seis
```

### Probar en un móvil de verdad

```bash
eas build --profile development --platform android
eas build --profile preview --platform all       # APK / TestFlight
```

### Producción

```bash
eas build --profile production --platform all
eas submit --profile production --platform android
eas submit --profile production --platform ios
```

`eas.json` deja el envío a Google Play como **borrador en el canal interno**: no
publica nada solo. Antes de usar `eas submit` hay que rellenar en ese fichero el
`appleId`, `ascAppId` y `appleTeamId`, y dejar la cuenta de servicio de Google
Play en `secretos/google-play.json` (ignorado por git).

### Lo que piden las tiendas

Ya resuelto en el repositorio:

- Identificador `com.cvoviedo` en las dos plataformas.
- Iconos, icono adaptativo, monocromo y pantalla de arranque, generados del
  escudo del club con `npm run assets`.
- Política de privacidad dentro de la app (*Más → Privacidad*).
- Permisos justificados: solo notificaciones y galería, esta última pedida en el
  momento de elegir la foto y con explicación en castellano.
- `usesNonExemptEncryption: false` — la app no lleva criptografía propia, así que
  se salta el trámite de exportación de Apple.
- Objetivos táctiles de 46 pt y roles de accesibilidad en los controles.

Queda por hacer, y no se puede hacer desde aquí:

- **Cuenta de revisor.** Las dos tiendas rechazan las apps con login sin una
  cuenta de prueba. Hay que crear un jugador de mentira con un equipo, un par de
  avisos y algo de chat, y dar sus credenciales en la ficha de revisión.
  Conviene explicar ahí que es una app **interna de un club** y que por eso no
  hay registro público — es el motivo de rechazo más habitual en este tipo de
  apps (guideline 4.3 y 5.1.1 de Apple).
- **Capturas de pantalla** para cada tamaño que pide cada tienda.
- **Declaración de datos**: App Privacy en App Store Connect y el formulario de
  seguridad de datos en Play Console. Lo que se recoge está listado en
  `src/app/privacidad.tsx`; hay que declarar correo, nombre, mensajes del chat e
  identificador de dispositivo, todo *no usado para seguimiento*.
- **Clasificación por edad**: la app tiene chat entre usuarios, así que en Play
  Console hay que declararlo (sube la clasificación) y en App Store subir a 12+.
- **Cuenta de desarrollador**: 25 $ una vez en Google, 99 $/año en Apple.

---

## Decisiones que no se ven en el código

- **Modo claro y ya.** Mantener una segunda paleta multiplica por dos cada
  pantalla que se toque después, y un club no lo necesita.
- **Archivar, no borrar.** Ni equipos ni usuarios se borran: se archivan o se
  desactivan. Borrar un equipo se lleva por delante su chat, sus avisos y su
  horario, o sea la temporada entera.
- **Un solo chat por equipo, sin privados.** Es lo que se pidió, y los privados
  entre menores en una app del club son un problema de moderación que nadie
  quiere.
- **Los partidos no se editan a mano.** Vienen de la federación y se corrigen
  solos cuando allí cambian un horario. Lo que no sale del calendario oficial
  —amistosos, torneos— va en «citas sueltas».
