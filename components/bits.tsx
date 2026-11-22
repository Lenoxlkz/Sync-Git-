'use client';

/* Piezas reutilizables de Orbit Next construidas sobre Liquid Glass. */
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { AppButton as GlassButton, AppInput as GlassInput, AppSheet as GlassSheet, AppCard as GlassCard } from '@/components/ui';
import { useOrbit } from '@/lib/store';
import { IcSearch, IcBranch, IcShield, IcX } from './Icons';

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="orbit-spinner" style={{ width: size, height: size }} aria-label="cargando" />;
}

export function Section({ title, sub, right, children }: { title: string; sub?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="orbit-section">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {sub ? <p>{sub}</p> : null}
        </div>
        {right ? <div className="section-right">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Row({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="orbit-row">
      <div className="orbit-row-text">
        <b>{label}</b>
        {sub ? <small>{sub}</small> : null}
      </div>
      <div className="orbit-row-ctl">{children}</div>
    </div>
  );
}

export function Diag({ text }: { text: string | null }) {
  if (!text) return null;
  return <div className="orbit-diag">{text}</div>;
}

export function Empty({ ico, text, action }: { ico: ReactNode; text: string; action?: ReactNode }) {
  return (
    <GlassCard padding="28px" className="orbit-empty">
      <div className="orbit-empty-ico">{ico}</div>
      <p>{text}</p>
      {action}
    </GlassCard>
  );
}

export function NeedConn({ what }: { what: string }) {
  return (
    <Empty
      ico={<IcShield size={30} />}
      text={`Para ${what} necesitas conectar tu cuenta con un Personal Access Token.`}
      action={<Link href="/control/"><GlassButton variant="filled" tint="var(--orbit-accent)">Ir a Control Center</GlassButton></Link>}
    />
  );
}

/* El token está conectado pero no tiene el scope que habilita esta función. */
export function NeedScope({ title, reason }: { title: string; reason: string }) {
  return (
    <Empty
      ico={<IcShield size={30} />}
      text={`${title} — ${reason} Revisa los scopes de tu token en Control Center (sección «Scopes y funciones»).`}
      action={<Link href="/control/"><GlassButton variant="filled" tint="var(--orbit-accent)">Ver scopes del token</GlassButton></Link>}
    />
  );
}

/* Selector de repositorio: sheet con búsqueda sobre tus repos */
export function RepoPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (full: string) => void }) {
  const { repos } = useOrbit();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return repos.filter(r => !needle || r.full_name.toLowerCase().includes(needle)).slice(0, 60);
  }, [repos, q]);
  return (
    <GlassSheet open={open} onClose={onClose} detents={['medium', 'large']} aria-label="Elegir repositorio">
      <div className="sheet-head">
        <h3>¿A qué repo quieres enviar?</h3>
        <GlassButton icon={<IcX size={15} />} aria-label="Cerrar" size="sm" onClick={onClose} />
      </div>
      <GlassInput type="search" placeholder="Buscar entre tus repos…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar repositorio" />
      <div className="picker-list">
        {list.map(r => (
          <button key={r.id} className="picker-item" onClick={() => { onPick(r.full_name); onClose(); }}>
            <b>{r.full_name}</b>
            <small>{r.private ? 'privado' : 'público'} · {r.default_branch}{r.description ? ' · ' + (r.description || '') : ''}</small>
          </button>
        ))}
        {!list.length ? <p className="picker-none">Nada que mostrar{repos.length ? '' : ' — conecta tu cuenta'}</p> : null}
      </div>
    </GlassSheet>
  );
}

