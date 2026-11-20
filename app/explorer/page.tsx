'use client';

/* Explorer: subida delta verificada. Eliges archivos/carpeta/ZIP, un repo y
   una rama; Orbit compara por SHA-1 Git, sube solo lo que cambia y verifica
   leyendo el árbol final. Con sincronización espejo opcional. */

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { GlassButton, GlassInput, GlassSwitch, GlassCard, GlassSegmented } from '@zakisheriff/liquid-glass';
import { useOrbit, setPrefs, pushToast } from '@/lib/store';
import { gh, GitHubError, type GHTreeEntry } from '@/lib/github';
import { analyze, commitOrbit, type FileEntry, type Plan, type CommitResult } from '@/lib/upload';
import { readZip } from '@/lib/zip';
import { Section, NeedConn, Diag, Spinner, RepoPicker, BranchPicker } from '@/components/bits';
import { IcUpload, IcFolder, IcFile, IcRefresh, IcCloud, IcCheck, IcWarn, IcExternal, IcTrash } from '@/components/Icons';

export default function ExplorerPage() {
  const { connected, repos, prefs } = useOrbit();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('');
  const [sync, setSync] = useState(true);
  const [message, setMessage] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; done: number; total: number; detail?: string } | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [err, setErr] = useState('');
  const [over, setOver] = useState(false);
  const [pickRepo, setPickRepo] = useState(false);
  const [pickBranch, setPickBranch] = useState(false);
  const dirRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRepo(prefs.lastRepo);
    setBranch(prefs.lastBranch);
    if (dirRef.current) dirRef.current.setAttribute('webkitdirectory', '');
    if (dirRef.current) dirRef.current.setAttribute('directory', '');
  }, [prefs.lastRepo, prefs.lastBranch]);

  function defaultBranch(r: string): string {
    return repos.find(x => x.full_name === r)?.default_branch || 'main';
  }

  function addEntries(list: FileEntry[]) {
    setFiles(prev => {
      const map = new Map(prev.map(e => [e.path, e]));
      for (const e of list) map.set(e.path, e);
      const merged = [...map.values()];
      pushToast(merged.length + ' archivos en cola', 'ok', list.length + ' añadidos ahora · ' + (new Set(list.map(x => x.path)).size) + ' rutas nuevas');
      return merged;
    });
    setPlan(null); setResult(null);
  }

  async function onPickFiles(fl: FileList | null) {
    if (!fl?.length) return;
    setErr('');
    if (fl.length === 1 && fl[0].name.toLowerCase().endsWith('.zip')) {
      try {
        const entries = await readZip(fl[0]);
        addEntries(entries);
      } catch (e) { setErr(e instanceof Error ? e.message : 'ZIP ilegible'); }
      return;
    }
    addEntries([...fl].map(f => ({ path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, file: f })));
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setOver(false);
    const items = e.dataTransfer?.files;
    if (items?.length) onPickFiles(items);
  }

  async function runAnalyze() {
    if (!files.length || !repo || !branch) return;
    setAnalyzing(true); setErr(''); setResult(null);
    try {
      const br = await gh.branches(repo).catch(() => []);
      let treeEntries: GHTreeEntry[] = [];
      if (br.some(b => b.name === branch)) {
        const refSha = (await gh.ref(repo, branch)).object.sha;
        const tree = await gh.tree(repo, refSha);
        treeEntries = tree.tree;
        if (tree.truncated) pushToast('Árbol enorme truncado por GitHub', 'err', 'La comparación solo cubre parte del repo');
      }
      const p = await analyze(files, treeEntries, sync, (done, total) => setProgress({ stage: 'análisis', done, total }));
      setPlan(p);
      pushToast('Análisis listo', 'ok', `${p.creates.length} nuevos · ${p.updates.length} cambiados · ${p.skips.length} idénticos`);
    } catch (e) {
      setErr(e instanceof GitHubError ? e.message : 'error al analizar');
    } finally { setAnalyzing(false); setProgress(null); }
  }

  async function runCommit() {
    if (!plan || !repo || !branch) return;
    setCommitting(true); setErr('');
    const msg = message.trim() || `Orbit: subida delta (${plan.creates.length} nuevos, ${plan.updates.length} actualizados${sync && plan.deletes.length ? ', ' + plan.deletes.length + ' borrados' : ''})`;
    try {
      const res = await commitOrbit({
        repo, branch, message: msg, plan, sync,
        onProgress: (stage, done, total, detail) => setProgress({ stage, done, total, detail }),
      });
      setResult(res);
      if (res.ok) pushToast('Commit verificado', 'ok', `${res.uploaded} subidos · ${res.skipped} sin cambios · ${res.deleted} borrados`);
      else pushToast('Commit con observaciones', 'err', res.problems[0]);
    } catch (e) {
      setErr(e instanceof GitHubError ? e.message : 'error al subir');
    } finally { setCommitting(false); setProgress(null); }
  }

  if (!connected) return <Section title="Explorer"><NeedConn what="subir archivos a un repositorio" /></Section>;

  const total = plan ? plan.creates.length + plan.updates.length : 0;
  const rows = plan ? [...plan.creates.map(e => ({ e, kind: 'nuevo' })), ...plan.updates.map(e => ({ e, kind: 'cambiado' })), ...plan.skips.slice(0, 60).map(e => ({ e, kind: 'igual' }))] : [];

  return (
    <Section
      title="Explorer · subida delta"
      sub="Solo se sube lo que cambia — verificado ruta por ruta con el SHA final"
      right={files.length ? <GlassButton icon={<IcTrash size={14} />} onClick={() => { setFiles([]); setPlan(null); setResult(null); }}>Vaciar</GlassButton> : null}
    >
      {/* 1. Origen de archivos */}
      <div
        className={`file-zone${over ? ' over' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        role="button" aria-label="Elegir archivos"
      >
        <b>Arrastra aquí archivos, una carpeta o un ZIP</b>
        <small>o haz clic para elegir · rutas relativas respetadas · ZIP64 soportado</small>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }} onClick={e => e.stopPropagation()}>
          <GlassButton size="sm" icon={<IcFolder size={14} />} onClick={() => dirRef.current?.click()}>Carpeta</GlassButton>
          <GlassButton size="sm" icon={<IcFile size={14} />} onClick={() => fileRef.current?.click()}>Archivos</GlassButton>
          <GlassButton size="sm" icon={<IcUpload size={14} />} onClick={() => zipRef.current?.click()}>ZIP</GlassButton>
        </div>
      </div>
      <input ref={dirRef} type="file" multiple hidden onChange={e => onPickFiles(e.target.files)} />
      <input ref={fileRef} type="file" multiple hidden onChange={e => onPickFiles(e.target.files)} />
      <input ref={zipRef} type="file" accept=".zip" hidden onChange={e => onPickFiles(e.target.files)} />

      {files.length ? (
        <p className="tiny" style={{ margin: '8px 0' }}>
          {files.length} archivos en cola · {(files.reduce((s, f) => s + f.file.size, 0) / 1024).toFixed(0)} KB totales
          {plan ? ` · plan: ${plan.creates.length} nuevos, ${plan.updates.length} cambiados, ${plan.skips.length} idénticos${sync ? ', ' + plan.deletes.length + ' a borrar en espejo' : ''}` : ''}
        </p>
      ) : null}

      {/* 2. Destino */}
      <div className="orbit-row">
        <div className="orbit-row-text"><b>Destino</b><small>Repositorio y rama a los que enviar los archivos</small></div>
        <div className="orbit-row-ctl">
          <GlassButton onClick={() => setPickRepo(true)}>{repo || 'Elegir repo…'}</GlassButton>
          <GlassButton icon={<IcRefresh size={14} />} aria-label="Elegir rama" onClick={() => setPickBranch(true)}>{branch || defaultBranch(repo) || 'rama…'}</GlassButton>
        </div>
      </div>
      <div className="orbit-row">
        <div className="orbit-row-text"><b>Sincronizar espejo</b><small>Borra del repo lo que ya no exista en tu carpeta local</small></div>
        <GlassSwitch checked={sync} onChange={setSync} tint="var(--orbit-accent)" aria-label="Sincronizar espejo" />
      </div>
      <div className="orbit-row">
        <div className="orbit-row-text"><b>Mensaje del commit</b><small>Si lo dejas vacío, Orbit redacta uno con el resumen</small></div>
        <GlassInput placeholder="Orbit: subida delta…" value={message} onChange={e => setMessage(e.target.value)} aria-label="Mensaje del commit" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcCloud size={15} />} disabled={!files.length || !repo || !branch || analyzing} onClick={runAnalyze}>
          {analyzing ? 'Analizando…' : 'Analizar contra el repo'}
        </GlassButton>
        <GlassButton variant="filled" tint="#30d158" icon={<IcUpload size={15} />} disabled={!plan || total === 0 || committing} onClick={runCommit}>
          {committing ? 'Subiendo…' : `Subir ${total} archivo${total === 1 ? '' : 's'}`}
        </GlassButton>
        {analyzing || committing ? <span className="orbit-spinner" /> : null}
      </div>
      {progress ? (
        <p className="tiny" style={{ marginTop: 8 }}>
          {progress.stage}: {progress.done}/{progress.total}{progress.detail ? ' · ' + progress.detail : ''}
        </p>
      ) : null}
      <Diag text={err || null} />

      {/* 3. Plan */}
      {plan ? (
        <>
          <div className="stat-strip" style={{ marginTop: 16 }}>
            <GlassCard padding="12px 16px" className="stat-box"><small>Nuevos</small><b>{plan.creates.length}</b></GlassCard>
            <GlassCard padding="12px 16px" className="stat-box"><small>Cambiados</small><b>{plan.updates.length}</b></GlassCard>
            <GlassCard padding="12px 16px" className="stat-box"><small>Idénticos</small><b>{plan.skips.length}</b></GlassCard>
            {sync ? <GlassCard padding="12px 16px" className="stat-box"><small>Borrado espejo</small><b>{plan.deletes.length}</b></GlassCard> : null}
            {plan.dups.length ? <GlassCard padding="12px 16px" className="stat-box"><small>Duplicados (mayús.)</small><b>{plan.dups.length}</b></GlassCard> : null}
          </div>
          {rows.length ? (
            <GlassCard padding="10px">
              <div className="table-wrap">
                <table className="plan-table">
                  <thead><tr><th>Ruta</th><th>Acción</th><th>Tamaño</th></tr></thead>
                  <tbody>
                    {rows.slice(0, 150).map(({ e, kind }) => (
                      <tr key={e.path}>
                        <td className="mono" style={{ maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.path}</td>
                        <td><span className={`chip ${kind === 'nuevo' ? 'ok' : kind === 'cambiado' ? 'warn' : ''}`}>{kind}</span></td>
                        <td>{(e.file.size / 1024).toFixed(1)} KB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 150 ? <p className="tiny" style={{ padding: '6px 10px' }}>…y {rows.length - 150} más</p> : null}
            </GlassCard>
          ) : null}
        </>
      ) : null}

      {/* 4. Resultado verificado */}
      {result ? (
        <GlassCard padding="16px" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ color: result.ok ? 'var(--ok)' : 'var(--err)', display: 'inline-flex' }}>
              {result.ok ? <IcCheck size={20} /> : <IcWarn size={20} />}
            </span>
            <b className={result.ok ? 'report-ok' : 'report-bad'}>
              {result.ok ? 'Commit verificado — todo coincide con el árbol final' : 'Commit hecho, con observaciones'}
            </b>
          </div>
          <p className="tiny" style={{ marginBottom: 8 }}>
            {result.commitSha?.slice(0, 10)} · {result.uploaded} subidos · {result.skipped} sin cambios · {result.deleted} borrados en espejo
          </p>
          {result.problems.map((p, i) => <p key={i} className="tiny" style={{ color: 'var(--err)' }}>· {p}</p>)}
          {result.url ? (
            <GlassButton size="sm" icon={<IcExternal size={13} />} href={result.url} target="_blank">Ver commit en GitHub</GlassButton>
          ) : null}
        </GlassCard>
      ) : null}

      <RepoPicker open={pickRepo} onClose={() => setPickRepo(false)} onPick={(r) => { setRepo(r); const d = defaultBranch(r); setBranch(d); setPrefs({ lastRepo: r, lastBranch: d }); setPlan(null); }} />
      <BranchPicker open={pickBranch} onClose={() => setPickBranch(false)} repo={repo} onPick={(b) => { setBranch(b); setPrefs({ lastBranch: b }); setPlan(null); }} />
    </Section>
  );
}
