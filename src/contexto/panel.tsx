// ==========================================================================
// El estado del panel de la web, compartido por sus pantallas.
//
// Las cuatro pantallas de contenido (noticias, patrocinadores, equipos, fotos)
// trabajan sobre la MISMA respuesta de `/api/panel/sesion`, que devuelve las
// cuatro listas de golpe. Pedirla en cada pantalla serían cuatro llamadas y
// cuatro versiones del mismo contenido bailando entre sí.
//
// Aquí se pide una vez, se edita en memoria y se guarda lista a lista. Lo que
// devuelve el servidor al guardar es lo que queda: él recorta los textos y tira
// los campos que no conoce, así que la verdad es siempre la suya.
//
// Ojo con la doble sesión: para el panel de la web hace falta la contraseña
// del panel, que NO es la cuenta de Firebase. Son dos cosas distintas y así se
// le explica a quien entra — es admin de la app, pero la web tiene su propia
// llave.
// ==========================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  entrarEnPanel,
  estadoPanel,
  guardarLista,
  olvidarToken,
  subirImagen,
  tokenGuardado,
  type Lista,
  type SesionPanel,
} from '../lib/web/panel'

/** Un hueco de foto de la web, con su nombre y dónde sale. */
export interface HuecoFoto {
  clave: string
  titulo: string
  donde: string
  formato: string
  porDefecto: string
}

type Estado = 'comprobando' | 'fuera' | 'dentro'

interface Panel {
  estado: Estado
  datos: SesionPanel | null
  catalogoFotos: HuecoFoto[]
  error: string | null
  entrar: (usuario: string, clave: string) => Promise<void>
  salir: () => Promise<void>
  recargar: () => Promise<void>
  /** Guarda una lista y deja en memoria lo que devuelva el servidor. */
  guardar: <K extends Lista>(lista: K, elementos: any[]) => Promise<void>
  subir: (uri: string, tipo: string, nombre: string) => Promise<string>
  guardando: boolean
}

const Contexto = createContext<Panel | null>(null)

export function ProveedorPanel({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('comprobando')
  const [datos, setDatos] = useState<SesionPanel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const token = useRef<string | null>(null)

  const cargar = useCallback(async () => {
    const t = token.current
    if (!t) {
      setEstado('fuera')
      return
    }
    try {
      const s = await estadoPanel(t)
      setDatos(s)
      setEstado('dentro')
      setError(null)
    } catch (e: any) {
      // Un 401 aquí significa token caducado; `panel.ts` ya lo ha borrado.
      token.current = null
      setDatos(null)
      setEstado('fuera')
      if (e?.estado !== 401) setError(e?.message ?? 'No se pudo cargar el panel.')
    }
  }, [])

  // Al abrir, se mira si ya había token guardado en el llavero.
  useEffect(() => {
    void (async () => {
      token.current = await tokenGuardado()
      await cargar()
    })()
  }, [cargar])

  const entrar = useCallback(
    async (usuario: string, clave: string) => {
      setError(null)
      await entrarEnPanel(usuario, clave)
      token.current = await tokenGuardado()
      await cargar()
    },
    [cargar],
  )

  const salir = useCallback(async () => {
    await olvidarToken()
    token.current = null
    setDatos(null)
    setEstado('fuera')
  }, [])

  const guardar = useCallback(async (lista: Lista, elementos: any[]) => {
    const t = token.current
    if (!t) throw new Error('No hay sesión del panel.')

    setGuardando(true)
    try {
      const limpia = await guardarLista(t, lista, elementos)
      setDatos((anterior) => (anterior ? { ...anterior, [lista]: limpia } : anterior))
    } finally {
      setGuardando(false)
    }
  }, [])

  const subir = useCallback(async (uri: string, tipo: string, nombre: string) => {
    const t = token.current
    if (!t) throw new Error('No hay sesión del panel.')
    return subirImagen(t, uri, tipo, nombre)
  }, [])

  const catalogoFotos = useMemo<HuecoFoto[]>(
    () => ((datos as any)?.catalogoFotos ?? []) as HuecoFoto[],
    [datos],
  )

  const valor = useMemo<Panel>(
    () => ({
      estado,
      datos,
      catalogoFotos,
      error,
      entrar,
      salir,
      recargar: cargar,
      guardar,
      subir,
      guardando,
    }),
    [estado, datos, catalogoFotos, error, entrar, salir, cargar, guardar, subir, guardando],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function usePanel(): Panel {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('usePanel fuera de <ProveedorPanel>')
  return valor
}
