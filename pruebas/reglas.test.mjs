// ==========================================================================
// Pruebas de las reglas de Firestore.
//
//   npm run pruebas:reglas
//
// Las reglas son lo único que de verdad separa a un jugador de los datos del
// club entero, y son código que no se ejecuta en desarrollo: se puede desplegar
// una regla rota y no enterarse hasta que alguien lee lo que no debe. De ahí
// estas pruebas.
//
// Corren contra el emulador de Firestore, que arranca solo con
// `firebase emulators:exec`. No tocan el proyecto de verdad ni hacen falta
// credenciales.
//
// `withSecurityRulesDisabled` es la puerta de atrás del emulador para sembrar
// datos: sirve para dejar puestos los usuarios y los equipos de partida sin
// tener que pasar por unas reglas que precisamente exigen que ya existan.
// ==========================================================================

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, deleteDoc } from 'firebase/firestore'

const ADMIN = 'uid-admin'
const ENTRENADOR = 'uid-entrenador'
const JUGADOR = 'uid-jugador'
const OTRO = 'uid-otro-equipo'
const BAJA = 'uid-de-baja'
const COLADO = 'uid-sin-ficha'
// Juega en un equipo y entrena en otro: el caso que antes no se podía modelar.
const MIXTO = 'uid-mixto'
// Ficha con el campo `rol` en singular, como las de antes del cambio y como la
// primera de admin, que se crea a mano en la consola.
const LEGADO = 'uid-legado'

const EQUIPO = 'equipo-cadete-a'
const AJENO = 'equipo-infantil-b'

let entorno

before(async () => {
  entorno = await initializeTestEnvironment({
    projectId: 'cvo-pruebas',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })

  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()

    await setDoc(doc(db, 'usuarios', ADMIN), {
      nombre: 'Ana Admin', email: 'ana@cvo.es', roles: ['admin'],
      equipos: [], activo: true, tokensPush: [],
    })
    await setDoc(doc(db, 'usuarios', LEGADO), {
      nombre: 'Luis Legado', email: 'luis@cvo.es', rol: 'admin',
      equipos: [], activo: true, tokensPush: [],
    })
    await setDoc(doc(db, 'usuarios', MIXTO), {
      nombre: 'Marta Mixta', email: 'marta@cvo.es', roles: ['jugador', 'entrenador'],
      equipos: [EQUIPO, AJENO], activo: true, tokensPush: [],
    })
    await setDoc(doc(db, 'usuarios', ENTRENADOR), {
      nombre: 'Edu Entrenador', email: 'edu@cvo.es', roles: ['entrenador'],
      equipos: [EQUIPO], activo: true, tokensPush: [],
    })
    await setDoc(doc(db, 'usuarios', JUGADOR), {
      nombre: 'Jimena Jugadora', email: 'jimena@cvo.es', roles: ['jugador'],
      equipos: [EQUIPO], activo: true, tokensPush: [], dorsal: '7',
    })
    await setDoc(doc(db, 'usuarios', OTRO), {
      nombre: 'Olga Otra', email: 'olga@cvo.es', roles: ['jugador'],
      equipos: [AJENO], activo: true, tokensPush: [],
    })
    await setDoc(doc(db, 'usuarios', BAJA), {
      nombre: 'Berta Baja', email: 'berta@cvo.es', roles: ['jugador'],
      equipos: [EQUIPO], activo: false, tokensPush: [],
    })

    await setDoc(doc(db, 'equipos', EQUIPO), {
      nombre: 'Cadete Femenino A', categoria: 'Cadete', genero: 'Femenino',
      temporada: '2026/27', claveCompeticion: null,
      entrenadores: [ENTRENADOR], jugadores: [JUGADOR, BAJA, MIXTO], archivado: false,
    })
    await setDoc(doc(db, 'equipos', AJENO), {
      nombre: 'Infantil Masculino B', categoria: 'Infantil', genero: 'Masculino',
      temporada: '2026/27', claveCompeticion: null,
      entrenadores: [MIXTO], jugadores: [OTRO], archivado: false,
    })

    await setDoc(doc(db, 'equipos', EQUIPO, 'mensajes', 'm1'), {
      autor: JUGADOR, autorNombre: 'Jimena', autorRol: 'jugador', texto: 'hola',
    })
    await setDoc(doc(db, 'equipos', EQUIPO, 'avisos', 'a1'), {
      titulo: 'Partido el sábado', cuerpo: 'A las 17:00', tipo: 'partido',
      autor: ENTRENADOR, autorNombre: 'Edu',
      requiereConfirmacion: true, confirmados: [], rechazados: [], leidoPor: [ENTRENADOR],
    })
    await setDoc(doc(db, 'equipos', EQUIPO, 'entrenamientos', 'e1'), {
      dia: 2, inicio: '20:00', fin: '21:30', lugar: 'Pumarín', activo: true,
    })
  })
})

