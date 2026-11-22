# Orbit Next v4.1 — Next.js · Liquid Glass o Material 3 Expressive (bajo consumo)

El centro de mando personal de GitHub, reconstruido como **aplicación Next.js
(App Router, TypeScript, export estático)** con la librería
**@zakisheriff/liquid-glass v4** (refracción real estilo iOS 26).

## Qué cambió respecto al HTML único

| Antes (github-orbit.html) | Ahora (Orbit Next) |
| --- | --- |
| Un archivo con todo inline | Proyecto Next.js 15 + TypeScript estricto (build verifica tipos) |
| Glass casero (backdrop-filter) | **Liquid Glass real**: refracción Snell por bevel, lentes que magnifican, wobble jelly |
| Controles propios | GlassButton · GlassSwitch · GlassSegmented · GlassSlider · GlassInput · GlassCard · GlassSheet · GlassNav |
| PWA manual | PWA (SW + manifest + iconos) sobre el export estático |
| Render con nginx | **GitHub Pages**: workflow de Actions → build → deploy automático |

Todo el motor de GitHub se portó completo: **subida delta por SHA-1 con
verificación ruta por ruta, sincronización espejo (sha:null), reintentos si la
rama avanzó, PRs (comentar/fusionar/cerrar), issues (crear/comentar/cerrar),
creación y borrado de repos, bóveda AES-256-GCM (PBKDF2 150k), NetKeep con
objetivo de caudal, IA multi-proveedor (OpenAI · GLM · Gemini), PWA instalable,
háptica y título vivo con la cuota.**


## Novedades v3.0 — paridad total con el HTML original

- **Code Explorer** (`/code/`): árbol de archivos real del repo, visor con resaltado de sintaxis y números de línea, búsqueda interna con saltos, copiar/descargar, **edición con commit real**, previsualización de Markdown/HTML (iframe aislado) y **comparador de ramas** con diff archivo por archivo.
- **Chat en lenguaje natural**: el mismo parser de intents del original («muéstrame mis repositorios», «compara main con development», «crea una rama llamada development», «busca archivos que contengan X», «prepara un pull request»…) con **tarjetas visuales** en la conversación, markdown, saludos, cambio de tema por voz y bienvenida con referencia de comandos.
- **IA con superpoderes**: el modelo recibe el contexto de tu cuenta y puede **ejecutar comandos por ti** con bloques ```orbit {"command":…}```; además, «Ver modelos disponibles» lista los modelos reales de tu clave en el proveedor.
- **Ficha de repositorio**: pestañas Información · Ramas (crear/eliminar) · Commits · Tags · **Releases con paquetes adjuntos** (hasta 350 MB por archivo, ventana de reconsideración de 120 s, subida directa a uploads.github.com con progreso y reintentos).
- **Repositorios**: filtros por lenguaje, orden (recientes/A-Z/★), vista tarjetas/lista, **menú contextual** (clic derecho): ficha, Code Explorer, fork, cambiar visibilidad, eliminar escribiendo el nombre.
- **Pull Requests globales** de toda la cuenta con **diff de archivos del cambio**, revisión (aprobar / pedir cambios / comentar), merge (merge/squash/rebase) y **asistente de creación** con confirmación.
- **Issues globales** con filtro por etiquetas, creación con etiquetas y **edición** de título/descripción.
- **Explorer reforzado**: detección de **secretos** (.env, .pem, id_rsa…) excluidos por defecto con interruptor explícito, normalización Zero Trust de rutas y **comparación lado a lado** (tu versión vs la del repo) antes de subir.
- **Seguridad Zero Trust**: redacción automática de tokens en pantalla, auditoría de credenciales en Control Center, verificación de integridad SHA-1 al leer blobs.
- **Rail de actividad** en la barra lateral con las operaciones recientes y **búsqueda global** de repos.
- **Guía** integrada: conceptos en palabras simples, comandos y notas de seguridad.


## Novedades v3.1

