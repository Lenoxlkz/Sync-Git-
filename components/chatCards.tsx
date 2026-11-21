'use client';

/* Tarjetas del chat (puerto de las mcard del original): resultados de los
   comandos renderizados como piezas Liquid Glass dentro de la conversación. */
import Link from 'next/link';
import { AppButton as GlassButton } from '@/components/ui';
import {
  IcFolder, IcBranch, IcCommit, IcIssue, IcPR, IcSearch, IcWifi, IcCompare, IcCheck, IcX, IcAlert,
  IcCode, IcSparkles, IcTerminal, IcArrowRight, IcPlus, IcSettings, IcInfo, IcBook,
} from './Icons';

export type LangColors = Record<string, string>;
const COLORS: LangColors = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', CSS: '#563d7c', HTML: '#e34c26',
  Swift: '#F05138', 'C++': '#f34b7d', C: '#555555', Go: '#00ADD8', Rust: '#dea584', Java: '#b07219',
  Kotlin: '#A97BFF', Ruby: '#701516', PHP: '#4F5D95', Shell: '#89e051', Dart: '#00B4AB', Vue: '#41b883',
};

export interface CardCtx {
  onNav: (to: string) => void;
  onRun: (cmd: string) => void;
  onOpenRepo: (name: string) => void;
  onOpenFile: (path: string, repo: string) => void;
}

interface RepoLite { name: string; full_name?: string; description?: string; language?: string; private?: boolean }
interface CommitLite { sha: string; message: string; author: string; date: string }
interface IssueLite { number: number; title: string; user: string; created: string; labels?: string[]; repo?: string }
interface PRLite { number: number; title: string; repo: string; head: string; base: string; user: string; created: string; state: string; draft?: boolean }
interface SearchLite { path: string; text?: string }
interface CompareLite { repo: string; a: string; b: string; totalCommits: number; files: Array<{ filename: string; status: string; additions: number; deletions: number }> }

export type CardSpec =
  | { type: 'repos'; repos: RepoLite[] }
  | { type: 'branches'; repo: string; branches: Array<{ name: string; isDefault: boolean }> }
  | { type: 'commits'; repo: string; commits: CommitLite[] }
  | { type: 'issues'; repo: string; issues: IssueLite[]; state: string }
  | { type: 'prs'; prs: PRLite[] }
  | { type: 'compare'; data: CompareLite }
  | { type: 'branch-confirm'; repo: string; name: string; from: string }
  | { type: 'branch-done'; repo: string; name: string; from: string }
  | { type: 'search'; repo: string; term: string; results: SearchLite[] }
  | { type: 'status'; payload: { connected: boolean; login: string; rate: string; ai: string; repos: number } }
  | { type: 'welcome' }
  | { type: 'actions'; text: string; actions: Array<{ label: string; href?: string; run?: string; primary?: boolean }> };

