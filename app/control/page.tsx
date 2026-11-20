'use client';

/* Control Center: conexión con PAT (con diagnóstico real), bóveda,
   apariencia, NetKeep, IA y zona de peligro. */

import { useState } from 'react';
import { GlassButton, GlassInput, GlassSwitch, GlassSegmented, GlassCard, GlassSlider } from '@zakisheriff/liquid-glass';
import { useSyncExternalStore } from 'react';
import { useOrbit, connect, disconnect, pushToast, setPrefs, destroyVault, openVaultSheet, wipeAll, ACCENTS } from '@/lib/store';
import { netKeep } from '@/lib/netkeep';
import { aiChat, AI_PROVIDERS, type AIProvider } from '@/lib/ai';
import { GitHubError } from '@/lib/github';
import { Section, Row, Diag, ConfirmSheet } from '@/components/bits';
import { IcShield, IcSun, IcMoon, IcZap, IcLock, IcTrash } from '@/components/Icons';

export default function ControlPage() {
  const state = useOrbit();
  const nk = useSyncExternalStore(netKeep.subscribe, netKeep.getSnapshot, netKeep.getSnapshot);
  const [tok, setTok] = useState('');
  const [err, setErr] = useState('');
  const [wipe, setWipe] = useState(false);
  const [wipeVault, setWipeVault] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doConnect() {
    const t = tok.trim().replace(/\s+/g, '');
    if (!t) { setErr('Pega tu Personal Access Token primero'); return; }
    setErr(''); setBusy(true);
    try {
      await connect(t, { remember: state.prefs.remember, device: state.prefs.rememberDevice });
      setTok('');
    } catch (e) {
      const m = e instanceof GitHubError ? e.message : 'error desconocido';
      setErr(m);
      pushToast('No se pudo verificar el token', 'err', m);
    } finally { setBusy(false); }
  }

  async function testAI() {
    setBusy(true);
    try {
      const r = await aiChat(state.prefs.aiProvider, state.prefs.aiKey, state.prefs.aiModel || AI_PROVIDERS.find(p => p.id === state.prefs.aiProvider)!.model, [
        { role: 'user', content: 'Di «Orbit IA lista» y nada más.' },
      ]);
      pushToast('IA conectada', 'ok', r.slice(0, 60));
    } catch (e) {
      pushToast('IA no responde', 'err', e instanceof Error ? e.message : '');
    } finally { setBusy(false); }
  }

  const p = state.prefs;
  const provIdx = AI_PROVIDERS.findIndex(x => x.id === p.aiProvider);

  return (
    <>
      <Section title="Conexión con GitHub" sub="Personal Access Token · se queda solo en tu navegador">
        <GlassCard padding="18px">
          {!state.connected ? (
            <>
              <GlassInput type="password" placeholder="ghp_… o github_pat_…" value={tok} onChange={e => setTok(e.target.value)} icon={<IcShield size={15} />} aria-label="Personal Access Token" tint="var(--orbit-accent)" />
              <div style={{ height: 8 }} />
              <Row label="Recordar durante la sesión" sub="sessionStorage: solo la pestaña actual, se borra al cerrarla">
                <GlassSwitch checked={p.remember} onChange={v => setPrefs({ remember: v })} tint="var(--orbit-accent)" aria-label="Recordar sesión" />
              </Row>
              <Row label="Mantener en este dispositivo" sub="Token cifrado con AES-256-GCM en una bóveda local; se restaura tras desbloquear">
                <GlassSwitch checked={p.rememberDevice} onChange={v => { setPrefs({ rememberDevice: v }); if (v && !state.vaultUnlocked) openVaultSheet(state.vaultExists ? 'unlock' : 'create'); }} tint="var(--orbit-accent)" aria-label="Mantener en este dispositivo" />
              </Row>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <GlassButton variant="filled" tint="var(--orbit-accent)" disabled={busy || !tok.trim() || state.connecting} onClick={doConnect}>
                  {busy || state.connecting ? 'Verificando…' : 'Verificar y conectar'}
                </GlassButton>
              </div>
              <Diag text={err || null} />
              <p className="tiny" style={{ marginTop: 10 }}>
                Crea el token en github.com → Settings → Developer settings → Tokens. Classic: scope <b>repo</b>.
                Fine-grained: permisos de Contents (lectura/escritura) sobre los repos que toque.
              </p>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.user!.avatar_url} alt="" width={44} height={44} style={{ borderRadius: 12 }} />
                <div>
                  <b>@{state.user!.login}</b>
                  <div className="tiny">{state.user!.name || 'cuenta GitHub'} · {state.scopes.length ? 'scopes: ' + state.scopes.join(', ') : 'scopes: —'}</div>
                </div>
              </div>
              <div className="stat-strip">
                <GlassCard padding="12px 16px" className="stat-box"><small>Cuota restante</small><b>{state.rate ? state.rate.rem : '—'}</b></GlassCard>
                <GlassCard padding="12px 16px" className="stat-box"><small>Límite</small><b>{state.rate ? state.rate.limit : '—'}</b></GlassCard>
                <GlassCard padding="12px 16px" className="stat-box"><small>Repos visibles</small><b>{state.repos.length}</b></GlassCard>
              </div>
              <GlassButton destructive onClick={disconnect}>Desconectar</GlassButton>
            </>
          )}
        </GlassCard>
      </Section>

      <Section title="Apariencia" sub="Sigue el sistema o fija tu tema — Liquid Glass responde a data-theme">
        <GlassCard padding="18px">
          <Row label="Tema" sub="Auto sigue a prefers-color-scheme">
            <GlassSegmented
              options={[{ label: 'Auto', icon: <IcZap size={13} /> }, { label: 'Claro', icon: <IcSun size={13} /> }, { label: 'Oscuro', icon: <IcMoon size={13} /> }]}
              value={['auto', 'light', 'dark'].indexOf(p.theme)}
              onChange={i => setPrefs({ theme: (['auto', 'light', 'dark'] as const)[i] })}
              aria-label="Tema"
            />
          </Row>
          <Row label="Color de acento" sub="Botones rellenos, enlaces y la aurora">
            <div className="accent-dots">
              {ACCENTS.map(c => (
                <button key={c} className={`accent-dot${c === p.accent ? ' on' : ''}`} style={{ background: c }} aria-label={'Acento ' + c} onClick={() => setPrefs({ accent: c })} />
              ))}
            </div>
          </Row>
          <Row label="Reducir movimiento" sub="Congela aurora y animaciones">
            <GlassSwitch checked={p.reduceMotion} onChange={v => setPrefs({ reduceMotion: v })} tint="var(--orbit-accent)" aria-label="Reducir movimiento" />
          </Row>
        </GlassCard>
      </Section>

      <Section title="Mantener red activa · NetKeep" sub="Goteo orgánico que mantiene la ruta tibia; se retira cuando la app trabaja">
        <GlassCard padding="18px">
          <Row label="Mantener red activa" sub="Ráfagas a un CDN público de pruebas, sin gastar cuota de la API">
            <GlassSwitch checked={p.netkeep} onChange={v => setPrefs({ netkeep: v })} tint="var(--orbit-accent)" aria-label="NetKeep" />
          </Row>
          <div className="orbit-row" style={{ alignItems: 'stretch', display: 'block' }}>
            <div className="orbit-row-text" style={{ marginBottom: 10 }}><b>Objetivo de caudal</b><small>{p.netkeepKbps} kbps ≈ {(p.netkeepKbps * 3600 / 8 / 1024).toFixed(0)} MB/hora</small></div>
            <GlassSlider
              showThumb={false} icon={<IcZap size={16} />} label="kbps"
              min={10} max={200} step={5} value={p.netkeepKbps}
              onChange={v => setPrefs({ netkeepKbps: Math.round(v) })}
              aria-label="Caudal objetivo de NetKeep"
            />
          </div>
          <div className="stat-strip">
            <GlassCard padding="12px 16px" className="stat-box"><small>Estado</small><b style={{ fontSize: 13 }}>{nk.running ? 'activo' : 'apagado'}</b></GlassCard>
            <GlassCard padding="12px 16px" className="stat-box"><small>Ahora</small><b>{nk.kbps} kbps</b></GlassCard>
            <GlassCard padding="12px 16px" className="stat-box"><small>Media</small><b>{nk.avg} kbps</b></GlassCard>
            <GlassCard padding="12px 16px" className="stat-box"><small>Latencia GitHub</small><b>{nk.latency != null ? nk.latency + ' ms' : '—'}</b></GlassCard>
            <GlassCard padding="12px 16px" className="stat-box"><small>Sesión</small><b>{(nk.bytes / 1024 / 1024).toFixed(1)} MB</b></GlassCard>
          </div>
        </GlassCard>
      </Section>

      <Section title="Inteligencia artificial" sub="La clave vive en tu navegador y viaja solo al proveedor">
        <GlassCard padding="18px">
          <Row label="Proveedor">
            <GlassSegmented
              options={AI_PROVIDERS.map(x => ({ label: x.label }))}
              value={provIdx < 0 ? 0 : provIdx}
              onChange={i => {
                const id = AI_PROVIDERS[i].id as AIProvider;
                setPrefs({ aiProvider: id, aiModel: AI_PROVIDERS[i].model });
              }}
              aria-label="Proveedor de IA"
            />
          </Row>
          <Row label="Clave de API" sub="OpenAI · GLM (Z.ai) · Gemini — se guarda en localStorage de este dispositivo">
            <GlassInput type="password" placeholder="sk-… / clave del proveedor" value={p.aiKey} onChange={e => setPrefs({ aiKey: e.target.value })} aria-label="Clave de IA" tint="var(--orbit-accent)" />
          </Row>
          <Row label="Modelo" sub={'Por defecto: ' + AI_PROVIDERS[provIdx < 0 ? 0 : provIdx].model}>
            <GlassInput placeholder={AI_PROVIDERS[provIdx < 0 ? 0 : provIdx].model} value={p.aiModel} onChange={e => setPrefs({ aiModel: e.target.value })} aria-label="Modelo" />
          </Row>
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <GlassButton disabled={busy || !p.aiKey} onClick={testAI}>Probar conexión</GlassButton>
          </div>
        </GlassCard>
      </Section>

      <Section title="Bóveda y datos locales" sub="Cifrado AES-256-GCM · nada sale de este dispositivo">
        <GlassCard padding="18px">
          <Row label="Bóveda de este dispositivo" sub={state.vaultExists ? (state.vaultUnlocked ? 'desbloqueada en esta sesión' : 'bloqueada — desbloquéala para restaurar la sesión') : 'sin crear — actívala con «Mantener en este dispositivo»'}>
            {state.vaultExists ? <GlassButton icon={<IcLock size={14} />} onClick={() => openVaultSheet('unlock')}>Desbloquear</GlassButton> : null}
          </Row>
          <Row label="Borrar datos locales" sub="Prefs, chat, bóveda y token de sesión — el servidor no guarda nada">
            <GlassButton icon={<IcTrash size={14} />} destructive onClick={() => setWipe(true)}>Borrar todo</GlassButton>
          </Row>
          {state.vaultExists ? (
            <Row label="Eliminar bóveda" sub="El token cifrado se pierde; tendrás que pegar el PAT de nuevo">
              <GlassButton icon={<IcLock size={14} />} destructive onClick={() => setWipeVault(true)}>Eliminar</GlassButton>
            </Row>
          ) : null}
        </GlassCard>
      </Section>

      <ConfirmSheet
        open={wipe} onClose={() => setWipe(false)}
        title="Borrar datos locales"
        text="Se eliminarán preferencias, conversación, bóveda y token de sesión de este dispositivo. Tus repos en GitHub no se tocan."
        confirmLabel="Borrar todo"
        onConfirm={() => { wipeAll(); pushToast('Datos locales borrados', 'ok'); }}
      />
      <ConfirmSheet
        open={wipeVault} onClose={() => setWipeVault(false)}
        title="Eliminar bóveda"
        text="El token cifrado se perderá y la sesión no se podrá restaurar automáticamente."
        confirmLabel="Eliminar bóveda"
        onConfirm={() => destroyVault()}
      />
    </>
  );
}