after(async () => {
  await entorno?.cleanup()
})

const como = (uid) => entorno.authenticatedContext(uid).firestore()
const sinCuenta = () => entorno.unauthenticatedContext().firestore()

// ==========================================================================

describe('la puerta: sin ficha no se entra', () => {
  it('sin iniciar sesión no se lee nada', async () => {
    await assertFails(getDoc(doc(sinCuenta(), 'equipos', EQUIPO)))
  })

  it('una cuenta de Auth sin ficha de club no puede leer nada', async () => {
    // Este es el caso que sostiene el «no hay registro abierto»: alguien puede
    // crearse una cuenta llamando al SDK, pero se queda fuera.
    await assertFails(getDoc(doc(como(COLADO), 'equipos', EQUIPO)))
    await assertFails(getDoc(doc(como(COLADO), 'usuarios', JUGADOR)))
  })

  it('una cuenta sin ficha tampoco puede fabricarse la suya', async () => {
    await assertFails(
      setDoc(doc(como(COLADO), 'usuarios', COLADO), {
        nombre: 'Yo Mismo', email: 'yo@ejemplo.com', roles: ['admin'],
        equipos: [], activo: true, tokensPush: [],
      }),
    )
  })

  it('quien está de baja pierde el acceso sin perder el histórico', async () => {
    await assertFails(getDoc(doc(como(BAJA), 'equipos', EQUIPO)))
    await assertFails(getDoc(doc(como(BAJA), 'equipos', EQUIPO, 'mensajes', 'm1')))
  })
})

