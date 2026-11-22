'use client';

/* Capa adaptadora de motores visuales de Orbit Next.
   Según el motor elegido (prefs.themeEngine + detección por User-Agent),
   cada pieza de UI se resuelve con:
   · 'glass'      → componentes Liquid Glass del vendor (@zakisheriff/liquid-glass).
   · 'expressive' → Material 3 Expressive con la LIBRERÍA OFICIAL de Google
                    (@material/web v2.5, web components Lit) + paleta vibrante
                    generada con material-color-utilities (HCT, SchemeVibrant).
                    Tema de bajo consumo: sin backdrop-filter ni filtros SVG.
   Las páginas importan App* con alias Glass* (p. ej. `AppButton as GlassButton`),
   así el JSX de toda la app no cambia y los motores son intercambiables. */
import { createContext, useContext } from 'react';
import {
  GlassButton, GlassInput, GlassSwitch, GlassCard, GlassSheet, GlassSegmented, GlassSlider, GlassNav,
} from '@zakisheriff/liquid-glass';
import {
  MdButton, MdIconButton, MdTextField, MdSwitch, MdSlider,
} from '@/components/material';
import { Card as ExCard } from '@/components/expressive/card';
import { Dialog, DialogContent } from '@/components/expressive/dialog';
import {
  NavigationBar as ExNavBar, NavigationBarItem as ExNavBarItem,
} from '@/components/expressive/navigation-bar';

export type Engine = 'glass' | 'expressive';
const EngineCtx = createContext<Engine>('glass');
export const EngineProvider = EngineCtx.Provider;
export const useEngine = (): Engine => useContext(EngineCtx);

/* ---------- Button ---------- */
export interface AppButtonProps {
  variant?: 'glass' | 'clear' | 'tinted' | 'filled';
  size?: 'sm' | 'md';
  tint?: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  href?: string;
  target?: string;
  download?: boolean | string;
  title?: string;
  'aria-label'?: string;
}

/* Material oficial: glass→tonal · tinted/filled→filled · clear→text.
   destructive→tokens de error oficiales del componente. */
export function AppButton({ variant = 'glass', size = 'md', tint, icon, destructive, children, className, style, onClick, disabled, type = 'button', href, target, download, title, 'aria-label': ariaLabel }: AppButtonProps) {
  const eng = useEngine();
  if (eng === 'glass') {
    return (
      <GlassButton variant={variant} size={size} tint={tint} icon={icon} destructive={destructive}
        className={className} style={style} onClick={onClick} disabled={disabled} type={type}
        href={href} target={target} title={title} aria-label={ariaLabel}>
        {children}
      </GlassButton>
    );
  }
  const v = variant === 'filled' || variant === 'tinted' ? 'filled' : variant === 'clear' ? 'text' : 'tonal';
  const err = destructive ? {
    ['--md-filled-button-container-color' as never]: 'var(--ex-color-error)',
    ['--md-filled-button-label-text-color' as never]: 'var(--ex-color-on-error)',
  } as React.CSSProperties : undefined;
  if (icon != null && children == null) {
    return (
      <MdIconButton variant={v === 'text' ? 'standard' : v} aria-label={ariaLabel}
        disabled={disabled} onClick={onClick} title={title}
        className={className} style={{ ...style, ...err }}>
        {icon}
      </MdIconButton>
    );
  }
  return (
    <MdButton variant={v} icon={icon} aria-label={ariaLabel} disabled={disabled}
      onClick={onClick} type={type} title={title} href={href} target={target}
      className={className} style={{ ...style, ...err }}>
      {children}
    </MdButton>
  );
}

/* ---------- Input ---------- */
export interface AppInputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  tint?: string;
  'aria-label'?: string;
}
export function AppInput({ type = 'text', placeholder, value, onChange, onBlur, onKeyDown, onFocus, icon, label, className, style, disabled, tint, 'aria-label': ariaLabel }: AppInputProps) {
  const eng = useEngine();
  if (eng === 'glass') {
    return (
      <GlassInput type={type} placeholder={placeholder} value={value} onChange={onChange} onBlur={onBlur}
        onKeyDown={onKeyDown} onFocus={onFocus} icon={icon} label={label} className={className} style={style}
        disabled={disabled} tint={tint} aria-label={ariaLabel} />
    );
  }
  /* md-outlined-text-field oficial; el evento input real se puentea en el wrapper */
  return (
    <MdTextField
      label={label || ariaLabel || placeholder || 'Campo'}
      type={type} placeholder={placeholder} value={value}
      leadingIcon={icon}
      onChange={onChange ? (e) => onChange(e as unknown as React.ChangeEvent<HTMLInputElement>) : undefined}
      onBlur={onBlur ? () => onBlur({ target: { value: value ?? '' } } as React.FocusEvent<HTMLInputElement>) : undefined}
      onFocus={onFocus ? () => onFocus({ target: { value: value ?? '' } } as React.FocusEvent<HTMLInputElement>) : undefined}
      onKeyDown={onKeyDown ? (e) => onKeyDown(e as unknown as React.KeyboardEvent<HTMLInputElement>) : undefined}
      disabled={disabled}
      className={className} style={style} aria-label={ariaLabel}
    />
  );
}

