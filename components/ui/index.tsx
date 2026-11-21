'use client';

/* Capa adaptadora de motores visuales de Orbit Next.
   Según el motor elegido (prefs.themeEngine + detección por User-Agent),
   cada pieza de UI se resuelve con:
   · 'glass'      → componentes Liquid Glass del vendor (@zakisheriff/liquid-glass).
   · 'expressive' → Material 3 Expressive (@grenishrai/expressive, Tailwind v4,
                    scheme fluid + engine motion) — tema de bajo consumo:
                    sin backdrop-filter ni filtros SVG de refracción.
   Las páginas importan App* con alias Glass* (p. ej. `AppButton as GlassButton`),
   así el JSX de toda la app no cambia y los motores son intercambiables. */
import { createContext, useContext } from 'react';
import {
  GlassButton, GlassInput, GlassSwitch, GlassCard, GlassSheet, GlassSegmented, GlassSlider, GlassNav,
} from '@zakisheriff/liquid-glass';
import { Button as ExButton } from '@/components/expressive/button';
import { IconButton as ExIconButton } from '@/components/expressive/icon-button';
import { Card as ExCard } from '@/components/expressive/card';
import { Dialog, DialogContent } from '@/components/expressive/dialog';
import { Switch as ExSwitch } from '@/components/expressive/switch';
import { Slider as ExSlider } from '@/components/expressive/slider';
import { TextField as ExTextField } from '@/components/expressive/text-field';
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
  /* Material: glass→tonal · tinted/filled→filled · clear→text; destructive→error */
  const v = variant === 'filled' || variant === 'tinted' ? 'filled' : variant === 'clear' ? 'text' : 'tonal';
  const err = destructive ? ' bg-error text-on-error' : '';
  const sz = size === 'sm' ? 'xs' : 'sm';
  const iconOnly = icon != null && children == null;
  if (iconOnly) {
    return (
      <ExIconButton variant={v === 'text' ? 'standard' : v} size={sz} aria-label={(ariaLabel || '') as string}
        disabled={disabled} onClick={onClick} type={type} title={title}
        render={href ? <a href={href} target={target} rel='noreferrer' /> : undefined}
        className={(className || '') + err} style={style}>
        {icon}
      </ExIconButton>
    );
  }
  return (
    <ExButton variant={v} size={sz} icon={icon} aria-label={ariaLabel} disabled={disabled}
      onClick={onClick} type={type} title={title}
      render={href ? <a href={href} target={target} rel='noreferrer' /> : undefined}
      className={(className || '') + err} style={style}>
      {children}
    </ExButton>
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
  /* Material: campo con etiqueta flotante; la etiqueta es el aria-label de la app */
  return (
    <ExTextField
      label={label || ariaLabel || placeholder || 'Campo'}
      variant="filled"
      leadingIcon={icon}
      type={type} placeholder={placeholder} value={value} onChange={onChange} onBlur={onBlur}
      onKeyDown={onKeyDown} onFocus={onFocus} disabled={disabled}
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
  return <ExSwitch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={ariaLabel} />;
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
  /* Material: diálogo centrado (los detents no aplican en Material 3) */
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
  return <ExSlider value={value} onValueChange={v => onChange(Array.isArray(v) ? v[0] : v)} min={min} max={max} step={step} thumbLabels={ariaLabel ? [ariaLabel] : undefined} aria-label={ariaLabel} />;
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