describe('usuarios', () => {
  it('cada cual ve su ficha', async () => {
    await assertSucceeds(getDoc(doc(como(JUGADOR), 'usuarios', JUGADOR)))
  })

  it('se ve la ficha de un compañero de equipo', async () => {
    await assertSucceeds(getDoc(doc(como(JUGADOR), 'usuarios', ENTRENADOR)))
  })

  it('NO se ve la ficha de alguien de otro equipo', async () => {
    await assertFails(getDoc(doc(como(JUGADOR), 'usuarios', OTRO)))
  })

  it('el admin ve a cualquiera', async () => {
    await assertSucceeds(getDoc(doc(como(ADMIN), 'usuarios', OTRO)))
  })

  it('un jugador puede apuntar el token de su móvil', async () => {
    await assertSucceeds(
      updateDoc(doc(como(JUGADOR), 'usuarios', JUGADOR), {
        tokensPush: ['ExponentPushToken[abc]'],
      }),
    )
  })

  it('un jugador NO puede ascenderse a admin', async () => {
    await assertFails(updateDoc(doc(como(JUGADOR), 'usuarios', JUGADOR), { rol: 'admin' }))
  })

  it('un jugador NO puede cambiarse de equipo por su cuenta', async () => {
    await assertFails(updateDoc(doc(como(JUGADOR), 'usuarios', JUGADOR), { equipos: [AJENO] }))
  })

  it('un jugador NO puede tocar la ficha de otro', async () => {
    await assertFails(updateDoc(doc(como(JUGADOR), 'usuarios', ENTRENADOR), { dorsal: '99' }))
  })

  it('un entrenador NO puede dar de alta cuentas', async () => {
    await assertFails(
      setDoc(doc(como(ENTRENADOR), 'usuarios', 'uid-nuevo'), {
        nombre: 'Nuevo', email: 'n@cvo.es', roles: ['jugador'],
        equipos: [], activo: true, tokensPush: [],
      }),
    )
  })

  it('el admin da de alta cuentas', async () => {
    await assertSucceeds(
      setDoc(doc(como(ADMIN), 'usuarios', 'uid-alta'), {
        nombre: 'Recién Llegada', email: 'nueva@cvo.es', roles: ['jugador'],
        equipos: [EQUIPO], activo: true, tokensPush: [],
      }),
    )
  })

  it('el admin puede desactivar a alguien, pero no borrarlo', async () => {
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'usuarios', OTRO), { activo: false }))
    await assertFails(deleteDoc(doc(como(ADMIN), 'usuarios', OTRO)))
  })

  it('un admin no puede quitarse a sí mismo el rol de admin', async () => {
    // Que lo haga otro: si no, el club se queda sin nadie que administre.
    await assertFails(updateDoc(doc(como(ADMIN), 'usuarios', ADMIN), { roles: ['jugador'] }))
  })

  it('pero sí puede cambiarse los demás roles', async () => {
    // Lo que se protege es la llave del club, no el resto de la ficha: un
    // admin puede apuntarse como jugador o dejar de serlo.
    await assertSucceeds(
      updateDoc(doc(como(ADMIN), 'usuarios', ADMIN), { roles: ['admin', 'jugador'] }),
    )
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'usuarios', ADMIN), { roles: ['admin'] }))
  })

  it('una cuenta sin ningún rol no se puede crear', async () => {
    await assertFails(
      setDoc(doc(como(ADMIN), 'usuarios', 'uid-sin-roles'), {
        nombre: 'Nadie', email: 'nadie@cvo.es', roles: [],
        equipos: [], activo: true, tokensPush: [],
      }),
    )
  })

  it('un rol inventado no cuela', async () => {
    await assertFails(
      setDoc(doc(como(ADMIN), 'usuarios', 'uid-rol-raro'), {
        nombre: 'Listo', email: 'listo@cvo.es', roles: ['superadmin'],
        equipos: [], activo: true, tokensPush: [],
      }),
    )
  })
})

describe('equipos', () => {
  it('se ve el equipo propio', async () => {
    await assertSucceeds(getDoc(doc(como(JUGADOR), 'equipos', EQUIPO)))
  })

  it('NO se ve un equipo ajeno', async () => {
    await assertFails(getDoc(doc(como(JUGADOR), 'equipos', AJENO)))
  })

  it('el admin ve todos', async () => {
    await assertSucceeds(getDoc(doc(como(ADMIN), 'equipos', AJENO)))
  })

  it('un entrenador NO puede crear equipos', async () => {
    await assertFails(
      setDoc(doc(como(ENTRENADOR), 'equipos', 'inventado'), {
        nombre: 'Mío', categoria: 'Cadete', genero: 'Mixto', temporada: '2026/27',
        claveCompeticion: null, entrenadores: [ENTRENADOR], jugadores: [], archivado: false,
      }),
    )
  })

  it('un entrenador NO puede meterse jugadores en su equipo', async () => {
    // Cambiar la plantilla es de administración: si no, un entrenador podría
    // darse acceso al chat de cualquiera metiéndolo en su equipo.
    await assertFails(
      updateDoc(doc(como(ENTRENADOR), 'equipos', EQUIPO), { jugadores: [JUGADOR, OTRO] }),
    )
  })

  it('el admin crea y modifica equipos, pero no los borra', async () => {
    await assertSucceeds(
      setDoc(doc(como(ADMIN), 'equipos', 'equipo-nuevo'), {
        nombre: 'Juvenil Femenino', categoria: 'Juvenil', genero: 'Femenino',
        temporada: '2026/27', claveCompeticion: null,
        entrenadores: [], jugadores: [], archivado: false,
      }),
    )
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'equipos', EQUIPO), { archivado: true }))
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'equipos', EQUIPO), { archivado: false }))
    await assertFails(deleteDoc(doc(como(ADMIN), 'equipos', 'equipo-nuevo')))
  })
})

