import type { NextConfig } from 'next';

/* Orbit Next: export estático → ultrarrápido.
   Todo el trabajo (GitHub API, IA, cifrado) corre en el navegador del usuario:
   el servidor solo entrega archivos, así que un export estático es el diseño
   más rápido y seguro posible. */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  /* GitHub Pages: sitio de proyecto → se sirve en usuario.github.io/Sync-Git-/
     Next antepone automáticamente esta base a next/link, router.push y assets.
     Las pocas rutas que Next no gestiona (manifest, SW, CSS) van prefijadas a mano. */
  basePath: '/Sync-Git-',
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