- **Modo «Reducir movimiento» = AMOLED**: al activarlo se ocultan y deshabilitan los temas y la sección de acentos, el tema **AMOLED** aparece como única opción y se fuerza el modo oscuro AMOLED (negro puro, sin aurora). Al desactivarlo vuelven los temas y acentos normales y AMOLED desaparece.
- **Barra de navegación única**: eliminado el menú lateral (redundante); la barra flotante es la única navegación, siempre centrada y **sin desborde horizontal** (580 px en escritorio, ocupa todo el ancho útil en móvil con los 8 iconos).
- **Tamaños adaptados**: títulos y píldoras de la topbar se recortan con elipsis, filas/botones/fichas encogen antes de desbordar; verificado sin scroll horizontal a 375 px.
- **Iconos originales del HTML**: favicon y los tres iconos de la PWA (192, 512 y 512-maskable) reconstruidos desde el logo «orbit» original (elipse rotada −18° + satélite); el Service Worker los distribuye con caché v3.1 y el logo original también preside la topbar.
- **Búsqueda global y actividad**: ahora en hoja desde la topbar y en Control Center, respectivamente (antes vivían en el menú lateral eliminado).


## Novedades v3.2

- **Barra de navegación Liquid Glass propia**: la «gota» líquida ahora es CSS puro (variables `--lnav-i`/`--lnav-n`) y se desliza con acento bajo **cualquiera de los 8 iconos** — antes, a partir del 4º, la lente del componente de terceros se desalineaba y no mostraba el acento del icono activo.
- **IA multi-proveedor**: selector en modal con **11 proveedores** (OpenAI, Claude · Anthropic, DeepSeek, Grok · xAI, GLM · Z.ai, Gemini, Mistral, OpenRouter, Groq, Ollama local y endpoint personalizado); campo de **API Key con ojo mostrar/ocultar** mientras se escribe; **URL Base opcional** y **clave adicional** para gateways/proxies cuando se usa URL personalizada. Reglas de seguridad: la clave guardada **nunca se vuelve a mostrar** (el campo siempre nace vacío; solo se reemplaza).
- **Scopes reales del token → funciones**: la app lee `X-OAuth-Scopes`, mapea cada scope a funciones en lenguaje natural (tarjeta «Scopes y funciones de tu token» en Control Center), **oculta del menú las secciones que el token no permite** y muestra en cada página un aviso explicando qué scope falta y por qué. Los tokens fine-grained (sin cabecera de scopes) se detectan y se habilitan con nota informativa.
- El compositor del chat ya no queda tapado por la barra flotante.


## Novedades v3.3

- **GlassNav del vendor de vuelta, sin overrides**: la barra vuelve a ser el componente `GlassNav` de `@zakisheriff/liquid-glass` tal y como está diseñado. La causa real del bug del 4º icono era geométrica: el componente reserva **68px por pestaña** (`--lg-item-w`); con 8 pestañas el track necesita 552px y en un móvil de 375px desbordaba, desalineando la lente de forma progresiva. Ahora la barra respeta esa geometría con sets por viewport: **8 pestañas con etiquetas (≥640px), 5 + «Más» (≥432px), 4 + «Más» (≥364px) y 3 + «Más» por debajo** — la lente queda alineada al 100% en cada pestaña (verificado por solape 68/68 en todas).
- **Hoja «Más»** (patrón iOS) con las secciones fuera de la barra, icono + descripción, sobre GlassSheet.
- **Modal de proveedores con scroll real**: `.picker-list` ahora es scrollable (`overflow-y: auto`, `touch-action: pan-y`, `overscroll-behavior: contain`) — no interfiere con el arrastre del sheet (el gesto vive en `.lg-sheet__grabber-zone`); se llega al fondo de los 11 proveedores sin cortes.
- **Sección IA reordenada**: Proveedor → API Key → URL Base → Modelo con textos concisos; el ojo de mostrar/ocultar convive con el botón de limpiar (×) del vendor; tocar el ojo **no** guarda (preventDefault en mousedown) y la clave guardada sigue sin mostrarse jamás.
- Compositor del chat re-ajustado a la altura de GlassNav (68px) para no quedar tapado.


## Novedades v3.4 — tema de bajo consumo (Material 3 Expressive)

