'use client';

/* Control Center: conexión con PAT (con diagnóstico real), bóveda,
   apariencia, NetKeep, IA y zona de peligro. */

import { useEffect, useState } from 'react';
import { AppButton as GlassButton, AppInput as GlassInput, AppSwitch as GlassSwitch, AppSegmented as GlassSegmented, AppCard as GlassCard, AppSlider as GlassSlider, AppSheet as GlassSheet } from '@/components/ui';
import { useSyncExternalStore } from 'react';
import { useOrbit, connect, disconnect, pushToast, setPrefs, destroyVault, openVaultSheet, wipeAll, ACCENTS } from '@/lib/store';
import { netKeep } from '@/lib/netkeep';
import { aiChat, aiListModels, AI_PROVIDERS, provOf } from '@/lib/ai';
import { CAPS, capsFromScopes } from '@/lib/scopes';
import { auditSecrets } from '@/lib/security';
import { GitHubError } from '@/lib/github';
import { Section, Row, Diag, ConfirmSheet } from '@/components/bits';
import { ActivityList } from '@/components/ActivityList';
import { IcShield, IcSun, IcMoon, IcZap, IcLock, IcTrash, IcList } from '@/components/Icons';

export default function ControlPage() {
  const state = useOrbit();
  const nk = useSyncExternalStore(netKeep.subscribe, netKeep.getSnapshot, netKeep.getSnapshot);
  const [tok, setTok] = useState('');
  const [err, setErr] = useState('');
  const [wipe, setWipe] = useState(false);
  const [wipeVault, setWipeVault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; name: string }> | null>(null);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [modelsBusy, setModelsBusy] = useState(false);
  const [audit, setAudit] = useState(-1);
  const [provOpen, setProvOpen] = useState(false);

  useEffect(() => { setAudit(auditSecrets()); }, []);

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
      const r = await aiChat(state.prefs.aiProvider, state.prefs.aiKey, state.prefs.aiModel || provOf(state.prefs.aiProvider).model, [
        { role: 'user', content: 'Di «Orbit IA lista» y nada más.' },
      ], { baseUrl: state.prefs.aiBaseUrl, gatewayKey: state.prefs.aiGatewayKey });
      pushToast('IA conectada', 'ok', r.slice(0, 60));
    } catch (e) {
      pushToast('IA no responde', 'err', e instanceof Error ? e.message : '');
    } finally { setBusy(false); }
  }

  async function loadModels() {
    if (!state.prefs.aiKey && provOf(state.prefs.aiProvider).needsKey) { pushToast('Pon la clave primero', 'err'); return; }
    setModelsBusy(true); setModelsOpen(true);
    try {
      const list = await aiListModels(state.prefs.aiProvider, state.prefs.aiKey, { baseUrl: state.prefs.aiBaseUrl, gatewayKey: state.prefs.aiGatewayKey });
      setModels(list);
      pushToast('Modelos disponibles', 'ok', list.length + ' modelos accesibles con tu clave');
    } catch (e) {
      setModels([]);
      pushToast('No se pudieron listar', 'err', e instanceof Error ? e.message : '');
    } finally { setModelsBusy(false); }
  }

  const p = state.prefs;
  const prov = provOf(p.aiProvider);
  const caps = capsFromScopes(state.scopes);

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

      <Section
        title="Scopes y funciones de tu token"
        sub={state.connected
          ? (caps.fineGrained
            ? 'Token fine-grained o sin scopes declarados — GitHub no informa los permisos; se descubren al usar cada función'
            : 'GitHub declara estos scopes en cada respuesta autenticada — cada uno habilita funciones equivalentes aquí')
          : 'Conecta tu cuenta: al verificar el token, GitHub informa sus scopes y aquí se listan las funciones que habilita'}
        right={state.connected && caps.raw.length ? (
          <div className="chips">
            {caps.raw.slice(0, 8).map(s => <span key={s} className="chip acc mono">{s}</span>)}
            {caps.raw.length > 8 ? <span className="chip">+{caps.raw.length - 8} más</span> : null}
          </div>
        ) : null}
      >
        <GlassCard padding="18px">
          {!state.connected ? (
            <p className="tiny" style={{ padding: '6px 4px' }}>
              Sin conexión no hay scopes que mostrar. Verifica tu Personal Access Token arriba y esta tarjeta
              se llenará con el mapeo scope → función en lenguaje natural.
            </p>
          ) : (
            <>
              {caps.fineGrained ? (
                <div className="note warn" style={{ marginBottom: 12 }}>
                  Los tokens fine-grained no exponen sus permisos en cabeceras. Orbit habilita lo esencial
                  (repos, código, PRs, issues) y descubre los permisos reales al usar cada función; si algo
                  responde 403, ese permiso falta en el token.
                </div>
              ) : null}
              {CAPS.map(ci => (
                <Row
                  key={ci.cap}
                  label={ci.title}
                  sub={
                    ci.plain + ' · scope: ' + ci.scopes +
                    ' · habilita: ' + ci.features.join(', ') +
                    (caps.map[ci.cap] ? '' : ' — ' + ci.missingNote)
                  }
                >
                  <span className={`chip ${caps.map[ci.cap] ? 'ok' : 'err'}`}>
                    {caps.map[ci.cap] ? 'disponible ✓' : 'no disponible'}
                  </span>
                </Row>
              ))}
              <p className="tiny" style={{ marginTop: 10 }}>
                Las secciones del menú aparecen u ocultan en tiempo real según estos scopes: si tu token
                no permite una función, esa sección no se muestra y aquí se explica por qué.
              </p>
            </>
          )}
        </GlassCard>
      </Section>

      <Section
        title="Apariencia"
        sub={p.reduceMotion
          ? '«Reducir movimiento» activo: tema AMOLED forzado y acentos ocultos'
          : 'Sigue el sistema o fija tu tema — Liquid Glass responde a data-theme'}
      >
        <GlassCard padding="18px">
          <Row label="Motor visual" sub={p.reduceMotion
            ? '«Reducir movimiento» fuerza el tema de bajo consumo (sin blur ni filtros SVG)'
            : 'Auto: Android 13 o menos arranca en Bajo consumo, Android 14+ en Liquid Glass · cámbialo cuando quieras'}>
            <GlassSegmented
              options={[{ label: 'Auto' }, { label: 'Liquid Glass' }, { label: 'Bajo consumo' }]}
              value={['auto', 'glass', 'expressive'].indexOf(p.themeEngine)}
              onChange={i => { if (!p.reduceMotion) setPrefs({ themeEngine: (['auto', 'glass', 'expressive'] as const)[i] }); }}
              aria-label="Motor visual"
            />
          </Row>
          {p.reduceMotion ? (
            <>
              <Row label="Tema" sub="Reducir movimiento fuerza el modo oscuro AMOLED (negro puro, sin aurora)">
                <GlassSegmented options={[{ label: 'AMOLED' }]} value={0} onChange={() => { }} aria-label="Tema AMOLED forzado" />
              </Row>
              <Row label="Color de acento" sub="Oculto mientras «Reducir movimiento» está activado">
                <span className="chip">oculto</span>
              </Row>
            </>
          ) : (
            <>
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
            </>
          )}
          <Row label="Reducir movimiento" sub="Congela aurora y animaciones · fuerza AMOLED y oculta temas y acentos">
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

      <Section title="Inteligencia artificial" sub="Proveedor → API Key → URL Base → Modelo · las claves se quedan solo en este dispositivo">
        <GlassCard padding="18px">
          <Row label="Proveedor" sub="Toca para elegir entre 11 servicios compatibles">
            <GlassButton icon={<IcList size={14} />} onClick={() => setProvOpen(true)}>
              {prov.label}
            </GlassButton>
          </Row>
          <Row label="API Key" sub="Muéstrala u ocúltala mientras escribes · guardada, nunca se vuelve a mostrar — se reemplaza escribiendo una nueva">
            <KeyField
              saved={!!p.aiKey}
              placeholder={prov.keyHint}
              onCommit={v => { setPrefs({ aiKey: v }); pushToast('Clave guardada', 'ok', 'No se volverá a mostrar'); }}
            />
          </Row>
          <Row label="URL Base (opcional)" sub="Déjala vacía para usar la oficial del proveedor">
            <GlassInput placeholder={prov.baseUrl || 'https://tu-endpoint/v1'} value={p.aiBaseUrl} onChange={e => setPrefs({ aiBaseUrl: e.target.value })} aria-label="URL Base personalizada" className="mono" />
          </Row>
          {p.aiBaseUrl.trim() ? (
            <Row label="API Key adicional (gateway)" sub="Clave propia de tu URL personalizada — se envía como Authorization en lugar de la del proveedor">
              <KeyField
                saved={!!p.aiGatewayKey}
                placeholder="clave del gateway"
                onCommit={v => { setPrefs({ aiGatewayKey: v }); pushToast('Clave adicional guardada', 'ok', 'No se volverá a mostrar'); }}
              />
            </Row>
          ) : null}
          <Row label="Modelo" sub={prov.model ? 'Por defecto: ' + prov.model : 'Nombre exacto del modelo de tu endpoint'}>
            <GlassInput placeholder={prov.model || 'nombre-del-modelo'} value={p.aiModel} onChange={e => setPrefs({ aiModel: e.target.value })} aria-label="Modelo" />
          </Row>
          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <GlassButton disabled={busy || (!p.aiKey && prov.needsKey)} onClick={testAI}>Probar conexión</GlassButton>
            <GlassButton icon={<IcList size={14} />} disabled={modelsBusy || (!p.aiKey && prov.needsKey)} onClick={loadModels}>
              {modelsBusy ? 'Listando…' : 'Ver modelos disponibles'}
            </GlassButton>
          </div>
          <p className="tiny" style={{ marginTop: 10 }}>
            Las claves viajan por HTTPS directamente al proveedor elegido — Orbit no tiene servidor intermediario.
          </p>
        </GlassCard>
      </Section>

      {/* Modal: selector de proveedor */}
      <GlassSheet open={provOpen} onClose={() => setProvOpen(false)} detents={['medium', 'large']} aria-label="Elegir proveedor de IA">
        <div className="sheet-head"><h3>Proveedor de IA</h3></div>
        <p className="sheet-text">Elige el servicio; después pegas su clave en el paso siguiente. Cada proveedor trae su modelo por defecto (editable).</p>
        <div className="picker-list">
          {AI_PROVIDERS.map(x => (
            <button key={x.id} className={`picker-item${x.id === p.aiProvider ? ' sel' : ''}`}
              onClick={() => { setPrefs({ aiProvider: x.id, aiModel: x.model }); setProvOpen(false); pushToast('Proveedor: ' + x.label, 'ok', x.model ? 'modelo por defecto: ' + x.model : 'define URL Base y modelo'); }}>
              <b>{x.label}{x.id === p.aiProvider ? ' ✓' : ''}</b>
              <small>{x.model ? 'modelo: ' + x.model : 'sin modelo por defecto'}{x.note ? ' · ' + x.note : ''}</small>
            </button>
          ))}
        </div>
      </GlassSheet>

      <Section title="Seguridad · Zero Trust" sub="Redacción de secretos, auditoría del código cargado y datos solo locales">
        <GlassCard padding="18px">
          <Row label="Auditoría de credenciales" sub="Busca tokens/claves embebidas en el código que tu navegador tiene cargado ahora mismo">
            <span className={`chip ${audit === 0 ? 'ok' : 'err'}`} style={{ fontSize: 13 }}>
              {audit < 0 ? '—' : audit === 0 ? '0 secretos ✓' : audit + ' sospechoso(s)'}
            </span>
          </Row>
          <Row label="Redacción en pantalla" sub="Toasts, actividad y errores redactan automáticamente cualquier token que pudiera filtrarse">
            <span className="chip ok">activo</span>
          </Row>
          <Row label="Archivos sensibles al subir" sub="Explorer detecta .env, .pem, id_rsa y similares, los marca y los excluye por defecto">
            <span className="chip ok">activo</span>
          </Row>
        </GlassCard>
      </Section>

      <Section title="Actividad reciente" sub="Últimas operaciones realizadas en esta app (solo en este dispositivo)">
        <GlassCard padding="12px 16px">
          <ActivityList max={10} />
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

      {/* Modelos disponibles del proveedor */}
      <GlassSheet open={modelsOpen} onClose={() => setModelsOpen(false)} detents={['medium', 'large']} aria-label="Modelos disponibles">
        <div className="sheet-head"><h3>Modelos del proveedor</h3></div>
        <p className="sheet-text">Lista real de los modelos que tu clave tiene accesibles. Elige uno para usarlo en el chat.</p>
        <div className="picker-list">
          {(models || []).map(m => (
            <button key={m.id} className="picker-item" onClick={() => { setPrefs({ aiModel: m.id }); setModelsOpen(false); pushToast('Modelo elegido', 'ok', m.id); }}>
              <b className="mono">{m.id}</b>
              <small>{m.name !== m.id ? m.name : ''}</small>
            </button>
          ))}
          {models && !models.length ? <p className="picker-none">La clave no devolvió modelos (o el proveedor no soporta listarlos).</p> : null}
        </div>
      </GlassSheet>
    </>
  );
}

