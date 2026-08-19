// ==========================================================================
// El contenido de la web: noticias, patrocinadores, equipos y fotos.
//
// GET /api/contenido, público y sin permisos, el mismo que pide el navegador
// al cargar clubvoleiboloviedo.com. Las formas son las que devuelve
// `api/contenido.js` de CVOWeb; si allí se añade un campo, aquí solo hay que
// añadirlo al tipo.
// ==========================================================================

import { pedir } from './cliente'

export interface Noticia {
  id: string
  slug: string
  destacada: boolean
  categoria: string
  fecha: string
  titulo: string
  resumen: string
  img: string
  foco: string
  /** Los párrafos de la ficha. Vacío = la noticia es solo la tarjeta. */
  cuerpo: string[]
  cta: string
}

export interface Patrocinador {
  slug: string
  nombre: string
  logo: string
  foto: string
  tagline: string
  web: string
  webTexto: string
  color: string
  descripcion: string
  parrafos: string[]
}

export interface JugadorWeb {
  numero: string
  nombre: string
  posicion: string
}

export interface EquipoWeb {
  slug: string
  zona: 'nacional' | 'cantera'
  enPortada: boolean
  nombre: string
  categoria: string
  liga: string
  img: string
  alt: string
  resumen: string
  crumb: string
  kicker: string
  sub: string
  headerImg: string
  headerFoco: string
  datos: { label: string; valor: string }[]
  squad: JugadorWeb[]
  staff: { nombre: string; rol: string }[]
  join: { title: string; text: string }
}

export interface FotoSitio {
  clave: string
  ruta: string
}

export interface Contenido {
  noticias: Noticia[]
  patrocinadores: Patrocinador[]
  equipos: EquipoWeb[]
  fotos: FotoSitio[]
  /** Por lista: 'panel' si la editó el club, 'semilla' si es la del código. */
  origen: Record<string, 'panel' | 'semilla'>
}

export function cargarContenido(): Promise<Contenido> {
  return pedir<Contenido>('/api/contenido')
}
