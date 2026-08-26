// ==========================================================================
// Qué está mirando ahora mismo quien tiene el móvil en la mano.
//
// Sirve para una sola cosa, pero importante: que no te suene el chat que tienes
// abierto. Es lo que hace WhatsApp y lo que se espera; sin esto, escribir con
// el equipo es una ristra de pitidos por mensajes que estás viendo llegar.
//
// Va en un módulo suelto y no en un contexto de React porque quien lo consulta
// —`setNotificationHandler` de expo-notifications— vive fuera del árbol de
// componentes: se registra una vez al cargar la app y no tiene forma de leer un
// hook.
//
// Es deliberadamente tonto: una variable y dos funciones. El estado de «qué
// pantalla hay delante» ya lo lleva el router; esto solo es el trozo que
// necesita el manejador de notificaciones.
// ==========================================================================

let chatAbierto: string | null = null

/**
 * Apunta que se está mirando el chat de este equipo.
 *
 * La pantalla de chat lo llama al entrar y lo borra al salir (con `null`).
 */
export function ponerChatAbierto(equipoId: string | null) {
  chatAbierto = equipoId
}

/** ¿Se está mirando ahora mismo el chat de este equipo? */
export const mirandoChatDe = (equipoId: unknown) =>
  typeof equipoId === 'string' && chatAbierto === equipoId