/* Ojo de mostrar/ocultar (solo afecta al texto que se está escribiendo) */
function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

/** Campo de clave con reglas de seguridad:
    · el ojo (hermano del campo) muestra/oculta solo el borrador — el vendor
      reserva el interior del campo para su propio botón de limpiar (×);
    · tocar el ojo NO guarda: el mousedown con preventDefault evita el blur;
    · confirmar (Enter o salir del campo) guarda y vacía el campo;
    · la clave guardada jamás se renderiza — solo se puede reemplazar. */
function KeyField({ saved, placeholder, onCommit }: {
  saved: boolean; placeholder: string; onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [show, setShow] = useState(false);
  const commit = () => {
    const v = draft.trim();
    if (v) { onCommit(v); setDraft(''); setShow(false); }
  };
  return (
    <div className="keyfield">
      <GlassInput
        type={show ? 'text' : 'password'}
        placeholder={saved ? '•••••• guardada · escribe para reemplazar' : placeholder}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); }}
        aria-label={saved ? 'Reemplazar clave guardada' : 'Nueva clave de API'}
        tint="var(--orbit-accent)"
      />
      <button
        type="button" className="ibtn" style={{ opacity: draft ? 1 : .4 }}
        aria-label={show ? 'Ocultar clave' : 'Mostrar clave'}
        disabled={!draft}
        onMouseDown={e => e.preventDefault()}
        onClick={() => setShow(s => !s)}
      >
        <EyeIcon off={!show} />
      </button>
      <span className={`chip ${saved ? 'ok' : ''}`}>{saved ? 'guardada ✓' : 'sin clave'}</span>
    </div>
  );
}
