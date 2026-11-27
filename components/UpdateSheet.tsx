'use client';

/* Modal de actualización de la app Android. Al detectar una compilación más
   nueva en el release android-latest (checkForUpdate) muestra el aviso con
   «Avísame más tarde (30 minutos)» y «Actualizar ahora»; la descarga la hace
   el bridge nativo (AndroidBridge.downloadUpdate) con porcentaje en vivo
   (window.__orbitUpdateProgress) y al terminar ofrece «Instalar ahora»,
   que invoca el instalador del sistema (AndroidBridge.installUpdate).
   En la web pura (sin bridge) este componente no hace nada. */
import { useEffect, useRef, useState } from 'react';
import { AppButton as GlassButton, AppSheet as GlassSheet } from '@/components/ui';
import { checkForUpdate, nativeBridge, snoozeActive, snoozeUpdate, type UpdateInfo } from '@/lib/updater';
import { pushToast } from '@/lib/store';
import { IcDownload, IcCheck } from '@/components/Icons';

type Phase = 'info' | 'down' | 'done' | 'err';

export default function UpdateSheet() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [phase, setPhase] = useState<Phase>('info');
  const [pct, setPct] = useState(0);
  const [errMsg, setErrMsg] = useState('');
  const checking = useRef(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!alive || checking.current || !nativeBridge() || snoozeActive()) return;
      checking.current = true;
      try {
        const r = await checkForUpdate();
        if (alive && r) { setInfo(r); setPhase('info'); setPct(0); setOpen(true); }
      } catch { /* sin red o API lenta: no interrumpe el uso de la app */ } finally {
        checking.current = false;
      }
    }

    /* callbacks que el bridge nativo ejecuta durante la descarga */
    window.__orbitUpdateProgress = (p: number) => setPct(p);
    window.__orbitUpdateReady = () => { setPhase('done'); setOpen(true); };
    window.__orbitUpdateError = (m: string) => { setErrMsg(m || 'Error de descarga'); setPhase('err'); };

    /* detectar al entrar la app (deja pasar el boot) y re-visar cada 30 min */
    const t = setTimeout(run, 2500);
    const iv = setInterval(run, 30 * 60 * 1000);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(iv);
      delete window.__orbitUpdateProgress;
      delete window.__orbitUpdateReady;
      delete window.__orbitUpdateError;
    };
  }, []);

  function startDownload() {
    const bridge = nativeBridge();
    if (!info || !bridge) return;
    setPhase('down'); setPct(0); setErrMsg('');
    try {
      bridge.downloadUpdate(info.assetUrl, info.assetName);
    } catch {
      setErrMsg('No se pudo iniciar la descarga nativa');
      setPhase('err');
    }
  }

  function install() {
    const bridge = nativeBridge();
    if (!bridge) return;
    try {
      bridge.installUpdate();
      pushToast('Instalador del sistema abierto', 'ok', 'Confirma la instalación cuando lo pida Android');
    } catch {
      pushToast('No se pudo abrir el instalador', 'err', 'Permite «instalar apps desconocidas» para Orbit');
    }
  }

  const sizeMb = info ? (info.sizeBytes / (1024 * 1024)).toFixed(1) : '';
  const when = info?.publishedAt
    ? new Date(info.publishedAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <GlassSheet open={open} onClose={() => setOpen(false)} aria-label="Actualización de la app">
      {phase === 'info' && info && (
        <>
          <div className="sheet-head"><h3><IcDownload size={16} /> Actualización disponible</h3></div>
          <p className="sheet-text">
            Hay una versión nueva de la app: <b className="mono">{info.versionName}</b> (compilación r{info.remoteCode}
            {when ? `, publicada el ${when}` : ''}); tienes instalada la r{info.currentCode}. Detectada
            automáticamente al entrar — no hace falta revisar el repositorio.
          </p>
          {info.notes ? <pre className="up-notes">{info.notes}</pre> : null}
          <p className="tiny" style={{ marginTop: 8 }}>Descarga nativa de {sizeMb} MB · instalación directa por el sistema.</p>
          <div className="sheet-actions">
            <GlassButton onClick={() => { snoozeUpdate(); setOpen(false); }}>Avísame más tarde (30 min)</GlassButton>
            <GlassButton variant="filled" tint="var(--orbit-accent)" icon={<IcDownload size={14} />} onClick={startDownload}>
              Actualizar ahora
            </GlassButton>
          </div>
        </>
      )}

      {phase === 'down' && (
        <>
          <div className="sheet-head"><h3><IcDownload size={16} /> Descargando actualización</h3></div>
          <p className="sheet-text"><b className="mono">{info?.assetName}</b></p>
          <div className="up-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="up-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="num" style={{ textAlign: 'center', marginTop: 8, fontSize: 14 }}>{pct}%</p>
          <div className="sheet-actions">
            <GlassButton onClick={() => setOpen(false)}>Ocultar</GlassButton>
          </div>
          <p className="tiny" style={{ marginTop: 6 }}>Puedes seguir usando la app: al terminar se te avisará.</p>
        </>
      )}

      {phase === 'done' && (
        <>
          <div className="sheet-head"><h3 className="up-done-title"><IcCheck size={16} /> ¡Descarga finalizada!</h3></div>
          <p className="sheet-text">Puedes proceder con la instalación. Android abrirá su instalador para actualizar la app de manera directa.</p>
          <div className="sheet-actions">
            <GlassButton onClick={() => setOpen(false)}>Cerrar</GlassButton>
            <GlassButton variant="filled" tint="var(--orbit-accent)" onClick={install}>Instalar ahora</GlassButton>
          </div>
        </>
      )}

      {phase === 'err' && (
        <>
          <div className="sheet-head"><h3>No se pudo completar la descarga</h3></div>
          <p className="sheet-text">{errMsg}</p>
          <div className="sheet-actions">
            <GlassButton onClick={() => setOpen(false)}>Cerrar</GlassButton>
            <GlassButton variant="filled" tint="var(--orbit-accent)" onClick={startDownload}>Reintentar</GlassButton>
          </div>
        </>
      )}
    </GlassSheet>
  );
}
