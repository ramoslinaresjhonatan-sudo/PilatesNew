# Identidad visual compartida

`app/brand-theme.css` es la única fuente de colores y familias tipográficas para la landing, páginas públicas, acceso y paneles de administración, recepción y estudiantes. Se carga desde `globals.css`.

Paleta del manual: cacao `#523A28`, blanco `#FFFFFF`, durazno `#F1D1B8`, dorado `#BE9E6F` y topo `#927055`. Las superficies, bordes y texto secundario se derivan de estas variables. Los estados funcionales tienen sus propios tokens `--status-*` para conservar su significado.

Utilizar `var(--color-cocoa)`, `var(--surface)`, `var(--text-muted)` y los demás tokens en componentes nuevos. No definir otra paleta por página. Los nombres `--landing-*`, `--panel-*` y los nombres antiguos son alias del mismo tema.

## Tipografías originales pendientes

Gatwick siempre se presenta en MAYÚSCULAS mediante `text-transform: var(--font-display-case)`. La variable se define como `uppercase` en `app/brand-theme.css`. Esta regla también cubre sus alias `--font-editorial`, `--font-number` y `--landing-serif`, incluso mientras se utiliza Syne como alternativa. No convertir los textos de la API ni los valores de los formularios a mayúsculas: la transformación es visual.

El PDF muestra las fuentes, pero no proporciona archivos web completos. No están instaladas en este repositorio. Las familias están preparadas en el tema y actualmente usan alternativas locales explícitas:

| Uso | Fuente del manual | Alternativa temporal |
| --- | --- | --- |
| Texto e interfaz | Agrandir | Montserrat |
| Títulos y cifras | Gatwick | Syne |
| Etiquetas destacadas | Sifonn | Montserrat |
| Acentos caligráficos | Sloop Script Pro | Pinyon Script |

Los botones de toda la interfaz (incluidos enlaces con apariencia de botón) usan `--font-button`, alias de Sifonn. Los subtítulos decorativos de la landing usan `--font-subtitle-decorative`, alias de Sloop Script Pro, conservando la escritura original y un tamaño legible. Los subtítulos funcionales de paneles y formularios mantienen Agrandir. Estas reglas se encuentran en `app/brand-theme.css`.

Fuentes oficiales consultadas el 19 de septiembre de 2026:

- Gatwick: https://pangrampangram.com/products/gatwick
- Agrandir: https://pangrampangram.com/products/agrandir
- Licencias y formatos WOFF2 de Pangram Pangram: https://pangrampangram.com/pages/faq (las pruebas gratuitas no cubren el uso comercial).
- Sifonn, publicación del diseñador: https://www.behance.net/gallery/11396221/SIFONN-Typeface (indica que Basic y Outline ya no están disponibles gratuitamente).
- Sloop Script: https://fonts.adobe.com/fonts/sloop-script y https://typenetwork.com/articles/sloop-script-sails-the-seven-seas

Cuando se disponga de archivos con licencia web, guardarlos en `public/fonts/` y añadir sus declaraciones `@font-face` exclusivamente en `app/brand-theme.css`, con los nombres de familia de la tabla. Declarar el peso real de cada archivo; solo usar rangos para fuentes variables. No es necesario cambiar los componentes. Para Adobe Fonts se necesita el proyecto web del titular y su hoja de estilos autorizada; su activación de escritorio no equivale a archivos para autoalojar.

No se añadieron rutas a fuentes inexistentes ni se descargaron versiones de prueba para producción.
