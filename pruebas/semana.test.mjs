// ==========================================================================
// Pruebas del planning semanal.
//
//   npm run pruebas:semana
//
// Se prueba `construirSemana` y no la pantalla: la pantalla es una tira de
// botones y una lista, y lo que de verdad se puede romper —y romper en
// silencio— es el reparto por días. Un entrenamiento colocado en el día que no
// es no da ningún error: simplemente aparece el martes en vez del miércoles, y
// eso solo lo nota alguien que se planta en el pabellón el día equivocado.
//
// Los casos de aquí no son inventados: son los tres sitios donde esto se
// tuerce. El domingo (que en `getDay()` es 0 y parece el principio de la
// semana), los partidos sin hora que la federación publica a medianoche, y los
// entrenamientos suspendidos.
// ==========================================================================

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { construirSemana, lunesDe } from '../src/lib/semana.ts'

const SEDE = 'Polideportivo José Manuel Fuente (Colloto)'

/** Un lunes de verdad: 14 de septiembre de 2026. */
const LUNES = new Date(2026, 8, 14)

const entrenamiento = (id, dia, inicio, fin, activo = true) => ({
  id,
  dia,
  inicio,
  fin,
  lugar: SEDE,
  notas: '',
  activo,
})

const equipo = (extra = {}) => ({
  id: 'eq-sm2',
  nombre: 'Superliga 2 Masculina',
  claveCompeticion: null,
  entrenamientos: [],
  eventos: [],
  ...extra,
})

describe('lunesDe', () => {
  it('un lunes se devuelve a sí mismo', () => {
    assert.equal(lunesDe(new Date(2026, 8, 14)).getDate(), 14)
  })

  it('el miércoles retrocede al lunes', () => {
    assert.equal(lunesDe(new Date(2026, 8, 16)).getDate(), 14)
  })

  it('EL DOMINGO retrocede seis días, no cero', () => {
    /* El caso que justifica que exista esta función.

       `getDay()` devuelve 0 el domingo, así que restarle su propio valor lo
       deja donde está y la semana arrancaría EN domingo. El partido del sábado
       anterior se quedaría fuera del planning y el domingo saldría como primer
       día de la semana siguiente. */
    assert.equal(lunesDe(new Date(2026, 8, 20)).getDate(), 14)
  })

  it('cruza el cambio de mes hacia atrás', () => {
    // Jueves 1 de octubre de 2026 -> lunes 28 de septiembre.
    const lunes = lunesDe(new Date(2026, 9, 1))
    assert.equal(lunes.getMonth(), 8)
    assert.equal(lunes.getDate(), 28)
  })

  it('la hora no cuenta: siempre a medianoche', () => {
    const lunes = lunesDe(new Date(2026, 8, 16, 23, 45))
    assert.equal(lunes.getHours(), 0)
    assert.equal(lunes.getMinutes(), 0)
  })
})

describe('construirSemana: entrenamientos', () => {
  it('devuelve siete días, de lunes a domingo', () => {
    const dias = construirSemana(LUNES, [], {})
    assert.equal(dias.length, 7)
    assert.equal(dias[0].fecha.getDay(), 1)
    assert.equal(dias[6].fecha.getDay(), 0)
  })

  it('coloca cada entrenamiento en su día de la semana', () => {
    // El horario de verdad de la Superliga 2: lunes, miércoles y jueves.
    const dias = construirSemana(
      LUNES,
      [
        equipo({
          entrenamientos: [
            entrenamiento('a', 1, '20:30', '22:30'),
            entrenamiento('b', 3, '20:30', '22:30'),
            entrenamiento('c', 4, '20:30', '22:30'),
          ],
        }),
      ],
      {},
    )

    assert.equal(dias[0].citas.length, 1, 'lunes')
    assert.equal(dias[1].citas.length, 0, 'martes vacío')
    assert.equal(dias[2].citas.length, 1, 'miércoles')
    assert.equal(dias[3].citas.length, 1, 'jueves')
    assert.equal(dias[4].citas.length, 0, 'viernes vacío')

    assert.equal(dias[0].citas[0].inicio.getHours(), 20)
    assert.equal(dias[0].citas[0].inicio.getMinutes(), 30)
    assert.equal(dias[0].citas[0].fin.getHours(), 22)
    assert.equal(dias[0].citas[0].lugar, SEDE)
  })

  it('un entrenamiento suspendido no se pinta', () => {
    const dias = construirSemana(
      LUNES,
      [equipo({ entrenamientos: [entrenamiento('a', 1, '20:30', '22:30', false)] })],
      {},
    )
    assert.equal(dias[0].citas.length, 0)
  })

  it('junta los entrenamientos de DOS equipos en el mismo día', () => {
    // Quien dobla categoría: es el caso que no se veía en ninguna pantalla.
    const dias = construirSemana(
      LUNES,
      [
        equipo({ id: 'a', nombre: 'Juvenil Masculino', entrenamientos: [entrenamiento('x', 1, '19:15', '20:30')] }),
        equipo({ id: 'b', nombre: 'Superliga 2 Masculina', entrenamientos: [entrenamiento('y', 1, '20:30', '22:30')] }),
      ],
      {},
    )

    assert.equal(dias[0].citas.length, 2)
    // Y en orden de reloj, no en el orden en que llegaron los equipos.
    assert.equal(dias[0].citas[0].equipoNombre, 'Juvenil Masculino')
    assert.equal(dias[0].citas[1].equipoNombre, 'Superliga 2 Masculina')
  })

  it('una hora mal escrita se descarta en vez de tumbar la semana', () => {
    const dias = construirSemana(
      LUNES,
      [equipo({ entrenamientos: [entrenamiento('a', 1, '', '22:30'), entrenamiento('b', 1, '25:00', '26:00')] })],
      {},
    )
    assert.equal(dias[0].citas.length, 0)
  })
})

