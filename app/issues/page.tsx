'use client';

/* Issues: lista global de la cuenta con filtro por etiqueta, creación con
   etiquetas, edición (título/cuerpo), comentarios y cierre/reapertura. */
import { useCallback, useEffect, useState } from 'react';
import { GlassButton, GlassInput, GlassSegmented, GlassSheet } from '@zakisheriff/liquid-glass';
import { useOrbit, pushToast } from '@/lib/store';
import { gh, GitHubError, type GHIssue, type GHComment } from '@/lib/github';
import { logAct } from '@/lib/activity';
import { Section, NeedConn, NeedScope, Diag, Spinner, ConfirmSheet, RepoPicker, relTime } from '@/components/bits';
import { CAPS, capsFromScopes } from '@/lib/scopes';
import { Md } from '@/lib/md';
import { IcPlus, IcExternal, IcIssue, IcEdit, IcRotate, IcX } from '@/components/Icons';

interface IssueFull extends GHIssue { repoFullName: string; labels: string[]; assignee: string | null }

export default function IssuesPage() {
  const { connected, prefs, scopes } = useOrbit();
  const caps = capsFromScopes(scopes);
  const [stateF, setStateF] = useState(0); // abiertos · cerrados · todos
  const [labelF, setLabelF] = useState('all');
  const [issues, setIssues] = useState<IssueFull[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [nRepo, setNRepo] = useState('');
  const [nTitle, setNTitle] = useState('');
  const [nBody, setNBody] = useState('');
  const [nLabels, setNLabels] = useState('');
  const [detail, setDetail] = useState<IssueFull | null>(null);
  const [comments, setComments] = useState<GHComment[]>([]);
  const [comment, setComment] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [eTitle, setETitle] = useState('');
  const [eBody, setEBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);

  const load = useCallback(async (s: number) => {
    setLoading(true); setErr('');
    try {
      const rows = await gh.issuesAll(['open', 'closed', 'all'][Math.min(s, 2)]);
      setIssues(rows.filter(i => !i.pull_request).map(i => ({
        ...i,
        repoFullName: (i as unknown as { repository_url?: string }).repository_url?.split('/repos/')[1] || '',
        labels: (i as unknown as { labels?: Array<string | { name: string }> }).labels?.map(l => typeof l === 'string' ? l : l.name) || [],
        assignee: (i as unknown as { assignee?: { login: string } | null }).assignee?.login || null,
      })));
    } catch (e) {
      setErr(e instanceof GitHubError ? e.message : 'error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (connected) void load(stateF); /* eslint-disable-line */ }, [connected, stateF]);

  const labels = Array.from(new Set(issues.flatMap(i => i.labels || [])));
  const shown = issues.filter(i => labelF === 'all' || (i.labels || []).includes(labelF));

  async function openDetail(i: IssueFull) {
    setDetail(i); setComments([]);
    try { setComments(await gh.issueComments(i.repoFullName, i.number)); } catch { /* sin comentarios */ }
  }

  if (!connected) return <Section title="Issues"><NeedConn what="ver issues" /></Section>;
  if (!caps.map.issues) return (
    <Section title="Issues">
      <NeedScope title="Scope «repo» o «public_repo» requerido" reason={CAPS.find(c => c.cap === 'issues')!.missingNote} />
    </Section>
  );

  const openCount = issues.filter(i => i.state === 'open').length;
  const closedCount = issues.filter(i => i.state === 'closed').length;

  return (
    <Section
      title="Issues"
      sub={`${openCount} abiertos · ${closedCount} cerrados en toda tu cuenta`}
      right={
        <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcPlus size={15} />} onClick={() => { setNRepo(prefs.lastRepo || ''); setShowNew(true); }}>Nuevo issue</GlassButton>
      }
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <GlassSegmented
          options={[{ label: 'Abiertos' }, { label: 'Cerrados' }, { label: 'Todos' }]}
          value={stateF} onChange={setStateF} aria-label="Estado de los issues"
        />
        <div className="chips">
          {['all', ...labels].slice(0, 10).map(l => (
            <button key={l} className={`chip-btn${labelF === l ? ' active' : ''}`} onClick={() => setLabelF(l)}>{l === 'all' ? 'Todas las etiquetas' : l}</button>
          ))}
        </div>
      </div>
      <div style={{ height: 12 }} />
      <Diag text={err || null} />
      {loading ? <Spinner size={22} /> : null}

      <div className="rows">
        {shown.map(i => (
          <button key={i.repoFullName + '-' + i.number} className="row" onClick={() => openDetail(i)}>
            <span style={{ color: i.state === 'open' ? 'var(--ok)' : '#bf5af2', display: 'inline-flex' }}><IcIssue size={16} /></span>
            <div className="r-main">
              <div className="r-title">#{i.number} {i.title}</div>
              <div className="r-meta">{i.repoFullName} · @{i.user.login} · {relTime(i.created_at)}{i.assignee ? ' · asignado a @' + i.assignee : ''}</div>
            </div>
            <div className="r-side">
              {(i.labels || []).slice(0, 3).map(l => <span key={l} className="label-chip">{l}</span>)}
            </div>
          </button>
        ))}
      </div>
      {!loading && !shown.length ? <p className="tiny">Sin issues en este filtro.</p> : null}

      {/* Nuevo issue */}
      <GlassSheet open={showNew} onClose={() => setShowNew(false)} detents={['medium', 'large']} aria-label="Nuevo issue">
        <div className="sheet-head"><h3><IcIssue size={16} /> Nuevo issue</h3></div>
        <GlassButton className="mono" style={{ width: '100%' }} onClick={() => setPickOpen(true)}>{nRepo || 'Elegir repositorio…'}</GlassButton>
        <div style={{ height: 10 }} />
        <GlassInput label="Título" placeholder="Resumen del problema" value={nTitle} onChange={e => setNTitle(e.target.value)} aria-label="Título" tint="var(--orbit-accent)" />
        <div style={{ height: 10 }} />
        <GlassInput label="Descripción" placeholder="Pasos para reproducir, contexto…" value={nBody} onChange={e => setNBody(e.target.value)} aria-label="Detalle" />
        <div style={{ height: 10 }} />
        <GlassInput label="Etiquetas (separadas por coma)" placeholder="bug, priority:high" value={nLabels} onChange={e => setNLabels(e.target.value)} className="mono" aria-label="Etiquetas" />
        <Diag text={err || null} />
        <div className="sheet-actions">
          <GlassButton onClick={() => setShowNew(false)}>Cancelar</GlassButton>
          <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcPlus size={14} />} disabled={busy || !nRepo || !nTitle.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const it = await gh.issueCreate(nRepo, nTitle.trim(), nBody.trim(), nLabels.split(',').map(s => s.trim()).filter(Boolean));
                logAct('issue', 'Issue creado', '#' + it.number + ' ' + nTitle.trim());
                pushToast('Issue creado', 'ok', '#' + it.number);
                setShowNew(false); setNTitle(''); setNBody(''); setNLabels('');
                load(stateF);
              } catch (e) { pushToast('No se pudo crear', 'err', e instanceof Error ? e.message : ''); }
              finally { setBusy(false); }
            }}>{busy ? 'Creando…' : 'Crear issue'}</GlassButton>
        </div>
      </GlassSheet>

      <RepoPicker open={pickOpen} onClose={() => setPickOpen(false)} onPick={setNRepo} />

      {/* Detalle del issue */}
      <GlassSheet open={detail !== null} onClose={() => setDetail(null)} detents={['large']} aria-label="Detalle del issue">
        {detail ? (
          <>
            <div className="sheet-head">
              <h3>#{detail.number} · {detail.title}</h3>
              <GlassButton size="sm" icon={<IcExternal size={13} />} aria-label="Abrir en GitHub" href={detail.html_url} target="_blank" />
            </div>
            <p className="sheet-text"><b>{detail.repoFullName}</b> · @{detail.user.login} · {relTime(detail.created_at)} · <span className={`chip ${detail.state === 'open' ? 'warn' : 'ok'}`}>{detail.state}</span></p>
            <div className="kv"><span className="k">Etiquetas</span><span className="v">{(detail.labels || []).map(l => <span key={l} className="label-chip" style={{ marginRight: 4 }}>{l}</span>)}{(detail.labels || []).length ? '' : '—'}</span></div>
            <div className="kv"><span className="k">Asignado</span><span className="v">{detail.assignee ? '@' + detail.assignee : 'sin asignar'}</span></div>
            <b className="tiny" style={{ display: 'block', margin: '12px 0 6px' }}>DESCRIPCIÓN</b>
            <div className="sheet-text"><Md src={detail.body || 'Sin descripción.'} /></div>

            <b className="tiny">ACCIONES RÁPIDAS</b>
            <div className="chips" style={{ marginTop: 8 }}>
              <button className="chip-btn" onClick={() => { setETitle(detail.title); setEBody(detail.body || ''); setEditOpen(true); }}><IcEdit size={12} />Editar</button>
              <button className="chip-btn" onClick={() => setCloseConfirm(true)}>
                {detail.state === 'open' ? <><IcX size={12} />Cerrar issue</> : <><IcRotate size={12} />Reabrir</>}
              </button>
            </div>

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
            <div className="sheet-actions">
              <GlassButton disabled={busy || !comment.trim()} onClick={async () => {
                setBusy(true);
                try {
                  await gh.addComment(detail.repoFullName, detail.number, comment.trim());
                  setComments(await gh.issueComments(detail.repoFullName, detail.number));
                  setComment(''); pushToast('Comentario publicado', 'ok');
                } catch (e) { pushToast('No se pudo comentar', 'err', e instanceof Error ? e.message : ''); }
                finally { setBusy(false); }
              }}>Comentar</GlassButton>
            </div>
          </>
        ) : null}
      </GlassSheet>

      {/* Editar issue */}
      <GlassSheet open={editOpen} onClose={() => setEditOpen(false)} aria-label="Editar issue">
        <div className="sheet-head"><h3><IcEdit size={15} /> Editar issue #{detail?.number}</h3></div>
        <GlassInput label="Título" value={eTitle} onChange={e => setETitle(e.target.value)} aria-label="Título" tint="var(--orbit-accent)" />
        <div style={{ height: 10 }} />
        <GlassInput label="Descripción" value={eBody} onChange={e => setEBody(e.target.value)} aria-label="Descripción" />
        <div className="sheet-actions">
          <GlassButton onClick={() => setEditOpen(false)}>Cancelar</GlassButton>
          <GlassButton variant="filled" tint="var(--orbit-accent)" disabled={busy || !eTitle.trim()} onClick={async () => {
            if (!detail) return;
            setBusy(true);
            try {
              await gh.issueEdit(detail.repoFullName, detail.number, { title: eTitle.trim(), body: eBody });
              logAct('edit', 'Issue editado', '#' + detail.number + ' @ ' + detail.repoFullName);
              pushToast('Issue actualizado', 'ok');
              setEditOpen(false);
              setDetail({ ...detail, title: eTitle.trim(), body: eBody });
              load(stateF);
            } catch (e) { pushToast('No se pudo editar', 'err', e instanceof Error ? e.message : ''); }
            finally { setBusy(false); }
          }}>Guardar</GlassButton>
        </div>
      </GlassSheet>

      {/* Confirmación cerrar/reabrir */}
      <ConfirmSheet
        open={closeConfirm} onClose={() => setCloseConfirm(false)}
        title={detail?.state === 'open' ? 'Cerrar issue' : 'Reabrir issue'}
        text={detail ? `${detail.state === 'open' ? 'Se cerrará' : 'Se reabrirá'} el issue #${detail.number} (${detail.title}) en ${detail.repoFullName}.` : ''}
        confirmLabel={detail?.state === 'open' ? 'Cerrar' : 'Reabrir'}
        onConfirm={async () => {
          if (!detail) return;
          const ns = detail.state === 'open' ? 'closed' : 'open';
          try {
            const upd = await gh.issueSetState(detail.repoFullName, detail.number, ns);
            logAct(ns === 'closed' ? 'check' : 'rotate', 'Issue ' + (ns === 'closed' ? 'cerrado' : 'reabierto'), '#' + detail.number + ' @ ' + detail.repoFullName);
            pushToast(ns === 'closed' ? 'Issue cerrado' : 'Issue reabierto', 'ok', '#' + detail.number);
            setDetail({ ...detail, state: (upd as GHIssue).state });
            load(stateF);
          } catch (e) { pushToast('Error', 'err', e instanceof Error ? e.message : ''); }
        }}
      />
    </Section>
  );
}