- **Dos motores visuales intercambiables**: `Liquid Glass` (vendor, con blur y refracción SVG) y
  `Bajo consumo` basado en **Material 3 Expressive** (`@grenishrai/expressive` + Tailwind CSS v4 +
  Base UI + `motion`): **scheme de color expressive, motion scheme `fluid`, motion engine `motion`**,
  seed `#0a84ff` (el acento de Orbit) y corner scale expressive. El motor Expressive elimina por
  completo los `backdrop-filter` y los filtros SVG de refracción (verificado: 0 elementos con blur
  en marcha vs 7 en Liquid Glass) — la RAM que consume el glass desaparece.
- **Detección automática por User-Agent**: `Android ≤ 13` arranca en **Bajo consumo**;
  `Android ≥ 14` y el resto (iOS/desktop) en **Liquid Glass**. Se aplica antes del primer paint
  (script inline) y en el arranque de la app (`detectAndroidVersion()` / `effectiveEngine()`).
- **Cambio manual sin recargar**: Control Center → Apariencia → «Motor visual»
  (Auto / Liquid Glass / Bajo consumo). La elección se guarda y manda sobre la detección;
  «Reducir movimiento» fuerza Bajo consumo + AMOLED (superficie negra real también en Material).
- **Arquitectura**: capa adaptadora `components/ui` — las páginas importan `AppButton as GlassButton`
  etc., así el JSX de la app no cambió y cada pieza (botón, input, switch, card, sheet, segmented,
  slider, barra de navegación) resuelve con el motor activo. Dark mode de Material sincronizado con
  la clase `.dark` en `<html>`.
- **Tailwind CSS v4 sin preflight** (`theme + utilities` por capas) para no alterar el CSS propio de
  Orbit; el puente `@theme inline` + utilities del registry Expressive vive en `app/expressive.css`
  junto al tema generado (`.dark`, springs fluid, prefers-reduced-motion → sin motion).


## Novedades v3.5 — correcciones de uso

- **Pull Requests funcionan de nuevo**: la sección fallaba porque la API de GitHub no
  tiene un endpoint global `/pulls` (devolvía 404 → «Failed to fetch»). Ahora se recorren
  tus repos con `gh.pulls()` en tandas de 4 y se ordena todo por actividad; cada fila
  muestra su repositorio, rama y autor, igual que la pestaña de Issues. El chat («mis PRs»)
  usa el mismo método.
- **Explorer · subida**: se restauró la **eliminación automática de la carpeta raíz**
  (ZIP de GitHub `repo-main/`, carpeta arrastrada…) con fila «Quitar carpeta raíz» en
  Control del formulario: detecta la raíz común, la quita y te lo muestra. El plan se
  ordena **en árbol** (por carpetas, como GitHub) y las rutas envuelven línea a línea
  (antes nowrap + elipsis).
- **Material 3 Expressive legible**: el CSS legacy de Orbit (`button { color: inherit }`,
  sin capa) pisaba las utilidades de Material. Ahora vive en `@layer app` (por debajo de
  las utilidades de Tailwind) — botones rellenos/tonales/destructivos miden **6.0–6.1:1**
  de contraste en claro y oscuro (antes «casi ilegibles»), incluida la bóveda y datos locales.
- **Modales moderados**: hoja Expressive a 520px máx. (antes 560) y sin desbordes
  horizontales verificados en móvil.
- **Campos más claros**: los inputs de token/API usan la variante **outlined** de Material
  (caja completa) en lugar de la de línea inferior, menos confusa.


## Novedades v3.6 — actualizador en vivo y ajustes de flujo

- **Actualización EN VIVO restaurada** (portado del HTML original): píldora «EN VIVO /
  PAUSADO» en la barra con cuenta atrás, botón ⟳ para refrescar al momento y fila en
  Control para activarla y elegir el intervalo (30 s / 1 min / 2 min / 5 min). Refresca
  la vista actual sin recargar: repos, PRs, issues, árbol del editor y re-análisis
  silencioso de la subida. Guardas del original intactas: se pausa si hay un diálogo
  abierto, estás escribiendo, la pestaña está oculta o la cuota de API baja de 30.
