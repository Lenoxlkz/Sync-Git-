'use client';

/* Issues: lista, creación, comentarios y cierre/reapertura. */
import { useEffect, useState } from 'react';
import { GlassButton, GlassInput, GlassSegmented, GlassCard, GlassSheet, GlassSwitch } from '@zakisheriff/liquid-glass';
import { useOrbit, pushToast } from '@/lib/store';
import { gh, GitHubError, type GHIssue, type GHComment } from '@/lib/github';
import { Section, NeedConn, Diag, Spinner, RepoPicker, relTime } from '@/components/bits';
import { IcPlus, IcExternal } from '@/components/Icons';

export default function IssuesPage() {
  const { connected, prefs } = useOrbit();
  const [repo, setRepo] = useState<string>('');
  const [stateF, setStateF] = useState(0); // abiertos · cerrados · todos
  const [issues, setIssues] = useState<GHIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [tTitle, setTTitle] = useState('');
  const [tBody, setTBody] = useState('');
  const [detail, setDetail] = useState<GHIssue | null>(null);
  const [comments, setComments] = useState<GHComment[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (prefs.lastRepo) setRepo(prefs.lastRepo); }, [prefs.lastRepo]);

  async function load(r: string, s: number) {
    if (!r) return;
    setLoading(true); setErr('');
    try {
      const all = await gh.issues(r, ['open', 'closed', 'all'][s]);
      setIssues(all.filter(i => !i.pull_request));
    } catch (e) {
      setErr(e instanceof GitHubError ? e.message : 'error');
    } finally { setLoading(false); }
  }

  useEffect(() => { if (connected && repo) load(repo, stateF); /* eslint-disable-line */ }, [connected, repo, stateF]);

  if (!connected) return <Section title="Issues"><NeedConn what="ver issues" /></Section>;

  return (
    <Section
      title="Issues"
      sub={repo ? `de ${repo}` : 'elige un repositorio'}
      right={
        <>
          <GlassButton onClick={() => setPickOpen(true)}>{repo || 'Elegir repo…'}</GlassButton>
          <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcPlus size={15} />} disabled={!repo} onClick={() => setShowNew(true)}>Nuevo</GlassButton>
        </>
      }
    >
      <GlassSegmented
        options={[{ label: 'Abiertos' }, { label: 'Cerrados' }, { label: 'Todos' }]}
        value={stateF} onChange={setStateF} aria-label="Estado de los issues"
      />
      <div style={{ height: 12 }} />
      <Diag text={err || null} />
      {loading ? <Spinner size={22} /> : null}

      <GlassCard padding="8px" className="list-card">
        {issues.map(i => (
          <button key={i.number} className="list-item" onClick={async () => {
            setDetail(i); setComments([]);
            try { setComments(await gh.issueComments(repo, i.number)); } catch { /* sin comentarios */ }
          }}>
            <span className="chip acc">#{i.number}</span>
            <span className="li-main">
              <b>{i.title}</b>
              <small>@{i.user.login} · {relTime(i.created_at)} · {i.comments} comentarios</small>
            </span>
            <span className="li-side"><span className={`chip ${i.state === 'open' ? 'warn' : 'ok'}`}>{i.state}</span></span>
          </button>
        ))}
      </GlassCard>
      {!loading && repo && !issues.length ? <p className="tiny">Sin issues en este estado.</p> : null}
      {!repo ? <p className="tiny">Elige un repositorio para ver sus issues.</p> : null}

      {/* Nuevo issue */}
      <GlassSheet open={showNew} onClose={() => setShowNew(false)} aria-label="Nuevo issue">
        <div className="sheet-head"><h3>Nuevo issue · {repo}</h3></div>
        <GlassInput label="Título" placeholder="Resumen del problema" value={tTitle} onChange={e => setTTitle(e.target.value)} aria-label="Título" tint="var(--orbit-accent)" />
        <div style={{ height: 10 }} />
        <GlassInput label="Detalle (opcional)" placeholder="Pasos para reproducir, contexto…" value={tBody} onChange={e => setTBody(e.target.value)} aria-label="Detalle" />
        <Diag text={err || null} />
        <div className="sheet-actions">
          <GlassButton onClick={() => setShowNew(false)}>Cancelar</GlassButton>
          <GlassButton variant="filled" tint="var(--orbit-accent)" disabled={busy || !tTitle.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await gh.issueCreate(repo, tTitle.trim(), tBody.trim());
                pushToast('Issue creado', 'ok', tTitle.trim());
                setShowNew(false); setTTitle(''); setTBody(''); load(repo, stateF);
              } catch (e) { pushToast('No se pudo crear', 'err', e instanceof Error ? e.message : ''); }
              finally { setBusy(false); }
            }}>{busy ? 'Creando…' : 'Crear issue'}</GlassButton>
        </div>
      </GlassSheet>

      {/* Detalle del issue */}
      <GlassSheet open={detail !== null} onClose={() => setDetail(null)} detents={['medium', 'large']} aria-label="Detalle del issue">
        {detail ? (
          <>
            <div className="sheet-head">
              <h3>#{detail.number} · {detail.title}</h3>
              <GlassButton size="sm" icon={<IcExternal size={14} />} aria-label="Abrir en GitHub" href={detail.html_url} target="_blank" />
            </div>
            <p className="sheet-text"><b>@{detail.user.login}</b> · {relTime(detail.created_at)} · <span className={`chip ${detail.state === 'open' ? 'warn' : 'ok'}`}>{detail.state}</span></p>
            {detail.body ? <p className="sheet-text">{detail.body.slice(0, 600)}</p> : null}

            <b className="tiny">COMENTARIOS ({comments.length})</b>
            <div className="picker-list" style={{ maxHeight: 220 }}>
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
            <div className="sheet-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <GlassSwitch checked={detail.state === 'open'} onChange={async (on) => {
                try {
                  const upd = await gh.issueSetState(repo, detail.number, on ? 'open' : 'closed');
                  setDetail(upd); load(repo, stateF);
                  pushToast(on ? 'Issue reabierto' : 'Issue cerrado', 'ok', `#${detail.number}`);
                } catch (e) { pushToast('No se pudo cambiar el estado', 'err', e instanceof Error ? e.message : ''); }
              }} tint="var(--orbit-accent)" aria-label="Abierto" />
              <div style={{ display: 'flex', gap: 8 }}>
                <GlassButton disabled={busy || !comment.trim()} onClick={async () => {
                  setBusy(true);
                  try {
                    await gh.addComment(repo, detail.number, comment.trim());
                    setComments(await gh.issueComments(repo, detail.number));
                    setComment(''); pushToast('Comentario publicado', 'ok');
                  } catch (e) { pushToast('No se pudo comentar', 'err', e instanceof Error ? e.message : ''); }
                  finally { setBusy(false); }
                }}>Comentar</GlassButton>
              </div>
            </div>
          </>
        ) : null}
      </GlassSheet>

      <RepoPicker open={pickOpen} onClose={() => setPickOpen(false)} onPick={setRepo} />
    </Section>
  );
}
