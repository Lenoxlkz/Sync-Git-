'use client';

/* Hoja de creación de releases: tag, título, notas y paquetes adjuntos (hasta
   350 MB por archivo) con ventana de reconsideración de 120 s y subida directa
   a uploads.github.com con progreso por archivo y reintento de los fallidos. */
import { useRef, useState } from 'react';
import { AppButton as GlassButton, AppInput as GlassInput, AppSheet as GlassSheet } from '@/components/ui';
import { pushToast } from '@/lib/store';
import { gh, uploadReleaseAsset, createBranch, fileToB64, GitHubError, type GHRelease } from '@/lib/github';
import { logAct } from '@/lib/activity';
import { fmtSize } from './bits';
import { IcArchive, IcPlus, IcX, IcCheck, IcAlert, IcZap, IcRefresh, IcBox } from './Icons';

const MAXB = 350 * 1024 * 1024;

interface Asset { file: File; progress: number; status: 'pend' | 'ok' | 'fail'; msg?: string }

export function ReleaseSheet({ open, onClose, repo, defaultBranch, onDone }: {
  open: boolean; onClose: () => void; repo: string; defaultBranch: string; onDone: () => void;
}) {
  const [tag, setTag] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stage, setStage] = useState<'form' | 'countdown' | 'uploading' | 'done'>('form');
  const [tleft, setTleft] = useState(120);
  const [rel, setRel] = useState<GHRelease | null>(null);
  const [relUrl, setRelUrl] = useState('');
  const [err, setErr] = useState('');
  const [compat, setCompat] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function reset() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTag(''); setTitle(''); setNotes(''); setAssets([]); setStage('form');
    setTleft(120); setRel(null); setRelUrl(''); setErr(''); setBusy(false); setCompat('');
  }

  function close() { if (timerRef.current) clearInterval(timerRef.current); onClose(); }

  function addFiles(fl: FileList | null) {
    if (!fl?.length) return;
    const next: Asset[] = [...assets];
    for (const f of [...fl]) {
      if (f.size > MAXB) { pushToast('Archivo demasiado grande', 'err', f.name + ' supera el límite de 350 MB por archivo'); continue; }
      if (next.some(a => a.file.name === f.name)) { pushToast('Duplicado', 'info', f.name + ' ya está en la lista'); continue; }
      next.push({ file: f, progress: 0, status: 'pend' });
    }
    setAssets(next);
  }

  function startCountdown() {
    if (!/^v?\d[\w.\-+]*$/i.test(tag.trim())) { pushToast('Tag inválido', 'err', 'Ej: v1.0.0'); return; }
    setStage('countdown');
    setTleft(120);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTleft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); timerRef.current = null; publish(tag.trim()); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  async function uploadPhase(release: GHRelease, list: Asset[], onTick: (idx: number, p: Asset) => void) {
    const fails: Asset[] = [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      try {
        await uploadReleaseAsset(repo, release.id, a.file, p => {
          onTick(i, { ...a, progress: Math.round((p.loaded / p.total) * 100), status: 'pend' });
        });
        onTick(i, { ...a, progress: 100, status: 'ok' });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'error';
        onTick(i, { ...a, status: 'fail', msg });
        fails.push({ ...a, status: 'fail', msg });
      }
    }
    return fails;
  }

  async function publish(tagV: string) {
    setStage('uploading'); setBusy(true); setErr('');
    try {
      const release = await gh.releaseCreate(repo, {
        tag_name: tagV, name: title.trim() || tagV, body: notes.trim() || undefined,
      });
      setRel(release); setRelUrl(release.html_url);
      logAct('archive', 'Release creado', tagV + ' @ ' + repo);
      if (assets.length) {
        const fails = await uploadPhase(release, assets, (idx, a) => {
          setAssets(prev => prev.map((x, i) => (i === idx ? a : x)));
        });
        if (fails.length) {
          pushToast('Adjuntos con fallos', 'err', fails.map(f => f.file.name).join(', '));
          setErr(fails.length + ' archivo(s) fallaron: ' + fails.map(f => f.file.name + ' — ' + f.msg).join(' · '));
        } else {
          pushToast('Release publicada', 'ok', tagV + ' · ' + assets.length + ' paquete(s)');
        }
      } else {
        pushToast('Release publicada', 'ok', tagV);
      }
      setStage('done');
    } catch (e) {
      setErr('No se pudo crear la release: ' + (e instanceof Error ? e.message : 'error'));
      setStage('form');
    } finally { setBusy(false); }
  }

  /* Modo compatible: GitHub bloquea la subida directa de adjuntos por CORS
     (uploads.github.com no responde a preflights). Publica cada archivo fallido
     como parte del repo, en la rama release-assets, y añade los enlaces de
     descarga al cuerpo de la release — todo 100 % en cliente con la Contents API. */
  const COMPAT_MAX = 90 * 1024 * 1024;
  async function compatUpload() {
    const failed = assets.filter(a => a.status === 'fail');
    if (!rel || !failed.length) return;
    setBusy(true); setErr(''); setCompat('Preparando la rama release-assets…');
    try {
      const BR = 'release-assets';
      const brs = await gh.branches(repo).catch(() => []);
      if (!brs.some(b => b.name === BR)) await createBranch(repo, BR, defaultBranch);
      const lines: string[] = [];
      for (const a of failed) {
        if (a.file.size > COMPAT_MAX) {
          setAssets(prev => prev.map(x => x.file.name === a.file.name ? { ...x, status: 'fail', msg: 'supera 90 MB: la Contents API no admite archivos tan grandes; súbelo manualmente a GitHub' } : x));
          continue;
        }
        setCompat('Subiendo ' + a.file.name + ' al repo (' + Math.round(a.file.size / 1024) + ' KB)…');
        const b64 = await fileToB64(a.file);
        const path = 'releases/' + rel.tag_name + '/' + a.file.name;
        try {
          await gh.contentPut(repo, path, b64, { branch: BR, message: 'Orbit: adjunto ' + a.file.name + ' para ' + rel.tag_name });
        } catch (e) {
          if (e instanceof GitHubError && (e.status === 422 || e.status === 409)) {
            const ex = await gh.contentGet(repo, path, BR).catch(() => null);
            if (!ex) throw e;
            await gh.contentPut(repo, path, b64, { branch: BR, message: 'Orbit: reemplaza ' + a.file.name + ' para ' + rel.tag_name, sha: ex.sha });
          } else throw e;
        }
        lines.push('- [' + a.file.name + '](https://github.com/' + repo + '/raw/' + BR + '/' + path + ')');
        setAssets(prev => prev.map(x => x.file.name === a.file.name ? { ...x, status: 'ok', progress: 100, msg: 'publicado en el repo + enlace en la release' } : x));
      }
      if (lines.length) {
        const prevBody = rel.body || '';
        const sep = prevBody.includes('**Descargas') ? '' : '\n\n**Descargas (modo compatible):**\n';
        const newBody = prevBody + sep + lines.join('\n');
        await gh.releaseEdit(repo, rel.id, { body: newBody });
        setRel({ ...rel, body: newBody });
      }
      setCompat('');
      pushToast('Modo compatible completado', 'ok', 'Archivo(s) en el repo + enlaces en la release');
      logAct('archive', 'Adjuntos vía modo compatible', failed.length + ' @ ' + repo);
    } catch (e) {
      setCompat('');
      setErr('Modo compatible falló: ' + (e instanceof Error ? e.message : 'error'));
    } finally { setBusy(false); }
  }

  async function retryFailed() {
    if (!rel) return;
    const failed = assets.filter(a => a.status === 'fail').map(a => ({ ...a, status: 'pend' as const, progress: 0 }));
    const idxs = assets.map((a, i) => (a.status === 'fail' ? i : -1)).filter(i => i >= 0);
    const fails = await uploadPhase(rel, failed, (i, a) => {
      setAssets(prev => prev.map((x, j) => (j === idxs[i] ? a : x)));
    });
    if (!fails.length) { setErr(''); pushToast('Adjuntos completos', 'ok', failed.length + ' archivo(s)'); }
    else pushToast('Sigue fallando', 'err', fails.map(f => f.file.name).join(', '));
  }

  const mm = String(Math.floor(tleft / 60)).padStart(2, '0');
  const ss = String(tleft % 60).padStart(2, '0');

  return (
    <GlassSheet open={open} onClose={close} detents={['large']} aria-label="Crear release">
      <div className="sheet-head"><h3><IcArchive size={16} /> Crear release · {repo}</h3></div>

      {stage === 'form' ? (
        <>
          <GlassInput label="Tag" placeholder="v1.0.0" value={tag} onChange={e => setTag(e.target.value)} className="mono" aria-label="Tag" tint="var(--orbit-accent)" />
          <div style={{ height: 10 }} />
          <GlassInput label="Título" placeholder="v1.0.0 · Primera versión estable" value={title} onChange={e => setTitle(e.target.value)} aria-label="Título" />
          <div style={{ height: 10 }} />
          <GlassInput label="Notas de cambios" placeholder="Qué incluye esta versión…" value={notes} onChange={e => setNotes(e.target.value)} aria-label="Notas" />
          <div style={{ height: 12 }} />
          <div className="orbit-row">
            <div className="orbit-row-text"><b>Paquetes adjuntos</b><small>Instaladores y binarios hasta 350 MB por archivo · subida directa sin límite de velocidad</small></div>
            <div className="orbit-row-ctl">
              <GlassButton size="sm" icon={<IcBox size={13} />} onClick={() => fileRef.current?.click()}>Añadir archivos</GlassButton>
            </div>
          </div>
          <input ref={fileRef} type="file" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          {assets.length ? (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p className="tiny">{assets.length} archivo(s) · {fmtSize(assets.reduce((s, a) => s + a.file.size / 1024, 0))}</p>
              {assets.map((a, i) => (
                <div key={i} className="orbit-row" style={{ padding: '6px 2px' }}>
                  <div className="orbit-row-text" style={{ minWidth: 0 }}><b style={{ fontSize: 12 }}>{a.file.name}</b>
                    {a.status !== 'pend' ? <small>{a.status === 'ok' ? 'subido ✓' : 'falló: ' + (a.msg || '')}</small> : null}
                  </div>
                  {stage !== 'form' ? <div className="progress"><i style={{ width: a.progress + '%' }} /></div> : null}
                  {stage === 'form' ? <GlassButton size="sm" icon={<IcX size={12} />} aria-label="Quitar" onClick={() => setAssets(prev => prev.filter((_, j) => j !== i))} /> : null}
                </div>
              ))}
            </div>
          ) : null}
          {err ? <p className="orbit-diag" style={{ marginTop: 10 }}>{err}</p> : null}
          <div className="sheet-actions">
            <GlassButton onClick={close}>Cancelar</GlassButton>
            <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcArchive size={14} />} disabled={busy || !tag.trim()} onClick={startCountdown}>
              Revisar y publicar
            </GlassButton>
          </div>
        </>
      ) : null}

      {stage === 'countdown' ? (
        <>
          <div className="note warn" style={{ marginBottom: 12 }}>
            <IcAlert size={15} />
            <span><b>Ventana de reconsideración:</b> la release{assets.length ? ' y sus ' + assets.length + ' paquete(s)' : ''} se enviarán a GitHub automáticamente al llegar a <b>0:00</b>. Tienes 120 segundos para cancelar o publicar ya. No cierres esta ventana durante la subida.</span>
          </div>
          <div className="countdown">
            <b>{mm}:{ss}</b>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>para cancelar<br />o pensarlo mejor</div>
          </div>
          <div className="sheet-actions" style={{ justifyContent: 'center' }}>
            <GlassButton destructive icon={<IcX size={13} />} onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setStage('form'); pushToast('Publicación cancelada', 'info', 'No se envió nada a GitHub'); }}>Cancelar todo</GlassButton>
            <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcZap size={13} />} onClick={() => { if (timerRef.current) clearInterval(timerRef.current); publish(tag.trim()); }}>Publicar ya</GlassButton>
          </div>
        </>
      ) : null}

      {stage === 'uploading' ? (
        <div style={{ padding: '18px 0', textAlign: 'center' }}>
          <p>Publicando release <b>{tag}</b>{assets.length ? ' y subiendo ' + assets.length + ' paquete(s)…' : '…'}</p>
        </div>
      ) : null}

      {stage === 'done' ? (
        <>
          <div className="note"><IcCheck size={15} /><span>Release <b>{tag}</b> publicada{assets.length ? ' (con adjuntos' + (err ? ' pendientes' : '') + ')' : ''}. {relUrl ? <a href={relUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orbit-accent)' }}>Ver en GitHub</a> : null}</span></div>
          {err ? (
            <>
              <p className="orbit-diag" style={{ marginTop: 10 }}>{err}</p>
              {compat ? <p className="tiny" style={{ marginTop: 6 }}>{compat}</p> : null}
              <div className="sheet-actions" style={{ justifyContent: 'flex-start' }}>
                <GlassButton icon={<IcRefresh size={13} />} disabled={busy} onClick={retryFailed}>Reintentar fallidos</GlassButton>
                <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcBox size={13} />} disabled={busy} onClick={compatUpload}>
                  Modo compatible: al repo + enlace
                </GlassButton>
              </div>
            </>
          ) : null}
          <div className="sheet-actions">
            <GlassButton variant="filled" tint="var(--orbit-accent)" onClick={() => { close(); onDone(); }}>Cerrar</GlassButton>
          </div>
        </>
      ) : null}
    </GlassSheet>
  );
}
