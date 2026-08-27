// ==========================================================================
// Las piezas sueltas con las que se montan las pantallas.
//
// Todo en un fichero a propósito: son componentes de veinte líneas que se usan
// juntos, y repartirlos en diez ficheros de un export cada uno solo añade
// imports. Cuando alguno crezca, se saca.
// ==========================================================================

import { Ionicons } from '@expo/vector-icons'
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'

import { color, espacio, radio, sombra } from '../tema'

// --- textos ---------------------------------------------------------------

export const Titulo = ({ children }: { children: ReactNode }) => (
  <Text style={e.titulo}>{children}</Text>
)

export const Seccion = ({ children }: { children: ReactNode }) => (
  <Text style={e.seccion}>{children}</Text>
)

export const Ante = ({ children }: { children: ReactNode }) => (
  <Text style={e.ante}>{children}</Text>
)

export const Cuerpo = ({ children, style }: { children: ReactNode; style?: any }) => (
  <Text style={[e.cuerpo, style]}>{children}</Text>
)

export const Secundario = ({ children, style }: { children: ReactNode; style?: any }) => (
  <Text style={[e.secundario, style]}>{children}</Text>
)

// --- contenedores ---------------------------------------------------------

export function Tarjeta({
  children,
  style,
  onPress,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  onPress?: () => void
}) {
  if (!onPress) return <View style={[e.tarjeta, style]}>{children}</View>
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [e.tarjeta, pressed && e.pulsada, style]}
    >
      {children}
    </Pressable>
  )
}

/** Separador con título, para partir una pantalla larga. */
export const Franja = ({ titulo, extra }: { titulo: string; extra?: ReactNode }) => (
  <View style={e.franja}>
    <Text style={e.seccion}>{titulo}</Text>
    {extra}
  </View>
)

// --- botones --------------------------------------------------------------

type Tono = 'principal' | 'secundario' | 'fantasma' | 'peligro'

const TONOS: Record<Tono, { fondo: string; texto: string; borde: string }> = {
  principal: { fondo: color.azul, texto: color.blanco, borde: color.azul },
  secundario: { fondo: color.tinte, texto: color.azulOscuro, borde: color.tinte },
  fantasma: { fondo: 'transparent', texto: color.azul, borde: color.linea },
  peligro: { fondo: color.rojoTinte, texto: color.rojo, borde: color.rojoTinte },
}

