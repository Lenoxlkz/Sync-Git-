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

/* Tema y motor visual antes del primer paint: sin flash. data-theme gobierna
   las variables de la app y de Liquid Glass; .dark el esquema de Expressive;
   data-engine elige liquid glass o el tema de bajo consumo (Android ≤13 →
   expressive; Android ≥14 y resto → glass; Reducir movimiento fuerza expressive). */
const themeScript = `(()=>{try{
  var p=JSON.parse(localStorage.getItem('orbit.prefs')||'{}');
  var t=p.theme||'auto';
  var sys=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  var dark;
  if(p.reduceMotion){
    dark=true;
    document.documentElement.dataset.amoled='1';
    document.documentElement.dataset.motion='reduce';
  }else{
    dark=(t==='auto')?(sys==='dark'):(t==='dark');
  }
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.documentElement.classList.toggle('dark',dark);
  var m=navigator.userAgent.match(/Android\\s+(\\d+)/i);
  var av=m?parseInt(m[1],10):null;
  var eng=(p.themeEngine==='glass'||p.themeEngine==='expressive')?p.themeEngine:(av!==null&&av<=13?'expressive':'glass');
  document.documentElement.dataset.engine=eng;
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
