'use client';

/* Pull Requests: lista por repo con detalle, comentarios y merge. */
import { useEffect, useState } from 'react';
import { GlassButton, GlassInput, GlassSegmented, GlassCard, GlassSheet } from '@zakisheriff/liquid-glass';
import { useOrbit, pushToast } from '@/lib/store';
import { gh, GitHubError, type GHPull, type GHComment } from '@/lib/github';
import { Section, NeedConn, Diag, Spinner, RepoPicker, relTime } from '@/components/bits';
import { IcExternal } from '@/components/Icons';

export default function PullsPage() {
  const { connected, repos, prefs } = useOrbit();
  const [repo, setRepo] = useState<string>('');
  const [stateF, setStateF] = useState(0); // 0 abiertos · 1 cerrados · 2 todos
  const [pulls, setPulls] = useState<GHPull[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [detail, setDetail] = useState<GHPull | null>(null);
  const [comments, setComments] = useState<GHComment[]>([]);
  const [comment, setComment] = useState('');
  const [method, setMethod] = useState(0); // merge · squash · rebase
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (prefs.lastRepo) setRepo(prefs.lastRepo); }, [prefs.lastRepo]);

  async function load(r: string, s: number) {
    if (!r) return;
    setLoading(true); setErr('');
    try {
      setPulls(await gh.pulls(r, ['open', 'closed', 'all'][s]));
    } catch (e) {
      setErr(e instanceof GitHubError ? e.message : 'error');
    } finally { setLoading(false); }
  }

  useEffect(() => { if (connected && repo) load(repo, stateF); /* eslint-disable-line */ }, [connected, repo, stateF]);

  async function openDetail(p: GHPull) {
    setDetail(p); setComments([]);
    try { setComments(await gh.issueComments(repo, p.number)); } catch { /* sin comentarios */ }
  }

  if (!connected) return <Section title="Pull Requests"><NeedConn what="ver pull requests" /></Section>;

  const METHODS = ['merge', 'squash', 'rebase'];

  return (
    <Section
      title="Pull Requests"
      sub={repo ? `de ${repo}` : 'elige un repositorio'}
      right={
        <>
          <GlassButton onClick={() => setPickOpen(true)}>{repo || 'Elegir repo…'}</GlassButton>
          {repo ? <GlassButton icon={<IcExternal size={14} />} aria-label="Refrescar" onClick={() => load(repo, stateF)} /> : null}
        </>
      }
    >
      <GlassSegmented
        options={[{ label: 'Abiertos' }, { label: 'Cerrados' }, { label: 'Todos' }]}
        value={stateF} onChange={setStateF} aria-label="Estado de los PRs"
      />
      <div style={{ height: 12 }} />
      <Diag text={err || null} />
      {loading ? <Spinner size={22} /> : null}

      <GlassCard padding="8px" className="list-card">
        {pulls.map(p => (
          <button key={p.number} className="list-item" onClick={() => openDetail(p)}>
            <span className="chip acc">#{p.number}</span>
            <span className="li-main">
              <b>{p.title}</b>
              <small>@{p.user.login} · {p.head.ref} → {p.base.ref} · {relTime(p.created_at)}</small>
            </span>
            <span className="li-side">
              <span className={`chip ${p.state === 'open' ? 'ok' : ''}`}>{p.merged ? 'merged' : p.state}</span>
            </span>
          </button>
        ))}
      </GlassCard>
      {!loading && repo && !pulls.length ? <p className="tiny">Sin pull requests en este estado.</p> : null}
      {!repo ? <p className="tiny">Elige un repositorio para ver sus pull requests.</p> : null}

      {/* Detalle del PR */}
      <GlassSheet open={detail !== null} onClose={() => setDetail(null)} detents={['medium', 'large']} aria-label="Detalle del PR">
        {detail ? (
          <>
            <div className="sheet-head">
              <h3>#{detail.number} · {detail.title}</h3>
              <GlassButton size="sm" icon={<IcExternal size={14} />} aria-label="Abrir en GitHub" href={detail.html_url} target="_blank" />
            </div>
            <p className="sheet-text"><b>@{detail.user.login}</b> · {detail.head.ref} → {detail.base.ref} · {relTime(detail.created_at)}</p>
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
              <GlassSegmented options={METHODS.map(m => ({ label: m }))} value={method} onChange={setMethod} size="sm" aria-label="Método de merge" />
              <div style={{ display: 'flex', gap: 8 }}>
                <GlassButton disabled={busy} onClick={async () => {
                  if (!comment.trim()) return;
                  setBusy(true);
                  try {
                    await gh.addComment(repo, detail.number, comment.trim());
                    setComments(await gh.issueComments(repo, detail.number));
                    setComment(''); pushToast('Comentario publicado', 'ok');
                  } catch (e) { pushToast('No se pudo comentar', 'err', e instanceof Error ? e.message : ''); }
                  finally { setBusy(false); }
                }}>Comentar</GlassButton>
                <GlassButton variant="filled" tint="var(--orbit-accent)" disabled={busy || detail.state !== 'open'}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await gh.prMerge(repo, detail.number, METHODS[method]);
                      pushToast('PR fusionado', 'ok', `#${detail.number} (${METHODS[method]})`);
                      setDetail(null); load(repo, stateF);
                    } catch (e) { pushToast('No se pudo fusionar', 'err', e instanceof Error ? e.message : ''); }
                    finally { setBusy(false); }
                  }}>{busy ? '…' : 'Fusionar'}</GlassButton>
                <GlassButton destructive disabled={busy || detail.state !== 'open'}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await gh.prSetState(repo, detail.number, 'closed');
                      pushToast('PR cerrado', 'ok', `#${detail.number}`);
                      setDetail(null); load(repo, stateF);
                    } catch (e) { pushToast('No se pudo cerrar', 'err', e instanceof Error ? e.message : ''); }
                    finally { setBusy(false); }
                  }}>Cerrar</GlassButton>
              </div>
            </div>
          </>
        ) : null}
      </GlassSheet>

      <RepoPicker open={pickOpen} onClose={() => setPickOpen(false)} onPick={setRepo} />
      {repos.length ? null : null}
    </Section>
  );
}