/* Selector de rama */
export function BranchPicker({ open, onClose, repo, onPick, title = 'Rama destino' }: { open: boolean; onClose: () => void; repo: string | null; onPick: (b: string) => void; title?: string }) {
  const [branches, setBranches] = useState<Array<{ name: string }> | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (open && repo) {
      import('@/lib/github').then(({ gh }) => gh.branches(repo))
        .then(setBranches)
        .catch(e => setErr(e instanceof Error ? e.message : 'error'));
    }
    if (!open) { setBranches(null); setErr(''); }
  }, [open, repo]);
  return (
    <GlassSheet open={open} onClose={onClose} aria-label="Elegir rama">
      <div className="sheet-head">
        <h3>{title} {repo ? '· ' + repo : ''}</h3>
        <GlassButton icon={<IcX size={15} />} aria-label="Cerrar" size="sm" onClick={onClose} />
      </div>
      {err ? <Diag text={err} /> : null}
      {!branches && !err ? <Spinner /> : null}
      <div className="picker-list">
        {branches?.map(b => (
          <button key={b.name} className="picker-item" onClick={() => { onPick(b.name); onClose(); }}>
            <span className="picker-ico"><IcBranch size={14} /></span><b>{b.name}</b>
          </button>
        ))}
      </div>
    </GlassSheet>
  );
}

/* Confirmación destructiva genérica (opcionalmente exige escribir un nombre) */
export function ConfirmSheet({ open, onClose, title, text, confirmLabel, onConfirm, typeTo }: {
  open: boolean; onClose: () => void; title: string; text: string; confirmLabel: string;
  onConfirm: () => Promise<void> | void; typeTo?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  useEffect(() => { if (!open) setTyped(''); }, [open]);
  const ok = !typeTo || typed.trim() === typeTo;
  return (
    <GlassSheet open={open} onClose={onClose} aria-label={title}>
      <h3 className="sheet-title">{title}</h3>
      <p className="sheet-text">{text}</p>
      {typeTo ? (
        <div style={{ margin: '10px 0 4px' }}>
          <GlassInput
            placeholder={'Escribe ' + typeTo + ' para confirmar'} value={typed}
            onChange={e => setTyped(e.target.value)} aria-label="Confirmación por nombre"
            className="mono" tint="var(--orbit-accent)"
          />
        </div>
      ) : null}
      <div className="sheet-actions">
        <GlassButton onClick={onClose} disabled={busy}>Cancelar</GlassButton>
        <GlassButton variant="filled" destructive disabled={busy || !ok}
          onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}>
          {busy ? 'Trabajando…' : confirmLabel}
        </GlassButton>
      </div>
    </GlassSheet>
  );
}

/* Menú contextual (clic derecho / pulsación larga) */
export interface CtxItem { label: string; icon?: ReactNode; danger?: boolean; fn?: () => void; sep?: boolean }
export function ContextMenu({ pos, items, onClose }: {
  pos: { x: number; y: number } | null; items: CtxItem[]; onClose: () => void;
}) {
  if (!pos) return null;
  const x = Math.min(pos.x, (typeof window !== 'undefined' ? window.innerWidth : 999) - 230);
  const y = Math.min(pos.y, (typeof window !== 'undefined' ? window.innerHeight : 999) - 60 - items.length * 38);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 94 }} onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }}>
      <div className="ctx-menu" style={{ left: Math.max(8, x), top: Math.max(8, y) }}>
        {items.map((it, i) => it.sep
          ? <div key={i} className="ctx-sep" />
          : <button key={i} className={`ctx-item${it.danger ? ' danger' : ''}`} onClick={(e) => { e.stopPropagation(); onClose(); it.fn?.(); }}>
              {it.icon}<span>{it.label}</span>
            </button>)}
      </div>
    </div>
  );
}

/* Color estándar de lenguaje (GitHub linguist) */
const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', CSS: '#563d7c', HTML: '#e34c26',
  Swift: '#F05138', 'C++': '#f34b7d', C: '#555555', Go: '#00ADD8', Rust: '#dea584', Java: '#b07219',
  Kotlin: '#A97BFF', Ruby: '#701516', PHP: '#4F5D95', Shell: '#89e051', Dart: '#00B4AB', Vue: '#41b883',
  SCSS: '#c6538c', 'Jupyter Notebook': '#DA5B0B', CMake: '#EDDEB8',
};
export function langColor(l?: string | null): string { return LANG_COLORS[l || ''] || '#8b949e'; }

/* Fecha relativa corta */
export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString('es');
}

export function fmtSize(kb: number): string {
  if (kb < 1024) return kb + ' KB';
  return (kb / 1024).toFixed(1) + ' MB';
}
