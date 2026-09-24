# Guía de estilo — Pilates House (Frontend)

Referencia rápida para cualquier cambio de texto o color en las pantallas públicas. La pantalla de referencia es **`/experience`**: ante la duda, mirá cómo está resuelto ahí.

## Tipografía

Usamos 3 fuentes, cada una con un rol fijo. No mezclar roles.

| Uso | Fuente / token | Regla | Ejemplo |
|---|---|---|---|
| Títulos (`h1`, `h2`, `h3`) | `var(--font-display)` (Gatwick; alternativa Syne) | peso **700**, siempre `text-transform: var(--font-display-case)` (uppercase), `letter-spacing` entre `-.03em` y `-.055em` | "RECUPERARTE TAMBIÉN ES PARTE DEL RITUAL." |
| Cuerpo, descripciones, botones, formularios | `var(--font-body)` (Montserrat) | es la fuente por defecto del `body`; no hace falta declararla en cada componente | "Bajá la temperatura, liberá tensión y devolvele equilibrio a tu cuerpo." |
| Eyebrows / etiquetas chicas arriba de un título | `var(--font-body)` | mayúsculas, `letter-spacing` amplio (`.18em`–`.28em`), tamaño ~`.65rem`–`.7rem` | "AFTER THE HEAT" |
| Acentos editoriales, horarios y precios | `var(--font-editorial)` (alias de Gatwick) | siempre `text-transform: var(--font-display-case)`; también aplica a `--font-number` y `--landing-serif` | "RESET YOUR BODY." |

**Regla rápida:** todo texto que use Gatwick o cualquiera de sus alias se muestra en mayúsculas mediante CSS. La configuración vigente de fuentes y colores está en `app/brand-theme.css`; consultar `BRAND.md`. Los textos originales de la base de datos conservan su escritura.

## Paleta de colores

Todo el sitio público usa los tokens `--landing-*` (definidos en `app/landing-boutique.css`). Los componentes más viejos (`globals.css`, páginas de login/galería/afiliación) usan `--carbon` / `--peach` / `--cream` / `--muted`, que están **igualados** a estos mismos valores — no los desincronices.

| Token | Hex | Uso típico |
|---|---|---|
| `--landing-ivory` | `#fbf5ed` | Fondo base claro |
| `--landing-cream` | `#f2e5d5` | Fondos alternos / secciones |
| `--landing-champagne` | `#efd9c3` | Placeholders de imagen, detalles |
| `--landing-beige` | `#dfc1a0` | Acentos suaves |
| `--landing-sand` | `#cba57d` | Bordes, detalles |
| `--landing-blush` | `#f3d4c6` | Fondos destacados (badges) |
| `--landing-dusty-pink` | `#dfa995` | Acentos |
| `--landing-rose` | `#b97860` | Color de marca, links, eyebrows |
| `--landing-rose-action` | `#955b47` | Hover de botones y links |
| `--landing-cocoa` | `#6c4c38` | Texto secundario oscuro / hover |
| `--landing-ink` | `#33271f` | Texto principal, fondos oscuros |
| `--landing-muted` | `#75604f` | Texto secundario / descripciones |

Nada de grises fríos, azules ni negros neutros: cualquier color nuevo tiene que caer dentro de esta familia beige/pastel cálida (o ser una variación de opacidad de un token existente).

## Checklist antes de mergear

- [ ] ¿Todo texto que usa Gatwick y sus alias declara `text-transform: var(--font-display-case)`?
- [ ] ¿El texto de cuerpo no fuerza una `font-family` propia (hereda Montserrat)?
- [ ] ¿Los colores nuevos salen de la tabla de arriba?
- [ ] ¿Comparaste con `/experience` si tenés dudas?
