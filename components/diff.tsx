'use client';

/* Vistas de diff: parche unificado (API compare) y lado a lado (lineDiff). */
import { parsePatch, lineDiff, type DiffResult } from '@/lib/code';

export function PatchView({ patch, emptyText = 'Sin diff textual disponible para este archivo.' }: { patch?: string; emptyText?: string }) {
  if (!patch) return <div style={{ padding: 10, color: 'var(--text-2)', fontSize: 12 }}>{emptyText}</div>;
  const rows = parsePatch(patch);
  return (
    <div className="diff-body">
      {rows.map((r, i) => (
        <div key={i} className={`dl ${r.kind === 'add' ? 'add' : r.kind === 'del' ? 'del' : r.kind === 'hunk' ? 'hunk' : ''}`}>
          <span className="no">{r.old ?? ''}</span>
          <span className="nn">{r.new ?? ''}</span>
          <span className="lc">{r.text || ' '}</span>
        </div>
      ))}
    </div>
  );
}

const CLS: Record<string, string> = { del: 'rv-c-del', add: 'rv-c-add', chg: 'rv-c-chg' };

function Side({ lines, title }: { lines: Array<{ n: number; t: string; cls: '' | 'add' | 'del' | 'chg' } | null>; title: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: '.08em', color: 'var(--text-2)', marginBottom: 4 }}><b>{title}</b></div>
      <pre className="mono">
        {lines.map((c, i) => c
          ? <div key={i} className={`rv-line ${CLS[c.cls] || ''}`}><span style={{ display: 'inline-block', width: 34, color: 'var(--text-3)', userSelect: 'none' }}>{c.n}</span>{c.t}</div>
          : <div key={i}>&nbsp;</div>)}
      </pre>
    </div>
  );
}

export function SideBySide({ d, leftLabel = 'TU VERSIÓN (local)', rightLabel = 'VERSIÓN DEL REPO (GitHub)' }: { d: DiffResult; leftLabel?: string; rightLabel?: string }) {
  return (
    <div>
      <div className="note" style={{ marginBottom: 10 }}>
        <span>Diff real de contenido: <b className="df-add">+{d.stats.added} líneas</b> · <b className="df-del">−{d.stats.removed} líneas</b>.
        Izquierda tu versión, derecha la del repo. Cambios de línea marcados (rojo = eliminado, verde = nuevo, naranja = reemplazado).</span>
      </div>
      <div className="rv-grid">
        <Side lines={d.rows.map(r => r.l)} title={leftLabel} />
        <Side lines={d.rows.map(r => r.r)} title={rightLabel} />
      </div>
    </div>
  );
}

export function DiffStats({ additions, deletions }: { additions: number; deletions: number }) {
  return <span className="df-stats"><span className="df-add">+{additions}</span> <span className="df-del">−{deletions}</span></span>;
}