describe('chat', () => {
  it('un jugador lee y escribe en el chat de su equipo', async () => {
    await assertSucceeds(getDoc(doc(como(JUGADOR), 'equipos', EQUIPO, 'mensajes', 'm1')))
    await assertSucceeds(
      addDoc(collection(como(JUGADOR), 'equipos', EQUIPO, 'mensajes'), {
        autor: JUGADOR, autorNombre: 'Jimena', autorRol: 'jugador', texto: '¿a qué hora?',
      }),
    )
  })

  it('NO se puede escribir en el chat de otro equipo', async () => {
    await assertFails(
      addDoc(collection(como(JUGADOR), 'equipos', AJENO, 'mensajes'), {
        autor: JUGADOR, autorNombre: 'Jimena', autorRol: 'jugador', texto: 'hola',
      }),
    )
  })

  it('NO se puede escribir en nombre de otro', async () => {
    await assertFails(
      addDoc(collection(como(JUGADOR), 'equipos', EQUIPO, 'mensajes'), {
        autor: ENTRENADOR, autorNombre: 'Edu', autorRol: 'entrenador', texto: 'os libro hoy',
      }),
    )
  })

  it('un mensaje no se edita', async () => {
    await assertFails(
      updateDoc(doc(como(JUGADOR), 'equipos', EQUIPO, 'mensajes', 'm1'), { texto: 'otra cosa' }),
    )
  })

  it('un mensaje vacío o larguísimo se rechaza', async () => {
    const chat = collection(como(JUGADOR), 'equipos', EQUIPO, 'mensajes')
    const base = { autor: JUGADOR, autorNombre: 'Jimena', autorRol: 'jugador' }
    await assertFails(addDoc(chat, { ...base, texto: '' }))
    await assertFails(addDoc(chat, { ...base, texto: 'x'.repeat(1001) }))
  })

  it('el entrenador puede borrar un mensaje de su equipo', async () => {
    await assertSucceeds(deleteDoc(doc(como(ENTRENADOR), 'equipos', EQUIPO, 'mensajes', 'm1')))
  })
})

describe('avisos', () => {
  it('el entrenador manda avisos a su equipo', async () => {
    await assertSucceeds(
      addDoc(collection(como(ENTRENADOR), 'equipos', EQUIPO, 'avisos'), {
        titulo: 'Cambio de hora', cuerpo: 'A las 18:00', tipo: 'general',
        autor: ENTRENADOR, autorNombre: 'Edu',
        requiereConfirmacion: false, confirmados: [], rechazados: [], leidoPor: [ENTRENADOR],
      }),
    )
  })

  it('un jugador NO puede mandar avisos', async () => {
    await assertFails(
      addDoc(collection(como(JUGADOR), 'equipos', EQUIPO, 'avisos'), {
        titulo: 'Mañana no hay entreno', cuerpo: '', tipo: 'urgente',
        autor: JUGADOR, autorNombre: 'Jimena',
        requiereConfirmacion: false, confirmados: [], rechazados: [], leidoPor: [],
      }),
    )
  })

  it('un jugador puede contestar a la convocatoria', async () => {
    await assertSucceeds(
      updateDoc(doc(como(JUGADOR), 'equipos', EQUIPO, 'avisos', 'a1'), {
        confirmados: [JUGADOR],
        leidoPor: [ENTRENADOR, JUGADOR],
      }),
    )
  })

  it('un jugador NO puede reescribir el aviso al contestarlo', async () => {
    await assertFails(
      updateDoc(doc(como(JUGADOR), 'equipos', EQUIPO, 'avisos', 'a1'), {
        confirmados: [JUGADOR],
        titulo: 'No hay partido',
      }),
    )
  })

  it('el entrenador de OTRO equipo no manda avisos aquí', async () => {
    await assertFails(
      addDoc(collection(como(OTRO), 'equipos', EQUIPO, 'avisos'), {
        titulo: 'Colado', cuerpo: '', tipo: 'general',
        autor: OTRO, autorNombre: 'Olga',
        requiereConfirmacion: false, confirmados: [], rechazados: [], leidoPor: [],
      }),
    )
  })
})

