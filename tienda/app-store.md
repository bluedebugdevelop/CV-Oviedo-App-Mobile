# Ficha de la App Store — CV Oviedo

Textos listos para pegar en App Store Connect. Los límites son de Apple y están
comprobados con `npm run tienda:textos`.

Los bloques van en el mismo orden que los comprueba el script: nombre,
subtítulo, texto promocional, descripción y palabras clave.

---

## Nombre (máx. 30)

```
CV Oviedo
```

---

## Subtítulo (máx. 30)

```
La app de tu equipo del club
```

---

## Texto promocional (máx. 170)

Es el único campo que se puede cambiar sin subir una versión nueva: aquí va lo
de esta temporada, no lo permanente.

```
La aplicación oficial del Club Voleibol Oviedo. Calendario y resultados de tu equipo, avisos del entrenador y el chat del grupo, sin salir de una sola app.
```

---

## Descripción (máx. 4000)

```
La aplicación oficial del Club Voleibol Oviedo, para que cada equipo tenga en el móvil lo que necesita saber: cuándo se juega, dónde se entrena y qué ha dicho el entrenador.

Está pensada para la gente del club —jugadoras, jugadores, entrenadores y junta directiva— y sustituye a los grupos de mensajería donde los avisos importantes se perdían entre conversaciones.


QUÉ ENCUENTRAS DENTRO

• Calendario y resultados
Los partidos de tu equipo tal y como los publican la Federación de Voleibol del Principado de Asturias y la Real Federación Española de Voleibol. Próximos encuentros, resultados con sus parciales y clasificación actualizada de tu grupo.

• Horarios de entrenamiento
El horario semanal de tu equipo, siempre a mano. Si el entrenador cambia una hora o suspende una sesión, te llega el aviso.

• Chat del equipo
Un grupo por equipo, con el entrenador dentro. Para lo del día a día: quién lleva los balones, a qué hora se sale, un cambio de última hora.

• Avisos del entrenador
Lo que tiene que llegar sí o sí, separado del chat para que no se pierda. Las convocatorias pueden pedir confirmación: dices si vas o no, y el entrenador ve de un vistazo quién falta por contestar.

• Noticias del club
Lo que se publica en clubvoleiboloviedo.com, sin salir de la aplicación.

• Notificaciones
Mensajes nuevos, avisos, cambios de horario y noticias del club. Se pueden ajustar por separado desde los ajustes del teléfono: puedes silenciar el chat sin perderte una convocatoria.


PARA ENTRENADORES

Organiza a tu equipo desde el móvil: manda avisos con confirmación de asistencia, pon el horario semanal de entrenamientos y apunta amistosos o torneos que no salen en el calendario federado.

Una misma persona puede llevar varios equipos, y entrenar en uno y jugar en otro. La aplicación enseña a cada quien lo que le toca según sus equipos y sus funciones.


PARA EL CLUB

La junta gestiona los equipos y las cuentas, y publica en la web del club —noticias, patrocinadores, fichas de equipo y fotos— sin necesitar un ordenador.


CÓMO SE ENTRA

Esta es una aplicación interna del club, no un servicio abierto. No hay registro: las cuentas las crea el club y se entregan a cada persona con su correo y su contraseña.

Si eres del Club Voleibol Oviedo y aún no tienes cuenta, pídesela a tu entrenador o a la junta. Si no eres del club, la aplicación no te será de utilidad.


PRIVACIDAD

Solo se guarda lo necesario para organizar los equipos: nombre, correo, equipo al que perteneces y, si juegas, dorsal y posición. No se pide la ubicación, ni la agenda, ni el micrófono, ni la cámara.

No hay publicidad ni rastreo de terceros, y nada de lo que hagas dentro se comparte con anunciantes. Los datos se guardan en servidores de la Unión Europea.

En el caso de los menores de 14 años, el consentimiento lo da su madre, su padre o su tutor, que es también quien puede pedir la corrección o el borrado de los datos.

Puedes leer la política completa dentro de la aplicación, en Más → Privacidad, y en clubvoleiboloviedo.com


Club Voleibol Oviedo
clubvoleiboloviedo.com
```

---

## Palabras clave (máx. 100)

Separadas por comas y sin espacios: el espacio cuenta como carácter y Apple ya
separa por la coma. Aquí no se repiten ni el nombre de la aplicación ni el
subtítulo, que Apple ya indexa por su cuenta.

```
voleibol,volei,club,equipo,entrenador,convocatoria,calendario,partidos,clasificacion,avisos,oviedo
```

---

## Notas para quien rellene la ficha

- **Categoría**: Deportes (primaria). Secundaria: Estilo de vida.
- **Clasificación por edades**: hay que declarar **comunicación entre usuarios**
  (el chat de equipo). Sube la edad recomendada, es correcto, y ocultarlo es
  motivo de retirada.
- **Cuenta de demostración (obligatoria)**: la guía 2.1 exige credenciales para
  revisar una aplicación con inicio de sesión. Hay que crear un jugador de
  mentira con equipo, algún aviso y algo de chat, y explicar en las notas que es
  una aplicación **interna de un club** y que por eso no hay registro público.
- **Privacidad de la app**: se recogen nombre, correo, mensajes del chat e
  identificador de dispositivo para las notificaciones. Todo va **vinculado a la
  identidad** para que funcione el producto, **no se comparte con terceros** y
  **no se usa para seguimiento** (no hay ATT que pedir).
- **Derecho de supresión**: hay que dar la vía de borrado de cuenta. La del
  club, la misma que la política de privacidad.
- **Capturas**: se generan con `npm run capturas` y salen a
  `tienda/capturas/iphone` (1284×2778) y `tienda/capturas/ipad` (2048×2732).
- **URL de privacidad**: clubvoleiboloviedo.com/privacidad — es obligatoria y
  tiene que estar publicada antes de enviar.
