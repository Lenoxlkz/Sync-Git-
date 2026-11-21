'use client';

/* AppShell: chrome de Orbit Next — topbar con logo original + búsqueda,
   barra de navegación GlassNav (Liquid Glass del vendor, sin overrides:
   en desktop 8 pestañas con etiquetas y en móvil 5 + «Más»/4 + «Más» para
   que la lente respete su geometría de 68px por ítem), scopes → navegación,
   toasts y bóveda. */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { EngineProvider, AppNav as GlassNav, AppButton as GlassButton, AppInput as GlassInput, AppSheet as GlassSheet } from '@/components/ui';
import { useOrbit, boot, applyAppearance, effectiveEngine, unlockVault, createVault, pushToast, openFicha, setPrefs } from '@/lib/store';
import { netKeep } from '@/lib/netkeep';
import { canAutoRefresh, fireLive, humanLeft, liveInterval, onLive } from '@/lib/live';
import { capsFromScopes, type Cap } from '@/lib/scopes';
import { ToastStack } from './Toast';
import { Diag } from './bits';
import { IcSearch, IcDownload, IcKey, IcUser, IcFolder, IcShield, IcLock, IcX, IcList, IcRefresh } from './Icons';
import {
  IcChat as IcChatNav, IcRepo as IcRepoNav, IcPR as IcPRNav, IcIssue as IcIssueNav,
  IcUpload as IcUploadNav, IcCode as IcCodeNav, IcSettings as IcSettingsNav, IcBook as IcBookNav,
} from './Icons';

/* Logo original del HTML (icono «logo» de GitHub Orbit) */
export function OrbitLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.6" transform="rotate(-18 12 12)" />
      <circle cx="21" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* cap: scope que habilita la sección (null = siempre visible) */
const NAV: Array<{ href: string; label: string; cap: Cap | null }> = [
  { href: '/', label: 'Chat', cap: null },
  { href: '/repos/', label: 'Repos', cap: 'repos' },
  { href: '/pulls/', label: 'PRs', cap: 'pulls' },
  { href: '/issues/', label: 'Issues', cap: 'issues' },
  { href: '/explorer/', label: 'Subir', cap: 'upload' },
  { href: '/code/', label: 'Código', cap: 'code' },
  { href: '/control/', label: 'Control', cap: null },
  { href: '/guide/', label: 'Guía', cap: null },
];

const NAV_ICONS: Record<string, React.ReactNode> = {
  Chat: <IcChatNav />, Repos: <IcRepoNav />, PRs: <IcPRNav />, Issues: <IcIssueNav />,
  Subir: <IcUploadNav />, Código: <IcCodeNav />, Control: <IcSettingsNav />, Guía: <IcBookNav />,
};

/* GlassNav reserva --lg-item-w: 68px por pestaña (más 4px de padding por
   lado) y «Más» ocupa un slot también: 8 pestañas = 552px (≥640px de
   viewport), 5+Más = 416px (≥432px), 4+Más = 348px (≥364px) y 3+Más =
   280px por debajo. El resto se abre en un GlassSheet. */
const SET5 = ['/', '/repos/', '/pulls/', '/issues/', '/explorer/'];
const SET4 = ['/', '/repos/', '/pulls/', '/control/'];
const SET3 = ['/', '/repos/', '/control/'];
const MORE_SUB: Record<string, string> = {
  Subir: 'Envía archivos y carpetas con verificación',
  Código: 'Explora y edita el código de un repositorio',
  Control: 'Conexión, IA, apariencia y scopes del token',
  Guía: 'Comandos y conceptos de Git en Orbit',
};


/* Live · píldora EN VIVO + latido global (port del HTML original): cuenta
   atrás por vista, guardas (oculto/modal/escribiendo/subida) y pausa con
   cuota baja. Las páginas se refrescan oyendo el evento «orbit:live». */
