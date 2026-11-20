# Orbit Next v2.0 — Next.js + Liquid Glass

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
| Render con nginx | Igual: Docker multi-stage (build Node → nginx) + Basic Auth opcional |

Todo el motor de GitHub se portó completo: **subida delta por SHA-1 con
verificación ruta por ruta, sincronización espejo (sha:null), reintentos si la
rama avanzó, PRs (comentar/fusionar/cerrar), issues (crear/comentar/cerrar),
creación y borrado de repos, bóveda AES-256-GCM (PBKDF2 150k), NetKeep con
objetivo de caudal, IA multi-proveedor (OpenAI · GLM · Gemini), PWA instalable,
háptica y título vivo con la cuota.**

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
npm run dev        # http://localhost:3000
npm run build      # genera ./out (export estático)
```

## Despliegue en Render (uso exclusivo personal)

1. Sube esta carpeta a un repo privado de GitHub.
2. Render → **New → Web Service** → conecta el repo → el Dockerfile multi-stage
   se detecta solo (build Node → nginx).
3. Variables de entorno (acceso exclusivo personal):
   - `BASIC_AUTH_USER` y `BASIC_AUTH_PASS` — sin ellas el sitio queda abierto.
4. Health Check Path: `/healthz`. Cada `git push` redespliega.

Alternativas: cualquier hosting estático sirve `out/` tal cual
(vercel/Netlify/GitHub Pages), o `npm run start` en un servicio Node.

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
- `npm ci` en Docker usa `package-lock.json` — está incluido tras el build.
