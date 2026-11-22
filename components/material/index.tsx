'use client';

/* Envoltorios React para los componentes OFICIALES de Google (@material/web).
   Son web components Lit: aquí se puentean los eventos (input/change) y el
   valor controlado, y se declaran las etiquetas para TypeScript (material.d.ts).
   Solo se importan los módulos que Orbit usa (producción oficial por variante). */

import * as React from 'react';

// Registro oficial de componentes (efectos de lado): botones en sus variantes,
// icon-buttons, campos de texto, switch y slider.
import '@material/web/button/filled-button.js';
import '@material/web/button/filled-tonal-button.js';
import '@material/web/button/text-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/elevated-button.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/iconbutton/filled-icon-button.js';
import '@material/web/iconbutton/filled-tonal-icon-button.js';
import '@material/web/iconbutton/outlined-icon-button.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/switch/switch.js';
import '@material/web/slider/slider.js';

/* ---------- Icono en slot oficial ---------- */
function IconSlot({ icon }: { icon?: React.ReactNode }) {
  if (icon == null) return null;
  return <span slot="icon" className="md-slot-icon">{icon}</span>;
}

/* ---------- Button ---------- */
export type MdVariant = 'filled' | 'tonal' | 'text' | 'outlined' | 'elevated';
const BTN_TAG: Record<MdVariant, string> = {
  filled: 'md-filled-button',
  tonal: 'md-filled-tonal-button',
  text: 'md-text-button',
  outlined: 'md-outlined-button',
  elevated: 'md-elevated-button',
};

export interface MdButtonProps {
  variant?: MdVariant;
  icon?: React.ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit';
  href?: string;
  target?: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  'aria-label'?: string;
}

export function MdButton({ variant = 'filled', icon, disabled, type = 'button', href, target, title, className, style, onClick, children, 'aria-label': ariaLabel }: MdButtonProps) {
  const Tag = BTN_TAG[variant] as React.ElementType;
  /* stopPropagation: si el click llega a document, el diálogo que ESTE click
     abre lo interpretaría como «click outside» y se cerraría al instante. */
  const guarded = (e: React.MouseEvent) => { e.stopPropagation(); onClick?.(e); };
  return (
    <Tag
      className={className} style={style} onClick={guarded} disabled={disabled}
      type={href ? undefined : type} href={href} target={target} title={title}
      aria-label={ariaLabel} data-orbit-md="1"
    >
      <IconSlot icon={icon} />
      {children}
    </Tag>
  );
}

/* ---------- IconButton ---------- */
export interface MdIconButtonProps {
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
  disabled?: boolean;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  'aria-label'?: string;
}
const ICO_TAG: Record<string, string> = {
  standard: 'md-icon-button',
  filled: 'md-filled-icon-button',
  tonal: 'md-filled-tonal-icon-button',
  outlined: 'md-outlined-icon-button',
};

export function MdIconButton({ variant = 'standard', disabled, title, className, style, onClick, children, 'aria-label': ariaLabel }: MdIconButtonProps) {
  const Tag = ICO_TAG[variant] as React.ElementType;
  const guarded = (e: React.MouseEvent) => { e.stopPropagation(); onClick?.(e); };
  return (
    <Tag className={className} style={style} onClick={guarded} disabled={disabled}
      title={title} aria-label={ariaLabel} data-orbit-md="1">
      <span slot="icon" className="md-slot-icon">{children}</span>
    </Tag>
  );
}

/* ---------- TextField (outlined, oficial) ---------- */
export interface MdTextFieldProps {
  label?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  leadingIcon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onChange?: (e: { target: { value: string } }) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
  'aria-label'?: string;
}

export function MdTextField({ label, type = 'text', placeholder, value, disabled, leadingIcon, className, style, onChange, onBlur, onKeyDown, onFocus, 'aria-label': ariaLabel }: MdTextFieldProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const cb = React.useRef(onChange);
  cb.current = onChange;
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = (e: Event) => { cb.current?.({ target: { value: (el as unknown as { value: string }).value } }); };
    el.addEventListener('input', h);
    return () => el.removeEventListener('input', h);
  }, []);
  return (
    <md-outlined-text-field
      ref={ref}
      className={className} style={style}
      label={label} type={type} placeholder={placeholder} value={value}
      disabled={disabled} aria-label={ariaLabel} data-orbit-md="1"
      onFocus={() => onFocus?.()} onBlur={() => onBlur?.()} onKeyDown={onKeyDown as never}
    >
      {leadingIcon ? <span slot="leading-icon" className="md-slot-icon">{leadingIcon}</span> : null}
    </md-outlined-text-field>
  );
}

/* ---------- Switch (oficial) ---------- */
export interface MdSwitchProps {
  checked: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  onCheckedChange?: (v: boolean) => void;
}

export function MdSwitch({ checked, disabled, className, style, 'aria-label': ariaLabel, onCheckedChange }: MdSwitchProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const cb = React.useRef(onCheckedChange);
  cb.current = onCheckedChange;
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = () => { cb.current?.((el as unknown as { checked: boolean }).checked); };
    el.addEventListener('change', h);
    return () => el.removeEventListener('change', h);
  }, []);
  return (
    <md-switch
      ref={ref} className={className} style={style}
      checked={checked} disabled={disabled} aria-label={ariaLabel}
      data-orbit-md="1" icons
    />
  );
}

/* ---------- Slider (oficial) ---------- */
export interface MdSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  onValueChange?: (v: number) => void;
}

export function MdSlider({ value, min, max, step, disabled, className, style, 'aria-label': ariaLabel, onValueChange }: MdSliderProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const cb = React.useRef(onValueChange);
  cb.current = onValueChange;
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = () => { cb.current?.((el as unknown as { value: number }).value); };
    el.addEventListener('input', h);
    return () => el.removeEventListener('input', h);
  }, []);
  return (
    <md-slider
      ref={ref} className={className} style={style}
      value={value} min={min} max={max} step={step} disabled={disabled}
      aria-label={ariaLabel} data-orbit-md="1"
    />
  );
}
