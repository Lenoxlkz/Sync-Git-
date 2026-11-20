'use client';

/* Pull Requests: lista global de la cuenta, detalle con el diff de archivos
   del cambio, revisión (aprobar / pedir cambios / comentar), merge y creación
   con asistente y confirmación previa. */
import { useCallback, useEffect, useState } from 'react';
import { GlassButton, GlassInput, GlassSegmented, GlassSheet } from '@zakisheriff/liquid-glass';
import { useOrbit, pushToast, consumeCreatePR } from '@/lib/store';
import { gh, GitHubError, type GHPull, type GHCompare } from '@/lib/github';
import { logAct } from '@/lib/activity';
import { Section, NeedConn, NeedScope, Diag, Spinner, ConfirmSheet, RepoPicker, BranchPicker, relTime } from '@/components/bits';
import { CAPS, capsFromScopes } from '@/lib/scopes';
import { PatchView } from '@/components/diff';
import { Md } from '@/lib/md';
import { IcPlus, IcExternal, IcMerge, IcX, IcPR, IcCheck, IcAlert, IcBranch } from '@/components/Icons';

export default function PullsPage() {
  const { connected, scopes } = useOrbit();
  const caps = capsFromScopes(scopes);
  const [repoFilter, setRepoFilter] = useState<string>('');
  const [stateF, setStateF] = useState(0); // abiertos · fusionados · cerrados · todos
  const [pulls, setPulls] = useState<GHPull[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [pickTarget, setPickTarget] = useState<'filter' | 'create'>('filter');
  const [detail, setDetail] = useState<GHPull | null>(null);
  const [files, setFiles] = useState<GHCompare['files'] | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [comments, setComments] = useState<Array<{ id: number; user: { login: string }; body: string; created_at: string }>>([]);
  const [comment, setComment] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [method, setMethod] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mergeConfirm, setMergeConfirm] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [cRepo, setCRepo] = useState('');
  const [cHead, setCHead] = useState('');
  const [cBase, setCBase] = useState('');
  const [cBranches, setCBranches] = useState<string[]>([]);
  const [pickHead, setPickHead] = useState(false);
  const [pickBase, setPickBase] = useState(false);
  const [cTitle, setCTitle] = useState('');
  const [cBody, setCBody] = useState('');
  const [cConfirm, setCConfirm] = useState(false);

  const STATES = ['open', 'closed', 'all'] as const;
  const METHODS = ['merge', 'squash', 'rebase'];

  const load = useCallback(async (s: number) => {
    setLoading(true); setErr('');
    try {
      const base = s === 3 ? 'all' : STATES[Math.min(s, 2)];
      let list = await gh.pullsAll(base);
      if (s === 1) list = list.filter(p => p.merged);
      if (s === 2) list = list.filter(p => !p.merged);
      setPulls(list);
    } catch (e) {
      setErr(e instanceof GitHubError ? e.message : 'error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (connected) void load(stateF); /* eslint-disable-line */ }, [connected, stateF]);

  /* el chat pide abrir el asistente de creación */
  useEffect(() => {
    if (consumeCreatePR()) setShowCreate(true);
  }, []);

  async function loadBranchesFor(r: string) {
    setCBranches([]);
    try {
      const bs = await gh.branches(r);
      const names = bs.map(b => b.name);
      setCBranches(names);
      setCHead(h => names.includes(h) ? h : names.find(n => n === 'development') || names[1] || names[0] || '');
      setCBase(b => names.includes(b) ? b : names.find(n => n === 'main') || names[0] || '');
    } catch { /* sin ramas */ }
  }

  async function openDetail(p: GHPull) {
    setDetail(p); setComments([]); setFiles(null); setComment(''); setReviewText('');
    try { setComments(await gh.issueComments(p.base.repo.full_name, p.number)); } catch { /* sin comentarios */ }
    if (p.state === 'open') {
      setLoadingFiles(true);
      try {
        const c = await gh.compare(p.base.repo.full_name, p.base.ref, p.head.ref);
        setFiles(c.files);
      } catch { setFiles([]); }
      finally { setLoadingFiles(false); }
    }
  }

  if (!connected) return <Section title="Pull Requests"><NeedConn what="ver pull requests" /></Section>;
  if (!caps.map.pulls) return (
    <Section title="Pull Requests">
      <NeedScope title="Scope «repo» o «public_repo» requerido" reason={CAPS.find(c => c.cap === 'pulls')!.missingNote} />
    </Section>
  );

  const shown = repoFilter ? pulls.filter(p => p.base.repo.full_name === repoFilter) : pulls;
  const counts = {
    open: pulls.filter(p => p.state === 'open' && !p.merged).length,
    merged: pulls.filter(p => p.merged).length,
    closed: pulls.filter(p => p.state === 'closed' && !p.merged).length,
  };

  return (
    <Section
      title="Pull Requests"
      sub="Revisión y gestión de cambios propuestos en toda tu cuenta"
      right={
        <>
          <GlassButton size="sm" onClick={() => { setPickTarget('filter'); setPickOpen(true); }}>{repoFilter || 'Todos los repos'}</GlassButton>
          <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcPlus size={15} />} onClick={() => setShowCreate(true)}>Preparar PR</GlassButton>
        </>
      }
    >
      <GlassSegmented
        options={[{ label: `Abiertos ${counts.open}` }, { label: `Fusionados ${counts.merged}` }, { label: `Cerrados ${counts.closed}` }, { label: 'Todos' }]}
        value={stateF} onChange={setStateF} aria-label="Estado de los PRs"
      />
      <div style={{ height: 12 }} />
      <Diag text={err || null} />
      {loading ? <Spinner size={22} /> : null}

      <div className="rows">
        {shown.map(p => (
          <button key={p.base.repo.full_name + '-' + p.number} className="row" onClick={() => openDetail(p)}>
            <span style={{ color: p.state === 'open' && !p.merged ? 'var(--ok)' : p.merged ? '#bf5af2' : 'var(--err)', display: 'inline-flex' }}><IcPR size={16} /></span>
            <div className="r-main">
              <div className="r-title">#{p.number} {p.title} {p.draft ? <span className="badge draft">borrador</span> : null}</div>
              <div className="r-meta">{p.base.repo.full_name} · <span className="mono">{p.head.ref} → {p.base.ref}</span> · @{p.user.login} · {relTime(p.created_at)}</div>
            </div>
            <div className="r-side">
              <span className={`badge ${p.state === 'open' && !p.merged ? 'open' : p.merged ? 'merged' : 'closed'}`}>
                {p.state === 'open' && !p.merged ? 'abierto' : p.merged ? 'fusionado' : 'cerrado'}
              </span>
            </div>
          </button>
        ))}
      </div>
      {!loading && !shown.length ? <p className="tiny">Nada por aquí: no hay pull requests en este estado. Prepara uno nuevo con cambios comparados.</p> : null}

      {/* Detalle del PR */}
      <GlassSheet open={detail !== null} onClose={() => setDetail(null)} detents={['large']} aria-label="Detalle del PR">
        {detail ? (
          <>
            <div className="sheet-head">
              <h3>#{detail.number} · {detail.title}</h3>
              <GlassButton size="sm" icon={<IcExternal size={13} />} aria-label="Abrir en GitHub" href={detail.html_url} target="_blank" />
            </div>
            <p className="sheet-text">
              <b>{detail.base.repo.full_name}</b> · <span className="mono">{detail.head.ref} → {detail.base.ref}</span> · @{detail.user.login} · {relTime(detail.created_at)}
            </p>
            {detail.body ? <div className="sheet-text"><Md src={detail.body.slice(0, 800)} /></div> : null}

            <b className="tiny">ARCHIVOS DEL CAMBIO {loadingFiles ? '· cargando…' : `(${files?.length ?? 0})`}</b>
            {files?.length ? files.map(f => (
              <div key={f.filename} className="diff-file">
                <div className="df-h">
                  <IcBranch size={13} />
                  <span className="grow">{f.filename}</span>
                  <span className="df-stats"><span className="df-add">+{f.additions}</span> <span className="df-del">−{f.deletions}</span></span>
                  <span className="badge">{f.status}</span>
                </div>
                <PatchView patch={f.patch} />
              </div>
            )) : <p className="tiny" style={{ padding: '6px 0' }}>{loadingFiles ? 'Comparando ramas…' : detail.state === 'open' ? 'Sin archivos detallados para este PR.' : 'El PR ya no está abierto: sin diff disponible.'}</p>}

            {detail.state === 'open' && !detail.merged ? (
              <>
                <b className="tiny">REVISIÓN</b>
                <div style={{ marginTop: 6 }}><GlassInput placeholder="Comentario de revisión (obligatorio para pedir cambios)…" value={reviewText} onChange={e => setReviewText(e.target.value)} aria-label="Revisión" /></div>
                <div className="chips" style={{ marginTop: 8 }}>
                  <button className="chip-btn" onClick={async () => {
                    try { await gh.pullReview(detail.base.repo.full_name, detail.number, 'APPROVE', reviewText.trim()); logAct('check', 'Revisión enviada', 'aprobado en #' + detail.number); pushToast('Revisión registrada', 'ok', 'PR aprobado'); }
                    catch (e) { pushToast('Error', 'err', e instanceof Error ? e.message : ''); }
                  }}><IcCheck size={12} />Aprobar</button>
                  <button className="chip-btn" onClick={async () => {
                    if (!reviewText.trim()) { pushToast('Falta el comentario', 'err', 'Solicitar cambios exige explicar qué corregir'); return; }
                    try { await gh.pullReview(detail.base.repo.full_name, detail.number, 'REQUEST_CHANGES', reviewText.trim()); logAct('alert', 'Revisión enviada', 'cambios solicitados en #' + detail.number); pushToast('Revisión registrada', 'ok', 'Cambios solicitados'); }
                    catch (e) { pushToast('Error', 'err', e instanceof Error ? e.message : ''); }
                  }}><IcAlert size={12} />Solicitar cambios</button>
                  <button className="chip-btn" onClick={async () => {
                    try { await gh.pullReview(detail.base.repo.full_name, detail.number, 'COMMENT', reviewText.trim() || 'Comentario de revisión.'); logAct('chat', 'Revisión enviada', 'comentario en #' + detail.number); pushToast('Revisión registrada', 'ok', 'Comentario añadido'); }
                    catch (e) { pushToast('Error', 'err', e instanceof Error ? e.message : ''); }
                  }}><IcPR size={12} />Comentar</button>
                </div>
              </>
            ) : null}

            <b className="tiny" style={{ display: 'block', marginTop: 12 }}>COMENTARIOS ({comments.length})</b>
            <div className="picker-list" style={{ maxHeight: 200 }}>
              {comments.map(c => (
                <div key={c.id} className="bubble orbit" style={{ maxWidth: '100%' }}>
                  <small>@{c.user.login} · {relTime(c.created_at)}</small>
                  {'\n'}{c.body.slice(0, 400)}
                </div>
              ))}
              {!comments.length ? <p className="picker-none">Sin comentarios.</p> : null}
            </div>
            <div style={{ height: 10 }} />
            <GlassInput placeholder="Escribe un comentario…" value={comment} onChange={e => setComment(e.target.value)} aria-label="Nuevo comentario" tint="var(--orbit-accent)" />

            {detail.state === 'open' && !detail.merged ? (
              <div className="sheet-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <GlassSegmented options={METHODS.map(m => ({ label: m }))} value={method} onChange={setMethod} size="sm" aria-label="Método de merge" />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <GlassButton disabled={busy || !comment.trim()} onClick={async () => {
                    setBusy(true);
                    try {
                      await gh.addComment(detail.base.repo.full_name, detail.number, comment.trim());
                      setComments(await gh.issueComments(detail.base.repo.full_name, detail.number));
                      setComment(''); pushToast('Comentario publicado', 'ok');
                    } catch (e) { pushToast('No se pudo comentar', 'err', e instanceof Error ? e.message : ''); }
                    finally { setBusy(false); }
                  }}>Comentar</GlassButton>
                  <GlassButton destructive disabled={busy} onClick={async () => {
                    setBusy(true);
                    try {
                      await gh.prSetState(detail.base.repo.full_name, detail.number, 'closed');
                      logAct('x', 'PR cerrado', '#' + detail.number);
                      pushToast('PR cerrado', 'ok', '#' + detail.number);
                      setDetail(null); load(stateF);
                    } catch (e) { pushToast('No se pudo cerrar', 'err', e instanceof Error ? e.message : ''); }
                    finally { setBusy(false); }
                  }}><IcX size={13} />Cerrar PR</GlassButton>
                  <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcMerge size={14} />} disabled={busy} onClick={() => setMergeConfirm(true)}>
                    Fusionar
                  </GlassButton>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </GlassSheet>

      {/* Confirmación de merge */}
      <ConfirmSheet
        open={mergeConfirm} onClose={() => setMergeConfirm(false)}
        title={'Fusionar PR #' + (detail?.number ?? '')}
        text={detail ? `Se fusionará ${detail.head.ref} en ${detail.base.ref} de ${detail.base.repo.full_name} (método: ${METHODS[method]}).` : ''}
        confirmLabel="Fusionar"
        onConfirm={async () => {
          if (!detail) return;
          try {
            await gh.prMerge(detail.base.repo.full_name, detail.number, METHODS[method]);
            logAct('merge', 'PR fusionado', '#' + detail.number + ' @ ' + detail.base.repo.full_name);
            pushToast('PR fusionado', 'ok', '#' + detail.number);
            setDetail(null); load(stateF);
          } catch (e) { pushToast('No se pudo fusionar', 'err', e instanceof Error ? e.message : ''); }
        }}
      />

      {/* Asistente de creación de PR */}
      <GlassSheet open={showCreate} onClose={() => setShowCreate(false)} detents={['medium', 'large']} aria-label="Preparar pull request">
        <div className="sheet-head"><h3><IcPR size={16} /> Preparar pull request</h3></div>
        <p className="sheet-text">Se revisará antes de publicarse: elige repositorio, ramas y describe el cambio.</p>
        <GlassButton className="mono" style={{ width: '100%' }} onClick={() => { setPickTarget('create'); setPickOpen(true); }}>{cRepo || 'Elegir repositorio…'}</GlassButton>
        <div style={{ height: 10 }} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <GlassButton className="mono" icon={<IcBranch size={13} />} onClick={() => setPickHead(true)} disabled={!cRepo}>{cHead || 'desde (head)…'}</GlassButton>
          <GlassButton className="mono" icon={<IcBranch size={13} />} onClick={() => setPickBase(true)} disabled={!cRepo}>{cBase || 'hacia (base)…'}</GlassButton>
        </div>
        <div style={{ height: 10 }} />
        <GlassInput label="Título" placeholder="feat: describe el cambio" value={cTitle} onChange={e => setCTitle(e.target.value)} aria-label="Título del PR" tint="var(--orbit-accent)" />
        <div style={{ height: 10 }} />
        <GlassInput label="Descripción" placeholder="Qué cambia y por qué" value={cBody} onChange={e => setCBody(e.target.value)} aria-label="Descripción del PR" />
        <div className="note" style={{ marginTop: 12 }}><IcAlert size={15} /><span>La creación se confirma antes de publicar: se creará vía API oficial en tu cuenta.</span></div>
        <div className="sheet-actions">
          <GlassButton onClick={() => setShowCreate(false)}>Cancelar</GlassButton>
          <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcPlus size={14} />} disabled={!cRepo || !cHead || !cBase || !cTitle.trim()} onClick={() => setCConfirm(true)}>
            Crear PR
          </GlassButton>
        </div>
        <BranchPicker open={pickHead} onClose={() => setPickHead(false)} repo={cRepo || null} onPick={setCHead} />
        <BranchPicker open={pickBase} onClose={() => setPickBase(false)} repo={cRepo || null} onPick={setCBase} />
      </GlassSheet>

      <ConfirmSheet
        open={cConfirm} onClose={() => setCConfirm(false)}
        title="Publicar pull request"
        text={`Se abrirá el PR «${cTitle}»: ${cHead} → ${cBase} en ${cRepo}.`}
        confirmLabel="Publicar"
        onConfirm={async () => {
          try {
            const p = await gh.pullCreate(cRepo, { title: cTitle.trim(), body: cBody.trim(), head: cHead, base: cBase });
            logAct('pr', 'Pull request creado', '#' + p.number + ' @ ' + cRepo);
            pushToast('PR publicado', 'ok', '#' + p.number);
            setShowCreate(false); setCTitle(''); setCBody('');
            load(stateF);
          } catch (e) { pushToast('No se pudo crear', 'err', e instanceof Error ? e.message : ''); }
        }}
      />

      <RepoPicker open={pickOpen} onClose={() => setPickOpen(false)} onPick={r => {
        if (pickTarget === 'create') { setCRepo(r); loadBranchesFor(r); }
        else setRepoFilter(r);
      }} />
    </Section>
  );
}