- **Editor sin auto-entrada**: ya no abre el último repo usado; muestra las tarjetas
  de repos para elegir cuál revisar o editar (solo el chat puede abrir uno directamente).
- **Textos «en bajada» corregidos**: en filas con campo de texto (API Key de IA, URL
  Base, Modelo, mensaje de commit, token) el campo apretaba el texto de la fila hasta
  una letra por línea. Ahora el texto conserva su línea completa y el campo pasa debajo
  a ancho completo.
- **Subida con confirmación y flujo limpio**: «Subir N archivos» abre una hoja de
  confirmación con el resumen (nuevos/cambiados → repo · rama); tras subir con éxito se
  vacían el mensaje del commit, la cola de archivos y el repo elegido (el resultado
  verificado queda a la vista).
- **Corrección de fondo**: los repos con árbol vacío (p. ej. recién creados) daban 404
  al listar el árbol; ahora se pela commit→árbol y el vacío se trata como lista vacía.


## Novedades v3.7 — subida a repos vacíos, scopes revalidados y destino seguro

- **Subida a repositorios vacíos o nuevos (404 corregido de raíz)**: el error
  «Recurso no encontrado (404): /repos/…/git/trees/…» ocurría porque el sha del
  commit se usaba como sha de árbol, y el árbol vacío de Git (4b825dc…) no es
  consultable en la API. Ahora se pela commit→árbol y el árbol vacío se trata
  como lista vacía: el análisis marca todo como «nuevo» y el commit se crea sin
  padre, creando la rama (refs) en el primer envío. Verificado con un repo
  scratch creado al momento (subida real → verificación → borrado).
- **Subida forzada (sobrescribir)**: interruptor en Explorer que reenvía también
  los archivos idénticos (misma ruta y mismo SHA), útil para reaplicar contenido
  completo o forzar estado en repos nuevos.
- **Destino sin preselección**: Explorer ya no trae un repo elegido; eliges
  repositorio y rama explícitamente en cada subida.
- **Confirmación al cambiar de repo con cola**: interruptor «Confirmar cambio de
  repo» (activable/desactivable): si hay archivos en cola y cambias de destino,
  pide confirmación y recalcula carpeta raíz y plan sin perder la cola.
- **Texto «en bajada» corregido para siempre**: el texto de cualquier fila ya no
  puede colapsar a una letra por línea (mínimo 210 px y corte de palabra sano);
  afectaba a «Actualización en vivo» por el control de intervalo.
- **Scopes revalidados y ampliados**: jerarquía admin⊃write⊃read expandida, seis
  capacidades nuevas (paquetes, proyectos, discusiones, enterprise, webhooks,
  claves), relectura automática de scopes en cada respuesta y botón «Revalidar
  ahora» en Control.


## Novedades v3.8 — ruta de destino específica por archivo

- **«Ruta de destino del archivo» en la sección Destino** (Explorer): cada archivo
  en cola muestra un campo editable con la carpeta y el nombre exactos con los
  que se subirá dentro del repo. Sirve sobre todo para enviar un archivo
  individual a una ubicación concreta: carpetas anidadas («docs/guías/nota.txt»)
  o la raíz del repo (deja solo el nombre, fuera de carpetas).
- La ruta específica tiene prioridad sobre la detectada y sobre el recorte de
  carpeta raíz; vaciar el campo restaura la ruta detectada automáticamente.
- Normalización al salir del campo (barras sanas, sin «..» ni rutas absolutas)
  y aviso visual cuando dos archivos quedan con la misma ruta de destino; el
  commit se detiene con un error claro si eso ocurre (antes GitHub fallaría).
- Verificado end to end con un repo real: archivo enviado a «docs/sub/…» y a la
  raíz, tanto en repos con historial como en uno vacío (primer commit con la
  Contents API respeta la ruta elegida, creando las carpetas).


## Novedades v3.9 — Control: reemplazo de token y «Recordar» estricto

