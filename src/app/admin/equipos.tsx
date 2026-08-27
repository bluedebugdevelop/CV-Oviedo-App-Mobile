// ==========================================================================
// Equipos del club: crearlos y ver de un vistazo cómo están.
//
// Crear un equipo es lo primero que hay que hacer en una temporada nueva, así
// que el formulario está aquí mismo y no detrás de otra pantalla.
//
// La parte que más se equivoca es enlazar el equipo con su competición: los
// nombres de las federaciones no coinciden con los del club («CV OVIEDO A» es
// el Cadete Femenino A). Por eso se elige de una lista traída de
// `/api/competicion?indice` y no se escribe a mano: escrita a mano, un espacio
// de más deja el equipo sin calendario y nadie sabe por qué.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Pantalla } from '../../componentes/Pantalla'
import {
  Banda,
  Boton,
  Campo,
  Cargando,
  Etiqueta,
  Franja,
  Pildoras,
  Secundario,
  Tarjeta,
  Vacio,
} from '../../componentes/ui'
import { useSesion } from '../../contexto/sesion'
import { crearEquipo, escucharTodosLosEquipos } from '../../lib/firebase/equipos'
import {
  CATEGORIAS,
  temporadaActual,
  type Equipo,
  type Genero,
} from '../../lib/firebase/modelo'
import {
  cargarIndiceCompeticion,
  nombresSugeridos,
  type ResumenCompeticion,
} from '../../lib/web/competicion'
import { color, espacio, radio } from '../../tema'

