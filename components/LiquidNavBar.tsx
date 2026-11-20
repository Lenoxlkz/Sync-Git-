'use client';

/* Barra de navegación Liquid Glass propia: píldora esmerilada con una «gota»
   líquida que se desliza bajo el icono activo y lo tiñe con el acento.
   Reemplaza a GlassNav (cuya lente interna se desalineaba a partir del 4º
   icono cuando el track se comprime): aquí la geometría de la gota es CSS
   puro (variables --lnav-i / --lnav-n), idéntica para todos los iconos. */

export interface LiquidNavItem { label: string; icon: React.ReactNode }

export function LiquidNavBar({ items, activeIndex, onChange, ariaLabel }: {
  items: LiquidNavItem[];
  activeIndex: number;
  onChange: (i: number) => void;
  ariaLabel?: string;
}) {
  const n = Math.max(1, items.length);
  const safe = Math.max(0, Math.min(n - 1, activeIndex));
  return (
    <div className="lnav" role="tablist" aria-label={ariaLabel} style={{ '--lnav-n': n } as React.CSSProperties}>
      <span className="lnav-drop" aria-hidden="true" style={{ '--lnav-i': safe } as React.CSSProperties} />
      {items.map((it, i) => (
        <button
          key={it.label}
          type="button"
          role="tab"
          aria-selected={i === safe}
          aria-label={it.label}
          title={it.label}
          className={`lnav-item${i === safe ? ' on' : ''}`}
          onClick={() => onChange(i)}
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}
