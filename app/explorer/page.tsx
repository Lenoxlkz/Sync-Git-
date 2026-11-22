'use client';

/* Explorer: subida delta verificada. Eliges archivos/carpeta/ZIP, un repo y
   una rama; Orbit compara por SHA-1 Git, sube solo lo que cambia y verifica
   leyendo el árbol final. Con sincronización espejo opcional. */

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { AppButton as GlassButton, AppInput as GlassInput, AppSwitch as GlassSwitch, AppCard as GlassCard, AppSegmented as GlassSegmented, AppSheet as GlassSheet } from '@/components/ui';
import { useOrbit, setPrefs, pushToast, revalidateScopes } from '@/lib/store';
import { gh, blobText, GitHubError, type GHTreeEntry } from '@/lib/github';
import { analyze, commitOrbit, type FileEntry, type Plan, type CommitResult } from '@/lib/upload';
import { onLive, setLiveBusy } from '@/lib/live';
import { lineDiff, type DiffResult } from '@/lib/code';
import { isSecretPath, isBinPath, normPath } from '@/lib/security';
import { readZip } from '@/lib/zip';
import { Section, NeedConn, NeedScope, Diag, Spinner, ConfirmSheet, RepoPicker, BranchPicker } from '@/components/bits';
import { CAPS, capsFromScopes } from '@/lib/scopes';
import { SideBySide } from '@/components/diff';
import { IcUpload, IcFolder, IcFile, IcRefresh, IcCloud, IcCheck, IcWarn, IcExternal, IcTrash, IcCompare, IcX } from '@/components/Icons';

