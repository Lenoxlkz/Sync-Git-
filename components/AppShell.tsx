'use client';

/* AppShell: chrome de Orbit Next — sidebar (escritorio) con búsqueda global y
   actividad reciente, topbar, GlassNav flotante (móvil), toasts y bóveda. */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { GlassNav, GlassButton, GlassInput, GlassSheet } from '@zakisheriff/liquid-glass';
import { useOrbit, boot, applyAppearance, unlockVault, createVault, pushToast, openFicha } from '@/lib/store';
import { netKeep } from '@/lib/netkeep';
import { useActivity, clearActivity } from '@/lib/activity';
import { ToastStack } from './Toast';
import { Diag } from './bits';
import {
  IcChat, IcRepo, IcPR, IcIssue, IcUpload, IcSettings, IcMenu, IcShield, IcLock, IcDownload, IcKey, IcUser,
  IcCode, IcBook, IcFolder, IcCommit, IcCompare, IcSearch, IcArchive, IcX, IcActivity, IcRotate, IcCheck,
  IcAlert, IcMerge, IcTrash, IcFork, IcGlobe, IcWifi, IcEdit, IcInfo, IcZap, IcFolderPlus, IcBranch,
} from './Icons';

const NAV = [
  { href: '/', label: 'Chat', icon: <IcChat size={20} /> },
  { href: '/repos/', label: 'Repos', icon: <IcRepo size={20} /> },
  { href: '/pulls/', label: 'PRs', icon: <IcPR size={20} /> },
  { href: '/issues/', label: 'Issues', icon: <IcIssue size={20} /> },
  { href: '/explorer/', label: 'Subir', icon: <IcUpload size={20} /> },
  { href: '/code/', label: 'Código', icon: <IcCode size={20} /> },
  { href: '/control/', label: 'Control', icon: <IcSettings size={20} /> },
  { href: '/guide/', label: 'Guía', icon: <IcBook size={20} /> },
];