function LivePill() {
  const { connected, rate, prefs } = useOrbit();
  const [left, setLeft] = useState(() => liveInterval(prefs.liveInt));
  const [refreshing, setRefreshing] = useState(false);
  const pulse = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 900); };
  useEffect(() => onLive(pulse), []);
  useEffect(() => { setLeft(liveInterval(prefs.liveInt)); }, [prefs.liveInt]);
  useEffect(() => {
    if (!connected) return;
    const iv = setInterval(() => {
      if (!prefs.live) { setLeft(liveInterval(prefs.liveInt)); return; }
      if (!canAutoRefresh()) { setLeft(liveInterval(prefs.liveInt)); return; }
      if (rate && Number(rate.rem) < 30) {
        setPrefs({ live: false });
        pushToast('Cuota de API baja', 'err', 'La actualización en vivo se pausó para proteger tu límite de GitHub');
        return;
      }
      setLeft(l => {
        if (l <= 1) { fireLive(); return liveInterval(prefs.liveInt); }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [connected, prefs.live, prefs.liveInt, rate]);
  const on = prefs.live && connected;
  const title = on
    ? `EN VIVO · refresco automático cada ${humanLeft(prefs.liveInt)} · clic para pausar`
    : 'EN VIVO pausado · clic para activar';
  return (
    <>
      <button type="button" className={`live-pill${on ? ' on' : ''}`} title={title} aria-pressed={on}
        onClick={() => {
          const nv = !prefs.live;
          setPrefs({ live: nv });
          pushToast(nv ? 'Actualización en vivo activada' : 'Actualización en vivo pausada',
            nv ? 'ok' : 'info',
            nv ? `Refresco automático cada ${humanLeft(prefs.liveInt)}, sin recargar la página` : 'Usa el botón ⟳ para actualizar manualmente');
        }}>
        <span className="live-dot" />
        <span>{on ? 'EN VIVO' : 'PAUSADO'}</span>
        <span className="live-count">{on ? (refreshing ? '···' : left > 0 ? humanLeft(left) : '') : ''}</span>
      </button>
      <GlassButton size="sm" icon={<IcRefresh size={14} />} aria-label="Actualizar ahora"
        onClick={() => { fireLive(); pushToast('Vista actualizada', 'ok', connected ? 'Las páginas refrescan sus datos' : 'Conecta tu cuenta para refrescar datos'); }} />
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const state = useOrbit();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [installEv, setInstallEv] = useState<{ prompt: () => void } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [gs, setGs] = useState('');
  const [vw, setVw] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  /* viewport para elegir el set de pestañas (SSR-safe: 0 hasta montar) */
  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  /* arranque: restaura sesión/bóveda/prefs una sola vez */
  useEffect(() => { boot().catch(() => { /* silencio */ }); }, []);

  /* apariencia (Reducir movimiento fuerza AMOLED) */
  useEffect(() => { applyAppearance(state.prefs); }, [state.prefs]);

  /* NetKeep sigue las preferencias (idempotente) */
  useEffect(() => {
    if (state.prefs.netkeep) netKeep.start(state.prefs.netkeepKbps);
    else netKeep.stop();
  }, [state.prefs.netkeep, state.prefs.netkeepKbps]);

  /* service worker + PWA */
  useEffect(() => {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('/Sync-Git-/sw.js').catch(() => { });
    }
    const onInstall = (e: Event) => { e.preventDefault(); setInstallEv(e as unknown as { prompt: () => void }); };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => window.removeEventListener('beforeinstallprompt', onInstall);
  }, []);

  /* título vivo con la cuota */
  useEffect(() => {
    const BASE_T = 'GitHub Orbit — Centro de mando personal';
    const t = setInterval(() => {
      document.title = state.connected && state.rate && state.user
        ? `Orbit · ${state.rate.rem} req · @${state.user.login}`
        : BASE_T;
    }, 30000);
    return () => clearInterval(t);
  }, [state.connected, state.rate, state.user]);

  const gsResults = useMemo(() => {
    const q = gs.trim().toLowerCase();
    if (!q) return [];
    return state.repos.filter(r => r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)).slice(0, 8);
  }, [gs, state.repos]);

  /* capacidades según los scopes reales del token: filtra la navegación */
  const caps = useMemo(
    () => (state.connected ? capsFromScopes(state.scopes) : null),
    [state.connected, state.scopes],
  );
  const visibleNav = useMemo(() => NAV.filter(n => !n.cap || !caps || caps.map[n.cap]), [caps]);

  /* set de pestañas según el ancho: 8 / 5+Más / 4+Más — GlassNav mantiene
     su geometría de 68px por ítem y la lente queda siempre alineada */
  type NavEntry = { href: string; label: string; cap: Cap | null; more?: boolean };
  const primaryHrefs = vw >= 640 ? null : vw >= 432 ? SET5 : vw >= 364 ? SET4 : SET3;
  const { navItems, moreItems } = useMemo<{ navItems: NavEntry[]; moreItems: NavEntry[] }>(() => {
    if (!primaryHrefs) return { navItems: visibleNav, moreItems: [] };
    const prim = visibleNav.filter(n => primaryHrefs.includes(n.href));
    const rest = visibleNav.filter(n => !primaryHrefs.includes(n.href));
    const items: NavEntry[] = [...prim];
    if (rest.length) items.push({ href: '', label: 'Más', cap: null, more: true });
    return { navItems: items, moreItems: rest };
  }, [visibleNav, primaryHrefs]);

  /* motor visual efectivo: auto por User-Agent, manual o forzado por Reducir movimiento */
  const engine = useMemo(() => effectiveEngine(state.prefs), [state.prefs]);

  const isMoreActive = !navItems.some(n => n.href && (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)));
  const activeIndex = isMoreActive
    ? Math.max(0, navItems.findIndex(n => n.more))
    : navItems.findIndex(n => n.href && (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)));
  const current = visibleNav.find(n => n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)) ?? visibleNav[0] ?? NAV[0];

  return (
    <EngineProvider value={engine}>
    <div className="app-frame">
      <div className="app-main">
        <header className="topbar">
          <Link href="/" className="tb-brand" aria-label="GitHub Orbit">
            <OrbitLogo size={26} />
          <span>
            <b>GitHub Orbit</b>
            <small>Centro de mando · v3.8</small>
          </span>
          </Link>
          <div className="tb-title"><h1>{current.label}</h1></div>
          <div className="tb-right">
            <LivePill />
            {installEv ? (
              <GlassButton size="sm" variant="tinted" tint="var(--orbit-accent)" icon={<IcDownload size={14} />}
                onClick={() => { installEv.prompt(); setInstallEv(null); }}>
                Instalar
              </GlassButton>
            ) : null}
            <GlassButton size="sm" icon={<IcSearch size={15} />} aria-label="Buscar repositorios" onClick={() => setSearchOpen(true)} />
            <Link href="/control/" className={`conn-pill slim${state.connected ? ' on' : ''}`}>
              {state.connected ? <IcUser size={13} /> : <IcKey size={13} />}
              <span>{state.connected ? '@' + state.user?.login : 'Sin conexión'}</span>
            </Link>
          </div>
        </header>

        <main className="view">{children}</main>
      </div>

      {/* barra de navegación Liquid Glass (GlassNav del vendor, sin overrides) */}
      <div className="bottom-nav">
        {vw > 0 && (
          <GlassNav
            items={navItems.map(n => ({ label: n.label, icon: n.more ? <IcList /> : NAV_ICONS[n.label] }))}
            activeIndex={activeIndex < 0 ? 0 : activeIndex}
            onChange={i => {
              const n = navItems[i];
              if (!n) return;
              if (n.more) { setMoreOpen(true); return; }
              router.push(n.href);
            }}
            aria-label="Secciones"
          />
        )}
      </div>

      {/* hoja «Más»: secciones fuera de la barra en pantallas estrechas */}
      <GlassSheet open={moreOpen} onClose={() => setMoreOpen(false)} detents={['medium', 'large']} aria-label="Más secciones">
        <div className="sheet-head"><h3>Más secciones</h3>
          <GlassButton icon={<IcX size={15} />} aria-label="Cerrar" size="sm" onClick={() => setMoreOpen(false)} />
        </div>
        <p className="sheet-text">Estas secciones no caben en la barra de esta pantalla; todas mantienen sus permisos por scope.</p>
        <div className="picker-list">
          {moreItems.map(n => (
            <button key={n.href} className={`picker-item picker-item--nav${pathname.startsWith(n.href) ? ' sel' : ''}`}
              onClick={() => { setMoreOpen(false); router.push(n.href); }}>
              <span className="picker-ico" aria-hidden="true">{NAV_ICONS[n.label]}</span>
              <span className="picker-txt"><b>{n.label}</b><small>{MORE_SUB[n.label] || ''}</small></span>
            </button>
          ))}
        </div>
      </GlassSheet>

      {/* búsqueda global de repos */}
      <GlassSheet open={searchOpen} onClose={() => { setSearchOpen(false); setGs(''); }} detents={['medium', 'large']} aria-label="Buscar repositorios">
        <div className="sheet-head"><h3><IcSearch size={16} /> Buscar en tus repos</h3></div>
        <div className="gs-wrap">
          <GlassInput
            type="search" placeholder="Nombre o descripción…"
            value={gs} onChange={e => setGs(e.target.value)} aria-label="Búsqueda global"
          />
        </div>
        <div className="gs-results-inlist">
          {gsResults.length ? gsResults.map(r => (
            <button key={r.id} className="gs-item" onClick={() => { openFicha(r.full_name); setSearchOpen(false); setGs(''); }}>
              <IcFolder size={15} />
              <div className="gs-main"><b>{r.name}</b><small>Repositorio · {r.language || '—'}</small></div>
            </button>
          )) : <p className="picker-none">{gs ? 'Sin resultados.' : 'Escribe para filtrar tus repositorios.'}</p>}
        </div>
      </GlassSheet>

      {/* Bóveda: desbloqueo */}
      <VaultSheetUnlock />
      <VaultSheetCreate />

      <ToastStack />
    </div>
    </EngineProvider>
  );
}

