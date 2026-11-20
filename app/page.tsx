'use client';

/* Personal Chat: comandos reales de Orbit + IA multi-proveedor. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassButton, GlassInput } from '@zakisheriff/liquid-glass';
import { useOrbit, pushToast, setPrefs, loadRepos } from '@/lib/store';
import { parseCommand, HELP_TEXT } from '@/lib/chat';
import { aiChat, ORBIT_SYSTEM, type ChatMsg } from '@/lib/ai';
import { gh, GitHubError, type GHRepo } from '@/lib/github';
import { Section, ConfirmSheet, relTime } from '@/components/bits';
import { IcSend, IcZap } from '@/components/Icons';

interface Bubble { role: 'user' | 'orbit' | 'sys'; text: string; ts: number }

const CHIPS = ['ayuda', 'repos', 'estado', 'ramas owner/repo', 'prs owner/repo', 'tema oscuro'];

export default function ChatPage() {
  const { connected, user, rate, scopes, repos, prefs } = useOrbit();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setMsgs(JSON.parse(localStorage.getItem('orbit.chat') || '[]')); } catch { setMsgs([]); }
  }, []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    try { localStorage.setItem('orbit.chat', JSON.stringify(msgs.slice(-120))); } catch { /* privado */ }
  }, [msgs]);

  const add = (role: Bubble['role'], text: string) => setMsgs(m => [...m, { role, text, ts: Date.now() }]);

  async function run(text: string) {
    const cmd = parseCommand(text);
    if (!cmd) {
      if (!prefs.aiKey) {
        add('orbit', 'No hay clave de IA configurada. Ponla en Control Center · Inteligencia artificial, o prueba los comandos:\n' + HELP_TEXT);
        return;
      }
      setBusy(true);
      try {
        const history: ChatMsg[] = msgs.slice(-12).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
        const reply = await aiChat(prefs.aiProvider, prefs.aiKey, prefs.aiModel || 'gpt-4o-mini', [
          { role: 'system', content: ORBIT_SYSTEM }, ...history, { role: 'user', content: text },
        ]);
        add('orbit', reply);
      } catch (e) {
        add('sys', 'IA: ' + (e instanceof Error ? e.message : 'error desconocido'));
      } finally { setBusy(false); }
      return;
    }

    switch (cmd.kind) {
      case 'ayuda': add('orbit', HELP_TEXT); return;
      case 'estado':
        add('sys', connected
          ? `Conectado como @${user?.login}\nCuota: ${rate ? rate.rem + ' / ' + rate.limit + ' peticiones restantes' : '—'}\nScopes: ${scopes.join(', ') || '(sin scopes declarados)'}`
          : 'Sin conexión. Añade tu PAT en Control Center.');
        return;
      case 'sube': router.push('/explorer/'); return;
      case 'limpiar': setMsgs([]); return;
      case 'tema': {
        const map = { claro: 'light', oscuro: 'dark', auto: 'auto' } as const;
        setPrefs({ theme: map[cmd.arg] });
        add('sys', `Tema cambiado a ${cmd.arg}.`);
        return;
      }
      case 'crea':
        setBusy(true);
        try {
          const r = await gh.createRepo(cmd.arg, '', false);
          await loadRepos().catch(() => { });
          add('orbit', `Repositorio creado: ${r.full_name}\n${r.html_url}`);
        } catch (e) { add('sys', 'No pude crear el repo: ' + msg(e)); }
        finally { setBusy(false); }
        return;
      case 'borra':
        setConfirmDelete(cmd.arg);
        add('sys', `Para confirmar, pulsa «Eliminar» en el diálogo: ${cmd.arg}`);
        return;
      case 'ramas':
      case 'prs':
      case 'issues':
      case 'repos': {
        setBusy(true);
        try {
          if (cmd.kind === 'repos') {
            let list: GHRepo[] = repos.length ? repos : await loadRepos();
            if (cmd.arg) {
              const q = cmd.arg.toLowerCase();
              list = list.filter(r => r.full_name.toLowerCase().includes(q));
            }
            add('orbit', list.length
              ? `Tus repositorios (${list.length}):\n` + list.slice(0, 30).map(r => `· ${r.full_name} — ${r.private ? 'privado' : 'público'} · ${r.default_branch}`).join('\n')
              : 'No encontré repositorios' + (cmd.arg ? ' con ese filtro' : '') + '.');
          } else if (cmd.kind === 'ramas') {
            const bs = await gh.branches(cmd.arg);
            add('orbit', `Ramas de ${cmd.arg} (${bs.length}):\n` + bs.map(b => `· ${b.name}`).join('\n'));
          } else if (cmd.kind === 'prs') {
            const ps = await gh.pulls(cmd.arg, 'open');
            add('orbit', ps.length
              ? `PRs abiertos en ${cmd.arg} (${ps.length}):\n` + ps.map(p => `· #${p.number} ${p.title} — @${p.user.login}`).join('\n')
              : `Sin PRs abiertos en ${cmd.arg}.`);
          } else {
            const is = (await gh.issues(cmd.arg, 'open')).filter(i => !i.pull_request);
            add('orbit', is.length
              ? `Issues abiertos en ${cmd.arg} (${is.length}):\n` + is.map(i => `· #${i.number} ${i.title} — @${i.user.login}`).join('\n')
              : `Sin issues abiertos en ${cmd.arg}.`);
          }
        } catch (e) { add('sys', msg(e)); }
        finally { setBusy(false); }
        return;
      }
    }
  }

  function msg(e: unknown) { return e instanceof GitHubError || e instanceof Error ? e.message : 'error desconocido'; }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    add('user', text);
    await run(text);
  }

  return (
    <Section title="Personal Chat" sub="Comandos reales de Orbit + tu IA, en una conversación">
      <div className="chat-wrap">
        <div className="chat-scroll" ref={scroller}>
          {!msgs.length ? (
            <div className="bubble orbit sys">
              Bienvenido{user ? ', @' + user.login : ''}. Escribe «ayuda» para ver los comandos,
              pega tu PAT en Control Center para conectar, o habla con tu IA.
              Última visita: {msgs.length ? '' : relTime(new Date(Date.now() - 60000).toISOString())}
            </div>
          ) : msgs.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>{m.text}</div>
          ))}
          {busy ? <div className="bubble orbit sys"><span className="orbit-spinner" style={{ width: 13, height: 13 }} /> trabajando…</div> : null}
        </div>
        <div className="chat-chips">
          {CHIPS.map(c => (
            <button key={c} className="chip acc" onClick={() => { setInput(c); }}>{c}</button>
          ))}
        </div>
        <div className="composer">
          <GlassInput
            placeholder="Escribe un comando… p. ej. «muéstrame mis repos» → «repos»"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(); }}
            aria-label="Mensaje"
            tint="var(--orbit-accent)"
          />
          <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcSend size={16} />} aria-label="Enviar" disabled={busy || !input.trim()} onClick={send} />
        </div>
      </div>

      <ConfirmSheet
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Eliminar repositorio"
        text={`Se eliminará permanentemente ${confirmDelete} de tu cuenta de GitHub con todo su historial. Esta acción es irreversible.`}
        confirmLabel="Eliminar para siempre"
        onConfirm={async () => {
          try {
            await gh.deleteRepo(confirmDelete!);
            await loadRepos().catch(() => { });
            add('orbit', `Repositorio eliminado: ${confirmDelete}`);
            pushToast('Repositorio eliminado', 'ok', confirmDelete!);
          } catch (e) { pushToast('No se pudo eliminar', 'err', msg(e)); add('sys', msg(e)); }
          setConfirmDelete(null);
        }}
      />

      {!connected ? (
        <div className="chip warn" style={{ marginTop: 12 }}>Conecta tu PAT en Control Center para usar comandos reales</div>
      ) : null}
    </Section>
  );
}