/* iconos del registro de actividad (nombres simbólicos de logAct) */
const ACT_ICONS: Record<string, React.ReactNode> = {
  folder: <IcFolder size={13} />, 'folder-plus': <IcFolderPlus size={13} />, branch: <IcBranch size={13} />,
  commit: <IcCommit size={13} />, issue: <IcIssue size={13} />, pr: <IcPR size={13} />, search: <IcSearch size={13} />,
  compare: <IcCompare size={13} />, upload: <IcUpload size={13} />, wifi: <IcWifi size={13} />,
  code: <IcCode size={13} />, archive: <IcArchive size={13} />, lock: <IcLock size={13} />, key: <IcKey size={13} />,
  shield: <IcShield size={13} />, edit: <IcEdit size={13} />, rotate: <IcRotate size={13} />, check: <IcCheck size={13} />,
  'x': <IcX size={13} />, merge: <IcMerge size={13} />, trash: <IcTrash size={13} />, fork: <IcFork size={13} />,
  globe: <IcGlobe size={13} />, alert: <IcAlert size={13} />, info: <IcInfo size={13} />, chat: <IcChat size={13} />,
  zap: <IcZap size={13} />,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const state = useOrbit();
  const activity = useActivity();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [installEv, setInstallEv] = useState<{ prompt: () => void } | null>(null);
  const [gs, setGs] = useState('');

  /* arranque: restaura sesión/bóveda/prefs una sola vez */
  useEffect(() => { boot().catch(() => { /* silencio */ }); }, []);

  /* apariencia */
  useEffect(() => { applyAppearance(state.prefs); }, [state.prefs.theme, state.prefs.accent, state.prefs.reduceMotion, state.prefs]);

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
    return state.repos.filter(r => r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)).slice(0, 6);
  }, [gs, state.repos]);

  const activeIndex = NAV.findIndex(n => n.href === '/' ? pathname === '/' : pathname.startsWith(n.href));
  const current = NAV[activeIndex] ?? NAV[0];

  return (
    <div className="app-frame">
      {/* Sidebar escritorio */}
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-logo" aria-hidden="true" />
          <span className="brand-text">
            <b>GitHub Orbit</b>
            <small>Centro de mando · v3.0</small>
          </span>
        </Link>
        <nav className="side-nav">
          {NAV.map(n => (
            <Link key={n.href} href={n.href} className={`side-link${pathname === n.href || (n.href !== '/' && pathname.startsWith(n.href)) ? ' on' : ''}`}>
              {n.icon}<span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          {/* búsqueda global sobre repos */}
          <div className="gs-wrap">
            <GlassInput
              type="search" placeholder="Buscar en tus repos…"
              value={gs} onChange={e => setGs(e.target.value)} aria-label="Búsqueda global"
            />
            {gsResults.length ? (
              <div className="gs-results">
                {gsResults.map(r => (
                  <button key={r.id} className="gs-item" onClick={() => { openFicha(r.full_name); setGs(''); }}>
                    <IcFolder size={15} />
                    <div className="gs-main"><b>{r.name}</b><small>Repositorio · {r.language || '—'}</small></div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Link href="/control/" className={`conn-pill${state.connected ? ' on' : ''}`}>
            {state.connected ? <IcUser size={13} /> : <IcKey size={13} />}
            <span>{state.connected ? '@' + state.user?.login : 'Sin conexión'}</span>
          </Link>
          <small className="side-ver">Next.js · Liquid Glass</small>

          {/* actividad reciente */}
          <div className="rail-act">
            <div className="rail-act-h">
              <IcActivity size={12} /> Actividad
              {activity.length ? <button aria-label="Limpiar actividad" onClick={() => { clearActivity(); pushToast('Actividad limpiada', 'ok'); }}><IcX size={12} /></button> : null}
            </div>
            {activity.length
              ? activity.slice(0, 8).map((a, i) => (
                <div key={a.t + '-' + i} className="act-item">
                  {ACT_ICONS[a.icon] ?? <IcInfo size={13} />}
                  <div style={{ minWidth: 0 }}><b>{a.text}</b><span>{a.sub}</span></div>
                </div>
              ))
              : <div className="rail-empty">Sin actividad todavía. Las operaciones que hagas aparecerán aquí.</div>}
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <GlassButton className="tb-menu" icon={<IcMenu size={16} />} aria-label="Menú" size="sm" onClick={() => setMenu(true)} />
          <div className="tb-title">
            <h1>{current.label}</h1>
          </div>
          <div className="tb-right">
            {installEv ? (
              <GlassButton size="sm" variant="tinted" tint="var(--orbit-accent)" icon={<IcDownload size={14} />}
                onClick={() => { installEv.prompt(); setInstallEv(null); }}>
                Instalar app
              </GlassButton>
            ) : null}
            <Link href="/control/" className={`conn-pill slim${state.connected ? ' on' : ''}`}>
              {state.connected ? <IcUser size={13} /> : <IcKey size={13} />}
              <span>{state.connected ? '@' + state.user?.login : 'Sin conexión'}</span>
            </Link>
          </div>
        </header>

        <main className="view">{children}</main>
      </div>

      {/* Menú lateral móvil */}
      <GlassSheet open={menu} onClose={() => setMenu(false)} aria-label="Navegación">
        <div className="sheet-head"><h3>Orbit</h3></div>
        <div className="mobile-nav">
          {NAV.map(n => (
            <button key={n.href} className="mobile-link" onClick={() => { setMenu(false); router.push(n.href); }}>
              {n.icon}<span>{n.label}</span>
              {pathname === n.href || (n.href !== '/' && pathname.startsWith(n.href)) ? <span className="mobile-on">aquí</span> : null}
            </button>
          ))}
        </div>
      </GlassSheet>

      {/* GlassNav flotante en móvil */}
      <div className="bottom-nav">
        <GlassNav
          items={NAV.map(n => ({ label: n.label, icon: n.icon }))}
          activeIndex={activeIndex < 0 ? 0 : activeIndex}
          onChange={i => router.push(NAV[i].href)}
          showLabels={false}
          aria-label="Secciones"
        />
      </div>

      {/* Bóveda: desbloqueo */}
      <VaultSheetUnlock />
      <VaultSheetCreate />

      <ToastStack />
    </div>
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
