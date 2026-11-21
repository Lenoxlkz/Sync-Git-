'use client';

/* Live · actualización en vivo de la cuenta (portado del HTML original).
   Un temporizador global (AppShell) dispara el evento «orbit:live»; cada
   página decide cómo refrescarse en silencio. Guardas del original: pestaña
   oculta, modal abierto, usuario escribiendo o subida en curso no consumen
   ciclo; la cuota baja de 30 pausa el modo. */

export const LIVE_INTERVALS = [30, 60, 120, 300] as const;

export function humanLeft(s: number): string {
  return s < 60 ? s + ' s' : Math.round(s / 60) + ' min';
}

export function liveInterval(n: number): number {
  return (LIVE_INTERVALS as readonly number[]).includes(n) ? n : 60;
}

/* bandera compartida: las páginas la levantan mientras trabajan (subida,
   análisis) para que el latido no compita */
let busy = false;
export function setLiveBusy(v: boolean) { busy = v; }
export function liveBusy(): boolean { return busy; }

export function canAutoRefresh(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.hidden) return false;
  if (document.querySelector('[aria-modal="true"]')) return false; /* modal abierto */
  if (liveBusy()) return false;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.tagName === 'INPUT')) return false; /* escribiendo */
  return true;
}

export function onLive(cb: () => void): () => void {
  const h = () => cb();
  window.addEventListener('orbit:live', h);
  return () => window.removeEventListener('orbit:live', h);
}

export function fireLive(): void {
  window.dispatchEvent(new Event('orbit:live'));
}
