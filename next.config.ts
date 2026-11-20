import type { NextConfig } from 'next';

/* Orbit Next: export estático → ultrarrápido.
   Todo el trabajo (GitHub API, IA, cifrado) corre en el navegador del usuario:
   el servidor solo entrega archivos, así que un export estático es el diseño
   más rápido y seguro posible. */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
