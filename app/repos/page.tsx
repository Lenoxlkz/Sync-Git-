'use client';

/* Repositories: lista real con búsqueda, creación y eliminación. */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GlassButton, GlassInput, GlassSwitch, GlassCard, GlassSheet } from '@zakisheriff/liquid-glass';
import { useOrbit, loadRepos, setPrefs, pushToast } from '@/lib/store';
import { gh, GitHubError } from '@/lib/github';
import { Section, NeedConn, Diag, Spinner, ConfirmSheet, relTime, fmtSize } from '@/components/bits';
import { IcPlus, IcSearch, IcUpload, IcExternal, IcTrash, IcPR, IcIssue } from '@/components/Icons';

export default function ReposPage() {
  const { connected, repos } = useOrbit();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [delRepo, setDelRepo] = useState<string | null>(null);
  const [nName, setNName] = useState('');
  const [nDesc, setNDesc] = useState('');
  const [nPriv, setNPriv] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (connected && !repos.length && !loading) {
      setLoading(true);
      loadRepos().catch(e => setErr(e instanceof Error ? e.message : 'error')).finally(() => setLoading(false));
    }
  }, [connected, repos.length]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? repos.filter(r => r.full_name.toLowerCase().includes(needle) || (r.language || '').toLowerCase().includes(needle)) : repos;
  }, [repos, q]);

  async function create() {
    if (!nName.trim()) return;
    setBusy(true); setErr('');
    try {
      await gh.createRepo(nName.trim().replace(/\s+/g, '-'), nDesc.trim(), nPriv);
      await loadRepos();
      pushToast('Repositorio creado', 'ok', nName);
      setShowCreate(false); setNName(''); setNDesc('');
    } catch (e) {
      setErr(e instanceof GitHubError ? e.message : 'error al crear');
    } finally { setBusy(false); }
  }

  if (!connected) return <Section title="Repositories"><NeedConn what="ver tus repositorios" /></Section>;

  return (
    <Section
      title="Repositories"
      sub={`${repos.length} repositorios de tu cuenta`}
      right={
        <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcPlus size={15} />} onClick={() => setShowCreate(true)}>Nuevo repo</GlassButton>
      }
    >
      <GlassInput type="search" placeholder="Buscar por nombre o lenguaje…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar repos" />
      <div style={{ height: 12 }} />
      <Diag text={err || null} />
      {loading && !repos.length ? <Spinner size={22} /> : null}

      <div className="grid-cards">
        {list.map(r => (
          <GlassCard key={r.id} padding="16px" className="repo-card">
            <b>{r.full_name}</b>
            <span className="desc">{r.description || 'Sin descripción.'}</span>
            <div className="meta">
              <span className="chip">{r.private ? 'privado' : 'público'}</span>
              {r.language ? <span className="chip acc">{r.language}</span> : null}
              <span className="chip">★ {r.stargazers_count}</span>
              <span className="chip">{fmtSize(r.size)}</span>
            </div>
            <span className="tiny">rama {r.default_branch} · actualizado {relTime(r.pushed_at)}</span>
            <div className="actions">
              <GlassButton size="sm" variant="tinted" tint="var(--orbit-accent)" icon={<IcUpload size={13} />}
                onClick={() => { setPrefs({ lastRepo: r.full_name, lastBranch: r.default_branch }); pushToast('Destino elegido', 'ok', r.full_name); }}>
                Subir aquí
              </GlassButton>
              <Link href="/pulls/"><GlassButton size="sm" icon={<IcPR size={13} />} aria-label="Pull requests" /></Link>
              <Link href="/issues/"><GlassButton size="sm" icon={<IcIssue size={13} />} aria-label="Issues" /></Link>
              <GlassButton size="sm" icon={<IcExternal size={13} />} aria-label="Abrir en GitHub" href={r.html_url} target="_blank" />
              <GlassButton size="sm" icon={<IcTrash size={13} />} aria-label="Eliminar repo" destructive onClick={() => setDelRepo(r.full_name)} />
            </div>
          </GlassCard>
        ))}
      </div>
      {!loading && !list.length ? <p className="tiny">Sin resultados.</p> : null}

      {/* Crear repo */}
      <GlassSheet open={showCreate} onClose={() => setShowCreate(false)} aria-label="Nuevo repositorio">
        <div className="sheet-head"><h3>Nuevo repositorio</h3></div>
        <GlassInput label="Nombre" placeholder="mi-repo" value={nName} onChange={e => setNName(e.target.value)} aria-label="Nombre del repo" tint="var(--orbit-accent)" />
        <div style={{ height: 10 }} />
        <GlassInput label="Descripción (opcional)" placeholder="Qué contiene…" value={nDesc} onChange={e => setNDesc(e.target.value)} aria-label="Descripción" />
        <div style={{ height: 6 }} />
        <div className="orbit-row">
          <div className="orbit-row-text"><b>Privado</b><small>Visible solo para ti</small></div>
          <GlassSwitch checked={nPriv} onChange={setNPriv} tint="var(--orbit-accent)" aria-label="Privado" />
        </div>
        <Diag text={err || null} />
        <div className="sheet-actions">
          <GlassButton onClick={() => setShowCreate(false)}>Cancelar</GlassButton>
          <GlassButton variant="filled" tint="var(--orbit-accent)" disabled={busy || !nName.trim()} onClick={create}>
            {busy ? 'Creando…' : 'Crear repositorio'}
          </GlassButton>
        </div>
      </GlassSheet>

      {/* Eliminar repo */}
      <ConfirmSheet
        open={delRepo !== null}
        onClose={() => setDelRepo(null)}
        title="Eliminar repositorio"
        text={`Se eliminará ${delRepo} permanentemente con todo su historial, PRs e issues. Irreversible.`}
        confirmLabel="Eliminar para siempre"
        onConfirm={async () => {
          try {
            await gh.deleteRepo(delRepo!);
            await loadRepos();
            pushToast('Repositorio eliminado', 'ok', delRepo!);
          } catch (e) {
            pushToast('No se pudo eliminar', 'err', e instanceof Error ? e.message : '');
          }
        }}
      />
    </Section>
  );
}