describe('construirSemana: partidos de la federación', () => {
  const competicion = (partidos) => ({
    clave: 'sm2',
    equipoClub: 'CV OVIEDO',
    partidos,
  })

  const partido = (extra) => ({
    id: 'p1',
    iso: '2026-09-19T18:00',
    local: 'CV OVIEDO',
    visitante: 'CV GIJÓN',
    setsLocal: null,
    setsVisitante: null,
    sede: 'Pabellón de Colloto',
    ...extra,
  })

  const conCompeticion = (partidos) =>
    construirSemana(LUNES, [equipo({ claveCompeticion: 'sm2' })], {
      sm2: competicion(partidos),
    })

  it('el partido del sábado cae en sábado', () => {
    const dias = conCompeticion([partido({})])
    assert.equal(dias[5].citas.length, 1)
    assert.equal(dias[5].citas[0].tipo, 'partido')
    assert.equal(dias[5].citas[0].titulo, 'CV GIJÓN')
    assert.equal(dias[5].citas[0].enCasa, true)
  })

  it('jugando fuera, el rival es el local', () => {
    const dias = conCompeticion([partido({ local: 'CV GIJÓN', visitante: 'CV OVIEDO' })])
    assert.equal(dias[5].citas[0].titulo, 'CV GIJÓN')
    assert.equal(dias[5].citas[0].enCasa, false)
  })

  it('ya jugado, el título lleva el resultado', () => {
    const dias = conCompeticion([partido({ setsLocal: 3, setsVisitante: 1 })])
    assert.equal(dias[5].citas[0].titulo, 'CV GIJÓN · 3–1')
  })

  it('SIN HORA se marca como por confirmar, no como las 00:00', () => {
    /* La federación publica el partido antes de fijar la hora y el ISO llega a
       medianoche. Pintarlo como «00:00» hace pensar que se juega de
       madrugada. */
    const dias = conCompeticion([partido({ iso: '2026-09-19T00:00' })])
    assert.equal(dias[5].citas[0].horaPorConfirmar, true)

    const soloFecha = conCompeticion([partido({ iso: '2026-09-19' })])
    assert.equal(soloFecha[5].citas[0].horaPorConfirmar, true)

    const conHora = conCompeticion([partido({ iso: '2026-09-19T18:00' })])
    assert.equal(conHora[5].citas[0].horaPorConfirmar, false)
  })

  it('los partidos de otras semanas no entran', () => {
    const antes = conCompeticion([partido({ iso: '2026-09-13T18:00' })]) // domingo anterior
    const despues = conCompeticion([partido({ iso: '2026-09-21T18:00' })]) // lunes siguiente
    assert.equal(
      antes.reduce((n, d) => n + d.citas.length, 0),
      0,
    )
    assert.equal(
      despues.reduce((n, d) => n + d.citas.length, 0),
      0,
    )
  })

  it('el domingo SÍ entra: es el último día, no el primero del siguiente', () => {
    const dias = conCompeticion([partido({ iso: '2026-09-20T12:00' })])
    assert.equal(dias[6].citas.length, 1)
  })

  it('a la misma hora, el partido va antes que el entrenamiento', () => {
    const dias = construirSemana(
      LUNES,
      [
        equipo({
          claveCompeticion: 'sm2',
          entrenamientos: [entrenamiento('a', 6, '18:00', '19:30')],
        }),
      ],
      { sm2: competicion([partido({ iso: '2026-09-19T18:00' })]) },
    )
    assert.equal(dias[5].citas[0].tipo, 'partido')
    assert.equal(dias[5].citas[1].tipo, 'entrenamiento')
  })
})

describe('construirSemana: citas sueltas', () => {
  it('un amistoso entra como partido y una comida como cita', () => {
    const dias = construirSemana(
      LUNES,
      [
        equipo({
          eventos: [
            { id: 'e1', titulo: 'Amistoso', tipo: 'partido', iso: '2026-09-19T11:00', lugar: 'Gijón', convocados: [] },
            { id: 'e2', titulo: 'Comida de equipo', tipo: 'otro', iso: '2026-09-20T14:00', lugar: '', convocados: [] },
          ],
        }),
      ],
      {},
    )

    assert.equal(dias[5].citas[0].tipo, 'partido')
    assert.equal(dias[5].citas[0].lugar, 'Gijón')
    assert.equal(dias[6].citas[0].tipo, 'cita')
    // Sin lugar escrito no se inventa uno: es `null` y la fila no lo pinta.
    assert.equal(dias[6].citas[0].lugar, null)
  })
})
