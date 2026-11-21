'use client';

/* Code Explorer: árbol de archivos, visor con resaltado y números de línea,
   búsqueda interna, copiar/descargar, edición con commit real, previsualización
   de Markdown/HTML y comparador de ramas con diff archivo por archivo. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppButton as GlassButton, AppInput as GlassInput, AppSheet as GlassSheet } from '@/components/ui';
import { useOrbit, consumeCodeCtx, pushToast, setPrefs } from '@/lib/store';
import { gh, blobText, GitHubError, type GHTreeEntry } from '@/lib/github';
import { detectLang, tokenize, buildTree, saveFileEdit } from '@/lib/code';
import { logAct } from '@/lib/activity';
import { Section, NeedConn, NeedScope, Diag, Spinner, RepoPicker } from '@/components/bits';
import { CAPS, capsFromScopes } from '@/lib/scopes';
import { PatchView } from '@/components/diff';
import { Md } from '@/lib/md';
import {
  IcRefresh, IcCompare, IcCode, IcFile, IcCopy, IcDownload, IcEdit, IcEye,
  IcUpload, IcX, IcFolder, IcBranch, IcArrowRight, IcAlert,
} from '@/components/Icons';

interface CodeFile { path: string; size: number; sha: string }

export default function CodePage() {
  const { connected, repos, prefs, scopes } = useOrbit();
  const caps = capsFromScopes(scopes);
  const [repo, setRepo] = useState<string>('');
  const [branch, setBranch] = useState<string>('main');
  const [branches, setBranches] = useState<string[]>([]);
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [filter, setFilter] = useState('');
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string>('');
  const [activeContent, setActiveContent] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [wrap, setWrap] = useState(false);
  const [edit, setEdit] = useState(false);
  const [preview, setPreview] = useState(false);
  const [view, setView] = useState<'code' | 'diff'>('code');
  const [base, setBase] = useState('main');
  const [head, setHead] = useState<string>('');
  const [diff, setDiff] = useState<null | Awaited<ReturnType<typeof gh.compare>>>(null);
  const [comparing, setComparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [err, setErr] = useState('');
  const [hitIdx, setHitIdx] = useState(0);
  const [pickRepo, setPickRepo] = useState(false);
  const [pickBranch, setPickBranch] = useState(false);
  const [pickBase, setPickBase] = useState(false);
  const [pickHead, setPickHead] = useState(false);
  const contents = useRef<Map<string, string>>(new Map());
  const bodyRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  /* contexto desde chat/ficha: abre repo (y archivo) automáticamente */
  useEffect(() => {
    const ctx = consumeCodeCtx();
    const defRepo = ctx.repo || prefs.lastRepo || '';
    if (defRepo) {
      setRepo(defRepo);
      const defBranch = ctx.branch
        || repos.find(r => r.full_name === defRepo)?.default_branch
        || prefs.lastBranch || 'main';
      setBranch(defBranch);
      setHead(defBranch);
      setBase('main');
      if (ctx.file) {
        const t = setTimeout(() => openFile(ctx.file!, defRepo, defBranch), 500);
        return () => clearTimeout(t);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (repo && branch) void loadTree(repo, branch); /* eslint-disable-line */ }, [repo, branch]);
  useEffect(() => { if (repo && !branches.length) void loadBranches(repo); /* eslint-disable-line */ }, [repo]);

  async function loadBranches(r: string) {
    try {
      const bs = await gh.branches(r);
      const names = bs.map(b => b.name);
      setBranches(names);
      setBranch(cur => (names.includes(cur) ? cur : names[0] || 'main'));
      setHead(cur => cur || names[0] || 'main');
    } catch { setBranches(['main']); }
  }

  async function loadTree(r: string, b: string) {
    setLoadingTree(true); setErr('');
    try {
      const refSha = (await gh.ref(r, b)).object.sha;
      const tree = await gh.tree(r, refSha);
      const list: CodeFile[] = tree.tree
        .filter((t: GHTreeEntry) => t.type === 'blob')
        .map(t => ({ path: t.path, size: t.size || 0, sha: t.sha }));
      setFiles(list);
      if (tree.truncated) pushToast('Árbol enorme truncado por GitHub', 'err', 'La lista de archivos puede ser parcial');
    } catch (e) {
      setFiles([]); setErr(e instanceof GitHubError ? e.message : 'No se pudo cargar el árbol');
    } finally { setLoadingTree(false); }
  }

  async function fetchText(path: string, r: string, b: string): Promise<string> {
    let f = files.find(x => x.path === path);
    if (!f) {
      const t = await gh.tree(r, (await gh.ref(r, b)).object.sha);
      const entry = t.tree.find(x => x.path === path && x.type === 'blob');
      if (!entry) throw new GitHubError('Archivo no encontrado en el árbol: ' + path, 404);
      f = { path, size: entry.size || 0, sha: entry.sha };
    }
    return blobText(r, f.sha, path);
  }

  async function openFile(path: string, r?: string, b?: string) {
    const rr = r || repo, bb = b || branch;
    if (!path || !rr) return;
    setActive(path); setView('code'); setEdit(false); setPreview(false); setSearch(''); setHitIdx(0);
    setTabs(t => (t.includes(path) ? t : [...t, path]));
    const key = rr + '|' + bb + '|' + path;
    if (!contents.current.has(key)) {
      try {
        const text = await fetchText(path, rr, bb);
        contents.current.set(key, text);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'No se pudo leer el archivo');
        contents.current.set(key, '');
      }
    }
    setActiveContent(contents.current.get(key) || '');
  }

  function setEditText(t: string) {
    if (taRef.current) taRef.current.value = t;
    editCache.current = t;
  }
  const editCache = useRef('');

  const treeRoot = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f ? files.filter(p => p.path.toLowerCase().includes(f)) : files;
    return buildTree(list);
  }, [files, filter]);

  function renderTree() {
    const walk = (node: ReturnType<typeof buildTree>, depth: number): React.ReactNode[] => {
      const out: React.ReactNode[] = [];
      [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name)).forEach(d => {
        out.push(
          <div key={'d' + depth + d.name}>
            <div className="trow folder" style={{ paddingLeft: depth * 13 }}>
              <span className="t-ico"><IcFolder size={14} /></span>
              <span className="t-name">{d.name}/</span>
              <span className="t-size">{d.files.length + d.dirs.size}</span>
            </div>
            {walk(d, depth + 1)}
          </div>,
        );
      });
      [...node.files].sort((a, b) => a.path.localeCompare(b.path)).forEach(f => {
        const lang = detectLang(f.path);
        out.push(
          <button key={f.path} className={`trow${active === f.path ? ' sel' : ''}`} style={{ paddingLeft: depth * 13 + 18 }} onClick={() => openFile(f.path)}>
            <span className={`t-ico${lang ? ' acc' : ''}`}>{lang ? <IcCode size={14} /> : <IcFile size={14} />}</span>
            <span className="t-name">{f.path.split('/').pop()}</span>
            <span className="t-size">{f.size < 1024 ? f.size + ' B' : (f.size / 1024).toFixed(1) + ' KB'}</span>
          </button>,
        );
      });
      return out;
    };
    return <div className="tree">{walk(treeRoot, 0)}</div>;
  }

  const activeText = activeContent;
  const lang = active ? detectLang(active) : null;
  const lines = (activeText ?? '').split('\n');
  const q = search.toLowerCase();
  const hits = useMemo(
    () => lines.map((l, i) => (q && l.toLowerCase().includes(q) ? i : -1)).filter(i => i >= 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, activeText],
  );

  function jump(d: number) {
    if (!hits.length) return;
    const idx = (hitIdx + d + hits.length) % hits.length;
    setHitIdx(idx);
    const el = bodyRef.current?.querySelectorAll('.ln.hit')[idx];
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async function runCompare() {
    if (!repo) return;
    setComparing(true); setErr('');
    try {
      const c = await gh.compare(repo, base, head || branch);
      setDiff(c);
      logAct('compare', 'Ramas comparadas', repo + ': ' + base + '…' + (head || branch));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo comparar'); setDiff(null);
    } finally { setComparing(false); }
  }

  async function saveEdit() {
    if (!repo || !active) return;
    setSaving(true); setErr('');
    try {
      const text = taRef.current?.value ?? editCache.current;
      await saveFileEdit({
        repo, branch, path: active, text, message: saveMsg.trim() || `edit: ${active.split('/').pop()} desde Orbit`,
      });
      contents.current.set(repo + '|' + branch + '|' + active, text);
      setActiveContent(text);
      setEdit(false); setSaveOpen(false);
      logAct('commit', 'Archivo editado y guardado', active + ' @ ' + repo);
      pushToast('Commit creado', 'ok', active);
      void loadTree(repo, branch);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setSaving(false); }
  }

  function download() {
    if (!activeText || !active) return;
    const blob = new Blob([activeText], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = active.split('/').pop() || 'file';
    a.click();
    pushToast('Descargado', 'ok', active);
  }

  if (!connected) return <Section title="Code Explorer"><NeedConn what="explorar el código de tus repositorios" /></Section>;
  if (!caps.map.code) return (
    <Section title="Code Explorer">
      <NeedScope title="Permiso «Contents» requerido" reason={CAPS.find(c => c.cap === 'code')!.missingNote} />
    </Section>
  );

  /* ---------- picker de repositorio ---------- */
  if (!repo) {
    return (
      <Section title="Code Explorer" sub="Elige explícitamente el repositorio que quieres abrir — no se carga ninguno automáticamente">
        <div className="grid-cards">
          {repos.map(r => (
            <button key={r.id} style={{ textAlign: 'left', border: 'none', background: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}
              onClick={() => {
                setRepo(r.full_name); setBranch(r.default_branch); setHead(r.default_branch); setBase('main');
                setPrefs({ lastRepo: r.full_name, lastBranch: r.default_branch });
                logAct('code', 'Repo elegido en Code Explorer', r.name);
              }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <IcCode size={16} />
                  <b style={{ fontSize: 13.5 }}>{r.name}</b>
                  <span className="badge blue" style={{ marginLeft: 'auto' }}>{r.default_branch}</span>
                </div>
                <p className="tiny" style={{ marginTop: 6, minHeight: 30 }}>{r.description || 'Sin descripción'}</p>
                <div className="chips" style={{ marginTop: 6 }}>
                  {r.language ? <span className="chip acc">{r.language}</span> : null}
                  <span className="chip">{(r.size / 1024).toFixed(1)} MB</span>
                </div>
              </div>
            </button>
          ))}
        </div>
        {!repos.length ? <p className="tiny">Sincroniza tus repositorios en Control Center y elige uno para abrir su código.</p> : null}
      </Section>
    );
  }

  return (
    <Section
      title="Code Explorer"
      sub="Visor, interpretación ligera y comparador de ramas"
      right={
        <>
          <GlassButton size="sm" onClick={() => { setRepo(''); setTabs([]); setActive(''); setFiles([]); setDiff(null); setBranches([]); contents.current.clear(); }}>Cambiar repo</GlassButton>
          <GlassButton size="sm" className="mono" onClick={() => setPickRepo(true)}>{repo}</GlassButton>
          <GlassButton size="sm" className="mono" onClick={() => setPickBranch(true)}><IcBranch size={12} /> {branch}</GlassButton>
          <GlassButton size="sm" icon={<IcRefresh size={13} />} aria-label="Recargar" onClick={() => { loadTree(repo, branch); loadBranches(repo); pushToast('Árbol actualizado', 'ok'); }} />
          <GlassButton size="sm" variant={view === 'diff' ? 'filled' : 'glass'} tint="var(--orbit-accent)" icon={<IcCompare size={13} />}
            onClick={() => { const nv = view === 'diff' ? 'code' : 'diff'; setView(nv); if (nv === 'diff' && !diff) setTimeout(runCompare, 30); }}>
            Comparar ramas
          </GlassButton>
        </>
      }
    >
      <Diag text={err || null} />

      {view === 'diff' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <GlassButton size="sm" className="mono" onClick={() => setPickBase(true)}><IcBranch size={12} /> {base}</GlassButton>
            <IcArrowRight size={15} />
            <GlassButton size="sm" className="mono" onClick={() => setPickHead(true)}><IcBranch size={12} /> {head || branch}</GlassButton>
            <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcCompare size={13} />} disabled={comparing} onClick={runCompare}>
              {comparing ? 'Comparando…' : 'Comparar'}
            </GlassButton>
            {diff ? (
              <span className="num">
                {diff.total_commits} commits · {diff.files.length} archivos ·{' '}
                <span className="df-add">+{diff.files.reduce((s, f) => s + f.additions, 0)}</span>{' '}
                <span className="df-del">−{diff.files.reduce((s, f) => s + f.deletions, 0)}</span>
              </span>
            ) : null}
          </div>
          {diff?.commits.length ? (
            <div className="chips" style={{ marginBottom: 10 }}>
              {diff.commits.slice(0, 5).map(c => (
                <span key={c.sha} className="chip" style={{ cursor: 'default' }}>{c.sha.slice(0, 7)} {(c.commit.message || '').split('\n')[0].slice(0, 40)}</span>
              ))}
            </div>
          ) : null}
          {diff
            ? diff.files.map(f => (
              <div key={f.filename} className="diff-file">
                <div className="df-h">
                  <IcCode size={14} />
                  <span className="grow">{f.filename}</span>
                  <span className="df-stats"><span className="df-add">+{f.additions}</span> <span className="df-del">−{f.deletions}</span></span>
                  <span className="badge">{f.status}</span>
                </div>
                <PatchView patch={f.patch} />
              </div>
            ))
            : (
              <div style={{ textAlign: 'center', padding: 34, color: 'var(--text-2)', fontSize: 13 }}>
                <IcCompare size={40} />
                <p style={{ marginTop: 10 }}>Elige base y comparación, y se mostrarán los cambios archivo por archivo con contexto.</p>
              </div>
            )}
          <BranchSheet open={pickBase} onClose={() => setPickBase(false)} branches={branches} onPick={setBase} title="Rama base" />
          <BranchSheet open={pickHead} onClose={() => setPickHead(false)} branches={branches} onPick={setHead} title="Rama a comparar" />
        </>
      ) : (
        <div className="code-grid">
          {/* árbol */}
          <div className="code-pane tree-pane" style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', padding: 10 }}>
            <div style={{ position: 'relative' }}>
              <GlassInput type="search" placeholder="Filtrar archivos…" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filtrar archivos" />
            </div>
            <div style={{ overflow: 'auto', marginTop: 8, maxHeight: 560 }}>
              {loadingTree && !files.length ? <div style={{ padding: 12 }}><Spinner size={20} /></div> : renderTree()}
              {!loadingTree && !files.length ? <p className="tiny" style={{ padding: 10 }}>Sin archivos en esta rama.</p> : null}
            </div>
          </div>

          {/* visor */}
          <div className="code-pane" style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)' }}>
            <div className="code-head">
              <div className="code-tabs">
                {tabs.map(t => (
                  <span key={t} className={`ctab${active === t ? ' active' : ''}`} role="button" tabIndex={0}
                    onClick={() => { setActive(t); setEdit(false); setPreview(false); setSearch(''); setActiveContent(contents.current.get(repo + '|' + branch + '|' + t) || ''); }}
                    onKeyDown={e => { if (e.key === 'Enter') setActive(t); }}>
                    <IcCode size={12} />
                    <span>{t.split('/').pop()}</span>
                    <span role="button" tabIndex={0} aria-label={'Cerrar ' + t}
                      onClick={e => { e.stopPropagation(); setTabs(prev => prev.filter(x => x !== t)); if (active === t) setActive(''); }}
                      onKeyDown={e => e.stopPropagation()}
                      style={{ display: 'inline-flex' }}><IcX size={11} /></span>
                  </span>
                ))}
                {!tabs.length ? <span className="tiny" style={{ alignSelf: 'center' }}>Sin pestañas abiertas</span> : null}
              </div>
              <div className="code-toolbar">
                <div style={{ width: 150 }}><GlassInput type="search" placeholder="Buscar en archivo" value={search} onChange={e => { setSearch(e.target.value); setHitIdx(0); }} aria-label="Buscar en archivo" /></div>
                {search ? <span className="num">{hits.length} coincid.</span> : null}
                <button className="ibtn" aria-label="Anterior coincidencia" onClick={() => jump(-1)}><IcArrowRight size={14} style={{ transform: 'rotate(-90deg)' }} /></button>
                <button className="ibtn" aria-label="Siguiente coincidencia" onClick={() => jump(1)}><IcArrowRight size={14} style={{ transform: 'rotate(90deg)' }} /></button>
                <button className={`ibtn${wrap ? ' on' : ''}`} aria-label="Ajuste de línea" onClick={() => setWrap(w => !w)}>↔</button>
                <button className="ibtn" aria-label="Copiar" onClick={() => { if (activeText != null) navigator.clipboard.writeText(activeText).then(() => pushToast('Copiado al portapapeles', 'ok')); }}><IcCopy size={14} /></button>
                <button className="ibtn" aria-label="Descargar" onClick={download}><IcDownload size={14} /></button>
                <button className={`ibtn${edit ? ' on' : ''}`} aria-label="Editar" onClick={() => {
                  if (!active) { pushToast('Abre un archivo primero', 'err'); return; }
                  if (edit) { setSaveOpen(true); return; }
                  setEditText(activeText ?? ''); setEdit(true); setPreview(false);
                  pushToast('Modo edición', 'info', 'Edita el texto y pulsa «Enviar cambios a GitHub» para crear el commit');
                }}><IcEdit size={14} /></button>
                <button className="ibtn" aria-label="Enviar cambios a GitHub" style={{ display: edit ? '' : 'none' }} onClick={() => setSaveOpen(true)}><IcUpload size={14} /></button>
                <button className={`ibtn${preview ? ' on' : ''}`} aria-label="Previsualizar" onClick={() => { if (!active) { pushToast('Abre un archivo primero', 'err'); return; } setPreview(p => !p); setEdit(false); }}><IcEye size={14} /></button>
              </div>
            </div>

            <div ref={bodyRef} style={{ flex: 1, minHeight: 320, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              {!active ? (
                <div style={{ margin: 'auto', textAlign: 'center', padding: 30 }}>
                  <IcCode size={40} />
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8 }}>Elige un archivo del árbol para verlo con resaltado, números de línea y búsqueda.</p>
                </div>
              ) : activeText === undefined ? (
                <div style={{ margin: 'auto' }}><Spinner size={22} /></div>
              ) : edit ? (
                <>
                  <textarea ref={taRef} className="code-edit" spellCheck={false} defaultValue={activeText} aria-label="Editor de código"
                    onChange={e => { editCache.current = e.target.value; }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', background: 'var(--surface-2)' }}>
                    <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcUpload size={14} />} disabled={saving} onClick={() => setSaveOpen(true)}>
                      {saving ? 'Guardando…' : 'Enviar cambios a GitHub'}
                    </GlassButton>
                    <span className="tiny">Crea un commit en <b className="mono">{repo} · {branch}</b> con el contenido del editor</span>
                    <span style={{ flex: 1 }} />
                    <GlassButton onClick={() => setEdit(false)}>Descartar</GlassButton>
                  </div>
                </>
              ) : preview ? (
                /\.md$/.test(active) ? (
                  <div style={{ padding: 18, maxWidth: 760, margin: '0 auto', width: '100%' }}><Md src={activeText} /></div>
                ) : /\.html?$/.test(active) ? (
                  <div style={{ padding: 14, width: '100%' }}>
                    <iframe title="Previsualización" sandbox="" srcDoc={activeText} style={{ width: '100%', height: 420, border: '1px solid var(--border)', borderRadius: 12, background: '#fff' }} />
                  </div>
                ) : (
                  <div style={{ padding: 18, width: '100%' }}><Md src={'```\n' + activeText + '\n```'} /></div>
                )
              ) : (
                <div className="code-body">
                  <div className="code-gutter">{lines.map((_, i) => (i + 1)).join('\n')}</div>
                  <div className={`code-lines${wrap ? ' wrap' : ''}`}>
                    {lines.map((l, i) => (
                      <span key={i} className={`ln${q && l.toLowerCase().includes(q) ? ' hit' : ''}`}>
                        {tokenize(l, lang).map((t, j) => t.c ? <span key={j} className={t.c}>{t.t}</span> : <span key={j}>{t.t}</span>)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <RepoPicker open={pickRepo} onClose={() => setPickRepo(false)} onPick={r => {
        setRepo(r);
        const d = repos.find(x => x.full_name === r)?.default_branch || 'main';
        setBranch(d); setHead(d); setBase('main');
        setTabs([]); setActive(''); setFiles([]); setDiff(null); setBranches([]);
        contents.current.clear();
        setPrefs({ lastRepo: r, lastBranch: d });
      }} />
      <BranchSheet open={pickBranch} onClose={() => setPickBranch(false)} branches={branches} onPick={b => {
        setBranch(b); setPrefs({ lastBranch: b }); setTabs([]); setActive(''); contents.current.clear();
      }} title="Cambiar rama" />

      <GlassSheet open={saveOpen} onClose={() => setSaveOpen(false)} aria-label="Guardar cambios">
        <h3 className="sheet-title">Guardar cambios · {active}</h3>
        <p className="sheet-text">Se creará un commit en <b className="mono">{repo} · {branch}</b> con el contenido editado.</p>
        <GlassInput
          placeholder="Mensaje del commit" value={saveMsg} onChange={e => setSaveMsg(e.target.value)}
          aria-label="Mensaje del commit" tint="var(--orbit-accent)"
        />
        <p className="tiny" style={{ marginTop: 8 }}>Si lo dejas vacío: «edit: {active ? active.split('/').pop() : ''} desde Orbit»</p>
        <div className="sheet-actions">
          <GlassButton onClick={() => setSaveOpen(false)} disabled={saving}>Cancelar</GlassButton>
          <GlassButton variant="filled" tint="var(--orbit-accent)" disabled={saving} onClick={saveEdit}>
            {saving ? 'Creando commit…' : 'Crear commit'}
          </GlassButton>
        </div>
      </GlassSheet>
    </Section>
  );
}

function BranchSheet({ open, onClose, branches, onPick, title }: {
  open: boolean; onClose: () => void; branches: string[]; onPick: (b: string) => void; title: string;
}) {
  return (
    <GlassSheet open={open} onClose={onClose} aria-label={title}>
      <div className="sheet-head"><h3><IcBranch size={15} /> {title}</h3></div>
      <div className="picker-list">
        {branches.map(b => (
          <button key={b} className="picker-item" onClick={() => { onPick(b); onClose(); }}>
            <span className="picker-ico"><IcBranch size={14} /></span><b className="mono">{b}</b>
          </button>
        ))}
        {!branches.length ? <p className="picker-none" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IcAlert size={13} /> No hay ramas cargadas todavía.</p> : null}
      </div>
    </GlassSheet>
  );
}
