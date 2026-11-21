'use client';

/* Personal Chat: comandos en lenguaje natural (puerto de parseIntent) + IA
   multi-proveedor con contexto de la cuenta y comandos ejecutables por la IA. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppButton as GlassButton, AppInput as GlassInput } from '@/components/ui';
import { useOrbit, pushToast, setPrefs, loadRepos, openFicha, openCode, requestCreatePR, setChatPrefill } from '@/lib/store';
import { aiChat, provOf, type AIProvider, type ChatMsg } from '@/lib/ai';
import { gh, createBranch, GitHubError, type GHRepo } from '@/lib/github';
import { logAct } from '@/lib/activity';
import { Md } from '@/lib/md';
import { Section, ConfirmSheet } from '@/components/bits';
import { ChatCard, type CardSpec, type CardCtx } from '@/components/chatCards';
import { IcSend, IcSparkles } from '@/components/Icons';

interface Bubble { role: 'user' | 'orbit' | 'sys'; text: string; ts: number; card?: CardSpec }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const CHIPS = ['Mis repos', 'Últimos commits', 'Issues abiertos', 'Pull requests', 'Comparar ramas', 'Subir carpeta', 'Ayuda'];

export default function ChatPage() {
  const state = useOrbit();
  const { connected, user, rate, repos, prefs } = state;
  const router = useRouter();
  const [msgs, setMsgs] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [createRepoName, setCreateRepoName] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const msgsRef = useRef<Bubble[]>([]);
  msgsRef.current = msgs;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('orbit.chat') || '[]') as Bubble[];
      if (Array.isArray(saved) && saved.length) setMsgs(saved);
      else setMsgs([{ role: 'orbit', ts: Date.now(), text: `¡Hola${user ? ', @' + user.login : ''}! Soy tu asistente de **GitHub Orbit**. Opero tu cuenta con comandos directos${prefs.aiKey ? ' y entiendo lenguaje natural gracias a tu proveedor de IA' : ' (y con IA si activas un proveedor en Control Center)'}.`, card: { type: 'welcome' } }]);
    } catch { setMsgs([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    try { localStorage.setItem('orbit.chat', JSON.stringify(msgs.slice(-120))); } catch { /* privado */ }
  }, [msgs]);

  /* borrador de mensaje enviado desde otra vista */
  useEffect(() => {
    if (state.chatPrefill) {
      setInput(state.chatPrefill);
      setChatPrefill('');
    }
  }, [state.chatPrefill]);

  const add = (role: Bubble['role'], text: string, card?: CardSpec) =>
    setMsgs(m => [...m, { role, text, ts: Date.now(), card }]);

  function mErr(e: unknown) {
    return e instanceof GitHubError || e instanceof Error ? e.message : 'error desconocido';
  }

  /* contexto de repositorio: si el texto menciona un repo, pasa a ser el activo */
  function ctxRepo(t: string): string {
    const hit = repos.find(r => t.includes(r.name.toLowerCase()));
    if (hit) { setPrefs({ lastRepo: hit.full_name }); return hit.name; }
    if (prefs.lastRepo) return prefs.lastRepo.split('/').pop() || prefs.lastRepo;
    return repos[0]?.name || '';
  }

  function needConn(): { text: string; card: CardSpec } {
    return {
      text: 'Para operar tu cuenta necesito conexión con GitHub.',
      card: { type: 'actions', text: 'Configura tu Personal Access Token en Control Center: se guarda solo en tu navegador y se usa únicamente contra api.github.com.', actions: [{ label: 'Ir a Control Center', href: '/control/', primary: true }] },
    };
  }

  /* ---------- intérprete de lenguaje natural (orden idéntico al original) ---------- */
  async function intent(t: string, raw: string): Promise<{ text: string; card?: CardSpec } | null> {
    if (/^(ayuda|help|\/help|comandos|que puedes hacer)/.test(t)) {
      return { text: 'Aquí tienes la referencia completa:', card: { type: 'welcome' } };
    }
    if (/(gu[ií]a|conceptos|que es un|qu[eé] significa)/.test(t) && !/(issue|rama|branch|pull)/.test(t)) {
      setTimeout(() => router.push('/guide/'), 500);
      return { text: 'Abro la **Guía**: conceptos en palabras simples, todos los comandos y notas de seguridad.' };
    }
    if (/(limpia|borra|clear).*(chat|conversaci)/.test(t)) {
      setConfirmClear(true);
      return { text: '¿Seguro? Confirma en el diálogo para borrar el historial guardado en este dispositivo.' };
    }
    if (/^(hola|hey|hi|buenas|saludos|que tal)/.test(t)) {
      return { text: '¡Hola de nuevo! Puedo listar repos, crear ramas, revisar commits, issues y PRs, comparar ramas o subir carpetas. ¿Qué hacemos?' };
    }
    if (/^(gracias|thanks|genial|perfecto)/.test(t)) return { text: 'Para eso estoy.' };
    if (/(que modelo|qué modelo|que ia|qué ia|proveedor)/.test(t)) {
      const c = prefs.aiKey;
      return {
        text: c
          ? `Uso **${labelProv(prefs.aiProvider)}** con el modelo **${prefs.aiModel || 'por defecto'}**. Las frases que no son comandos llegan a ese modelo.`
          : 'No hay ningún proveedor de IA configurado; solo comandos definidos.',
        card: { type: 'actions', text: '', actions: [{ label: 'Configurar IA', href: '/control/' }] },
      };
    }
    if (/(estado|status|conexion|connection|rate limit)/.test(t)) {
      logAct('wifi', 'Consulta de estado');
      return {
        text: '',
        card: {
          type: 'status',
          payload: {
            connected, login: user?.login || '', rate: rate ? `Rate limit: ${rate.rem}/${rate.limit} peticiones restantes esta hora` : 'Token activo',
            ai: prefs.aiKey ? `${labelProv(prefs.aiProvider)} · ${prefs.aiModel || 'modelo por defecto'}` : 'IA sin configurar',
            repos: repos.length,
          },
        },
      };
    }
    if (/(modo oscuro|dark mode|tema oscuro)/.test(t)) { setPrefs({ theme: 'dark' }); return { text: 'Cambiado al **modo oscuro**. También está en Control Center → Apariencia.' }; }
    if (/(modo claro|light mode|tema claro)/.test(t)) { setPrefs({ theme: 'light' }); return { text: 'Cambiado al **modo claro**. También está en Control Center → Apariencia.' }; }
    if (/^tema\s+auto$/.test(t)) { setPrefs({ theme: 'auto' }); return { text: 'Tema en **automático**: sigue al sistema.' }; }

    /* operaciones GitHub (requieren conexión) */
    if (/(crea|crear|nuevo|new).*(repo|repositorio)/.test(t)) {
      if (!connected) return needConn();
      const m = raw.match(/llamad[oa]\s+["“']?([\w.\-]+)/i) || raw.match(/(?:repo|repositorio)\s+["“']?([\w.\-]+)/i);
      const name = m ? m[1] : 'nuevo-proyecto';
      setCreateRepoName(name);
      return { text: `Voy a crear el repositorio **${name}**. Confírmalo escribiendo su nombre en el diálogo.` };
    }
    if (/(sube|subir|carga|cargar|upload|empuja|push).*(carpeta|folder|zip|archivo|files|ficheros)/.test(t) || /^(subir|upload)/.test(t)) {
      if (!connected) return needConn();
      logAct('upload', 'Chat → Explorer');
      setTimeout(() => router.push('/explorer/'), 600);
      return { text: 'Te llevo al **Explorer**: allí se analiza cada archivo contra el repositorio (por hash Git, no por fecha), se muestra el resultado completo y nada se envía sin tu confirmación.' };
    }
    if (/(compara|comparar|diff|diferencia)/.test(t)) {
      if (!connected) return needConn();
      const repoName = ctxRepo(t);
      if (!repoName) return { text: 'No tengo repositorios cargados todavía. Dime «mis repositorios» primero.' };
      const full = fullOf(repoName);
      let a = 'main', b = 'development';
      const m2 = raw.match(/con\s+([\w.\-\/]+)/i); if (m2) b = m2[1];
      const m1 = raw.match(/compara\s+([\w.\-\/]+)/i); if (m1) a = m1[1];
      const c = await gh.compare(full, a, b);
      logAct('compare', 'Ramas comparadas', full + ': ' + a + '…' + b);
      return {
        text: `Comparación de **${a}** contra **${b}** en **${repoName}**:`,
        card: {
          type: 'compare',
          data: {
            repo: repoName, a, b, totalCommits: c.total_commits,
            files: c.files.map(f => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions })),
          },
        },
      };
    }
    if (/(crea|crear|nueva|new).*(rama|branch)/.test(t) || /(rama|branch).*(crea|nueva)/.test(t)) {
      if (!connected) return needConn();
      const repoName = ctxRepo(t);
      if (!repoName) return { text: 'No tengo repositorios cargados todavía. Dime «mis repositorios» primero.' };
      const m = raw.match(/llamad[oa]\s+["“']?([\w./\-]+)/i) || raw.match(/rama\s+["“']?([\w./\-]+)/i);
      const name = m ? m[1] : 'development';
      const from = repos.find(r => r.name === repoName)?.default_branch || 'main';
      return {
        text: 'Voy a crear la rama. Confírmalo en la tarjeta:',
        card: { type: 'branch-confirm', repo: fullOf(repoName), name, from },
      };
    }
    if (/(ramas|branches)/.test(t)) {
      if (!connected) return needConn();
      const repoName = ctxRepo(t);
      const full = fullOf(repoName);
      const bs = await gh.branches(full);
      logAct('branch', 'Ramas consultadas', repoName);
      const def = repos.find(r => r.name === repoName)?.default_branch;
      return {
        text: `Ramas de **${repoName}** (${bs.length}):`,
        card: { type: 'branches', repo: repoName, branches: bs.map(b => ({ name: b.name, isDefault: b.name === def })) },
      };
    }
    if (/(commit|historial|log)/.test(t)) {
      if (!connected) return needConn();
      const repoName = ctxRepo(t);
      const full = fullOf(repoName);
      const def = repos.find(r => r.name === repoName)?.default_branch || 'main';
      const cs = await gh.commits(full, def, 6);
      logAct('commit', 'Commits consultados', repoName);
      return {
        text: `Últimos commits de **${repoName}**:`,
        card: { type: 'commits', repo: repoName, commits: cs.map(c => ({ sha: c.sha, message: (c.commit.message || '').split('\n')[0], author: c.author?.login || c.commit.author?.name || '—', date: c.commit.author?.date || '' })) },
      };
    }
    if (/(pull request|pullrequest|\bpr\b|\bprs\b)/.test(t)) {
      if (/(prepara|preparar|crea|crear|abrir|open|nuevo)/.test(t)) {
        if (!connected) return needConn();
        logAct('pr', 'Asistente de PR');
        requestCreatePR();
        setTimeout(() => router.push('/pulls/'), 600);
        return { text: 'Abro el asistente de **creación de PR**: eliges repositorio, base y comparación, y se confirma antes de publicar.' };
      }
      if (!connected) return needConn();
      const prs = await gh.pullsAll('open');
      logAct('pr', 'PRs consultados');
      return {
        text: `Pull requests abiertos (${prs.length}):`,
        card: { type: 'prs', prs: prs.map(p => ({ number: p.number, title: p.title, repo: p.base.repo.full_name, head: p.head.ref, base: p.base.ref, user: p.user.login, created: p.created_at, state: p.state })) },
      };
    }
    if (/(issue|issues|incidencia|tarea)/.test(t)) {
      if (!connected) return needConn();
      const closed = /cerrad|closed|resuelt/.test(t);
      const all = (await gh.issuesAll(closed ? 'closed' : 'open')).filter(i => !i.pull_request);
      logAct('issue', 'Issues consultados', (closed ? 'cerrados' : 'abiertos') + ' · ' + all.length);
      return {
        text: `Issues ${closed ? 'cerrados' : 'abiertos'} (${all.length}):`,
        card: {
          type: 'issues', repo: prefs.lastRepo ? prefs.lastRepo.split('/').pop() + ' y el resto de tus repos' : 'todos los repos', state: closed ? 'closed' : 'open',
          issues: all.slice(0, 12).map(i => ({ number: i.number, title: i.title, user: i.user.login, created: i.created_at, labels: (i as unknown as { labels?: Array<string | { name: string }> }).labels?.map(l => typeof l === 'string' ? l : l.name) || [] })),
        },
      };
    }
    if (/(busca|buscar|encuentra|search|contengan|contiene)/.test(t)) {
      if (!connected) return needConn();
      const repoName = ctxRepo(t);
      const full = fullOf(repoName);
      const m = raw.match(/(?:contengan|contenga|contiene|containing)\s+(?:una\s+)?(?:determinada\s+)?(?:funci[oó]n\s+)?["“']?([\w.$\-]+)/i)
        || raw.match(/["“']([^"”]{2,})["”']/)
        || raw.match(/buscar\s+(?:archivos\s+)?(?:con\s+)?([\w.$\-]+)/i);
      const term = m ? m[1] : 'main';
      const res = await gh.searchCode(full, term);
      logAct('search', 'Búsqueda de código', `${term} @ ${repoName}`);
      return {
        text: `Buscando **«${term}»** en **${repoName}** — ${res.items.length} coincidencias:`,
        card: { type: 'search', repo: repoName, term, results: res.items.map(it => ({ path: it.path, text: it.text_matches?.[0]?.fragment || 'Coincidencia reportada por la API de búsqueda.' })) },
      };
    }
    if (/(repo|repos|repositorio|proyectos)/.test(t)) {
      if (!connected) return needConn();
      const list = repos.length ? repos : await loadRepos();
      logAct('folder', 'Repositorios listados');
      return {
        text: `Tus repositorios (${list.length}):`,
        card: { type: 'repos', repos: list.map(r => ({ name: r.name, full_name: r.full_name, description: r.description || '', language: r.language || '', private: r.private })) },
      };
    }
    return null;
  }

  function fullOf(name: string): string {
    if (name.includes('/')) return name;
    return repos.find(r => r.name === name)?.full_name || name;
  }

  function labelProv(p: string): string {
    return provOf(p as AIProvider).label;
  }

  /* ---------- IA con contexto + comandos ejecutables ---------- */
  async function aiRespond(raw: string): Promise<{ text: string; card?: CardSpec }> {
    const ctx: string[] = [];
    ctx.push('Eres el asistente personal de GitHub Orbit, una app web en el navegador que administra una cuenta de GitHub mediante la API oficial.');
    if (connected && user) ctx.push('Usuario conectado: @' + user.login + '.');
    if (repos.length) ctx.push('Repositorios del usuario: ' + repos.slice(0, 25).map(r => r.name).join(', ') + '.');
    ctx.push('Repositorio activo: ' + (prefs.lastRepo || 'ninguno') + '.');
    ctx.push('Comandos exactos que la app puede ejecutar sin IA: muéstrame mis repositorios | últimos commits | abre los issues pendientes | pull requests | crea una rama llamada <nombre> | compara <ramaA> con <ramaB> | prepara un pull request | busca archivos que contengan <texto> | sube esta carpeta al repositorio | crea un repositorio llamado <nombre> | estado de la conexión | modo oscuro | modo claro | limpia el chat | guía.');
    ctx.push('Responde SIEMPRE en español, breve y claro (máximo ~150 palabras), con markdown ligero. Si el usuario quiere ejecutar una operación cubierta por un comando, responde brevemente y añade AL FINAL una línea con el bloque ```orbit {"command":"<comando exacto>"}``` para que la app lo ejecute. Si quiere navegar a una sección usa ```orbit {"navigate":"repos"}``` con una de: repos, prs, issues, explorer, code, control, guide. No inventes datos de la cuenta: si no lo sabes, indica qué comando lo consulta.');
    const hist: ChatMsg[] = msgsRef.current.slice(-8).map((m): ChatMsg => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text.replace(/[#*`]/g, '') })).filter(m => m.content);
    const text = await aiChat(
      prefs.aiProvider, prefs.aiKey,
      prefs.aiModel || provOf(prefs.aiProvider).model || 'gpt-4o-mini',
      [
        { role: 'system', content: ctx.join(' ') }, ...hist, { role: 'user', content: raw },
      ],
      { baseUrl: prefs.aiBaseUrl, gatewayKey: prefs.aiGatewayKey },
    );
    const cmds: Array<{ type: 'command' | 'nav'; v: string }> = [];
    const re = /```orbit\s*([\s\S]*?)```/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(text))) {
      try {
        const j = JSON.parse(mm[1].trim()) as { command?: string; navigate?: string };
        if (j.command) cmds.push({ type: 'command', v: String(j.command) });
        else if (j.navigate) cmds.push({ type: 'nav', v: String(j.navigate) });
      } catch { /* bloque malformado: se ignora */ }
    }
    const clean = text.replace(/```orbit\s*[\s\S]*?```/g, '').trim();
    const NAV: Record<string, string> = { repos: '/repos/', prs: '/pulls/', issues: '/issues/', explorer: '/explorer/', code: '/code/', control: '/control/', guide: '/guide/' };
    const card: CardSpec | undefined = cmds.length
      ? {
        type: 'actions', text: '',
        actions: cmds.map(c => c.type === 'nav'
          ? { label: 'Ir a ' + c.v, href: NAV[c.v] || '/control/' }
          : { label: 'Ejecutar: ' + c.v, run: c.v, primary: true }),
      }
      : undefined;
    return { text: clean || '(la IA devolvió una respuesta vacía)', card };
  }

  function fallback(): { text: string; card: CardSpec } {
    return {
      text: 'Mmm, ese comando no está en mi repertorio de comandos definidos.',
      card: {
        type: 'actions',
        text: prefs.aiKey ? '' : 'Si activas un proveedor de IA en Control Center → Inteligencia Artificial, cualquier frase en lenguaje natural se responde con ese modelo.',
        actions: [
          { label: 'Mis repos', run: 'Mis repos' },
          { label: 'Últimos commits', run: 'Últimos commits' },
          { label: 'Issues abiertos', run: 'Issues abiertos' },
          { label: 'Compara main con development', run: 'Compara main con development' },
          { label: 'Ver la guía completa', href: '/guide/' },
        ],
      },
    };
  }

  /* ---------- envío ---------- */
  async function run(text: string) {
    add('user', text);
    const t = norm(text);
    setBusy(true);
    try {
      /* acciones especiales disparadas desde tarjetas */
      if (text.startsWith('__do-branch__')) {
        const [repoFull, name, from] = text.replace('__do-branch__', '').split('|');
        try {
          await createBranch(repoFull, name, from);
          logAct('branch', 'Rama creada', name + ' @ ' + repoFull);
          pushToast('Rama creada', 'ok', name);
          loadRepos().catch(() => { });
          add('orbit', `Rama creada:`, { type: 'branch-done', repo: repoFull, name, from });
        } catch (e) {
          add('sys', mErr(e)); pushToast('No se pudo crear la rama', 'err', mErr(e));
        }
        return;
      }
      if (text === '__noop__') return;

      const res = await intent(t, text);
      if (res) { add('orbit', res.text, res.card); return; }
      if (prefs.aiKey) {
        try {
          const ai = await aiRespond(text);
          add('orbit', ai.text, ai.card);
        } catch (e) {
          add('sys', 'La IA no respondió: ' + mErr(e) + ' — Revisa la clave, el modelo y el proveedor en Control Center.');
        }
        return;
      }
      const fb = fallback();
      add('orbit', fb.text, fb.card);
    } catch (e) {
      add('sys', mErr(e) + ' — Si persiste, revisa el token y el rate limit en Control Center.');
    } finally { setBusy(false); }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    await run(text);
  }

  const cardCtx: CardCtx = useMemo(() => ({
    onNav: to => router.push(to),
    onRun: cmd => { if (!busy) void run(cmd); },
    onOpenRepo: name => openFicha(name),
    onOpenFile: (path, repo) => { openCode(path ? { repo, file: path } : { repo }); router.push('/code/'); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [busy, repos, prefs, connected, user, rate, msgs]);

  const aiLabel = prefs.aiKey ? `${labelProv(prefs.aiProvider)} · ${prefs.aiModel || 'auto'}` : 'Activar IA';

  return (
    <Section title="Personal Chat" sub="Lenguaje natural, comandos reales y tu IA — todo en una conversación">
      <div className="chat-wrap">
        <div className="chat-scroll" ref={scroller}>
          {msgs.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              {m.role === 'user'
                ? <div className="bubble user">{m.text}</div>
                : (
                  <div className="bubble orbit">
                    {m.text ? <Md src={m.text} /> : null}
                    {m.card ? <ChatCard card={m.card} ctx={cardCtx} /> : null}
                  </div>
                )}
            </div>
          ))}
          {busy ? <div className="bubble orbit sys"><span className="orbit-spinner" style={{ width: 13, height: 13 }} /> trabajando…</div> : null}
        </div>
        <div className="chat-chips">
          {CHIPS.map(c => (
            <button key={c} className="chip-btn" onClick={() => { if (!busy) void run(c); }}>{c}</button>
          ))}
          <button className="chip-btn acc" onClick={() => router.push('/control/')}><IcSparkles size={12} />{aiLabel}</button>
        </div>
        <div className="composer">
          <GlassInput
            placeholder="Escribe en lenguaje natural… «muéstrame mis repositorios»"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            aria-label="Mensaje"
            tint="var(--orbit-accent)"
          />
          <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcSend size={16} />} aria-label="Enviar" disabled={busy || !input.trim()} onClick={send} />
        </div>
      </div>

      {!connected ? (
        <div className="chip warn" style={{ marginTop: 12 }}>Conecta tu PAT en Control Center para usar comandos reales</div>
      ) : null}

      {/* crear repo (exige escribir el nombre) */}
      <ConfirmSheet
        open={createRepoName !== null}
        onClose={() => setCreateRepoName(null)}
        title="Crear repositorio"
        text={`Se creará el repositorio ${createRepoName} en tu cuenta mediante la API de GitHub. Escribe su nombre para confirmar.`}
        confirmLabel="Crear"
        typeTo={createRepoName || ''}
        onConfirm={async () => {
          const name = createRepoName!;
          try {
            await gh.createRepo(name, 'Creado desde GitHub Orbit', false);
            await loadRepos().catch(() => { });
            logAct('folder-plus', 'Repositorio creado', name);
            const r: GHRepo | undefined = repos.find(x => x.name === name);
            add('orbit', `Listo, **${name}** ya existe en tu cuenta.`, {
              type: 'repos', repos: r ? [{ name: r.name, description: r.description || '', language: r.language || '', private: r.private }] : [],
            });
            pushToast('Repositorio creado', 'ok', name);
          } catch (e) { add('sys', mErr(e)); pushToast('No se pudo crear', 'err', mErr(e)); }
        }}
      />

      {/* limpiar conversación */}
      <ConfirmSheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Borrar conversación"
        text="Se eliminará el historial de chat guardado en este dispositivo."
        confirmLabel="Borrar"
        onConfirm={() => { setMsgs([{ role: 'orbit', ts: Date.now(), text: 'Conversación limpia. ¿Empezamos de nuevo?', card: { type: 'welcome' } }]); pushToast('Historial borrado', 'ok'); }}
      />

      {/* eliminar repo (mantenido del parser estricto: «borra repo X») */}
      <ConfirmSheet
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Eliminar repositorio"
        text={`Se eliminará permanentemente ${confirmDelete} de tu cuenta de GitHub con todo su historial. Escribe su nombre para confirmar. Esta acción es irreversible.`}
        confirmLabel="Eliminar para siempre"
        typeTo={confirmDelete || ''}
        onConfirm={async () => {
          try {
            await gh.deleteRepo(confirmDelete!);
            await loadRepos().catch(() => { });
            add('orbit', `Repositorio eliminado: **${confirmDelete}**`);
            pushToast('Repositorio eliminado', 'ok', confirmDelete!);
          } catch (e) { pushToast('No se pudo eliminar', 'err', mErr(e)); add('sys', mErr(e)); }
          setConfirmDelete(null);
        }}
      />
    </Section>
  );
}
