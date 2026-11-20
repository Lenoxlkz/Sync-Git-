# GitHub Orbit — Next.js + Liquid Glass

Centro de mando personal de GitHub: chat con comandos e IA, repos, pull
requests, issues, **subida delta por SHA-1 con verificación ruta por ruta**,
sincronización espejo, bóveda cifrada AES-256-GCM y NetKeep. Construido con
**Next.js 15 (App Router, TypeScript)** y **@zakisheriff/liquid-glass v4**
(refracción real estilo iOS 26). El token y las claves viven solo en tu
navegador; el servidor no guarda nada.

## Estructura

```
app/                      páginas (Chat, Repos, PRs, Issues, Explorer, Control Center)
components/               AppShell, iconos, toasts y piezas glass reutilizables
lib/                      GitHub API, upload delta, bóveda AES, IA, ZIP, NetKeep, store
public/                   PWA: manifest, service worker, iconos, .nojekyll
.github/workflows/        deploy.yml — build y despliegue automático a GitHub Pages
next.config.ts            export estático + basePath /Sync-Git- (GitHub Pages)
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