function VaultSheetUnlock() {
  const { vaultSheet, vaultError } = useOrbit();
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  if (vaultSheet !== 'unlock') return null;
  return (
    <GlassSheet open onClose={() => pushToast('Bóveda bloqueada', 'info', 'Desbloquéala desde Control Center cuando quieras')} aria-label="Desbloquear bóveda">
      <div className="sheet-head"><h3><IcLock size={16} /> Desbloquea tu bóveda</h3></div>
      <p className="sheet-text">El token guardado en este dispositivo está cifrado (AES-256-GCM). Introduce la contraseña de la bóveda para restaurar la sesión.</p>
      <GlassInput type="password" placeholder="Contraseña de la bóveda" value={pass} onChange={e => setPass(e.target.value)} icon={<IcLock size={15} />} aria-label="Contraseña de la bóveda" />
      <Diag text={vaultError || null} />
      <div className="sheet-actions">
        <GlassButton onClick={() => pushToast('Sesión sin restaurar', 'info')}>Ahora no</GlassButton>
        <GlassButton variant="filled" tint="var(--orbit-accent)" disabled={busy || !pass}
          onClick={async () => { setBusy(true); const ok = await unlockVault(pass).catch(() => false); setBusy(false); if (ok) setPass(''); }}>
          {busy ? 'Verificando…' : 'Desbloquear'}
        </GlassButton>
      </div>
    </GlassSheet>
  );
}

