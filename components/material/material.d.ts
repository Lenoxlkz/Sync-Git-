/* Declaraciones para las etiquetas oficiales de @material/web usadas por Orbit.
   React 19 define el namespace JSX dentro del módulo 'react': aquí se aumenta. */
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type MdProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>;

type MdTags =
  | 'md-filled-button' | 'md-filled-tonal-button' | 'md-text-button' | 'md-outlined-button' | 'md-elevated-button'
  | 'md-icon-button' | 'md-filled-icon-button' | 'md-filled-tonal-icon-button' | 'md-outlined-icon-button'
  | 'md-outlined-text-field' | 'md-filled-text-field'
  | 'md-switch' | 'md-slider' | 'md-linear-progress';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-filled-button': MdProps;
      'md-filled-tonal-button': MdProps;
      'md-text-button': MdProps;
      'md-outlined-button': MdProps;
      'md-elevated-button': MdProps;
      'md-icon-button': MdProps;
      'md-filled-icon-button': MdProps;
      'md-filled-tonal-icon-button': MdProps;
      'md-outlined-icon-button': MdProps;
      'md-outlined-text-field': MdProps;
      'md-filled-text-field': MdProps;
      'md-switch': MdProps;
      'md-slider': MdProps;
      'md-linear-progress': MdProps;
    }
  }
}

// El runtime de JSX (jsx-runtime) usa React.JSX vía referencia; la ampliación
// en 'react' cubre los dos modos (tsc y next).
export {};
