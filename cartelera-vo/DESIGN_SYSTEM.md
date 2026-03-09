# VOSE Design System

Sistema de diseño minimalista para VOSE. Inspirado en Apple HIG: jerarquía visual solo con tamaño y peso, mucho espacio negativo, cero decoración innecesaria.

---

## Paleta de colores

| Token | Valor | Uso |
|-------|-------|-----|
| `background` | `#000` | Fondo principal, base de toda la app |
| `text-primary` | `#fff` | Texto principal, títulos, botones activos |
| `text-secondary` | `rgba(255,255,255,0.45)` | Texto secundario, descripciones |
| `text-muted` | `rgba(255,255,255,0.2)` | Placeholders, texto deshabilitado |
| `border` | `rgba(255,255,255,0.08)` | Bordes sutiles, separadores |
| `surface` | `rgba(255,255,255,0.06)` | Fondos de tarjetas, inputs, botones inactivos |
| `green` | `#34c759` | Acciones positivas (VOY, aceptar, éxito) |
| `red` | `#ff453a` | Acciones negativas (PASO, error, eliminar) |
| `gold` | `#c9a84c` | Coincidencias, elementos premium |

### Gradientes

```
Botón activo:     linear-gradient(135deg, #7c3aed, #ec4899)
Poster fallback:  linear-gradient(145deg, #1a1a2e, #302b63)
Overlay inferior: linear-gradient(to top, rgba(0,0,0,0.85), transparent)
Fade lateral:     linear-gradient(to right, #000, transparent)
```

---

## Tipografía

### Familias

| Familia | Peso | Uso |
|---------|------|-----|
| **Moniqa** | 900 | Títulos de marca, headers de tarjetas de película |
| **DM Sans** | 400–700 | Todo el texto del cuerpo, UI, botones |
| `monospace` | 600 | Códigos de invitación |

Fallback: `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`

### Escala de tamaños

| Token | Tamaño | Peso | Uso |
|-------|--------|------|-----|
| `title-xl` | 56px | 900 (Moniqa) | Logo VOSE en login |
| `title-lg` | 26px | 900 (Moniqa) | Título de película en tarjeta |
| `title-md` | 22px | 800 | Encabezados de sección |
| `body` | 15px | 400–600 | Texto principal, botones |
| `caption` | 13px | 500 | Toast, metadatos, sinopsis |
| `small` | 12px | 600 | Etiquetas, pills, timestamps |
| `tiny` | 10px | 700 | Badges, indicadores mínimos |

### Letter spacing

- Títulos Moniqa: `0.06em`
- Texto uppercase: `0.1em`
- Cuerpo: `0` (por defecto)
- Códigos: `0.12em`

---

## Espaciado

Base de 4px. Todos los valores son múltiplos.

| Token | Valor | Uso |
|-------|-------|-----|
| `space-1` | 4px | Separación mínima, padding de badges |
| `space-2` | 8px | Gap interno, separación entre elementos |
| `space-3` | 12px | Padding de pills, gap de componentes |
| `space-4` | 16px | Padding estándar de botones, gap de secciones |
| `space-5` | 20px | Padding horizontal de página |
| `space-6` | 24px | Separación entre secciones |
| `space-8` | 32px | Separación grande entre bloques |

### Contenedor

- Ancho máximo: `430px` (centrado con `margin: 0 auto`)
- Padding horizontal: `20px`
- Bottom nav: `56px` de alto

---

## Border radius

| Token | Valor | Uso |
|-------|-------|-----|
| `radius-sm` | 6px | Poster cards pequeños, badges |
| `radius-md` | 8px | Pills, etiquetas, inputs |
| `radius-lg` | 14px | Botones, tarjetas de contenido |
| `radius-xl` | 20px | Secciones grandes, modales |
| `radius-full` | 50% | Avatares, botones circulares |

---

## Sombras

Solo dos niveles. Menos es más.