- **«Reemplazar token»** junto a «Desconectar» (Control Center): abre una hoja
  donde pegas el token nuevo, se verifica contra GitHub y sustituye al actual
  en toda la app al instante; si falla la verificación, el token anterior
  sigue activo y el error se muestra en la hoja. Con bóveda desbloqueada, el
  nuevo token se re-sella cifrado automáticamente.
- **«Recordar durante la sesión» en modo estricto**: siempre activada por
  defecto y sin posibilidad de desactivarla (el interruptor queda fijado).
- **La bóveda tiene precedencia**: si existe una bóveda en el dispositivo,
  «Recordar» no tiene efecto ninguno (el interruptor se deshabilita y así lo
  dice su texto) — la restauración pasa por desbloquear la bóveda, también en
  el arranque de la app.
- **La bóveda guarda token y claves API** (proveedor, clave, URL base, modelo
  y clave de gateway): en disco solo viven cifradas dentro de la bóveda cuando
  está desbloqueada; al desbloquear se restauran en la sesión y al cambiar
  alguna se re-sella sola. Al eliminar la bóveda, las claves vuelven al
  almacenamiento local en claro (como antes).


## Novedades v4.0 — Subida y releases: correcciones y funciones nuevas

- **Modal «Subir al repositorio» ya no puede desbordar la página**: guardas
  anti-desborde horizontal globales (overflow-x: clip en el documento,
  max-width: 100vw en sheets/dialogs y corte de palabras largas). Ningún modal
  vuelve a ensanchar ni inclinar el sitio, en ningún motor ni pantalla.
- **Adjuntos de release: modo compatible.** GitHub bloquea la subida directa
  a uploads.github.com desde navegadores (no responde a las preflights CORS —
  verificado contra la API real; por eso «No se pudo conectar»). La subida
  directa se reintenta y, si el navegador no puede, un botón «Modo compatible:
  al repo + enlace» publica cada archivo en la rama `release-assets` con la
  Contents API y añade los enlaces de descarga al cuerpo de la release.
- **Eliminar releases, tags y adjuntos** (Repositorio → Releases/Tags), con
  confirmación escribiendo el nombre: eliminar release no toca el código ni el
  tag; eliminar adjunto deja el resto de la release intacta.
- **Crear tags** desde la pestaña Tags (apuntan a la rama por defecto) y
  **copiar URL HTTPS / URL de clonación git** en el menú contextual de cada
  repo (los tres puntos) y en la ficha (Información → Copiar URL HTTPS).
- **Descartar archivos antes de subir**: botón en cada fila de «Ruta de
  destino» y columna «Quitar» en el árbol organizado del plan — saca el
  archivo de la cola y del plan sin re-analizar lo demás.


## Novedades v4.1 — Auditoría E2E completa del sitio

Recorrido funcional de TODAS las páginas y funciones contra la API real
(repositorio de pruebas `orbit-test-lab`), con este resultado:

**Corregidos (bugs reales encontrados al probar)**
- Eliminar rama borraba al primer clic sin confirmación: ahora exige
  confirmación escribiendo el nombre de la rama (como eliminar repo/tag/release).
- Crear rama dejaba la lista desactualizada (stale closure de la recarga).
- El aviso de «secretos excluidos» se reiniciaba al añadir más tandas de
  archivos (p. ej. tras importar un ZIP): ahora se deriva siempre de la cola.
- La bóveda no ofrecía crearse estando conectado (había que desconectarse a
  ciegas): la fila de Bóveda ofrece ahora «Crear bóveda» también conectado.

**Mejoras**
- `config.env` y cualquier `*.env` se tratan como posibles credenciales
  (excluidos por defecto, incluyibles a propósito).
- Los errores 422 de GitHub ahora muestran el detalle real («No commits between
  main and pr-rama», «A pull request already exists»…) en vez de un genérico.
- Los selectores de rama del asistente de PR se titulan «Rama origen (head)» y
  «Rama destino (base)» (antes ambos decían lo mismo y se confundían).
- Botón «Reabrir PR» en PRs cerrados sin fusionar (simétrico con «Reabrir» de
  los issues).
