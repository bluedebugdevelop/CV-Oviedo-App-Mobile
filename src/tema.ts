// ==========================================================================
// Los colores y las medidas de la app, en un solo sitio.
//
// Salen de las variables CSS de la web (src/index.css de CVOWeb) para que la
// app y clubvoleiboloviedo.com se parezcan: es el mismo club, y un socio que
// pasa de una a otra no debería notar que son dos productos distintos.
//
// La app va en modo claro y punto. Un club no necesita dos paletas, y mantener
// una segunda multiplica por dos cada pantalla que se toque después.
// ==========================================================================

export const color = {
  // --- azules del club ---
  tinta: '#082139', // texto principal y fondos oscuros
  tintaSuave: '#0d3157',
  azul: '#1560bd', // acentos y botones
  azulOscuro: '#0f4a94',
  azulClaro: '#7cc4f7', // sobre fondo oscuro
  tinte: '#eaf2fb', // fondos de sección

  // --- neutros ---
  linea: '#dbe6f2',
  apagado: '#5c6b7d', // texto secundario
  blanco: '#ffffff',
  fondo: '#f7fafd',

  // --- estados ---
  // El ámbar y el rojo son los de las competiciones nacionales en la web; se
  // reaprovechan para avisos y alertas en vez de inventar otros.
  ambar: '#ffad00',
  ambarTinte: '#fff4dd',
  rojo: '#dd0a16',
  rojoTinte: '#fdeaeb',
  verde: '#15803d',
  verdeTinte: '#e8f5ec',
} as const

/** Un color por rol, para las etiquetas de quién es quién. */
export const colorRol = {
  admin: { fondo: color.rojoTinte, texto: '#9b1c23' },
  entrenador: { fondo: color.ambarTinte, texto: '#8a5a00' },
  jugador: { fondo: color.tinte, texto: color.azulOscuro },
} as const

/** Escala de espaciado. Todo es múltiplo de 4 para que nada quede a medio píxel. */
export const espacio = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radio = {
  sm: 8,
  md: 12,
  lg: 16,
  pastilla: 999,
} as const

export const texto = {
  titulo: { fontSize: 26, fontWeight: '800', color: color.tinta, letterSpacing: -0.5 },
  seccion: { fontSize: 19, fontWeight: '700', color: color.tinta },
  tarjeta: { fontSize: 16, fontWeight: '700', color: color.tinta },
  cuerpo: { fontSize: 15, color: color.tinta, lineHeight: 22 },
  secundario: { fontSize: 13, color: color.apagado },
  // Los antetítulos van en versalitas, como en la web.
  ante: {
    fontSize: 11,
    fontWeight: '700',
    color: color.azul,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
} as const

/** Sombra suave para las tarjetas. iOS y Android la declaran distinto. */
export const sombra = {
  shadowColor: '#082139',
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const