export function Boton({
  children,
  onPress,
  tono = 'principal',
  icono,
  cargando = false,
  desactivado = false,
  ancho = false,
  style,
}: {
  children: ReactNode
  onPress?: () => void
  tono?: Tono
  icono?: keyof typeof Ionicons.glyphMap
  cargando?: boolean
  desactivado?: boolean
  /** Ocupa todo el ancho disponible. */
  ancho?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const apagado = desactivado || cargando
  const paleta = TONOS[tono]

  return (
    <Pressable
      onPress={apagado ? undefined : onPress}
      accessibilityRole="button"
      // Sin esto, un lector de pantalla anuncia como pulsable un botón que no
      // lo está.
      accessibilityState={{ disabled: apagado, busy: cargando }}
      style={({ pressed }) => [
        e.boton,
        { backgroundColor: paleta.fondo, borderColor: paleta.borde },
        ancho && { alignSelf: 'stretch' },
        pressed && !apagado && e.pulsada,
        apagado && e.apagado,
        style,
      ]}
    >
      {cargando ? (
        <ActivityIndicator size="small" color={paleta.texto} />
      ) : (
        <>
          {icono ? <Ionicons name={icono} size={17} color={paleta.texto} /> : null}
          <Text style={[e.botonTexto, { color: paleta.texto }]}>{children}</Text>
        </>
      )}
    </Pressable>
  )
}

// --- formularios ----------------------------------------------------------

export function Campo({
  etiqueta,
  ayuda,
  error,
  ...resto
}: TextInputProps & { etiqueta: string; ayuda?: string; error?: string }) {
  return (
    <View style={e.campo}>
      <Text style={e.campoEtiqueta}>{etiqueta}</Text>
      <TextInput
        placeholderTextColor={color.apagado}
        {...resto}
        style={[
          e.campoEntrada,
          resto.multiline ? e.campoLargo : null,
          error ? { borderColor: color.rojo } : null,
          resto.style,
        ]}
      />
      {error ? (
        <Text style={e.campoError}>{error}</Text>
      ) : ayuda ? (
        <Text style={e.campoAyuda}>{ayuda}</Text>
      ) : null}
    </View>
  )
}

/**
 * Fila de opciones en horizontal.
 *
 * Hace de desplegable: con cuatro o cinco opciones se ven todas a la vez y se
 * elige de un toque, sin abrir nada encima.
 */
export function Pildoras<T extends string>({
  etiqueta,
  opciones,
  valor,
  alElegir,
}: {
  etiqueta?: string
  opciones: { valor: T; etiqueta: string }[]
  valor: T | null
  alElegir: (v: T) => void
}) {
  return (
    <View style={e.campo}>
      {etiqueta ? <Text style={e.campoEtiqueta}>{etiqueta}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={e.pildoras}
      >
        {opciones.map((o) => {
          const activa = o.valor === valor
          return (
            <Pressable
              key={o.valor}
              onPress={() => alElegir(o.valor)}
              accessibilityRole="radio"
              accessibilityState={{ selected: activa }}
              style={[e.pildora, activa ? e.pildoraActiva : null]}
            >
              <Text style={[e.pildoraTexto, activa ? e.pildoraTextoActivo : null]}>
                {o.etiqueta}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

/**
 * Control segmentado: unas pocas opciones que se excluyen entre sí.
 *
 * Sustituye a la fila de pastillas sueltas, que parecían botones flotando
 * sobre el fondo. Aquí las opciones comparten un carril y la elegida se
 * levanta sobre él — el mismo patrón que usan iOS y Material, y que se lee de
 * un vistazo como «esto es UN control con varias posiciones» en vez de como
 * varios botones sin relación.
 *
 * Para tres o cuatro opciones. Con más no caben sin cortar el texto: ahí
 * sigue valiendo `Pildoras`, que sí desplaza en horizontal.
 */
export function Segmentado<T extends string>({
  opciones,
  valor,
  alElegir,
  etiqueta,
}: {
  opciones: { valor: T; etiqueta: string }[]
  valor: T
  alElegir: (v: T) => void
  etiqueta?: string
}) {
  return (
    <View style={etiqueta ? e.campo : undefined}>
      {etiqueta ? <Text style={e.campoEtiqueta}>{etiqueta}</Text> : null}
      <View style={e.carril} accessibilityRole="tablist">
        {opciones.map((o) => {
          const activa = o.valor === valor
          return (
            <Pressable
              key={o.valor}
              onPress={() => alElegir(o.valor)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              style={[e.segmento, activa ? e.segmentoActivo : null]}
            >
              <Text
                style={[e.segmentoTexto, activa ? e.segmentoTextoActivo : null]}
                numberOfLines={1}
              >
                {o.etiqueta}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function Interruptor({
  etiqueta,
  ayuda,
  valor,
  alCambiar,
}: {
  etiqueta: string
  ayuda?: string
  valor: boolean
  alCambiar: (v: boolean) => void
}) {
  return (
    <Pressable
      onPress={() => alCambiar(!valor)}
      accessibilityRole="switch"
      accessibilityState={{ checked: valor }}
      style={e.interruptor}
    >
      <View style={[e.casilla, valor ? e.casillaActiva : null]}>
        {valor ? <Ionicons name="checkmark" size={15} color={color.blanco} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={e.cuerpo}>{etiqueta}</Text>
        {ayuda ? <Text style={e.secundario}>{ayuda}</Text> : null}
      </View>
    </Pressable>
  )
}

// --- avisos y estados -----------------------------------------------------

export function Etiqueta({
  children,
  fondo = color.tinte,
  texto = color.azulOscuro,
}: {
  children: ReactNode
  fondo?: string
  texto?: string
}) {
  return (
    <View style={[e.etiqueta, { backgroundColor: fondo }]}>
      <Text style={[e.etiquetaTexto, { color: texto }]}>{children}</Text>
    </View>
  )
}

type TonoBanda = 'info' | 'error' | 'exito' | 'ojo'

const BANDAS: Record<
  TonoBanda,
  { fondo: string; texto: string; icono: keyof typeof Ionicons.glyphMap }
> = {
  info: { fondo: color.tinte, texto: color.azulOscuro, icono: 'information-circle' },
  error: { fondo: color.rojoTinte, texto: '#9b1c23', icono: 'alert-circle' },
  exito: { fondo: color.verdeTinte, texto: color.verde, icono: 'checkmark-circle' },
  ojo: { fondo: color.ambarTinte, texto: '#8a5a00', icono: 'warning' },
}

export function Banda({ tono = 'info', children }: { tono?: TonoBanda; children: ReactNode }) {
  const p = BANDAS[tono]
  return (
    <View style={[e.banda, { backgroundColor: p.fondo }]}>
      <Ionicons name={p.icono} size={18} color={p.texto} />
      <Text style={[e.bandaTexto, { color: p.texto }]}>{children}</Text>
    </View>
  )
}

export const Cargando = ({ texto }: { texto?: string }) => (
  <View style={e.centrado}>
    <ActivityIndicator color={color.azul} />
    {texto ? <Text style={[e.secundario, { marginTop: espacio.md }]}>{texto}</Text> : null}
  </View>
)

export function Vacio({
  icono = 'file-tray-outline',
  titulo,
  texto,
  children,
}: {
  icono?: keyof typeof Ionicons.glyphMap
  titulo: string
  texto?: string
  children?: ReactNode
}) {
  return (
    <View style={e.vacio}>
      <Ionicons name={icono} size={40} color={color.linea} />
      <Text style={[e.tarjetaTitulo, { marginTop: espacio.md }]}>{titulo}</Text>
      {texto ? (
        <Text style={[e.secundario, { textAlign: 'center', marginTop: espacio.xs }]}>
          {texto}
        </Text>
      ) : null}
      {children ? <View style={{ marginTop: espacio.lg }}>{children}</View> : null}
    </View>
  )
}

/** Fila con flecha: la unidad de una lista de ajustes o de un menú. */
export function Fila({
  titulo,
  detalle,
  icono,
  onPress,
  derecha,
  tono,
}: {
  titulo: string
  detalle?: string
  icono?: keyof typeof Ionicons.glyphMap
  onPress?: () => void
  derecha?: ReactNode
  tono?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [e.fila, pressed && onPress ? e.pulsada : null]}
    >
      {icono ? (
        <View style={e.filaIcono}>
          <Ionicons name={icono} size={19} color={tono ?? color.azul} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[e.tarjetaTitulo, tono ? { color: tono } : null]}>{titulo}</Text>
        {detalle ? <Text style={e.secundario}>{detalle}</Text> : null}
      </View>
      {derecha ??
        (onPress ? <Ionicons name="chevron-forward" size={18} color={color.linea} /> : null)}
    </Pressable>
  )
}

/**
 * Aviso de «tienes cambios sin publicar», con los dos botones.
 *
 * Las cuatro pantallas del panel editan sobre una copia y publican al final
 * (ver lib/listaEditable.ts), así que las cuatro necesitan exactamente esto.
 */
export function BarraPublicar({
  guardando,
  alPublicar,
  alDescartar,
}: {
  guardando: boolean
  alPublicar: () => void
  alDescartar: () => void
}) {
  return (
    <View style={e.barra}>
      <Text style={e.barraTexto}>Hay cambios sin publicar</Text>
      <View style={e.barraBotones}>
        <Boton tono="fantasma" onPress={alDescartar} style={{ flex: 1 }}>
          Descartar
        </Boton>
        <Boton
          onPress={alPublicar}
          cargando={guardando}
          icono="cloud-upload"
          style={{ flex: 1 }}
        >
          Publicar
        </Boton>
      </View>
    </View>
  )
}

export const Separador = () => <View style={e.separador} />

const e = StyleSheet.create({
  titulo: { fontSize: 26, fontWeight: '800', color: color.tinta, letterSpacing: -0.5 },
  seccion: { fontSize: 19, fontWeight: '700', color: color.tinta },
  ante: {
    fontSize: 11,
    fontWeight: '700',
    color: color.azul,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cuerpo: { fontSize: 15, color: color.tinta, lineHeight: 21 },
  secundario: { fontSize: 13, color: color.apagado, lineHeight: 18 },
  tarjetaTitulo: { fontSize: 16, fontWeight: '700', color: color.tinta },

  tarjeta: {
    backgroundColor: color.blanco,
    borderRadius: radio.lg,
    padding: espacio.lg,
    borderWidth: 1,
    borderColor: color.linea,
    ...sombra,
  },
  pulsada: { opacity: 0.65 },
  apagado: { opacity: 0.45 },

  franja: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: espacio.xl,
    marginBottom: espacio.md,
  },

  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.sm,
    paddingVertical: 13,
    paddingHorizontal: espacio.lg,
    borderRadius: radio.md,
    borderWidth: 1,
    // 46 pt de alto: por encima del mínimo táctil que piden las dos tiendas.
    minHeight: 46,
  },
  botonTexto: { fontSize: 15, fontWeight: '700' },

  campo: { marginBottom: espacio.lg },
  campoEtiqueta: {
    fontSize: 13,
    fontWeight: '700',
    color: color.tinta,
    marginBottom: espacio.sm,
  },
  campoEntrada: {
    borderWidth: 1,
    borderColor: color.linea,
    borderRadius: radio.md,
    paddingHorizontal: espacio.md,
    paddingVertical: 12,
    // 16 px o más: por debajo, iOS hace zoom al enfocar el campo.
    fontSize: 16,
    color: color.tinta,
    backgroundColor: color.blanco,
    minHeight: 48,
  },
  campoLargo: { minHeight: 110, textAlignVertical: 'top', paddingTop: espacio.md },
  campoAyuda: { fontSize: 12, color: color.apagado, marginTop: espacio.xs },
  campoError: { fontSize: 12, color: color.rojo, marginTop: espacio.xs, fontWeight: '600' },

  carril: {
    flexDirection: 'row',
    backgroundColor: color.tinte,
    borderRadius: radio.md,
    padding: 3,
    gap: 3,
  },
  segmento: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: espacio.sm,
    borderRadius: radio.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  segmentoActivo: {
    backgroundColor: color.blanco,
    // Sombra muy corta: lo justo para que el segmento elegido se despegue del
    // carril sin parecer otra vez un botón flotante.
    shadowColor: '#082139',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentoTexto: { fontSize: 13.5, fontWeight: '600', color: color.apagado },
  segmentoTextoActivo: { color: color.tinta, fontWeight: '700' },

  pildoras: { gap: espacio.sm, paddingRight: espacio.lg },
  pildora: {
    paddingHorizontal: espacio.lg,
    paddingVertical: espacio.sm,
    borderRadius: radio.pastilla,
    // Sin borde ni fondo blanco: apoyadas en el fondo, no flotando sobre él.
    backgroundColor: color.tinte,
    minHeight: 38,
    justifyContent: 'center',
  },
  pildoraActiva: { backgroundColor: color.azul },
  pildoraTexto: { fontSize: 14, fontWeight: '600', color: color.azulOscuro },
  pildoraTextoActivo: { color: color.blanco },

  interruptor: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacio.md,
    paddingVertical: espacio.md,
  },
  casilla: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: color.linea,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaActiva: { backgroundColor: color.azul, borderColor: color.azul },

  etiqueta: {
    paddingHorizontal: espacio.md,
    paddingVertical: 3,
    borderRadius: radio.pastilla,
    alignSelf: 'flex-start',
  },
  etiquetaTexto: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },

  banda: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacio.md,
    padding: espacio.md,
    borderRadius: radio.md,
    marginBottom: espacio.lg,
  },
  bandaTexto: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },

  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl },
  vacio: { alignItems: 'center', paddingVertical: espacio.xxl, paddingHorizontal: espacio.lg },

  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    paddingVertical: espacio.md,
    minHeight: 56,
  },
  filaIcono: {
    width: 38,
    height: 38,
    borderRadius: radio.md,
    backgroundColor: color.tinte,
    alignItems: 'center',
    justifyContent: 'center',
  },

  separador: { height: 1, backgroundColor: color.linea },

  barra: {
    backgroundColor: color.tinta,
    borderRadius: radio.md,
    padding: espacio.md,
    marginBottom: espacio.lg,
    gap: espacio.md,
  },
  barraTexto: { color: color.blanco, fontSize: 14, fontWeight: '700' },
  barraBotones: { flexDirection: 'row', gap: espacio.sm },
})
