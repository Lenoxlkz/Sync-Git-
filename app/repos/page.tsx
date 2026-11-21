'use client';

/* Repositories: filtros (lenguaje, orden, layout), ficha completa, menú
   contextual (ficha · código · fork · visibilidad · eliminar) y creación. */
import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AppButton as GlassButton, AppInput as GlassInput, AppSwitch as GlassSwitch, AppCard as GlassCard, AppSegmented as GlassSegmented, AppSheet as GlassSheet } from '@/components/ui';
import { useOrbit, loadRepos, pushToast, openFicha, closeFicha, setPrefs } from '@/lib/store';
import { gh, GitHubError } from '@/lib/github';
import { logAct } from '@/lib/activity';
import { Section, NeedConn, NeedScope, Diag, Spinner, ConfirmSheet, ContextMenu, langColor, relTime, fmtSize, type CtxItem } from '@/components/bits';
import { CAPS, capsFromScopes } from '@/lib/scopes';
import { RepoFicha } from '@/components/RepoFicha';
import { IcPlus, IcLock, IcGlobe, IcTrash, IcBranch, IcIssue, IcStar, IcBox, IcCommit, IcCode, IcUpload, IcFork, IcMore } from '@/components/Icons';

type Sort = 'updated' | 'name' | 'stars';
type Layout = 'grid' | 'list';

