'use client';

/* NetKeep para Orbit Next: goteo orgánico (30–50 kbps configurable) que
   mantiene la ruta de red «tibia» (TCP activo, NAT sin expirar, DNS caliente)
   y una sonda de latencia real a github.com cada 15 s. Sin cuota de API.
   Las transferencias reales nunca se limitan: el goteo simplemente se retira
   mientras la app esté haciendo trabajo de verdad (appBusy). */

export interface NKStats {
  running: boolean; target: number; bytes: number;
  kbps: number; avg: number; latency: number | null;
  fails: number; skipped: number; appBusy: number;
}

let stats: NKStats = {
  running: false, target: 40, bytes: 0, kbps: 0, avg: 0,
  latency: null, fails: 0, skipped: 0, appBusy: 0,
};

const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let probeTimer: ReturnType<typeof setInterval> | null = null;
let busy = false;
let lastOk = 0;
let lastProbe = 0;

function emit() { stats = { ...stats }; subs.forEach(f => f()); }

export function setAppBusy(n: number) {
  stats.appBusy = Math.max(0, n);
  emit();
}

async function tick() {
  if (!stats.running) return;
  const now = Date.now();
  const elapsed = Math.min(4, (now - (lastOk || now)) / 1000);
  if (busy || stats.appBusy > 0) { stats.skipped++; emit(); schedule(); return; }
  busy = true;
  const n = Math.max(2200, Math.min(24000, Math.round((stats.target * 1000 / 8) * elapsed * (0.85 + Math.random() * 0.3))));
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const to = ctl ? setTimeout(() => ctl.abort(), 12000) : null;
  try {
    const r = await fetch('https://speed.cloudflare.com/__down?bytes=' + n, {
      cache: 'no-store', ...(ctl ? { signal: ctl.signal } : {}),
    });
    const b = await r.arrayBuffer();
    if (b.byteLength) {
      stats.bytes += b.byteLength;
      stats.kbps = Math.round((b.byteLength * 8) / elapsed / 1000);
      stats.avg = stats.avg ? Math.round(stats.avg * 0.85 + stats.kbps * 0.15) : stats.kbps;
      stats.fails = 0;
      lastOk = now;
    }
  } catch {
    stats.fails++;
  } finally {
    busy = false;
    if (to) clearTimeout(to);
    emit();
    schedule();
  }
}

function schedule() {
  if (!stats.running) return;
  const backoff = stats.fails > 0 ? Math.min(60000, 1000 * Math.pow(2, stats.fails - 1)) : 1000;
  timer = setTimeout(tick, backoff);
}

async function probe() {
  if (!stats.running) return;
  const t0 = performance.now();
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const to = ctl ? setTimeout(() => ctl.abort(), 8000) : null;
  try {
    await fetch('https://github.com/favicon.ico?nk=' + Date.now(), {
      method: 'HEAD', mode: 'no-cors', cache: 'no-store', ...(ctl ? { signal: ctl.signal } : {}),
    });
    stats.latency = Math.round(performance.now() - t0);
    lastProbe = Date.now();
  } catch {
    stats.latency = null;
  } finally {
    if (to) clearTimeout(to);
    emit();
  }
}

export const netKeep = {
  start(target?: number) {
    if (target !== undefined) stats.target = target;
    if (stats.running) return;
    stats.running = true;
    lastOk = 0;
    probe();
    probeTimer = setInterval(probe, 15000);
    schedule();
    emit();
  },
  stop() {
    stats.running = false;
    if (timer) clearTimeout(timer);
    if (probeTimer) clearInterval(probeTimer);
    timer = probeTimer = null;
    emit();
  },
  setTarget(n: number) {
    stats.target = Math.max(10, Math.min(200, Math.round(n)));
    emit();
  },
  probeAge() { return lastProbe ? Math.round((Date.now() - lastProbe) / 1000) : -1; },
  get(): NKStats { return stats; },
  subscribe(fn: () => void) { subs.add(fn); return () => subs.delete(fn); },
  getSnapshot(): NKStats { return stats; },
};
