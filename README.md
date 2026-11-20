# GitHub Orbit — Next.js + Liquid Glass · v3.1

Centro de mando personal de GitHub: chat en lenguaje natural con IA que ejecuta
comandos, repos con ficha y releases, PRs con diff y revisión, issues, Code
Explorer con editor y comparador de ramas, **subida delta por SHA-1 verificada
ruta por ruta**, bóveda cifrada AES-256-GCM y NetKeep. Construido con
**Next.js 15 (App Router, TypeScript)** y **@zakisheriff/liquid-glass v4**
(refracción real estilo iOS 26). El token y las claves viven solo en tu
navegador; el servidor no guarda nada.

## Estructura

```
app/            8 vistas: Chat · Repos · PRs · Issues · Explorer · Code · Control · Guía
components/     AppShell, ficha de repo, releases, tarjetas de chat, diff, toasts
lib/            GitHub API, upload delta, código (diff/highlight), IA, bóveda, NetKeep
public/         PWA: manifest, service worker, iconos, .nojekyll
.github/        workflow de despliegue automático a GitHub Pages
next.config.ts  export estático + basePath /Sync-Git- (GitHub Pages)
```

## Despliegue en GitHub Pages (automático)

1. Settings → Pages → **Build and deployment → Source: GitHub Actions**
   (si ya se activó una vez por API no hace falta tocar nada).
2. Cada `git push` a `main` lanza `.github/workflows/deploy.yml`:
   `npm ci` → `next build` (export en `out/`) → deploy a Pages.
3. URL pública: `https://lenoxlkz.github.io/Sync-Git-/`

El `basePath: '/Sync-Git-'` de `next.config.ts` es imprescindible para Pages
(sitio de proyecto, no de usuario): cambia el nombre del repo y cámbialo ahí.

## Desarrollo local

```bash
npm install
npm run dev        # http://localhost:3000/Sync-Git-/
npm run build      # export estático en ./out
```

## Notas

- El PAT se pega en **Control Center** (scope `repo` en tokens classic; en
  fine-grained, permisos de Contents). Opcionalmente se guarda cifrado en una
  bóveda local (AES-256-GCM, PBKDF2 150k).
- La IA (OpenAI · GLM · Gemini) se configura también en Control Center; la
  clave viaja solo al endpoint del proveedor elegido.

Detalles completos: [`LEEME-NEXT.md`](LEEME-NEXT.md).