export function ChatCard({ card, ctx }: { card: CardSpec; ctx: CardCtx }) {
  switch (card.type) {
    case 'repos':
      return (
        <div className="mcard">
          <div className="mcard-h"><IcFolder size={14} />Repositorios · {card.repos.length}</div>
          <div className="mcard-b">
            {card.repos.slice(0, 8).map(r => (
              <button key={r.name} className="mc-row" onClick={() => ctx.onOpenRepo(r.name)}>
                <IcFolder size={15} />
                <div className="grow"><b>{r.name}</b><span>{r.description || 'Sin descripción'}</span></div>
                <span className="rc-tag"><i className="lang-dot" style={{ background: COLORS[r.language || ''] || '#8b949e' }} /> {r.language || '—'}</span>
              </button>
            ))}
          </div>
          <div className="mc-act"><Link href="/repos/"><button className="chip-btn"><IcArrowRight size={12} />Abrir Repositories</button></Link></div>
        </div>
      );
    case 'commits':
      return (
        <div className="mcard">
          <div className="mcard-h"><IcCommit size={14} />Commits · {card.repo}</div>
          <div className="mcard-b">
            {card.commits.map(c => (
              <div key={c.sha} className="mc-row" style={{ cursor: 'default' }}>
                <IcCommit size={15} />
                <div className="grow"><b>{c.message}</b><span>@{c.author} · {relDate(c.date)}</span></div>
                <span className="rc-tag mono">{c.sha.slice(0, 7)}</span>
              </div>
            ))}
          </div>
          <div className="mc-act"><Link href="/repos/"><button className="chip-btn"><IcFolder size={12} />Ver repositorio</button></Link></div>
        </div>
      );
    case 'issues':
      return (
        <div className="mcard">
          <div className="mcard-h"><IcIssue size={14} />Issues · {card.repo} · {card.issues.length}</div>
          <div className="mcard-b">
            {!card.issues.length ? (
              <div className="mc-row" style={{ cursor: 'default' }}><IcCheck size={15} /><div className="grow"><b>Sin issues en este estado</b><span>Todo despejado</span></div></div>
            ) : card.issues.slice(0, 6).map(i => (
              <Link key={i.repo + '-' + i.number} href="/issues/" className="mc-row" style={{ display: 'flex' }}>
                <IcIssue size={15} />
                <div className="grow"><b>#{i.number} {i.title}</b><span>@{i.user} · {relDate(i.created)}{i.repo ? ' · ' + i.repo : ''}</span></div>
                <span className="rc-tag">{(i.labels || []).slice(0, 2).map(l => <span key={l} className="label-chip" style={{ marginLeft: 3 }}>{l}</span>)}</span>
              </Link>
            ))}
          </div>
          <div className="mc-act"><Link href="/issues/"><button className="chip-btn"><IcArrowRight size={12} />Abrir Issues</button></Link></div>
        </div>
      );
    case 'prs':
      return (
        <div className="mcard">
          <div className="mcard-h"><IcPR size={14} />Pull Requests · {card.prs.length}</div>
          <div className="mcard-b">
            {!card.prs.length ? (
              <div className="mc-row" style={{ cursor: 'default' }}><IcCheck size={15} /><div className="grow"><b>No hay pull requests abiertos</b><span>Puedes preparar uno nuevo</span></div></div>
            ) : card.prs.slice(0, 6).map(p => (
              <Link key={p.repo + '-' + p.number} href="/pulls/" className="mc-row" style={{ display: 'flex' }}>
                <IcPR size={15} />
                <div className="grow"><b>#{p.number} {p.title}</b><span>{p.repo} · {p.head} → {p.base}{p.draft ? ' · borrador' : ''}</span></div>
                <span className={`badge ${p.state === 'open' ? 'open' : p.state === 'merged' ? 'merged' : 'closed'}`}>{p.state}</span>
              </Link>
            ))}
          </div>
          <div className="mc-act">
            <Link href="/pulls/"><button className="chip-btn"><IcArrowRight size={12} />Abrir Pull Requests</button></Link>
            <button className="chip-btn" onClick={() => ctx.onRun('prepara un pull request')}><IcPlus size={12} />Preparar PR</button>
          </div>
        </div>
      );
    case 'compare': {
      const d = card.data;
      const add = d.files.reduce((s, f) => s + f.additions, 0);
      const del = d.files.reduce((s, f) => s + f.deletions, 0);
      return (
        <div className="mcard">
          <div className="mcard-h"><IcCompare size={14} />Comparación · {d.repo}</div>
          <div className="mc-stats"><IcBranch size={13} /><b>{d.a}</b> → <b>{d.b}</b><span>·</span><span>{d.totalCommits} commits</span><span>·</span><span>{d.files.length} archivos</span><span>·</span><span className="df-add">+{add}</span><span className="df-del">−{del}</span></div>
          <div className="mcard-b">
            {d.files.slice(0, 4).map(f => (
              <button key={f.filename} className="mc-row" onClick={() => ctx.onNav('/code/')}>
                <IcCode size={15} />
                <div className="grow"><b>{f.filename}</b><span>{f.status}</span></div>
                <span className="rc-tag"><span className="df-add">+{f.additions}</span> <span className="df-del">−{f.deletions}</span></span>
              </button>
            ))}
          </div>
          <div className="mc-act">
            <button className="chip-btn" onClick={() => ctx.onNav('/code/')}><IcCode size={12} />Ver en Code Explorer</button>
          </div>
        </div>
      );
    }
    case 'branch-confirm':
      return (
        <div className="mcard">
          <div className="mcard-h"><IcAlert size={14} />Confirmar creación de rama</div>
          <div className="mc-stats"><IcBranch size={13} /><span>Se creará <b>{card.name}</b> desde <b>{card.from}</b> en <b>{card.repo}</b>.</span></div>
          <div className="mc-act">
            <button className="chip-btn" onClick={() => ctx.onRun(`__do-branch__${card.repo}|${card.name}|${card.from}`)}><IcCheck size={12} />Confirmar</button>
            <button className="chip-btn" onClick={() => ctx.onRun('__noop__')}><IcX size={12} />Cancelar</button>
          </div>
        </div>
      );
    case 'branch-done':
      return (
        <div className="mcard">
          <div className="mcard-h"><IcBranch size={14} />Rama creada</div>
          <div className="mcard-b">
            <div className="mc-row" style={{ cursor: 'default' }}>
              <IcCheck size={15} />
              <div className="grow"><b>{card.name}</b><span>creada desde {card.from} en {card.repo}</span></div>
            </div>
          </div>
          <div className="mc-act"><Link href="/repos/"><button className="chip-btn"><IcFolder size={12} />Ver ramas</button></Link></div>
        </div>
      );
    case 'search':
      return (
        <div className="mcard">
          <div className="mcard-h"><IcSearch size={14} />«{card.term}» · {card.repo} · {card.results.length}</div>
          <div className="mcard-b">
            {!card.results.length ? (
              <div className="mc-row" style={{ cursor: 'default' }}><IcInfo size={15} /><div className="grow"><b>Sin coincidencias</b><span>Nada que contenga «{card.term}» en {card.repo}</span></div></div>
            ) : card.results.slice(0, 6).map(r => (
              <button key={r.path} className="mc-row" onClick={() => ctx.onOpenFile(r.path, card.repo)}>
                <IcCode size={15} />
                <div className="grow"><b>{r.path}</b><span className="mono" style={{ fontSize: 10.5 }}>{(r.text || '').slice(0, 80)}</span></div>
              </button>
            ))}
          </div>
          <div className="mc-act">
            <button className="chip-btn" onClick={() => { ctx.onOpenFile('', card.repo); ctx.onNav('/code/'); }}><IcCode size={12} />Abrir Code Explorer</button>
          </div>
        </div>
      );
    case 'branches':
      return (
        <div className="mcard">
          <div className="mcard-h"><IcBranch size={14} />Branches · {card.repo} · {card.branches.length}</div>
          <div className="mcard-b">
            {card.branches.map(b => (
              <div key={b.name} className="mc-row" style={{ cursor: 'default' }}>
                <IcBranch size={15} />
                <div className="grow"><b>{b.name}</b></div>
                {b.isDefault ? <span className="badge blue">default</span> : null}
              </div>
            ))}
          </div>
        </div>
      );
    case 'welcome':
      return (
        <div className="mcard">
          <div className="mcard-h"><IcTerminal size={14} />Comandos que entiendo</div>
          <div className="mcard-b">
            {[
              ['«muéstrame mis repositorios»', 'Lista los proyectos de tu cuenta con sus datos'],
              ['«crea una rama llamada development»', 'Crea ramas con confirmación previa'],
              ['«muéstrame los últimos commits»', 'Historial reciente del repositorio activo'],
              ['«abre los issues pendientes»', 'Issues abiertos con etiquetas'],
              ['«sube esta carpeta al repositorio»', 'Te guía al Explorer: ZIP, árbol y envío verificado'],
              ['«compara main con development»', 'Diferencias línea a línea entre ramas'],
              ['«prepara un pull request»', 'Asistente de creación con revisión previa'],
              ['«busca archivos que contengan función X»', 'Búsqueda de código en el repositorio activo'],
            ].map(([t, d]) => (
              <div key={t} className="mc-row" style={{ cursor: 'default' }}>
                <IcTerminal size={14} />
                <div className="grow"><b>{t}</b><span>{d}</span></div>
              </div>
            ))}
          </div>
          <div className="mc-act">
            <Link href="/guide/"><button className="chip-btn">Guía: ¿qué es un issue, una rama, un PR?</button></Link>
          </div>
        </div>
      );
    case 'status': {
      const p = card.payload;
      return (
        <div className="mcard">
          <div className="mcard-h"><IcWifi size={14} />Estado del sistema</div>
          <div className="mcard-b">
            <div className="mc-row" style={{ cursor: 'default' }}>
              <IcSparkles size={15} />
              <div className="grow"><b>{p.connected ? 'Conectado a GitHub como @' + p.login : 'Sin conexión con GitHub'}</b><span>{p.rate || 'Token activo'}</span></div>
              <span className={`badge ${p.connected ? 'open' : 'draft'}`}>{p.connected ? 'LIVE' : 'OFF'}</span>
            </div>
            <div className="mc-row" style={{ cursor: 'default' }}>
              <IcSparkles size={15} />
              <div className="grow"><b>{p.ai || 'IA sin configurar'}</b><span>Las frases que no son comandos las responde este modelo</span></div>
            </div>
            <div className="mc-row" style={{ cursor: 'default' }}>
              <IcFolder size={15} />
              <div className="grow"><b>{p.repos} repositorios en caché</b><span>Los comandos usan esta lista</span></div>
            </div>
          </div>
          <div className="mc-act">
            <Link href="/control/"><button className="chip-btn"><IcSettings size={12} />Control Center</button></Link>
            <Link href="/guide/"><button className="chip-btn"><IcBook size={12} />Guía</button></Link>
          </div>
        </div>
      );
    }
    case 'actions':
      return (
        <div className="mcard">
          <div className="mcard-b" style={{ padding: '10px 12px' }}><span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{card.text}</span></div>
          <div className="mc-act">
            {card.actions.map((a, i) => a.href
              ? <Link key={i} href={a.href}><GlassButton size="sm" variant={a.primary ? 'filled' : 'glass'} tint="var(--orbit-accent)">{a.label}</GlassButton></Link>
              : <GlassButton key={i} size="sm" variant={a.primary ? 'filled' : 'glass'} tint="var(--orbit-accent)" icon={<IcTerminal size={12} />} onClick={() => ctx.onRun(a.run || '')}>{a.label}</GlassButton>)}
          </div>
        </div>
      );
    default:
      return null;
  }
}

function relDate(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1e3;
  if (isNaN(s)) return '—';
  if (s < 60) return 'hace un momento';
  const m = s / 60; if (m < 60) return `hace ${Math.floor(m)} min`;
  const h = m / 60; if (h < 24) return `hace ${Math.floor(h)} h`;
  const d = h / 24; if (d < 31) return `hace ${Math.floor(d)} d`;
  return new Date(iso).toLocaleDateString('es');
}