export default function ReposPage() {
  const { connected, repos, fichaRepo, scopes } = useOrbit();
  const caps = capsFromScopes(scopes);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('all');
  const [sortIdx, setSortIdx] = useState(0);
  const [layoutIdx, setLayoutIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [delRepo, setDelRepo] = useState<string | null>(null);
  const [nName, setNName] = useState('');
  const [nDesc, setNDesc] = useState('');
  const [nPriv, setNPriv] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; repo: string } | null>(null);

  const sortKeys: Sort[] = ['updated', 'name', 'stars'];
  const layoutKeys: Layout[] = ['grid', 'list'];

  useEffect(() => {
    if (connected && !repos.length && !loading) {
      setLoading(true);
      loadRepos().catch(e => setErr(e instanceof Error ? e.message : 'error')).finally(() => setLoading(false));
    }
  }, [connected, repos.length]);

  const langs = useMemo(() => ['all', ...new Set(repos.map(r => r.language).filter(Boolean))] as string[], [repos]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const s = sortKeys[sortIdx];
    return repos
      .filter(r => (lang === 'all' || r.language === lang) && (!needle || r.name.toLowerCase().includes(needle) || (r.description || '').toLowerCase().includes(needle)))
      .sort((a, b) => s === 'name' ? a.name.localeCompare(b.name) : s === 'stars' ? b.stargazers_count - a.stargazers_count : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [repos, q, lang, sortIdx, sortKeys]);

  async function create() {
    if (!nName.trim()) return;
    setBusy(true); setErr('');
    try {
      await gh.createRepo(nName.trim().replace(/\s+/g, '-'), nDesc.trim(), nPriv);
      await loadRepos();
      logAct('folder-plus', 'Repositorio creado', nName);
      pushToast('Repositorio creado', 'ok', nName);
      setShowCreate(false); setNName(''); setNDesc('');
    } catch (e) {
      setErr(e instanceof GitHubError ? e.message : 'error al crear');
    } finally { setBusy(false); }
  }

  function openMenuAt(e: MouseEvent, repo: string) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, repo });
  }

  function menuItems(repo: string): CtxItem[] {
    const full = repos.find(r => r.name === repo)?.full_name || repo;
    return [
      { label: 'Abrir ficha', icon: <IcBox size={14} />, fn: () => openFicha(full) },
      { label: 'Abrir en Code Explorer', icon: <IcCode size={14} />, fn: () => { setPrefs({ lastRepo: full }); router.push('/code/'); } },
      { label: 'Comparar ramas', icon: <IcBranch size={14} />, fn: () => { setPrefs({ lastRepo: full }); router.push('/code/'); } },
      { sep: true, label: '' },
      { label: 'Subir archivos aquí', icon: <IcUpload size={14} />, fn: () => { setPrefs({ lastRepo: full }); router.push('/explorer/'); } },
      {
        label: 'Crear fork', icon: <IcFork size={14} />, fn: async () => {
          try { await gh.fork(full); logAct('fork', 'Fork creado', full); pushToast('Fork creado', 'ok', full); loadRepos().catch(() => { }); }
          catch (e) { pushToast('Error', 'err', e instanceof Error ? e.message : ''); }
        },
      },
      {
        label: 'Cambiar visibilidad', icon: repos.find(r => r.name === repo)?.private ? <IcGlobe size={14} /> : <IcLock size={14} />, fn: async () => {
          const r = repos.find(x => x.name === repo);
          if (!r) return;
          try { await gh.setVisibility(r.full_name, !r.private); logAct(r.private ? 'globe' : 'lock', 'Visibilidad cambiada', full); pushToast('Visibilidad actualizada', 'ok', full); loadRepos().catch(() => { }); }
          catch (e) { pushToast('Error', 'err', e instanceof Error ? e.message : ''); }
        },
      },
      { sep: true, label: '' },
      { label: 'Eliminar repositorio', icon: <IcTrash size={14} />, danger: true, fn: () => setDelRepo(full) },
    ];
  }

  if (!connected) return (
    <>
      <Section title="Repositories"><NeedConn what="ver tus repositorios" /></Section>
      <RepoFicha open={false} onClose={closeFicha} />
    </>
  );
  if (connected && !caps.map.repos) return (
    <Section title="Repositories">
      <NeedScope title="Scope «repo» o «public_repo» requerido" reason={CAPS.find(c => c.cap === 'repos')!.missingNote} />
    </Section>
  );

  return (
    <>
      <Section
        title="Repositories"
        sub={`${repos.length} proyectos de tu cuenta · clic derecho para el menú de acciones`}
        right={
          <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcPlus size={15} />} onClick={() => setShowCreate(true)}>Nuevo repo</GlassButton>
        }
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}><GlassInput type="search" placeholder="Filtrar repositorios…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar repos" /></div>
          <GlassSegmented
            options={[{ label: 'Recientes' }, { label: 'A-Z' }, { label: '★' }]}
            value={sortIdx} onChange={setSortIdx} aria-label="Orden"
          />
          <GlassSegmented
            options={[{ label: 'Tarjetas' }, { label: 'Lista' }]}
            value={layoutIdx} onChange={setLayoutIdx} aria-label="Vista"
          />
        </div>
        <div style={{ height: 10 }} />
        <div className="chips">
          {langs.map(l => (
            <button key={l} className={`chip-btn${lang === l ? ' active' : ''}`} onClick={() => setLang(l)}>{l === 'all' ? 'Todos' : l}</button>
          ))}
        </div>
        <div style={{ height: 12 }} />
        <Diag text={err || null} />
        {loading && !repos.length ? <Spinner size={22} /> : null}

        {layoutKeys[layoutIdx] === 'grid' ? (
          <div className="grid-cards">
            {list.map(r => (
              <GlassCard key={r.id} padding="16px" className="repo-card">
                <div onClick={() => openFicha(r.full_name)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openFicha(r.full_name); }} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b style={{ fontSize: 13.5 }}>{r.name}</b>
                    <span className="chip" style={{ marginLeft: 'auto' }}>{r.private ? <IcLock size={10} /> : <IcGlobe size={10} />} {r.private ? 'privado' : 'público'}</span>
                    <span aria-label="Menú" role="button" tabIndex={0} style={{ color: 'var(--text-3)', display: 'inline-flex', cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); openMenuAt(e, r.name); }}
                      onKeyDown={e => e.stopPropagation()}><IcMore size={15} /></span>
                  </div>
                  <span className="desc">{r.description || 'Sin descripción.'}</span>
                  <div className="meta">
                    {r.language ? <span className="chip"><i className="lang-dot" style={{ background: langColor(r.language) }} /> {r.language}</span> : null}
                    <span className="chip"><IcBranch size={10} /> {r.default_branch}</span>
                    <span className="chip"><IcIssue size={10} /> {r.open_issues_count ?? 0}</span>
                    <span className="chip"><IcStar size={10} /> {r.stargazers_count}</span>
                    <span className="chip"><IcBox size={10} /> {fmtSize(r.size)}</span>
                  </div>
                  <span className="tiny"><IcCommit size={11} /> actualizado {relTime(r.pushed_at || r.updated_at)}</span>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <div className="rows">
            {list.map(r => (
              <div key={r.id} className="row" onClick={() => openFicha(r.full_name)} onContextMenu={e => openMenuAt(e, r.name)}>
                <span style={{ color: 'var(--orbit-accent)', display: 'inline-flex' }}><IcBox size={16} /></span>
                <div className="r-main">
                  <div className="r-title">{r.name} {r.private ? <IcLock size={11} /> : <IcGlobe size={11} />}</div>
                  <div className="r-meta">{r.description || 'Sin descripción'} · {r.language || '—'}</div>
                </div>
                <div className="r-side">
                  <span className="chip"><IcStar size={10} /> {r.stargazers_count}</span>
                  <span className="chip">{relTime(r.pushed_at || r.updated_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && !list.length ? <p className="tiny">Sin resultados.</p> : null}
      </Section>

      {/* Hoja de creación */}
      <GlassSheet open={showCreate} onClose={() => setShowCreate(false)} aria-label="Nuevo repositorio">
        <div className="sheet-head"><h3>Nuevo repositorio</h3><span className="tiny">Se creará en tu cuenta vía API oficial</span></div>
        <GlassInput label="Nombre" placeholder="mi-repo" value={nName} onChange={e => setNName(e.target.value)} className="mono" aria-label="Nombre del repo" tint="var(--orbit-accent)" />
        <div style={{ height: 10 }} />
        <GlassInput label="Descripción (opcional)" placeholder="Qué contiene…" value={nDesc} onChange={e => setNDesc(e.target.value)} aria-label="Descripción" />
        <div style={{ height: 6 }} />
        <div className="orbit-row">
          <div className="orbit-row-text"><b>Repositorio privado</b><small>Público por defecto</small></div>
          <GlassSwitch checked={nPriv} onChange={setNPriv} tint="var(--orbit-accent)" aria-label="Privado" />
        </div>
        <Diag text={err || null} />
        <div className="sheet-actions">
          <GlassButton onClick={() => setShowCreate(false)}>Cancelar</GlassButton>
          <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcPlus size={14} />} disabled={busy || !nName.trim()} onClick={create}>
            {busy ? 'Creando…' : 'Crear repositorio'}
          </GlassButton>
        </div>
      </GlassSheet>

      {/* Eliminar repo: exige escribir el nombre */}
      <ConfirmSheet
        open={delRepo !== null}
        onClose={() => setDelRepo(null)}
        title={'Eliminar ' + delRepo}
        text={`Esta acción es permanente y se ejecuta contra GitHub: se borrará el repositorio ${delRepo} con todo su historial, PRs e issues. Escribe su nombre para confirmar.`}
        confirmLabel="Eliminar"
        typeTo={delRepo || ''}
        onConfirm={async () => {
          try {
            await gh.deleteRepo(delRepo!);
            await loadRepos();
            logAct('trash', 'Repositorio eliminado', delRepo!);
            pushToast('Repositorio eliminado', 'ok', delRepo!);
          } catch (e) {
            pushToast('No se pudo eliminar', 'err', e instanceof Error ? e.message : '');
          }
        }}
      />

      {/* Ficha (global: se abre también desde búsqueda global y chat) */}
      <RepoFicha open={fichaRepo !== null} onClose={closeFicha} />

      {/* Menú contextual */}
      <ContextMenu pos={menu ? { x: menu.x, y: menu.y } : null} items={menu ? menuItems(menu.repo) : []} onClose={() => setMenu(null)} />
    </>
  );
}