- Botón «Quitar clave» para eliminar una clave API guardada sin borrar todo.
- «Borrar datos locales» exige escribir BORRAR antes de ejecutarse.
- Accesibilidad: aria-label en «Crear rama», «Editar archivo» y demás botones
  de icono que carecían de etiqueta.

**Probado y funcionando (sin cambios necesarios)**
Subida delta con verificación SHA (textos, binarios y ZIP64), rutas
específicas, diff local-vs-repo, sincronizar espejo, subida forzada, descartar
archivos, releases con modo compatible, eliminar release/tag/adjunto, crear
tags, crear/visibilidad/fork/eliminar repositorios, PRs (crear, comentar,
revisar, fusionar, cerrar, reabrir), issues (ciclo completo + editar),
Code Explorer (árbol, visor con resaltado, búsqueda, edición con commit real,
comparador de ramas), bóveda AES-256 (crear, bloquear, desbloquear, restaurar),
reemplazo de token con verificación, NetKeep EN VIVO, motores glass/expressive
y temas claro/oscuro, borrado local con confirmación.

## Rendimiento

- **Export estático** (`output:'export'`): no hay servidor de app — el
  servidor solo entrega archivos y todo (API, IA, cifrado) corre en tu
  navegador. Lo más rápido y lo más privado posible.
- **First Load JS ≈ 136 kB** por página (React + Liquid Glass incluidos).
- Assets con hash en `/_next/static/` → caché inmutable de un año.
- Imágenes desoptimizadas (`unoptimized`) — no hay loader innecesario.

## Desarrollo local

```bash
npm install
npm run dev        # http://localhost:3000/Sync-Git-/
npm run build      # genera ./out (export estático, listo para Pages)
```

## Despliegue en GitHub Pages

1. Pages ya configurado con **Source: GitHub Actions** (build_type `workflow`).
2. Cada `git push` a `main` ejecuta `.github/workflows/deploy.yml`:
   `npm ci` → `next build` → `actions/upload-pages-artifact` → `actions/deploy-pages`.
3. URL: `https://lenoxlkz.github.io/Sync-Git-/` — `public/.nojekyll` evita que
   Jekyll descarte la carpeta `_next/`.

El sitio es un **sitio de proyecto** (`/Sync-Git-`), por eso
`next.config.ts` fija `basePath: '/Sync-Git-'` y `trailingSlash: true` (así
`/repos/` resuelve a `repos/index.html` y los enlaces profundos nunca dan 404).
El manifest usa rutas relativas y el service worker deduce la base de su propio
scope, así que la PWA sigue instalable. Público por diseño: la app no tiene
secretos en el servidor (el PAT va cifrado en el navegador de cada usuario).

## Componentes glass usados (mapa)

- **Navegación**: GlassNav flotante inferior (móvil) + sidebar glass propia (escritorio).
- **Botones**: GlassButton (filled/tinted/glass, destructive, icon, href-as-link).
- **Toggles**: GlassSwitch (recordar sesión, bóveda, NetKeep, espejo, privado, reducir movimiento).
- **Segmented**: GlassSegmented (tema, proveedor IA, estado PRs/issues, método de merge).
- **Sliders**: GlassSlider `showThumb={false}` (bloque Control Center para el caudal de NetKeep).
- **Inputs**: GlassInput (PAT tipo password, búsquedas `type=search`, comentarios, commit).
- **Sheets**: GlassSheet (pickers de repo/rama con `detents:['medium','large']`, confirmaciones destructivas, bóveda, detalle PR/issue).
- **Cards**: GlassCard (listas, stats, plan de subida, reporte verificado).

El tema se aplica con `data-theme="light|dark"` en `<html>` (auto/light/dark en
Control Center, sin flash gracias al script pre-paint en `layout.tsx`).

## Notas

- El PAT y la clave de IA **nunca** salen de tu navegador; viajan únicamente a
  api.github.com y al endpoint de tu proveedor de IA.
- NetKeep apagable; se retira solo cuando la app hace trabajo real.
- `npm ci` en Actions usa `package-lock.json` — está incluido en el repo.
