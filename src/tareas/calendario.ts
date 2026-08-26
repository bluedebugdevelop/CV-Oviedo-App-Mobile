// ==========================================================================
// La tarea que vigila el calendario con la app cerrada.
//
// Este fichero SOLO define y registra la tarea. La lógica de qué comparar está
// en `lib/vigilanciaCalendario.ts`, que no sabe nada de tareas ni de
// notificaciones y por eso se puede llamar también a mano desde la app.
//
// IMPORTANTE: se importa desde el _layout raíz, no desde una pantalla. El
// sistema puede arrancar el proceso sin abrir ninguna pantalla —justamente para
// ejecutar la tarea— y `defineTask` tiene que haberse ejecutado ya en ese
// momento. Si esto viviera dentro de una pantalla, la tarea existiría solo
// cuando alguien tuviera esa pantalla delante, que es justo cuando no hace
// falta.
//
// La notificación que sale de aquí es LOCAL: la genera el propio móvil porque
// es él quien descubre el cambio. No pasa por Expo Push ni por el servidor de
// nadie.
// ==========================================================================

import * as BackgroundTask from 'expo-background-task'
import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'

import { CANALES } from '../lib/push'
import { revisarCalendarios, type CambioDetectado } from '../lib/vigilanciaCalendario'

export const TAREA_CALENDARIO = 'cvo-vigilar-calendario'

/**
 * Cada cuánto se querría mirar, en minutos.
 *
 * Es una petición, no una orden. Android lo agrupa con el trabajo de otras apps
 * y suele respetarlo a partir de los 15 minutos; iOS decide por su cuenta según
 * cómo se use la app y puede tardar un día. Seis horas es un término razonable:
 * un cambio de horario se sabe con margen y no se gasta batería mirando algo
 * que cambia dos veces por temporada.
 */
const CADA_MINUTOS = 6 * 60

TaskManager.defineTask(TAREA_CALENDARIO, async () => {
  try {
    const cambios = await revisarCalendarios()
    if (cambios.length === 0) return BackgroundTask.BackgroundTaskResult.Success

    await notificarCambios(cambios)
    return BackgroundTask.BackgroundTaskResult.Success
  } catch {
    // Si falla, el sistema decide si reintenta. No se propaga: una excepción
    // aquí solo consigue que el sistema deje de programar la tarea.
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

/**
 * Enseña los cambios encontrados.
 *
 * Uno solo se cuenta entero; varios se resumen. Cuando la federación mueve una
 * jornada entera puede haber cinco cambios de golpe, y cinco notificaciones
 * seguidas son un motivo para desactivarlas.
 */
async function notificarCambios(cambios: CambioDetectado[]) {
  const contenido =
    cambios.length === 1
      ? { title: `${cambios[0].equipo}: cambio en el calendario`, body: cambios[0].texto }
      : {
          title: 'Cambios en el calendario',
          body: `${cambios.length} partidos han cambiado de fecha, hora o sede. Míralo en la app.`,
        }

  await Notifications.scheduleNotificationAsync({
    content: {
      ...contenido,
      data: { tipo: 'calendario' },
    },
    /* Un segundo en vez de `trigger: null`.

       El canal de Android se declara en el DISPARADOR, no en el contenido, y
       el disparador inmediato —`null`— no tiene dónde ponerlo: la notificación
       saldría por el canal por defecto y se saltaría los ajustes que la
       persona haya puesto para «Horarios y partidos».

       Un intervalo de un segundo sí admite canal y, a efectos prácticos, es
       inmediato. */
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      repeats: false,
      channelId: CANALES.calendario,
    },
  })
}

/**
 * Deja la tarea programada.
 *
 * Se llama en cada arranque a propósito: registrar una tarea ya registrada no
 * hace daño, y así se recupera sola si el sistema la descartó por falta de uso
 * o tras una actualización.
 */
export async function vigilarCalendario(): Promise<boolean> {
  try {
    const estado = await BackgroundTask.getStatusAsync()
    // El usuario puede tener las tareas en segundo plano desactivadas para toda
    // la app desde los ajustes del sistema. No es un error: es su decisión.
    if (estado === BackgroundTask.BackgroundTaskStatus.Restricted) return false

    await BackgroundTask.registerTaskAsync(TAREA_CALENDARIO, {
      minimumInterval: CADA_MINUTOS,
    })
    return true
  } catch {
    return false
  }
}

export async function dejarDeVigilar() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TAREA_CALENDARIO)) {
      await BackgroundTask.unregisterTaskAsync(TAREA_CALENDARIO)
    }
  } catch {
    /* si no estaba, no hay nada que quitar */
  }
}
