# GitHub Orbit — Next.js + Liquid Glass

Centro de mando personal de GitHub: chat con comandos e IA, repos, pull
requests, issues, **subida delta por SHA-1 con verificación ruta por ruta**,
sincronización espejo, bóveda cifrada AES-256-GCM y NetKeep. Construido con
**Next.js 15 (App Router, TypeScript)** y **@zakisheriff/liquid-glass v4**
(refracción real estilo iOS 26). El token y las claves viven solo en tu
navegador; el servidor no guarda nada.

## Estructura

```
app/          páginas (Chat, Repos, PRs, Issues, Explorer, Control Center)
components/   AppShell, iconos, toasts y piezas glass reutilizables
lib/          GitHub API, upload delta, bóveda AES, IA, ZIP, NetKeep, store
public/       PWA: manifest, service worker, iconos
Dockerfile    build multi-stage (Node → nginx) para Render
start.sh      nginx con Basic Auth opcional + /healthz
render.yaml   Blueprint de Render (servicio Docker + variables)
```

## Despliegue en Render (2 minutos)

1. Sube este repo a GitHub (el `.gitignore` ya excluye `node_modules/` y `out/`).
2. En Render: **New → Blueprint** y elige el repo — detecta `render.yaml`.
3. Rellena las dos variables (acceso exclusivo personal):
   - `BASIC_AUTH_USER` · `BASIC_AUTH_PASS` — sin ellas el sitio queda abierto.
4. Deploy. Health check: `/healthz`. Cada `git push` redespliega.

También funciona en cualquier hosting estático tras `npm run build` (carpeta
`out/`), o local con:

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # export estático en ./out
```

## Notas

- El PAT se pega en **Control Center** (scope `repo` en tokens classic; en
  fine-grained, permisos de Contents). Opcionalmente se guarda cifrado en una
  bóveda local (AES-256-GCM, PBKDF2 150k).
- La IA (OpenAI · GLM · Gemini) se configura también en Control Center; la
  clave viaja solo al endpoint del proveedor elegido.

Detalles completos: [`LEEME-NEXT.md`](LEEME-NEXT.md).