| Token | Valor | Uso |
|-------|-------|-----|
| `shadow-card` | `0 20px 60px rgba(0,0,0,0.7)` | Tarjeta principal, modales |
| `shadow-toast` | `0 8px 32px rgba(0,0,0,0.5)` | Toasts, elementos flotantes |

### Backdrop blur

```
Nav bar, toasts:  backdrop-filter: blur(20px)
Pills sobre img:  backdrop-filter: blur(12px)
```

---

## Transiciones

| Token | Valor | Uso |
|-------|-------|-----|
| `transition-fast` | `0.2s ease` | Hover, estados de botón |
| `transition-base` | `0.3s ease` | Cambios de contenido, apariciones |
| `transition-slow` | `0.4s cubic-bezier(0.4, 0, 0.2, 1)` | Transiciones principales, morphing de botones |

### Animaciones

| Nombre | Duración | Uso |
|--------|----------|-----|
| `fadeInUp` | 0.7s | Entrada de elementos al cargar |
| `slideDown` | 0.3s | Badges, notificaciones |
| `spin` | 0.7s | Spinners de carga |
| `marqueeLeft/Right` | 35–50s | Marquee de posters en login |
| `shake` | 0.4s | Error de validación |

---

## Estados interactivos

### Botones

| Estado | Background | Color | Opacidad |
|--------|-----------|-------|----------|
| Default | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.45)` | 1 |
| Hover/Active | `rgba(255,255,255,0.10)` | `#fff` | 1 |
| Disabled | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.15)` | 1 |
| Loading | — | — | 0.7 |
| CTA activo | `gradient(#7c3aed, #ec4899)` | `#fff` | 1 |
| Éxito (VOY) | `#34c759` | `#fff` | 1 |
| Peligro | `#ff453a` | `#fff` | 1 |

### Inputs

| Estado | Border | Color texto |
|--------|--------|-------------|
| Default | `rgba(255,255,255,0.12)` bottom | `#fff` |
| Focus | `rgba(255,255,255,0.35)` bottom | `#fff` |
| Error | `rgba(255,69,58,0.4)` bottom | `#fff` |
| Éxito | `rgba(52,199,89,0.4)` bottom | `#fff` opacity 0.45 |

---

## Componentes base

### Tarjeta (Card)

```
background: rgba(255,255,255,0.04)
border: 1px solid rgba(255,255,255,0.06)
border-radius: 20px
padding: 16px
```

### Pill / Tag

```
background: rgba(0,0,0,0.65) + backdrop-filter: blur(12px)
border-radius: 8px
padding: 5px 10px
font-size: 12px
font-weight: 700
```

### Badge (notificación)

```
background: #ff453a
border-radius: 8px
min-width: 16px
height: 16px
font-size: 9px
font-weight: 800
padding: 0 4px
```

### Toast

```
background: rgba(24,24,28,0.92) + backdrop-filter: blur(20px)
border: 1px solid rgba(255,255,255,0.06)
border-radius: 14px
padding: 13px 16px
box-shadow: shadow-toast
```

### Bottom Nav

```
background: rgba(0,0,0,0.85) + backdrop-filter: blur(20px)
height: 56px
position: fixed bottom
border-top: 1px solid rgba(255,255,255,0.06)
```

---

## Principios

1. **Negro absoluto** — El fondo siempre es `#000`. Sin grises. El contenido flota sobre la oscuridad.
2. **Jerarquía por opacidad** — No usamos colores de texto distintos. Controlamos jerarquía con la opacidad del blanco: 1.0 → 0.45 → 0.2 → 0.08.
3. **Un acento a la vez** — Verde para positivo, rojo para negativo, gold para especial. Nunca dos acentos compitiendo.
4. **Espacio generoso** — En caso de duda, más espacio. El contenido respira.
5. **Transiciones sutiles** — Todo movimiento es suave (0.2–0.4s). Nada salta.
6. **Mobile first** — 430px max-width. Todo se diseña para el pulgar.
