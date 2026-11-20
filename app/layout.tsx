import type { Metadata, Viewport } from 'next';
import '@zakisheriff/liquid-glass/styles.css';
import './globals.css';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'GitHub Orbit — Centro de mando personal',
  description: 'Centro de administración personal de GitHub: chat con IA, repos, PRs, issues, subida delta verificada y sincronización espejo. Next.js + Liquid Glass.',
  manifest: '/Sync-Git-/manifest.webmanifest',
  icons: { icon: '/Sync-Git-/favicon.svg', apple: '/Sync-Git-/icons/icon-192.png' },
  appleWebApp: { capable: true, title: 'Orbit', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#06060a',
};

/* Tema antes del primer paint: sin flash. data-theme en <html> gobierna
   también las variables de Liquid Glass. «Reducir movimiento» fuerza AMOLED. */
const themeScript = `(()=>{try{
  var p=JSON.parse(localStorage.getItem('orbit.prefs')||'{}');
  var t=p.theme||'auto';
  var sys=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  if(p.reduceMotion){
    document.documentElement.dataset.theme='dark';
    document.documentElement.dataset.amoled='1';
    document.documentElement.dataset.motion='reduce';
  }else{
    document.documentElement.dataset.theme=(t==='auto')?sys:t;
  }
  if(p.accent)document.documentElement.style.setProperty('--orbit-accent',p.accent);
}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div id="aurora" aria-hidden="true"><i /><i /><i /></div>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