export default function ExplorerPage() {
  const { connected, repos, prefs, scopes } = useOrbit();
  const caps = capsFromScopes(scopes);
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
  useEffect(() => { setLiveBusy(analyzing || committing); }, [analyzing, committing]);
  /* Live: re-análisis silencioso si hay cola y destino (como el HTML original) */
  useEffect(() => onLive(() => {
    if (repo && branch && files.length && plan && !analyzing && !committing) void runAnalyze();
  }), [repo, branch, files, plan, analyzing, committing]);
  const [includeSecrets, setIncludeSecrets] = useState(false);

  const [invalidCount, setInvalidCount] = useState(0);
  const [cmpOpen, setCmpOpen] = useState(false);
  const [cmpEntry, setCmpEntry] = useState<(FileEntry & { remoteSha?: string }) | null>(null);
  const [cmpDiff, setCmpDiff] = useState<DiffResult | 'bin' | null>(null);
  const [cmpBusy, setCmpBusy] = useState(false);
  const [pickRepo, setPickRepo] = useState(false);
  const [pickBranch, setPickBranch] = useState(false);
  const [stripRoot, setStripRoot] = useState(true);
  const [confirmUp, setConfirmUp] = useState(false);
  const [pendingRepo, setPendingRepo] = useState('');
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [emptyRepo, setEmptyRepo] = useState(false);

  async function openCompare(e: FileEntry & { remoteSha?: string }) {
    setCmpEntry(e); setCmpDiff(null); setCmpOpen(true); setCmpBusy(true);
    try {
      const remoteText = e.remoteSha ? await blobText(repo, e.remoteSha, e.path) : '';
      if (isBinPath(e.path) || e.file.size > 1024 * 1024) { setCmpDiff('bin'); return; }
      const localText = await e.file.text();
      if (localText.includes('\u0000')) { setCmpDiff('bin'); return; }
      setCmpDiff(lineDiff(localText, remoteText) || 'bin');
    } catch (errC) {
      pushToast('No se pudo leer la versión remota', 'err', errC instanceof Error ? errC.message : '');
      setCmpDiff(null);
    } finally { setCmpBusy(false); }
  }
  const dirRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    /* sin repo preseleccionado: el destino se elige explícitamente para cada
       subida — evita enviar archivos al repo equivocado */
    if (dirRef.current) dirRef.current.setAttribute('webkitdirectory', '');
    if (dirRef.current) dirRef.current.setAttribute('directory', '');
  }, []);

  function defaultBranch(r: string): string {
    return repos.find(x => x.full_name === r)?.default_branch || 'main';
  }

  /* destino de subida: cambio explícito y — si hay cola — con confirmación
     activable/desactivable; al cambiar se recalculan raíz y plan */
  function applyRepo(r: string) {
    setRepo(r);
    const d = defaultBranch(r);
    setBranch(d);
    setPlan(null); setErr(''); setResult(null); setEmptyRepo(false);
    setPrefs({ lastRepo: r, lastBranch: d });
    setConfirmSwitch(false); setPendingRepo('');
    pushToast('Destino: ' + r, 'ok', 'Rama ' + d + ' · vuelve a analizar para el plan de subida');
  }
  function chooseRepo(r: string) {
    if (files.length && prefs.confirmRepoSwitch && repo && r !== repo) {
      setPendingRepo(r); setPickRepo(false); setConfirmSwitch(true);
      return;
    }
    applyRepo(r);
  }

  /* Carpeta superior compartida por TODAS las rutas (p. ej. «repo-main/» en los
     ZIP de GitHub o la carpeta elegida). Si existe, se quita para que los
     archivos caigan en la raíz del repo, como GitHub los ordena. */
  function commonRoot(paths: string[]): string | null {
    if (!paths.length) return null;
    const tops = paths.map(p => p.split('/')[0]);
    if (tops.some(t => t !== tops[0])) return null;
    if (paths.every(p => !p.includes('/'))) return null;
    return tops[0] + '/';
  }
  const detectedRoot = useMemo(() => commonRoot(files.map(f => f.path)), [files]);
  /* rutas efectivas: con o sin la carpeta raíz; el estado de secreto se
     recalcula sobre la ruta final (la que se sube) */
  const effEntries = useMemo(() => {
    const root = stripRoot ? detectedRoot : null;
    const out: FileEntry[] = [];
    for (const f of files) {
      /* la ruta de destino elegida por el usuario manda sobre la detectada;
         se normaliza SIEMPRE aquí (el campo es libre al teclear y el usuario
         puede analizar sin salir del campo) */
      const auto = root && f.path.startsWith(root) ? f.path.slice(root.length) : f.path;
      const p = f.customPath ? (normPath(f.customPath) || auto) : auto;
      if (!p) continue;
      out.push({ ...f, path: p, secret: isSecretPath(p) });
    }
    return out;
  }, [files, stripRoot, detectedRoot]);

  /* ruta de destino específica por archivo: se escribe sin normalizar (para
     poder teclear «docs/») y se normaliza al salir del campo; vacío restaura */
  function setFilePath(detected: string, value: string) {
    setFiles(prev => prev.map(f => f.path === detected ? { ...f, customPath: value } : f));
    setPlan(null); setResult(null);
  }
  function commitFilePath(detected: string, value: string) {
    const raw = value.trim();
    if (!raw) { setFilePath(detected, ''); return; }
    const p = normPath(raw);
    if (!p) {
      pushToast('Ruta de destino inválida', 'err', 'No puede quedar vacía ni contener «..» (subir fuera del repo)');
      setFilePath(detected, '');
      return;
    }
    setFilePath(detected, p);
  }
  function autoPath(f: FileEntry): string {
    return stripRoot && detectedRoot && f.path.startsWith(detectedRoot) ? f.path.slice(detectedRoot.length) : f.path;
  }
  function effPath(f: FileEntry): string {
    const auto = autoPath(f);
    return f.customPath ? (normPath(f.customPath) || auto) : auto;
  }
  /* descarta un archivo antes de analizar: sale de la cola y anula el plan */
  function discardFile(origPath: string) {
    setFiles(prev => prev.filter(f => f.path !== origPath));
    setPlan(null); setResult(null);
    pushToast('Archivo descartado', 'info', origPath + ' no se subirá');
  }
  /* descarta desde el plan/árbol organizado: quita el archivo de la cola y del
     plan sin re-analizar (las SHA del resto siguen siendo válidas) */
  function discardFromPlan(destPath: string) {
    setFiles(prev => prev.filter(f => effPath(f) !== destPath));
    setPlan(p => p ? {
      ...p,
      creates: p.creates.filter(e => e.path !== destPath),
      updates: p.updates.filter(e => e.path !== destPath),
      skips: p.skips.filter(e => e.path !== destPath),
    } : p);
    pushToast('Archivo descartado', 'info', destPath + ' no se subirá' + (sync ? ' · re-analiza si usas Sincronizar espejo' : ''));
  }
  /* rutas finales actuales (para marcar duplicadas en el editor) */
  const finalPaths = useMemo(() => files.map(f => (f.customPath ? normPath(f.customPath) : autoPath(f))), [files, stripRoot, detectedRoot]);
  /* el aviso de secretos SIEMPRE refleja la cola actual (suma tandas y sobrevive
     a nuevas tandas sin secretos y a descartes) */
  const secretCount = useMemo(() => files.filter(f => f.secret).length, [files]);

  function addEntries(list: FileEntry[]) {
    const clean: FileEntry[] = [];
    let invalid = 0, secrets = 0;
    for (const e of list) {
      const p = normPath(e.path);
      if (!p) { invalid++; continue; }
      const secret = isSecretPath(p);
      if (secret) secrets++;
      clean.push({ ...e, path: p, secret });
    }
    setInvalidCount(prev => prev + invalid);
    /* secretCount se deriva de la cola (ver useMemo) — aquí no se toca para no
       reiniciar el aviso cuando una tanda nueva no trae secretos */
    if (invalid) pushToast(invalid + ' archivo(s) descartado(s)', 'info', 'Rutas inválidas para Git (con «..», vacías o absolutas)');
    if (secrets) pushToast(secrets + ' archivo(s) marcados como posibles secretos', 'warn' as 'info', 'Se excluyen por defecto; actívalos con «Incluir secretos» si de verdad quieres enviarlos');
    setFiles(prev => {
      const map = new Map(prev.map(e => [e.path, e]));
      for (const e of clean) map.set(e.path, e);
      const merged = [...map.values()];
      pushToast(merged.length + ' archivos en cola', 'ok', clean.length + ' añadidos ahora');
      return merged;
    });
    setPlan(null); setResult(null);
  }

  async function onPickFiles(fl: FileList | null) {
    if (!fl?.length) return;
    /* copia primero: el FileList es VIVO y limpiar el input lo vacía; el
       reset del value permite re-seleccionar el mismo archivo otra vez */
    const all: File[] = Array.from(fl);
    [dirRef.current, fileRef.current, zipRef.current].forEach(i => { if (i) i.value = ''; });
    setErr('');
    if (all.length === 1 && all[0].name.toLowerCase().endsWith('.zip')) {
      try {
        const entries = await readZip(all[0]);
        addEntries(entries);
      } catch (e) { setErr(e instanceof Error ? e.message : 'ZIP ilegible'); }
      return;
    }
    addEntries(all.map(f => ({ path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, file: f })));
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setOver(false);
    const items = e.dataTransfer?.files;
    if (items?.length) onPickFiles(items);
  }

  async function runAnalyze() {
    if (!files.length || !repo || !branch) return;
    const eff = effEntries.filter(f => !f.secret || includeSecrets);
    const hidden = files.length - eff.length;
    if (hidden) pushToast(hidden + ' secreto(s) excluidos del análisis', 'info', 'Activa «Incluir secretos» para mandarlos también');
    if (!eff.length) { setErr('Nada que analizar: todos los archivos están excluidos.'); return; }
    setAnalyzing(true); setErr(''); setResult(null);
    try {
      const br = await gh.branches(repo).catch(() => []);
      let treeEntries: GHTreeEntry[] = [];
      if (br.some(b => b.name === branch)) {
        const tree = await gh.treeAt(repo, branch);
        treeEntries = tree.tree;
        if (tree.truncated) pushToast('Árbol enorme truncado por GitHub', 'err', 'La comparación solo cubre parte del repo');
      }
      setEmptyRepo(!br.length);
      const p = await analyze(eff, treeEntries, sync, (done, total) => setProgress({ stage: 'análisis', done, total }), prefs.forceUpload);
      setPlan(p);
      if (!br.length) pushToast('Repositorio vacío', 'ok', 'Se creará el primer commit y la rama ' + branch + ' con tus archivos');
      pushToast('Análisis listo', 'ok', `${p.creates.length} nuevos · ${p.updates.length} cambiados · ${p.skips.length} idénticos${prefs.forceUpload ? ' · forzado' : ''}`);
    } catch (e) {
      setErr(e instanceof GitHubError ? e.message : 'error al analizar');
    } finally { setAnalyzing(false); setProgress(null); }
  }

  async function runCommit() {
    if (!plan || !repo || !branch) return;
    const seen = new Set<string>();
    for (const e of [...plan.creates, ...plan.updates]) {
      const k = e.path.toLowerCase();
      if (seen.has(k)) { setErr('Dos archivos tienen la misma ruta de destino («' + e.path + '»): corrige las rutas antes de subir.'); return; }
      seen.add(k);
    }
    setCommitting(true); setErr('');
    const msg = message.trim() || `Orbit: subida delta (${plan.creates.length} nuevos, ${plan.updates.length} actualizados${sync && plan.deletes.length ? ', ' + plan.deletes.length + ' borrados' : ''})`;
    try {
      const res = await commitOrbit({
        repo, branch, message: msg, plan, sync,
        onProgress: (stage, done, total, detail) => setProgress({ stage, done, total, detail }),
      });
      setResult(res);
      if (res.ok) {
        pushToast('Commit verificado', 'ok', `${res.uploaded} subidos · ${res.skipped} sin cambios · ${res.deleted} borrados`);
        /* flujo limpio: tras subir se vacían mensaje, cola y repo elegido */
        setMessage(''); setFiles([]); setRepo(''); setBranch(''); setPlan(null);
        setIncludeSecrets(false); setInvalidCount(0);
      } else pushToast('Commit con observaciones', 'err', res.problems[0]);
    } catch (e) {
      setErr(e instanceof GitHubError ? e.message : 'error al subir');
    } finally { setCommitting(false); setProgress(null); }
  }

  if (!connected) return <Section title="Explorer"><NeedConn what="subir archivos a un repositorio" /></Section>;
  if (!caps.map.upload) return (
    <Section title="Explorer">
      <NeedScope title="Permiso «Contents» de escritura requerido" reason={CAPS.find(c => c.cap === 'upload')!.missingNote} />
    </Section>
  );

  const total = plan ? plan.creates.length + plan.updates.length : 0;
  /* orden de árbol: agrupado por carpeta y alfabético, como lista GitHub */
  const rows = plan ? [...plan.creates.map(e => ({ e, kind: 'nuevo' })), ...plan.updates.map(e => ({ e, kind: 'cambiado' })), ...plan.skips.slice(0, 60).map(e => ({ e, kind: 'igual' }))].sort((a, b) => a.e.path.localeCompare(b.e.path, 'es', { numeric: true })) : [];
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
      {files.length ? (
        <div className="orbit-row">
          <div className="orbit-row-text"><b>Ruta de destino {files.length > 1 ? 'de cada archivo' : 'del archivo'}</b>
            <small>Carpeta y nombre exactos dentro del repo: para la raíz deja solo el nombre; separa carpetas con «/» (p. ej. «docs/guías/nota.txt»). Vacía el campo para volver a la ruta detectada{stripRoot && detectedRoot ? ' · la carpeta raíz se recorta salvo ruta específica' : ''}</small></div>
          <div className="orbit-row-ctl" style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            {files.slice(0, 150).map(f => {
              const value = f.customPath ?? autoPath(f);
              const dup = finalPaths.filter(x => x.toLowerCase() === value.toLowerCase()).length > 1;
              return (
                <div key={f.path} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <small className="tiny mono" style={{ color: 'var(--text-3)', overflowWrap: 'break-word', flex: 1 }}>{f.path}</small>
                    <GlassButton size="sm" icon={<IcX size={12} />} destructive aria-label={'Descartar ' + f.path} onClick={() => discardFile(f.path)} />
                  </div>
                  <GlassInput
                    placeholder="ruta/dentro/del/repo/archivo.ext"
                    value={value}
                    onChange={e => setFilePath(f.path, e.target.value)}
                    onBlur={e => commitFilePath(f.path, e.target.value)}
                    aria-label={'Ruta de destino de ' + f.path}
                    style={dup ? { borderColor: 'var(--warn)' } : undefined}
                  />
                  {dup ? <span className="chip warn" style={{ alignSelf: 'flex-start' }}>ruta duplicada: otro archivo usa la misma</span> : null}
                </div>
              );
            })}
            {files.length > 150 ? <small className="tiny">Se muestran las primeras 150 rutas; el resto conservan la detectada.</small> : null}
          </div>
        </div>
      ) : null}
      <div className="orbit-row">
        <div className="orbit-row-text"><b>Sincronizar espejo</b><small>Borra del repo lo que ya no exista en tu carpeta local</small></div>
        <GlassSwitch checked={sync} onChange={setSync} tint="var(--orbit-accent)" aria-label="Sincronizar espejo" />
      </div>
      <div className="orbit-row">
        <div className="orbit-row-text"><b>Subida forzada</b><small>Sobrescribe también los archivos idénticos (misma ruta y mismo SHA). Ideal para repos vacíos o nuevos y para reaplicar el contenido completo</small></div>
        <GlassSwitch checked={prefs.forceUpload} onChange={v => { setPrefs({ forceUpload: v }); setPlan(null); }} tint="var(--warn)" aria-label="Subida forzada" />
      </div>
      <div className="orbit-row">
        <div className="orbit-row-text"><b>Confirmar cambio de repo</b><small>Si hay archivos en cola, pide confirmación antes de cambiar el destino de subida</small></div>
        <GlassSwitch checked={prefs.confirmRepoSwitch} onChange={v => setPrefs({ confirmRepoSwitch: v })} tint="var(--orbit-accent)" aria-label="Confirmar cambio de repositorio" />
      </div>
      <div className="orbit-row">
        <div className="orbit-row-text"><b>Quitar carpeta raíz</b><small>{detectedRoot
          ? `Detectada «${detectedRoot}»: las rutas se recortan para quedar en la raíz del repo, en orden de árbol como en GitHub`
          : 'Sin carpeta común: las rutas se suben tal cual'}</small></div>
        <GlassSwitch checked={stripRoot} onChange={v => { setStripRoot(v); setPlan(null); setResult(null); }} tint="var(--orbit-accent)" aria-label="Quitar carpeta raíz" />
      </div>
      {secretCount ? (
        <div className="orbit-row">
          <div className="orbit-row-text"><b>Incluir secretos</b><small>{secretCount} archivo(s) parecen credenciales (.env, .pem, claves…): se excluyen por defecto. Inclúyelos solo a propósito.</small></div>
          <GlassSwitch checked={includeSecrets} onChange={v => { setIncludeSecrets(v); setPlan(null); }} tint="var(--warn)" aria-label="Incluir secretos" />
        </div>
      ) : null}
      {invalidCount ? (
        <p className="tiny" style={{ color: 'var(--warn)' }}>{invalidCount} archivo(s) con ruta inválida fueron descartados al añadirse.</p>
      ) : null}
      <div className="orbit-row">
        <div className="orbit-row-text"><b>Mensaje del commit</b><small>Si lo dejas vacío, Orbit redacta uno con el resumen</small></div>
        <GlassInput placeholder="Orbit: subida delta…" value={message} onChange={e => setMessage(e.target.value)} aria-label="Mensaje del commit" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcCloud size={15} />} disabled={!files.length || !repo || !branch || analyzing} onClick={runAnalyze}>
          {analyzing ? 'Analizando…' : 'Analizar contra el repo'}
        </GlassButton>
        <GlassButton variant="filled" tint="#30d158" icon={<IcUpload size={15} />} disabled={!plan || total === 0 || committing} onClick={() => setConfirmUp(true)}>
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
                  <thead><tr><th>Ruta</th><th>Acción</th><th>Tamaño</th><th>Comparar</th><th>Quitar</th></tr></thead>
                  <tbody>
                    {rows.slice(0, 150).map(({ e, kind }) => (
                      <tr key={e.path}>
                        <td className="mono plan-path">
                          {e.path}{(e as FileEntry).secret ? <span className="chip warn" style={{ marginLeft: 6 }}>secreto</span> : null}
                        </td>
                        <td><span className={`chip ${kind === 'nuevo' ? 'ok' : kind === 'cambiado' ? 'warn' : ''}`}>{kind}</span></td>
                        <td>{(e.file.size / 1024).toFixed(1)} KB</td>
                        <td>
                          {kind === 'cambiado' ? (
                            <button className="chip-btn" onClick={() => openCompare(e as FileEntry & { remoteSha?: string })}>
                              <IcCompare size={12} /> Diff
                            </button>
                          ) : <span className="tiny">—</span>}
                        </td>
                        <td>
                          <button className="chip-btn" aria-label={'Descartar ' + e.path} onClick={() => discardFromPlan(e.path)}>
                            <IcX size={12} /> Quitar
                          </button>
                        </td>
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

      <ConfirmSheet
        open={confirmUp} onClose={() => setConfirmUp(false)}
        title="Subir al repositorio"
        text={`${total} archivo(s): ${plan?.creates.length ?? 0} nuevos y ${plan?.updates.length ?? 0} cambiados → ${repo} · ${branch}${emptyRepo ? '. El repo está vacío: se creará el primer commit y la rama' : ''}${prefs.forceUpload ? '. Subida forzada: los idénticos también se sobrescriben' : ''}${sync && plan?.deletes.length ? `; ${plan.deletes.length} se borrarán en espejo` : ''}. Verificación ruta por ruta con el SHA final.`}
        confirmLabel="Subir ahora"
        onConfirm={runCommit}
      />
      <RepoPicker open={pickRepo} onClose={() => setPickRepo(false)} onPick={chooseRepo} />
      <ConfirmSheet
        open={confirmSwitch} onClose={() => { setConfirmSwitch(false); setPendingRepo(''); }}
        title="Cambiar de repositorio"
        text={`Tienes ${files.length} archivo(s) en cola${repo ? ` con destino ${repo}` : ''}. Si cambias a ${pendingRepo} se recalcula la carpeta raíz y el plan; los archivos se quedan en la cola y nada se sube al repo anterior.`}
        confirmLabel="Cambiar destino"
        onConfirm={() => applyRepo(pendingRepo)}
      />
      <BranchPicker open={pickBranch} onClose={() => setPickBranch(false)} repo={repo} onPick={(b) => { setBranch(b); setPrefs({ lastBranch: b }); setPlan(null); }} />

      {/* Comparación lado a lado: tu versión vs la del repo */}
      <GlassSheet open={cmpOpen} onClose={() => setCmpOpen(false)} detents={['large']} aria-label="Comparar con el repo">
        <div className="sheet-head"><h3><IcCompare size={15} /> {cmpEntry?.path}</h3></div>
        {cmpBusy ? <div style={{ padding: 20, textAlign: 'center' }}><Spinner size={22} /></div>
          : cmpDiff === 'bin' ? (
            <div className="note"><IcFile size={15} /><span>Archivo <b>binario o demasiado grande para diff de texto</b>: decide con los botones de abajo o revisa los metadatos del plan.</span></div>
          ) : cmpDiff ? (
            <SideBySide d={cmpDiff} />
          ) : (
            <p className="tiny">Sin diff disponible para este archivo.</p>
          )}
        {cmpEntry ? (
          <p className="tiny" style={{ marginTop: 10 }}>
            La subida usa <b>tu versión local</b> (la más reciente) salvo que quites el archivo de la cola. Esto es solo una previsualización: nada se envía aquí.
          </p>
        ) : null}
        <div className="sheet-actions">
          <GlassButton onClick={() => setCmpOpen(false)}>Cerrar</GlassButton>
        </div>
      </GlassSheet>
    </Section>
  );
}
