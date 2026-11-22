'use client';

/* Composer del chat compartido por ambos motores.
   · Área de texto multilínea: Enter (PC y móvil) salta a la siguiente línea;
     el envío es explícito con el botón «Enviar».
   · Botón de expandir: agranda el espacio de escritura hacia arriba (panorama)
     con tope de altura y scroll interno — nunca desborda la pantalla.
   · Límite duro de 4000 caracteres por mensaje, con contador visible. */
import { useEffect, useRef, useState } from 'react';
import { AppButton, useEngine } from './ui';
import { IcSend, IcExpand, IcCollapse } from './Icons';

export const CHAT_MAX = 4000;
const H_MAX_NORMAL = 132;   // px — crecimiento automático sin expandir
const H_MAX_BIG = 280;      // px — con el espacio expandido

export function ChatComposer({ value, onChange, onSend, busy, placeholder }: {
  value: string; onChange: (v: string) => void; onSend: () => void;
  busy: boolean; placeholder: string;
}) {
  const eng = useEngine();
  const [expanded, setExpanded] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  /* auto-crecimiento con tope: lo que sobra se scrollea dentro del área */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const max = expanded ? H_MAX_BIG : H_MAX_NORMAL;
    ta.style.height = Math.min(ta.scrollHeight, max) + 'px';
  }, [value, expanded]);

  const count = value.length;
  const near = count > CHAT_MAX * 0.9;
  const full = count >= CHAT_MAX;

  return (
    <div className={`chat-composer${eng === 'expressive' ? ' ex' : ''}${expanded ? ' big' : ''}`}>
      <button
        type="button"
        className="cc-expand"
        onClick={() => setExpanded(v => !v)}
        aria-label={expanded ? 'Contraer espacio de escritura' : 'Expandir espacio de escritura'}
        title={expanded ? 'Contraer' : 'Expandir'}
      >
        {expanded ? <IcCollapse size={18} /> : <IcExpand size={18} />}
      </button>
      <div className="cc-box">
        <textarea
          ref={taRef}
          value={value}
          maxLength={CHAT_MAX}
          rows={1}
          /* Enter salta de línea (comportamiento nativo del textarea, PC y móvil);
             el mensaje se envía con el botón, nunca con la tecla */
          placeholder={placeholder}
          aria-label="Mensaje"
          enterKeyHint="enter"
          onChange={e => onChange(e.target.value.slice(0, CHAT_MAX))}
        />
        <div className="cc-meta">
          <span className={`cc-count${near ? (full ? ' err' : ' warn') : ''}`}>{count}/{CHAT_MAX}</span>
        </div>
      </div>
      <AppButton
        variant="filled"
        tint="var(--orbit-accent)"
        icon={<IcSend size={16} />}
        aria-label="Enviar"
        disabled={busy || !value.trim()}
        onClick={onSend}
      />
    </div>
  );
}
