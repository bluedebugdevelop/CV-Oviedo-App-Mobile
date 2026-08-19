// ==========================================================================
// Usuarios del club: dar de alta cuentas y gestionarlas.
//
// Esta es la pantalla que sostiene el «nadie se registra solo». Una persona
// existe en la app porque un admin la crea aquí, con su correo y una
// contraseña inicial que se le entrega.
//
// LA CONTRASEÑA
// Se genera sola y se enseña UNA vez, al terminar el alta. No se guarda en
// ningún sitio —ni en Firestore ni en el móvil— porque de una contraseña de
// Firebase no se puede volver atrás: lo que hay allí es su huella. Si se
// pierde, se manda un correo de recuperación y punto.
//
// Se genera sin caracteres que se confundan al copiarlos a mano (nada de l/1,
// O/0), porque esta contraseña se dicta por WhatsApp o se apunta en un papel.
//
// LA BAJA
// Desactivar, no borrar. Borrar la cuenta de Auth desde el móvil no se puede
// (hace falta el Admin SDK), y además dejaría sus mensajes del chat firmados
// por un fantasma. Desactivada, las reglas le cierran la puerta y su histórico
// se queda con nombre.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { Pantalla } from '../../componentes/Pantalla'
import {
  Banda,
  Boton,
  Campo,
  Cargando,
  Etiqueta,
  Franja,
  Interruptor,
  Pildoras,
  Secundario,
  Tarjeta,
  Vacio,
} from '../../componentes/ui'
import { ChipsRoles } from '../../componentes/Roles'
import { useSesion } from '../../contexto/sesion'
import { anadirAEquipo, escucharTodosLosEquipos } from '../../lib/firebase/equipos'
import {
  POSICIONES,
  ROLES,
  esAdmin,
  puedeEntrenar,
  type Equipo,
  type Rol,
  type Usuario,
} from '../../lib/firebase/modelo'
import {
  actualizarUsuario,
  cambiarActivo,
  crearUsuario,
  emailYaUsado,
  escucharTodosLosUsuarios,
} from '../../lib/firebase/usuarios'
import { color, espacio, radio } from '../../tema'

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    return escucharTodosLosUsuarios((lista) => {
      setUsuarios(lista)
      setCargando(false)
    })
  }, [])

  useEffect(() => escucharTodosLosEquipos(setEquipos), [])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return usuarios
    return usuarios.filter(
      (u) => u.nombre.toLowerCase().includes(q) || u.email.includes(q),
    )
  }, [usuarios, busqueda])

  const activos = filtrados.filter((u) => u.activo)
  const inactivos = filtrados.filter((u) => !u.activo)

  return (
    <Pantalla
      ante="Administración"
      titulo="Usuarios"
      atras
      accion={{
        icono: creando ? 'close' : 'person-add',
        etiqueta: creando ? 'Cancelar' : 'Dar de alta',
        alPulsar: () => setCreando((v) => !v),
      }}
    >
      {creando ? (
        <FormularioAlta equipos={equipos} alTerminar={() => setCreando(false)} />
      ) : null}

      {cargando ? (
        <Cargando texto="Cargando usuarios…" />
      ) : usuarios.length === 0 ? (
        <Vacio
          icono="person-add-outline"
          titulo="Sin usuarios"
          texto="Da de alta la primera cuenta para que alguien pueda entrar en la app."
        >
          <Boton icono="person-add" onPress={() => setCreando(true)}>
            Dar de alta
          </Boton>
        </Vacio>
      ) : (
        <>
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar por nombre o correo"
            placeholderTextColor={color.apagado}
            autoCapitalize="none"
            style={e.buscador}
          />

          <Franja titulo={`Activos (${activos.length})`} />
          <View style={{ gap: espacio.sm }}>
            {activos.map((u) => (
              <TarjetaUsuario key={u.uid} usuario={u} equipos={equipos} />
            ))}
          </View>

          {inactivos.length > 0 ? (
            <>
              <Franja titulo={`Desactivados (${inactivos.length})`} />
              <View style={{ gap: espacio.sm }}>
                {inactivos.map((u) => (
                  <TarjetaUsuario key={u.uid} usuario={u} equipos={equipos} />
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </Pantalla>
  )
}

function TarjetaUsuario({ usuario, equipos }: { usuario: Usuario; equipos: Equipo[] }) {
  const { perfil } = useSesion()
  const suyos = equipos.filter((x) => usuario.equipos.includes(x.id))
  const soyYo = usuario.uid === perfil?.uid

  const [editandoRoles, setEditandoRoles] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  /**
   * Cambia un rol de club de esta persona.
   *
   * Se guarda al momento, sin botón de confirmar: es un interruptor y lo que
   * hace se ve en la propia tarjeta. Si las reglas lo rechazan —el caso típico
   * es un admin intentando quitarse a sí mismo el admin— se explica ahí mismo
   * en vez de dejar el interruptor mintiendo.
   */
  async function alternarRol(rol: Rol) {
    const siguientes = usuario.roles.includes(rol)
      ? usuario.roles.filter((r) => r !== rol)
      : [...usuario.roles, rol]

    if (siguientes.length === 0) {
      setFallo('Tiene que quedarle al menos un rol.')
      return
    }

    setFallo(null)
    try {
      await actualizarUsuario(usuario.uid, { roles: siguientes })
    } catch {
      setFallo(
        soyYo && rol === 'admin'
          ? 'No puedes quitarte a ti mismo el rol de administrador. Que lo haga otro.'
          : 'No se pudo guardar el cambio.',
      )
    }
  }

  function alternar() {
    if (soyYo) {
      Alert.alert('No puedes desactivarte', 'Que otro administrador lo haga si hace falta.')
      return
    }
    const desactivar = usuario.activo
    Alert.alert(
      desactivar ? 'Desactivar cuenta' : 'Reactivar cuenta',
      desactivar
        ? `${usuario.nombre} dejará de poder entrar en la app. Sus mensajes y su histórico se quedan.`
        : `${usuario.nombre} volverá a poder entrar con su contraseña de siempre.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: desactivar ? 'Desactivar' : 'Reactivar',
          style: desactivar ? 'destructive' : 'default',
          onPress: () => void cambiarActivo(usuario.uid, !usuario.activo).catch(() => {}),
        },
      ],
    )
  }

  return (
    <Tarjeta style={!usuario.activo ? { opacity: 0.6 } : undefined}>
      <View style={e.usuario}>
        <Pressable
          onPress={() => setEditandoRoles((v) => !v)}
          style={{ flex: 1, gap: 3 }}
          accessibilityRole="button"
          accessibilityLabel={`Cambiar los roles de ${usuario.nombre}`}
        >
          <Text style={e.nombre}>
            {usuario.nombre}
            {soyYo ? ' (tú)' : ''}
          </Text>
          <Text style={e.meta} numberOfLines={1}>
            {usuario.email}
          </Text>
          <View style={e.etiquetas}>
            <ChipsRoles roles={usuario.roles} />
            {suyos.length > 0 ? (
              <Etiqueta>{suyos.map((x) => x.nombre).join(' · ')}</Etiqueta>
            ) : // A un admin sin equipo no se le avisa de nada: administrar el
            // club no requiere estar en ninguna plantilla.
            !esAdmin(usuario) ? (
              <Etiqueta fondo={color.ambarTinte} texto="#8a5a00">
                SIN EQUIPO
              </Etiqueta>
            ) : null}
          </View>
        </Pressable>

        <Pressable
          onPress={alternar}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={usuario.activo ? 'Desactivar' : 'Reactivar'}
        >
          <Ionicons
            name={usuario.activo ? 'lock-open-outline' : 'lock-closed'}
            size={21}
            color={usuario.activo ? color.apagado : color.rojo}
          />
        </Pressable>
      </View>

      {editandoRoles ? (
        <View style={e.editorRoles}>
          <Text style={e.etiquetaBloque}>Roles en el club</Text>
          {ROLES.map((r) => (
            <Interruptor
              key={r.valor}
              etiqueta={r.etiqueta}
              ayuda={r.explicacion}
              valor={usuario.roles.includes(r.valor)}
              alCambiar={() => void alternarRol(r.valor)}
            />
          ))}
          {fallo ? <Banda tono="error">{fallo}</Banda> : null}
          <Secundario>
            Cambiar los roles no lo mete ni lo saca de ningún equipo: eso se hace en la ficha de
            cada equipo.
          </Secundario>
        </View>
      ) : null}
    </Tarjeta>
  )
}

// --- alta -----------------------------------------------------------------

/**
 * Contraseña fácil de dictar.
 *
 * Sin i/I/l/1/0/O ni caracteres raros: esta contraseña se copia a mano de una
 * pantalla a un papel o a un chat, y ahí es donde se pierden. Es el mismo
 * criterio de `scripts/clave.mjs` en la web.
 */
function inventarClave(largo = 10): string {
  const ALFABETO = 'abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789'
  let clave = ''
  for (let i = 0; i < largo; i++) {
    clave += ALFABETO[Math.floor(Math.random() * ALFABETO.length)]
  }
  return clave
}

function FormularioAlta({
  equipos,
  alTerminar,
}: {
  equipos: Equipo[]
  alTerminar: () => void
}) {
  const { perfil } = useSesion()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<Rol[]>(['jugador'])
  const [dorsal, setDorsal] = useState('')
  const [posicion, setPosicion] = useState<string | null>(null)
  const [equipoId, setEquipoId] = useState<string | null>(null)
  const [comoEnEquipo, setComoEnEquipo] = useState<'jugador' | 'entrenador'>('jugador')
  const [clave, setClave] = useState(inventarClave())

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<{ email: string; clave: string } | null>(null)

  const juega = roles.includes('jugador')
  const entrena = puedeEntrenar({ roles })

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  // Al menos un rol: una cuenta sin ninguno no puede hacer nada y solo sirve
  // para que alguien se pregunte por qué no ve nada al entrar.
  const listo = nombre.trim().length >= 3 && emailOk && clave.length >= 6 && roles.length > 0

  const disponibles = equipos.filter((x) => !x.archivado)

  /* Con qué papel entra en el equipo elegido.

     Si solo puede hacer una cosa, no se pregunta. Solo cuando puede las dos
     —que es justo lo que se quería permitir— hay que decidirlo, porque el
     equipo guarda dos listas separadas y de ahí sale quién manda avisos. */
  const hayQueElegirPapel = juega && entrena
  const papelEnEquipo: 'jugador' | 'entrenador' = hayQueElegirPapel
    ? comoEnEquipo
    : juega
      ? 'jugador'
      : 'entrenador'

  function alternarRol(rol: Rol) {
    setRoles((actuales) =>
      actuales.includes(rol) ? actuales.filter((r) => r !== rol) : [...actuales, rol],
    )
  }

  async function guardar() {
    if (!listo || guardando) return
    setGuardando(true)
    setError(null)

    try {
      // Se mira antes de llamar a Auth para dar un mensaje claro: el error de
      // Firebase por correo repetido es 'auth/email-already-in-use' y no dice
      // quién lo tiene.
      if (await emailYaUsado(email)) {
        setError('Ya hay una cuenta con ese correo en el club.')
        setGuardando(false)
        return
      }

      const uid = await crearUsuario(
        {
          nombre,
          email,
          clave,
          roles,
          // Sin equipos aquí a propósito: los mete `anadirAEquipo`, que escribe
          // las DOS caras a la vez. Ponerlos solo en la ficha del usuario
          // dejaba a la persona creyendo que está en el equipo mientras las
          // reglas —que miran la lista del equipo— le negaban el chat.
          equipos: [],
          dorsal: juega ? dorsal.trim() : '',
          posicion: juega ? (posicion ?? '') : '',
        },
        perfil!.uid,
      )

      if (equipoId) await anadirAEquipo(equipoId, uid, papelEnEquipo)

      setHecho({ email: email.trim().toLowerCase(), clave })
    } catch (err: any) {
      setError(traduce(err?.code) ?? err?.message ?? 'No se pudo crear la cuenta.')
      setGuardando(false)
    }
  }

  // --- credenciales recién creadas ---
  if (hecho) {
    return (
      <Tarjeta style={{ marginBottom: espacio.lg }}>
        <Banda tono="exito">
          Cuenta creada. Dale estos datos a la persona: la contraseña no se puede volver a ver.
        </Banda>

        <View style={e.credenciales}>
          <Text style={e.credEtiqueta}>Correo</Text>
          <Text style={e.credValor} selectable>
            {hecho.email}
          </Text>
          <Text style={[e.credEtiqueta, { marginTop: espacio.md }]}>Contraseña</Text>
          <Text style={e.credValor} selectable>
            {hecho.clave}
          </Text>
        </View>

        <Boton
          tono="secundario"
          icono="copy-outline"
          ancho
          onPress={() => {
            void Clipboard.setStringAsync(
              `App del Club Voleibol Oviedo\nCorreo: ${hecho.email}\nContraseña: ${hecho.clave}`,
            )
            Alert.alert('Copiado', 'Ya lo puedes pegar donde quieras.')
          }}
        >
          Copiar para enviar
        </Boton>

        <Boton ancho style={{ marginTop: espacio.md }} onPress={alTerminar}>
          Hecho
        </Boton>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta style={{ marginBottom: espacio.lg }}>
      <Text style={e.tituloForm}>Dar de alta</Text>

      {error ? <Banda tono="error">{error}</Banda> : null}

      <Campo
        etiqueta="Nombre y apellidos"
        value={nombre}
        onChangeText={setNombre}
        placeholder="Lucía García Fernández"
        maxLength={80}
        autoCapitalize="words"
      />

      <Campo
        etiqueta="Correo"
        value={email}
        onChangeText={setEmail}
        placeholder="lucia@correo.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        inputMode="email"
        ayuda="Con este correo entrará en la app. En menores, el de su madre o su padre."
        error={email.length > 4 && !emailOk ? 'Ese correo no es válido' : undefined}
      />

      {/* Roles en plural: se marcan los que hagan falta.

          La misma persona puede entrenar al infantil y jugar en el sénior, o
          llevar la web del club y además entrenar. Antes había que elegir una
          sola cosa y quedaba a medias. */}
      <Text style={e.etiquetaBloque}>Roles en el club</Text>
      <Secundario>Marca todos los que valgan. Se pueden cambiar luego.</Secundario>

      <View style={{ marginTop: espacio.sm, marginBottom: espacio.lg }}>
        {ROLES.map((r) => (
          <Interruptor
            key={r.valor}
            etiqueta={r.etiqueta}
            ayuda={r.explicacion}
            valor={roles.includes(r.valor)}
            alCambiar={() => alternarRol(r.valor)}
          />
        ))}
        {roles.length === 0 ? (
          <Banda tono="ojo">
            Sin ningún rol, la cuenta entra pero no puede hacer nada. Marca al menos uno.
          </Banda>
        ) : null}
      </View>

      {juega ? (
        <View style={{ marginTop: espacio.lg }}>
          <Campo
            etiqueta="Dorsal (opcional)"
            value={dorsal}
            onChangeText={(v) => setDorsal(v.replace(/\D/g, '').slice(0, 3))}
            placeholder="12"
            keyboardType="number-pad"
          />
          <Pildoras
            etiqueta="Posición (opcional)"
            valor={posicion}
            alElegir={setPosicion}
            opciones={POSICIONES.map((p) => ({ valor: p, etiqueta: p }))}
          />
        </View>
      ) : null}

      {disponibles.length > 0 ? (
        <>
          <Pildoras
            etiqueta="Equipo (opcional)"
            valor={equipoId}
            alElegir={(v) => setEquipoId(v === equipoId ? null : v)}
            opciones={disponibles.map((x) => ({ valor: x.id, etiqueta: x.nombre }))}
          />

          {/* Solo se pregunta cuando de verdad hay dos respuestas posibles. */}
          {equipoId && hayQueElegirPapel ? (
            <Pildoras
              etiqueta="En ese equipo entra como"
              valor={comoEnEquipo}
              alElegir={setComoEnEquipo}
              opciones={[
                { valor: 'jugador', etiqueta: 'Jugador' },
                { valor: 'entrenador', etiqueta: 'Entrenador' },
              ]}
            />
          ) : null}

          {equipoId ? (
            <View style={{ marginBottom: espacio.lg }}>
              <Secundario>
                Podrás añadirle más equipos —y con otro papel en cada uno— desde la ficha de cada
                equipo.
              </Secundario>
            </View>
          ) : null}
        </>
      ) : (
        <Banda tono="ojo">
          Todavía no hay equipos creados. Puedes dar de alta la cuenta igual y asignarle equipo
          después.
        </Banda>
      )}

      <View style={e.claveFila}>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Contraseña inicial"
            value={clave}
            onChangeText={setClave}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={40}
            ayuda="Se enseña una sola vez al terminar. La persona puede cambiarla luego."
          />
        </View>
        <Pressable
          onPress={() => setClave(inventarClave())}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Generar otra contraseña"
          style={e.dado}
        >
          <Ionicons name="refresh" size={20} color={color.azul} />
        </Pressable>
      </View>

      <Boton onPress={guardar} cargando={guardando} desactivado={!listo} icono="checkmark" ancho>
        Crear cuenta
      </Boton>
    </Tarjeta>
  )
}

function traduce(codigo?: string): string | null {
  switch (codigo) {
    case 'auth/email-already-in-use':
      return 'Ese correo ya tiene cuenta en Firebase. Si es de alguien que se dio de baja, reactívala en vez de crear otra.'
    case 'auth/weak-password':
      return 'La contraseña es muy corta: mínimo 6 caracteres.'
    case 'auth/invalid-email':
      return 'Ese correo no es válido.'
    case 'permission-denied':
      return 'Firestore ha rechazado la escritura. Revisa que tu cuenta siga siendo administradora.'
    default:
      return null
  }
}

const e = StyleSheet.create({
  buscador: {
    borderWidth: 1,
    borderColor: color.linea,
    borderRadius: radio.md,
    paddingHorizontal: espacio.md,
    paddingVertical: 11,
    fontSize: 16,
    color: color.tinta,
    backgroundColor: color.blanco,
    minHeight: 46,
  },

  usuario: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
  editorRoles: {
    marginTop: espacio.md,
    paddingTop: espacio.md,
    borderTopWidth: 1,
    borderTopColor: color.linea,
  },
  nombre: { fontSize: 15.5, fontWeight: '700', color: color.tinta },
  meta: { fontSize: 12.5, color: color.apagado },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm, marginTop: 2 },

  etiquetaBloque: { fontSize: 13, fontWeight: '700', color: color.tinta, marginBottom: 2 },
  tituloForm: { fontSize: 18, fontWeight: '800', color: color.tinta, marginBottom: espacio.lg },
  claveFila: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.md },
  dado: {
    width: 46,
    height: 48,
    borderRadius: radio.md,
    backgroundColor: color.tinte,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
  },

  credenciales: {
    backgroundColor: color.fondo,
    borderRadius: radio.md,
    padding: espacio.lg,
    marginBottom: espacio.lg,
  },
  credEtiqueta: { fontSize: 12, fontWeight: '700', color: color.apagado },
  credValor: {
    fontSize: 18,
    fontWeight: '700',
    color: color.tinta,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
})