function VaultSheetCreate() {
  const { vaultSheet, vaultError } = useOrbit();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  if (vaultSheet !== 'create') return null;
  return (
    <GlassSheet open aria-label="Crear bóveda">
      <div className="sheet-head"><h3><IcShield size={16} /> Crea tu bóveda</h3></div>
      <p className="sheet-text">Para mantener la sesión en este dispositivo, el token se guarda cifrado con AES-256-GCM. Elige una contraseña (mínimo 6 caracteres).</p>
      <GlassInput type="password" placeholder="Contraseña" value={p1} onChange={e => setP1(e.target.value)} icon={<IcLock size={15} />} aria-label="Contraseña" />
      <GlassInput type="password" placeholder="Repite la contraseña" value={p2} onChange={e => setP2(e.target.value)} icon={<IcLock size={15} />} aria-label="Repite la contraseña" />
      <Diag text={vaultError || null} />
      <div className="sheet-actions">
        <GlassButton onClick={() => pushToast('El token no se guardará en este dispositivo', 'info')}>Cancelar</GlassButton>
        <GlassButton variant="filled" tint="var(--orbit-accent)" disabled={busy || !p1 || !p2}
          onClick={async () => { setBusy(true); await createVault(p1, p2).catch(() => false); setBusy(false); }}>
          {busy ? 'Cifrando…' : 'Crear bóveda'}
        </GlassButton>
      </div>
    </GlassSheet>
  );
}