describe('horario', () => {
  it('un jugador lo lee pero no lo cambia', async () => {
    await assertSucceeds(getDoc(doc(como(JUGADOR), 'equipos', EQUIPO, 'entrenamientos', 'e1')))
    await assertFails(
      updateDoc(doc(como(JUGADOR), 'equipos', EQUIPO, 'entrenamientos', 'e1'), {
        inicio: '10:00',
      }),
    )
  })

  it('el entrenador lo cambia', async () => {
    await assertSucceeds(
      updateDoc(doc(como(ENTRENADOR), 'equipos', EQUIPO, 'entrenamientos', 'e1'), {
        inicio: '19:30',
      }),
    )
  })

  it('el admin también', async () => {
    await assertSucceeds(
      addDoc(collection(como(ADMIN), 'equipos', EQUIPO, 'entrenamientos'), {
        dia: 4, inicio: '20:00', fin: '21:30', lugar: 'Pumarín', activo: true,
      }),
    )
  })
})

describe('multirol', () => {
  it('quien juega en un equipo y entrena en otro entra en los dos', async () => {
    await assertSucceeds(getDoc(doc(como(MIXTO), 'equipos', EQUIPO)))
    await assertSucceeds(getDoc(doc(como(MIXTO), 'equipos', AJENO)))
  })

  it('manda avisos SOLO donde entrena', async () => {
    // En AJENO está en la lista de entrenadores: puede.
    await assertSucceeds(
      addDoc(collection(como(MIXTO), 'equipos', AJENO, 'avisos'), {
        titulo: 'Entreno movido', cuerpo: '', tipo: 'general',
        autor: MIXTO, autorNombre: 'Marta',
        requiereConfirmacion: false, confirmados: [], rechazados: [], leidoPor: [],
      }),
    )
    // En EQUIPO solo juega: no puede, aunque su rol de club sea entrenador.
    await assertFails(
      addDoc(collection(como(MIXTO), 'equipos', EQUIPO, 'avisos'), {
        titulo: 'Mando yo', cuerpo: '', tipo: 'general',
        autor: MIXTO, autorNombre: 'Marta',
        requiereConfirmacion: false, confirmados: [], rechazados: [], leidoPor: [],
      }),
    )
  })

  it('toca el horario donde entrena y no donde juega', async () => {
    await assertSucceeds(
      addDoc(collection(como(MIXTO), 'equipos', AJENO, 'entrenamientos'), {
        dia: 3, inicio: '18:00', fin: '19:30', lugar: 'Pumarín', activo: true,
      }),
    )
    await assertFails(
      updateDoc(doc(como(MIXTO), 'equipos', EQUIPO, 'entrenamientos', 'e1'), {
        inicio: '09:00',
      }),
    )
  })

  it('ser entrenador de club no da mando sobre un equipo ajeno', async () => {
    // Edu entrena EQUIPO; en AJENO no está, así que ahí no pinta nada.
    await assertFails(getDoc(doc(como(ENTRENADOR), 'equipos', AJENO)))
  })

  it('las fichas con el campo `rol` en singular siguen valiendo', async () => {
    // La primera ficha de admin se crea a mano en la consola con el campo
    // viejo. Si dejara de valer, el club se quedaría sin quien administre.
    await assertSucceeds(getDoc(doc(como(LEGADO), 'usuarios', OTRO)))
    await assertSucceeds(
      setDoc(doc(como(LEGADO), 'usuarios', 'uid-creado-por-legado'), {
        nombre: 'Creada', email: 'creada@cvo.es', roles: ['jugador'],
        equipos: [], activo: true, tokensPush: [],
      }),
    )
  })
})

describe('colecciones no declaradas', () => {
  it('cualquier otra ruta está cerrada, incluso para un admin', async () => {
    // El `match /{documento=**}` del final. Sin él, una colección nueva creada
    // por descuido nacería abierta a internet.
    await assertFails(setDoc(doc(como(ADMIN), 'loQueSea', 'x'), { a: 1 }))
    await assertFails(getDoc(doc(como(ADMIN), 'loQueSea', 'x')))
  })
})

describe('cordura', () => {
  it('el entorno de pruebas está montado', () => {
    assert.ok(entorno, 'sin entorno no se ha probado nada')
  })
})
