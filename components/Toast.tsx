'use client';

/* Toasts glass de Orbit con respuesta háptica (el háptico vive en el store). */
import { useOrbit, dismissToast } from '@/lib/store';
import { IcCheck, IcWarn, IcZap } from './Icons';

export function ToastStack() {
  const { toasts } = useOrbit();
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast t-${t.type}`} onClick={() => dismissToast(t.id)}>
          <span className="toast-ico">
            {t.type === 'ok' ? <IcCheck size={15} /> : t.type === 'err' ? <IcWarn size={15} /> : <IcZap size={15} />}
          </span>
          <span className="toast-body">
            <b>{t.msg}</b>
            {t.sub ? <small>{t.sub}</small> : null}
          </span>
        </div>
      ))}
    </div>
  );
}