export default function AdminEquipos() {
  const { perfil } = useSesion()
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    return escucharTodosLosEquipos((lista) => {
      setEquipos(lista)
      setCargando(false)
    })
  }, [])

  const activos = equipos.filter((x) => !x.archivado)
  const archivados = equipos.filter((x) => x.archivado)

  return (
    <Pantalla
      ante="Administración"
      titulo="Equipos"
      atras
      accion={{
        icono: creando ? 'close' : 'add-circle',
        etiqueta: creando ? 'Cancelar' : 'Nuevo equipo',
        alPulsar: () => setCreando((v) => !v),
      }}
    >
      {/* Lo primero: cuadrar con la web. Crear los equipos a mano uno a uno
          era teclear doce veces algo que ya está publicado, y bastaba con
          equivocarse al elegir la competición para que un equipo se quedara
          sin calendario. */}
      <EquiposDeLaWeb equipos={equipos} creadoPor={perfil!.uid} />

      {creando ? (
        <FormularioEquipo
          creadoPor={perfil!.uid}
          alTerminar={(id) => {
            setCreando(false)
            router.push(`/admin/equipo/${id}`)
          }}
        />
      ) : null}

      {cargando ? (
        <Cargando texto="Cargando equipos…" />
      ) : equipos.length === 0 ? (
        <Vacio
          icono="people-outline"
          titulo="Todavía no hay equipos"
          texto="Crea el primero y luego asígnale entrenador y jugadores."
        >
          <Boton icono="add" onPress={() => setCreando(true)}>
            Crear equipo
          </Boton>
        </Vacio>
      ) : (
        <>
          <Franja titulo={`Temporada en curso (${activos.length})`} />
          <View style={{ gap: espacio.md }}>
            {activos.map((eq) => (
              <TarjetaEquipo key={eq.id} equipo={eq} />
            ))}
          </View>

          {archivados.length > 0 ? (
            <>
              <Franja titulo={`Archivados (${archivados.length})`} />
              <View style={{ gap: espacio.md }}>
                {archivados.map((eq) => (
                  <TarjetaEquipo key={eq.id} equipo={eq} />
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </Pantalla>
  )
}

/**
 * Crear de golpe los equipos que compiten, tal y como salen en la web.
 *
 * Los doce equipos federados del club ya están definidos en un sitio: el
 * calendario que scrapea la web. Volver a escribirlos a mano en la app era
 * trabajo repetido y, peor, una forma fácil de acabar con un equipo mal
 * enlazado y por tanto sin calendario ni clasificación.
 *
 * Se comparan por `claveCompeticion`, no por nombre: el nombre lo puede
 * cambiar el club cuando quiera y esto tiene que seguir sabiendo cuáles ya
 * están. Y solo CREA los que faltan — nunca toca los que ya existen, para no
 * pisar un nombre que alguien haya ajustado a mano.
 */
function EquiposDeLaWeb({
  equipos,
  creadoPor,
}: {
  equipos: Equipo[]
  creadoPor: string
}) {
  const [competiciones, setCompeticiones] = useState<ResumenCompeticion[]>([])
  const [fallo, setFallo] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [hecho, setHecho] = useState<number | null>(null)

  useEffect(() => {
    let vivo = true
    void cargarIndiceCompeticion()
      .then((r) => vivo && setCompeticiones(r.equipos))
      .catch((e) => vivo && setFallo(e?.message ?? 'No se pudo consultar la web.'))
    return () => {
      vivo = false
    }
  }, [])

  const yaEstan = useMemo(
    () => new Set(equipos.map((x) => x.claveCompeticion).filter(Boolean) as string[]),
    [equipos],
  )
  const faltan = competiciones.filter((c) => !yaEstan.has(c.clave))

  async function crearLosQueFaltan() {
    if (creando || faltan.length === 0) return
    setCreando(true)
    setFallo(null)

    const nombres = nombresSugeridos(
      competiciones.map((c) => ({
        clave: c.clave,
        categoria: c.categoria,
        genero: c.genero,
        division: c.division,
        // El índice no trae `equipoClub`; sin él no hay letra y los que la
        // necesiten se distinguirán por la división, que también vale.
        equipoClub: '',
      })),
    )

    let creados = 0
    try {
      for (const c of faltan) {
        await crearEquipo(
          {
            nombre: nombres[c.clave] ?? `${c.categoria} ${c.genero}`,
            categoria: c.categoria,
            genero: generoDe(c.genero),
            temporada: temporadaActual(),
            claveCompeticion: c.clave,
          },
          creadoPor,
        )
        creados++
      }
      setHecho(creados)
    } catch (e: any) {
      // Los ya creados se quedan: volver a pulsar continúa por donde iba.
      setFallo(`Se crearon ${creados} y falló el siguiente: ${e?.message ?? 'error'}`)
    } finally {
      setCreando(false)
    }
  }

  if (fallo && competiciones.length === 0) {
    return (
      <Banda tono="ojo">
        No se pudo consultar los equipos de la web ({fallo}). Puedes crearlos a mano.
      </Banda>
    )
  }

  if (competiciones.length === 0) return null

  return (
    <Tarjeta style={e.sincro}>
      <View style={e.sincroFila}>
        <View style={e.sincroIcono}>
          <Ionicons name="git-compare-outline" size={20} color={color.azul} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={e.sincroTitulo}>Equipos de la web</Text>
          <Text style={e.meta}>
            {competiciones.length - faltan.length} de {competiciones.length} creados en la app
          </Text>
        </View>
      </View>

      {fallo ? <Banda tono="error">{fallo}</Banda> : null}

      {faltan.length === 0 ? (
        <Banda tono="exito">
          Están todos. Cada uno con su calendario, resultados y clasificación.
        </Banda>
      ) : (
        <>
          <Secundario>
            Faltan {faltan.length}: {faltan.map((c) => `${c.categoria} ${c.genero}`).join(", ")}.
            Se crean enlazados a su competición, así que traen el calendario puesto.
          </Secundario>
          <Boton
            icono="download-outline"
            ancho
            cargando={creando}
            style={{ marginTop: espacio.md }}
            onPress={crearLosQueFaltan}
          >
            Crear los {faltan.length} que faltan
          </Boton>
        </>
      )}

      {hecho ? <Banda tono="exito">Creados {hecho}. Ya puedes asignarles gente.</Banda> : null}
    </Tarjeta>
  )
}

/** Lo que dicen las federaciones, en los tres valores que usa el modelo. */
function generoDe(texto: string): Genero {
  const g = texto.trim().toLowerCase()
  if (g.startsWith('masc')) return 'Masculino'
  if (g.startsWith('fem')) return 'Femenino'
  return 'Mixto'
}

function TarjetaEquipo({ equipo }: { equipo: Equipo }) {
  const gente = equipo.jugadores.length + equipo.entrenadores.length

  return (
    <Tarjeta
      style={[e.fila, equipo.archivado ? { opacity: 0.6 } : null]}
      onPress={() => router.push(`/admin/equipo/${equipo.id}`)}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={e.nombre}>{equipo.nombre}</Text>
        <Text style={e.meta}>
          {equipo.categoria} · {equipo.genero} · {equipo.temporada}
        </Text>
        <View style={e.etiquetas}>
          <Etiqueta>
            {gente} {gente === 1 ? 'PERSONA' : 'PERSONAS'}
          </Etiqueta>
          {equipo.claveCompeticion ? (
            <Etiqueta fondo={color.verdeTinte} texto={color.verde}>
              CON CALENDARIO
            </Etiqueta>
          ) : (
            <Etiqueta fondo={color.ambarTinte} texto="#8a5a00">
              SIN COMPETICIÓN
            </Etiqueta>
          )}
          {equipo.entrenadores.length === 0 ? (
            <Etiqueta fondo={color.rojoTinte} texto={color.rojo}>
              SIN ENTRENADOR
            </Etiqueta>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color.linea} />
    </Tarjeta>
  )
}

// --- alta de equipo -------------------------------------------------------

const GENEROS: { valor: Genero; etiqueta: string }[] = [
  { valor: 'Femenino', etiqueta: 'Femenino' },
  { valor: 'Masculino', etiqueta: 'Masculino' },
  { valor: 'Mixto', etiqueta: 'Mixto' },
]

function FormularioEquipo({
  creadoPor,
  alTerminar,
}: {
  creadoPor: string
  alTerminar: (id: string) => void
}) {
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0])
  const [genero, setGenero] = useState<Genero>('Femenino')
  const [clave, setClave] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [competiciones, setCompeticiones] = useState<ResumenCompeticion[]>([])
  const [fallo, setFallo] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    void cargarIndiceCompeticion()
      .then((r) => vivo && setCompeticiones(r.equipos))
      .catch((err) => vivo && setFallo(err?.message ?? 'No se pudo cargar la lista.'))
    return () => {
      vivo = false
    }
  }, [])

  // Se ofrecen primero las competiciones que casan con la categoría y el
  // género elegidos: son doce y así la que se busca sale arriba.
  const sugeridas = useMemo(() => {
    const casa = (c: ResumenCompeticion) =>
      c.categoria.toLowerCase().startsWith(categoria.toLowerCase().slice(0, 4)) &&
      c.genero.toLowerCase() === genero.toLowerCase()
    return [...competiciones].sort((a, b) => Number(casa(b)) - Number(casa(a)))
  }, [competiciones, categoria, genero])

  const listo = nombre.trim().length >= 3

  async function guardar() {
    if (!listo || guardando) return
    setGuardando(true)
    setError(null)
    try {
      const id = await crearEquipo(
        {
          nombre: nombre.trim(),
          categoria,
          genero,
          temporada: temporadaActual(),
          claveCompeticion: clave,
        },
        creadoPor,
      )
      alTerminar(id)
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo crear el equipo.')
      setGuardando(false)
    }
  }

  return (
    <Tarjeta style={{ marginBottom: espacio.lg }}>
      <Text style={e.tituloForm}>Nuevo equipo</Text>

      {error ? <Banda tono="error">{error}</Banda> : null}

      <Campo
        etiqueta="Nombre"
        value={nombre}
        onChangeText={setNombre}
        placeholder="Cadete Femenino A"
        maxLength={60}
        ayuda="Es el nombre que verá el equipo dentro de la app."
      />

      <Pildoras
        etiqueta="Categoría"
        valor={categoria}
        alElegir={setCategoria}
        opciones={CATEGORIAS.map((c) => ({ valor: c, etiqueta: c }))}
      />

      <Pildoras etiqueta="Género" valor={genero} alElegir={setGenero} opciones={GENEROS} />

      <Text style={e.etiquetaCampo}>Competición</Text>
      <Secundario>
        Enlaza el equipo con su liga para que vea calendario y clasificación. Si no compite
        federado, déjalo en «Sin competición».
      </Secundario>

      {fallo ? (
        <View style={{ marginTop: espacio.md }}>
          <Banda tono="ojo">
            No se ha podido cargar la lista de competiciones ({fallo}). Puedes crear el equipo
            igual y enlazarlo luego.
          </Banda>
        </View>
      ) : (
        <View style={{ marginTop: espacio.md, gap: espacio.sm }}>
          <OpcionCompeticion
            titulo="Sin competición"
            detalle="Escuela, veteranos o equipos que no juegan liga"
            elegida={clave === null}
            alElegir={() => setClave(null)}
          />
          {sugeridas.map((c) => (
            <OpcionCompeticion
              key={c.clave}
              titulo={`${c.categoria} ${c.genero}`}
              detalle={`${c.division}${c.grupo ? ` · ${c.grupo}` : ''} · ${c.ente}`}
              elegida={clave === c.clave}
              alElegir={() => setClave(c.clave)}
            />
          ))}
        </View>
      )}

      <Boton
        onPress={guardar}
        cargando={guardando}
        desactivado={!listo}
        ancho
        icono="checkmark"
        style={{ marginTop: espacio.xl }}
      >
        Crear equipo
      </Boton>
    </Tarjeta>
  )
}

function OpcionCompeticion({
  titulo,
  detalle,
  elegida,
  alElegir,
}: {
  titulo: string
  detalle: string
  elegida: boolean
  alElegir: () => void
}) {
  return (
    <Tarjeta
      onPress={alElegir}
      style={[e.opcion, elegida ? e.opcionElegida : null]}
    >
      <Ionicons
        name={elegida ? 'radio-button-on' : 'radio-button-off'}
        size={19}
        color={elegida ? color.azul : color.linea}
      />
      <View style={{ flex: 1 }}>
        <Text style={e.opcionTitulo}>{titulo}</Text>
        <Text style={e.meta}>{detalle}</Text>
      </View>
    </Tarjeta>
  )
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },

  sincro: { marginBottom: espacio.lg, gap: espacio.md },
  sincroFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
  sincroIcono: {
    width: 40,
    height: 40,
    borderRadius: radio.md,
    backgroundColor: color.tinte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sincroTitulo: { fontSize: 16, fontWeight: '800', color: color.tinta },
  nombre: { fontSize: 16.5, fontWeight: '700', color: color.tinta },
  meta: { fontSize: 12.5, color: color.apagado, lineHeight: 18 },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm, marginTop: 2 },

  tituloForm: { fontSize: 18, fontWeight: '800', color: color.tinta, marginBottom: espacio.lg },
  etiquetaCampo: {
    fontSize: 13,
    fontWeight: '700',
    color: color.tinta,
    marginBottom: espacio.xs,
  },

  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    padding: espacio.md,
    borderRadius: radio.md,
  },
  opcionElegida: { borderColor: color.azul, backgroundColor: color.tinte },
  opcionTitulo: { fontSize: 14.5, fontWeight: '700', color: color.tinta },
})