/* ---------- Switch ---------- */
export function AppSwitch({ checked, onChange, disabled, tint, 'aria-label': ariaLabel }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; tint?: string; 'aria-label'?: string;
}) {
  const eng = useEngine();
  if (eng === 'glass') {
    return <GlassSwitch checked={checked} onChange={onChange} disabled={disabled} tint={tint} aria-label={ariaLabel} />;
  }
  return <MdSwitch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={ariaLabel} />;
}

/* ---------- Card ---------- */
export function AppCard({ padding, className, style, children, onClick, 'aria-label': ariaLabel }: {
  padding?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode;
  onClick?: () => void; 'aria-label'?: string;
}) {
  const eng = useEngine();
  if (eng === 'glass') {
    return <GlassCard padding={padding} className={className} style={style} onClick={onClick} aria-label={ariaLabel}>{children}</GlassCard>;
  }
  return (
    <ExCard variant="filled" interactive={!!onClick} onClick={onClick} aria-label={ariaLabel}
      className={className} style={{ padding: padding || undefined, ...style }}>
      {children}
    </ExCard>
  );
}

/* ---------- Sheet (hoja inferior / modal) ---------- */
export function AppSheet({ open, onClose, detents, 'aria-label': ariaLabel, children }: {
  open: boolean; onClose?: () => void; detents?: Array<'medium' | 'large'>;
  'aria-label'?: string; children?: React.ReactNode;
}) {
  const eng = useEngine();
  if (eng === 'glass') {
    return <GlassSheet open={open} onClose={onClose} detents={detents} aria-label={ariaLabel}>{children}</GlassSheet>;
  }
  /* Shell propio estilo M3 (no hay bottom-sheet en @material/web); el interior
     (botones, campos, switches…) ya es oficial. */
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose?.(); }}>
      <DialogContent className="exp-sheet" aria-label={ariaLabel}>{children}</DialogContent>
    </Dialog>
  );
}

/* ---------- Segmented (filtros) ---------- */
export function AppSegmented({ options, value, onChange, size, 'aria-label': ariaLabel }: {
  options: Array<{ label: string; icon?: React.ReactNode }>; value: number; onChange: (i: number) => void;
  size?: 'sm' | 'md'; 'aria-label'?: string;
}) {
  const eng = useEngine();
  if (eng === 'glass') {
    return <GlassSegmented options={options} value={value} onChange={onChange} size={size} aria-label={ariaLabel} />;
  }
  return (
    <div className={`exp-seg${size === 'sm' ? ' exp-seg--sm' : ''}`} role="tablist" aria-label={ariaLabel}>
      {options.map((o, i) => (
        <button key={o.label + i} type="button" role="tab" aria-selected={i === value}
          className={i === value ? 'sel' : ''} onClick={() => onChange(i)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Slider ---------- */
export function AppSlider({ value, onChange, min, max, step, showThumb, icon, label, tint, 'aria-label': ariaLabel }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
  showThumb?: boolean; icon?: React.ReactNode; label?: string; tint?: string; 'aria-label'?: string;
}) {
  const eng = useEngine();
  if (eng === 'glass') {
    return <GlassSlider value={value} onChange={onChange} min={min} max={max} step={step} showThumb={showThumb} icon={icon} label={label} tint={tint} aria-label={ariaLabel} />;
  }
  return <MdSlider value={value} onValueChange={v => onChange(v)} min={min} max={max} step={step} aria-label={ariaLabel} />;
}

/* ---------- Nav (barra inferior) ---------- */
export function AppNav({ items, activeIndex, onChange, 'aria-label': ariaLabel }: {
  items: Array<{ label: string; icon: React.ReactNode }>; activeIndex: number;
  onChange: (i: number) => void; 'aria-label'?: string;
}) {
  const eng = useEngine();
  if (eng === 'glass') {
    return <GlassNav items={items} activeIndex={activeIndex} onChange={onChange} aria-label={ariaLabel} />;
  }
  return (
    <ExNavBar aria-label={ariaLabel} className="exp-navbar">
      {items.map((n, i) => (
        <ExNavBarItem
          key={n.label}
          render={<button type="button" onClick={() => onChange(i)} aria-label={n.label} />}
          icon={n.icon}
          label={n.label}
          active={i === activeIndex}
        />
      ))}
    </ExNavBar>
  );
}
