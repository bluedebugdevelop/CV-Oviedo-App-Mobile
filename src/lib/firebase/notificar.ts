// ==========================================================================
// Quién recibe qué notificación, y con qué texto.
//
// Todas las llamadas a Expo Push pasan por aquí. Antes estaba repartido por las
// pantallas y eso llevaba a dos sitios malos: cada pantalla decidía a su manera
// a quién excluir, y el texto de la notificación se escribía donde tocaba el
// formulario en vez de donde se piensa qué va a leer alguien en la pantalla de
// bloqueo.
//
// TRES REGLAS QUE SE REPITEN EN TODAS
//
//   1. A quien lo provoca no se le avisa. Nadie quiere que le suene el móvil
//      por su propio mensaje.
//   2. A quien está de baja tampoco: sigue teniendo tokens guardados, pero ya
//      no es del club.
//   3. Nunca se lanza. Un push que no sale no puede tumbar lo que de verdad
//      importa —el mensaje, el aviso, la noticia— que ya está guardado. Se
//      devuelve cuántos salieron y quien llama decide si lo cuenta.
//
// EL LÍMITE DE ESTE DISEÑO
// El envío lo hace el móvil de quien actúa (ver push.ts). Eso significa que si
// el entrenador pierde la cobertura justo al mandar el aviso, el aviso queda
// guardado pero la notificación no sale. Es el precio de no tener servidor, y
// se asume porque el aviso sigue estando al abrir la app. Los cambios del
// calendario federado, que no los provoca ningún móvil, van por otro camino:
// ver `tareas/calendario.ts`.
// ==========================================================================

import { CANALES, enviarPush } from '../push'
import type { Equipo, Usuario } from './modelo'

/** Los tokens de quien deba recibir: activos y distintos de quien lo provoca. */
function destinatarios(gente: Usuario[], excepto: string): string[] {
  return gente
    .filter((u) => u.activo && u.uid !== excepto)
    .flatMap((u) => u.tokensPush)
}

/** Recorta un texto para que quepa en la pantalla de bloqueo sin cortarse feo. */
function resumir(texto: string, tope = 140): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  if (limpio.length <= tope) return limpio
  return `${limpio.slice(0, tope - 1).trimEnd()}…`
}

/** Solo el nombre de pila: en una notificación no cabe el apellido. */
const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] || nombre

// --- chat -----------------------------------------------------------------

/**
 * Mensaje nuevo en el chat de un equipo.
 *
 * El título lleva el equipo y el cuerpo empieza por quién escribe, que es como
 * se lee un grupo: «Cadete Femenino A — Lucía: ¿alguien lleva balones?».
 *
 * El `hilo` agrupa todos los mensajes de ese equipo en una sola tarjeta, para
 * que una conversación de veinte mensajes no deje veinte notificaciones. Y el
 * dato `tipo: 'chat'` es lo que mira el manejador para NO hacerla sonar si esa
 * persona tiene ese mismo chat abierto (ver lib/foco.ts).
 */
export function avisarMensaje(
  equipo: Equipo,
  plantilla: Usuario[],
  autor: { uid: string; nombre: string },
  texto: string,
): Promise<number> {
  return enviarPush(destinatarios(plantilla, autor.uid), {
    titulo: equipo.nombre,
    cuerpo: `${primerNombre(autor.nombre)}: ${resumir(texto)}`,
    canal: CANALES.chat,
    hilo: `chat-${equipo.id}`,
    datos: { tipo: 'chat', equipoId: equipo.id },
  })
}

// --- avisos ---------------------------------------------------------------

export function avisarAviso(
  equipo: Equipo,
  plantilla: Usuario[],
  autor: { uid: string },
  aviso: { titulo: string; cuerpo: string },
): Promise<number> {
  return enviarPush(destinatarios(plantilla, autor.uid), {
    titulo: `${equipo.nombre}: ${aviso.titulo}`,
    cuerpo: resumir(aviso.cuerpo) || 'Nuevo aviso de tu entrenador',
    canal: CANALES.avisos,
    datos: { tipo: 'aviso', equipoId: equipo.id },
  })
}

// --- horarios y citas -----------------------------------------------------

/**
 * Cambios en el horario del equipo: un entrenamiento nuevo, uno que se quita,
 * un amistoso apuntado.
 *
 * Va por el canal de calendario y no por el de avisos porque no es lo mismo:
 * un cambio de horario tiene que llegar igual de fuerte, pero quien quiera
 * puede regularlos por separado desde los ajustes del móvil.
 */
export function avisarHorario(
  equipo: Equipo,
  plantilla: Usuario[],
  autor: { uid: string },
  detalle: string,
): Promise<number> {
  return enviarPush(destinatarios(plantilla, autor.uid), {
    titulo: `${equipo.nombre}: cambio de horario`,
    cuerpo: resumir(detalle),
    canal: CANALES.calendario,
    hilo: `horario-${equipo.id}`,
    datos: { tipo: 'horario', equipoId: equipo.id },
  })
}

// --- noticias del club ----------------------------------------------------

/**
 * Noticia nueva en la web del club. Esta va a TODO el club, no a un equipo.
 *
 * Solo la puede disparar un admin, porque es el único que puede leer el censo
 * entero de usuarios —y por tanto sus tokens—. Las reglas ya lo garantizan; si
 * lo intentara otro, la consulta fallaría antes de llegar aquí.
 */
export function avisarNoticia(
  todos: Usuario[],
  autorUid: string,
  noticia: { titulo: string; resumen: string },
): Promise<number> {
  return enviarPush(destinatarios(todos, autorUid), {
    titulo: 'Club Voleibol Oviedo',
    cuerpo: resumir(noticia.resumen ? `${noticia.titulo} — ${noticia.resumen}` : noticia.titulo),
    canal: CANALES.club,
    hilo: 'noticias-club',
    datos: { tipo: 'noticia' },
  })
}
