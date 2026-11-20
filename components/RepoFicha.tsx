'use client';

/* Ficha de repositorio: Información · Branches · Commits · Tags · Releases.
   Puerto de openRepoFicha del original sobre GlassSheet + Liquid Glass. */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassButton, GlassInput, GlassSheet } from '@zakisheriff/liquid-glass';
import { useOrbit, pushToast, setPrefs } from '@/lib/store';
import { gh, createBranch, GitHubError, type GHBranch, type GHCommitFull, type GHTag, type GHRelease } from '@/lib/github';
import { logAct } from '@/lib/activity';
import { relTime, fmtSize, langColor, Diag } from './bits';
import { ReleaseSheet } from './ReleaseSheet';
import { IcBranch, IcCommit, IcTag, IcArchive, IcPlus, IcTrash, IcCode, IcLock, IcGlobe, IcExternal } from './Icons';

type Tab = 'info' | 'branches' | 'commits' | 'tags' | 'releases';

export function RepoFicha({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { repos, fichaRepo } = useOrbit();
  const router = useRouter();
  const repo = repos.find(r => r.full_name === fichaRepo || r.name === fichaRepo);
  const [tab, setTab] = useState<Tab>('info');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [branches, setBranches] = useState<GHBranch[] | null>(null);
  const [commits, setCommits] = useState<GHCommitFull[] | null>(null);
  const [tags, setTags] = useState<GHTag[] | null>(null);
  const [releases, setReleases] = useState<GHRelease[] | null>(null);
  const [newBranch, setNewBranch] = useState('');
  const [relSheet, setRelSheet] = useState(false);

  useEffect(() => {
    if (open && repo) { setTab('info'); setErr(''); }
  }, [open, repo]);

  async function loadTab(t: Tab) {
    if (!repo) return;
    setErr('');
    if (t === 'branches' && !branches) {
      setLoading(true);
      try { setBranches(await gh.branches(repo.full_name)); } catch (e) { setErr(m(e)); } finally { setLoading(false); }
    }
    if (t === 'commits' && !commits) {
      setLoading(true);
      try { setCommits(await gh.commits(repo.full_name, repo.default_branch, 10)); } catch (e) { setErr(m(e)); } finally { setLoading(false); }
    }
    if (t === 'tags' && !tags) {
      setLoading(true);
      try { setTags(await gh.tags(repo.full_name)); } catch (e) { setErr(m(e)); } finally { setLoading(false); }
    }
    if (t === 'releases' && !releases) {
      setLoading(true);
      try { setReleases(await gh.releases(repo.full_name)); } catch (e) { setErr(m(e)); } finally { setLoading(false); }
    }
  }

  function go(t: Tab) { setTab(t); void loadTab(t); }

  async function addBranch() {
    if (!repo || !newBranch.trim()) return;
    try {
      await createBranch(repo.full_name, newBranch.trim(), repo.default_branch);
      logAct('branch', 'Rama creada', newBranch.trim() + ' @ ' + repo.name);
      pushToast('Rama creada', 'ok', newBranch.trim());
      setBranches(null); setNewBranch('');
      void loadTab('branches');
    } catch (e) { pushToast('No se pudo crear la rama', 'err', m(e)); }
  }

  async function delBranch(name: string) {
    if (!repo) return;
    try {
      await gh.branchDelete(repo.full_name, name);
      logAct('trash', 'Rama eliminada', name + ' @ ' + repo.name);
      pushToast('Rama eliminada', 'ok', name);
      setBranches(null);
      void loadTab('branches');
    } catch (e) { pushToast('No se pudo eliminar la rama', 'err', m(e)); }
  }

  if (!repo) return <GlassSheet open={false} onClose={onClose} aria-label="Ficha" />;

  return (
    <GlassSheet open={open} onClose={onClose} detents={['large']} aria-label={'Ficha de ' + repo.name}>
      <div className="sheet-head">
        <h3>{repo.name}</h3>
        <span className={`badge ${repo.private ? 'warn' : 'blue'}`}>{repo.private ? 'privado' : 'público'}</span>
        <GlassButton size="sm" icon={<IcExternal size={13} />} aria-label="Abrir en GitHub" href={repo.html_url} target="_blank" />
      </div>

      <div className="ftabs">
        {(['info', 'branches', 'commits', 'tags', 'releases'] as Tab[]).map(t => (
          <button key={t} className={`ftab${tab === t ? ' active' : ''}`} onClick={() => go(t)}>
            {t === 'info' ? 'Información' : t === 'branches' ? 'Ramas' : t === 'commits' ? 'Commits' : t === 'tags' ? 'Tags' : 'Releases'}
          </button>
        ))}
      </div>
      <div style={{ height: 12 }} />
      <Diag text={err || null} />

      {tab === 'info' ? (
        <div>
          <div className="kv"><span className="k">Descripción</span><span className="v">{repo.description || '—'}</span></div>
          <div className="kv"><span className="k">Lenguaje</span><span className="v"><i className="lang-dot" style={{ background: langColor(repo.language) }} /> {repo.language || '—'}</span></div>
          <div className="kv"><span className="k">Rama principal</span><span className="v mono">{repo.default_branch}</span></div>
          <div className="kv"><span className="k">Visibilidad</span><span className="v">{repo.private ? <><IcLock size={12} /> Privado</> : <><IcGlobe size={12} /> Público</>}</span></div>
          <div className="kv"><span className="k">Última actualización</span><span className="v">{relTime(repo.pushed_at || repo.updated_at)}</span></div>
          <div className="kv"><span className="k">Stars / Forks</span><span className="v">{repo.stargazers_count} / {repo.forks_count}</span></div>
          <div className="kv"><span className="k">Tamaño</span><span className="v">{fmtSize(repo.size)}</span></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcCode size={14} />}
              onClick={() => { setPrefs({ lastRepo: repo.full_name, lastBranch: repo.default_branch }); router.push('/code/'); }}>
              Abrir en Code Explorer
            </GlassButton>
            <GlassButton icon={<IcBranch size={14} />} onClick={() => go('branches')}>Gestionar ramas</GlassButton>
          </div>
        </div>
      ) : null}

      {tab === 'branches' ? (
        <div>
          {loading && !branches ? <p className="tiny">Cargando…</p> : null}
          <div className="rows">
            {(branches || []).map(b => (
              <div key={b.name} className="row" style={{ cursor: 'default' }}>
                <span style={{ color: 'var(--orbit-accent)', display: 'inline-flex' }}><IcBranch size={15} /></span>
                <div className="r-main">
                  <div className="r-title mono">{b.name}</div>
                  <div className="r-meta">{b.commit.sha.slice(0, 7)}</div>
                </div>
                {b.name === repo.default_branch
                  ? <span className="badge blue">default</span>
                  : <GlassButton size="sm" icon={<IcTrash size={13} />} destructive aria-label={'Eliminar rama ' + b.name} onClick={() => delBranch(b.name)} />}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <GlassInput placeholder="nueva-rama" value={newBranch} onChange={e => setNewBranch(e.target.value)} className="mono" aria-label="Nueva rama" tint="var(--orbit-accent)" />
            <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcPlus size={14} />} disabled={!newBranch.trim()} onClick={addBranch} />
          </div>
        </div>
      ) : null}

      {tab === 'commits' ? (
        <div className="rows">
          {loading && !commits ? <p className="tiny">Cargando…</p> : null}
          {(commits || []).map(c => (
            <div key={c.sha} className="row" style={{ cursor: 'default' }}>
              <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><IcCommit size={15} /></span>
              <div className="r-main">
                <div className="r-title">{(c.commit.message || '').split('\n')[0]}</div>
                <div className="r-meta">@{c.author?.login || c.commit.author?.name || '—'} · {relTime(c.commit.author?.date || '')}</div>
              </div>
              <span className="badge mono">{c.sha.slice(0, 7)}</span>
            </div>
          ))}
          {commits && !commits.length ? <p className="tiny">Sin commits.</p> : null}
        </div>
      ) : null}

      {tab === 'tags' ? (
        <div className="rows">
          {loading && !tags ? <p className="tiny">Cargando…</p> : null}
          {(tags || []).map(t => (
            <div key={t.name} className="row" style={{ cursor: 'default' }}>
              <span style={{ color: 'var(--warn)', display: 'inline-flex' }}><IcTag size={15} /></span>
              <div className="r-main"><div className="r-title mono">{t.name}</div></div>
            </div>
          ))}
          {tags && !tags.length ? <p className="tiny">Este repositorio no tiene etiquetas.</p> : null}
        </div>
      ) : null}

      {tab === 'releases' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <GlassButton variant="filled" tint="var(--orbit-accent)" size="sm" icon={<IcPlus size={13} />} onClick={() => setRelSheet(true)}>Crear release</GlassButton>
          </div>
          {loading && !releases ? <p className="tiny">Cargando…</p> : null}
          {(releases || []).map(x => (
            <div key={x.id} className="row" style={{ cursor: 'default', alignItems: 'flex-start', marginBottom: 8, border: '1px solid var(--border)', borderRadius: 12 }}>
              <span style={{ color: 'var(--orbit-accent)', display: 'inline-flex', marginTop: 2 }}><IcArchive size={16} /></span>
              <div className="r-main">
                <div className="r-title">{x.name || x.tag_name} <span className="badge blue mono">{x.tag_name}</span></div>
                <div className="r-meta">{x.published_at ? new Date(x.published_at).toLocaleDateString('es') : ''}</div>
                {x.body ? <p className="tiny" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{x.body.slice(0, 300)}</p> : null}
              </div>
            </div>
          ))}
          {releases && !releases.length ? <p className="tiny">Sin releases. Publica la primera versión con el botón de arriba.</p> : null}
          <ReleaseSheet open={relSheet} onClose={() => setRelSheet(false)} repo={repo.full_name} onDone={() => { setReleases(null); void loadTab('releases'); }} />
        </div>
      ) : null}
    </GlassSheet>
  );
}

function m(e: unknown) { return e instanceof GitHubError || e instanceof Error ? e.message : 'error'; }
