// Genera la paleta M3 Expressive de Orbit con el algoritmo oficial de Google
// (material-color-utilities, HCT · SchemeVibrant) para TODOS los acentos del
// picker de Liquid Glass + un modo AMOLED nocturno cálido compartido.
// Escribe app/expressive-colors.css con:
//   1) Bloque base (:root y .dark) — semilla violeta Orbit (fallback).
//   2) html[data-accent="k"] y html[data-accent="k"].dark — 7 acentos × 2 esquemas,
//      alimentando --ex-color-* (componentes shell) y --md-sys-color-* (md-* oficiales).
//   3) html[data-amoled="1"] (+ .dark) — noche negra con naranja/dorado/rojo vibrantes,
//      válida para AMBOS motores (también pisa las variables legacy de Liquid Glass).
// Requisito previo: node scripts/fix-mcu-esm.js (copia /tmp/mcu con extensiones ESM).
const fs = require('fs');
const {
  argbFromHex, hexFromArgb, SchemeVibrant, Hct,
} = require('/tmp/mcu/index.js');

/* Acentos oficiales del picker (lib/store.tsx ACCENTS) — en el mismo orden */
const ACCENTS = [
  ['azul', '#0a84ff'],
  ['indigo', '#5e5ce6'],
  ['violeta', '#bf5af2'],
  ['rosa', '#ff375f'],
  ['ambar', '#ff9f0a'],
  ['verde', '#30d158'],
  ['cian', '#40cbe0'],
];
const DEFAULT_SEED = '#7C5CFF'; // fallback si el acento no está en la lista

const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'primaryFixed', 'primaryFixedDim', 'onPrimaryFixed', 'onPrimaryFixedVariant', 'inversePrimary',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'secondaryFixed', 'secondaryFixedDim', 'onSecondaryFixed', 'onSecondaryFixedVariant',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'tertiaryFixed', 'tertiaryFixedDim', 'onTertiaryFixed', 'onTertiaryFixedVariant',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'background', 'onBackground',
  'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
  'surfaceDim', 'surfaceBright',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer',
  'surfaceContainerHigh', 'surfaceContainerHighest',
  'outline', 'outlineVariant', 'shadow', 'scrim',
  'inverseSurface', 'inverseOnSurface',
];

const kebab = (r) => r.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
/* Acepta un Hct (tiene .toInt()) o directamente el número ARGB del rol */
const hx = (v) => hexFromArgb(typeof v === 'number' ? v : v.toInt());

/* Superficies «tinted» por semilla: hue del acento, croma/tone controlados.
   Es lo que da las capas tonales visibles estilo M3 Expressive. */
function darkSurfaces(hue) {
  const f = (c, t) => hx(Hct.from(hue, c, t));
  return {
    surface: f(14, 5), surfaceDim: f(14, 4), surfaceBright: f(16, 24),
    surfaceContainerLowest: f(10, 3), surfaceContainerLow: f(16, 8),
    surfaceContainer: f(18, 12), surfaceContainerHigh: f(20, 16),
    surfaceContainerHighest: f(22, 22),
  };
}
function lightSurfaces(hue) {
  const f = (c, t) => hx(Hct.from(hue, c, t));
  return {
    surface: f(8, 99), surfaceDim: f(10, 90), surfaceBright: f(8, 100),
    surfaceContainerLowest: '#ffffff', surfaceContainerLow: f(9, 97),
    surfaceContainer: f(10, 94), surfaceContainerHigh: f(10, 92),
    surfaceContainerHighest: f(11, 90),
  };
}

function scheme(seedHex, dark) {
  const hct = Hct.fromInt(argbFromHex(seedHex));
  return { s: new SchemeVibrant(hct, dark, 0), hue: hct.hue };
}

function blockBody(schemeObj, tuned) {
  return ROLES.map((r) => {
    const v = tuned[r] || hx(schemeObj[r]);
    return `  --ex-color-${kebab(r)}: ${v};\n  --md-sys-color-${kebab(r)}: ${v};`;
  }).join('\n');
}

function emit(selLight, selDark, seedHex) {
  const l = scheme(seedHex, false);
  const d = scheme(seedHex, true);
  return `${selLight} {\n${blockBody(l.s, lightSurfaces(l.hue))}\n}\n${selDark} {\n${blockBody(d.s, darkSurfaces(d.hue))}\n}\n`;
}

/* ---------- AMOLED: noche negra con naranja/dorado/rojo vibrantes ---------- */
function amoledRoles() {
  const naranja = Hct.from(62, 105, 78);   // primary: naranja vivo (#ffb064)
  const dorado = Hct.from(75, 90, 82);     // secondary: dorado
  const rojo = Hct.from(15, 100, 74);      // tertiary: rojo-coral
  const warm = (hue, c, t) => hx(Hct.from(hue, c, t));
  const roles = {
    primary: hx(naranja), onPrimary: '#2b1600',
    primaryContainer: warm(45, 90, 38), onPrimaryContainer: hx(Hct.from(34, 90, 95)),
    primaryFixed: hx(Hct.from(34, 90, 95)), primaryFixedDim: hx(naranja),
    onPrimaryFixed: '#2b1600', onPrimaryFixedVariant: warm(45, 80, 55),
    inversePrimary: warm(45, 80, 40),
    secondary: hx(dorado), onSecondary: '#2e2200',
    secondaryContainer: warm(60, 70, 34), onSecondaryContainer: hx(Hct.from(60, 70, 94)),
    secondaryFixed: hx(Hct.from(60, 70, 94)), secondaryFixedDim: hx(dorado),
    onSecondaryFixed: '#2e2200', onSecondaryFixedVariant: warm(60, 60, 62),
    tertiary: hx(rojo), onTertiary: '#3d0800',
    tertiaryContainer: warm(18, 90, 36), onTertiaryContainer: hx(Hct.from(18, 90, 94)),
    tertiaryFixed: hx(Hct.from(18, 90, 94)), tertiaryFixedDim: hx(rojo),
    onTertiaryFixed: '#3d0800', onTertiaryFixedVariant: warm(18, 80, 66),
    error: '#ffb4ab', onError: '#650903',
    errorContainer: warm(10, 90, 34), onErrorContainer: hx(Hct.from(10, 90, 95)),
    background: '#000000', onBackground: warm(45, 10, 94),
    onSurface: warm(45, 10, 94), surfaceVariant: warm(45, 18, 20),
    onSurfaceVariant: warm(45, 14, 76),
    surface: '#000000', surfaceDim: '#000000', surfaceBright: warm(45, 12, 26),
    surfaceContainerLowest: '#070503', surfaceContainerLow: warm(45, 14, 10),
    surfaceContainer: warm(45, 16, 14), surfaceContainerHigh: warm(45, 18, 20),
    surfaceContainerHighest: warm(45, 20, 27),
    outline: warm(45, 40, 42), outlineVariant: warm(45, 30, 26),
    shadow: '#000000', scrim: '#000000',
    inverseSurface: hx(naranja), inverseOnSurface: '#1c1106',
  };
  return roles;
}

const amoledBody = ROLES.map((r) => {
  const v = amoledRoles()[r];
  return `  --ex-color-${kebab(r)}: ${v};\n  --md-sys-color-${kebab(r)}: ${v};`;
}).join('\n');

const css = `/* Paleta M3 Expressive de Orbit — generada con material-color-utilities
   (algoritmo oficial de Google, HCT · SchemeVibrant).
   · Bloque base: semilla violeta Orbit (fallback).
   · html[data-accent="k"]: los 7 acentos del picker de Liquid Glass, en claro
     y oscuro, para --ex-color-* (shell) y --md-sys-color-* (md-* oficiales).
   · html[data-amoled="1"]: noche AMOLED negra con naranja/dorado/rojo
     vibrantes — válida para AMBOS motores (también pisa las variables legacy
     de Liquid Glass). El toggle «Reducir movimiento» la activa.
   Regenerar: node scripts/fix-mcu-esm.js && node scripts/gen-m3-colors.js */

${emit(':root', '.dark', DEFAULT_SEED)}
${ACCENTS.map(([k, hex]) => emit(`html[data-accent="${k}"]`, `html[data-accent="${k}"].dark`, hex)).join('\n')}

/* ================= AMOLED nocturno cálido (ambos motores) ================= */
html[data-amoled="1"],
html[data-amoled="1"].dark {
${amoledBody}
}

/* Variables legacy de Liquid Glass en AMOLED: superficie negra, bordes y
   textos cálidos, acento naranja vibrante */
html[data-amoled="1"] {
  --bg: #000000;
  --bg-grad: none;
  --text: #fff3e8;
  --text-2: rgba(255, 214, 178, .72);
  --text-3: rgba(255, 214, 178, .45);
  --border: rgba(255, 150, 70, .22);
  --surface: rgba(255, 140, 60, .055);
  --surface-2: rgba(255, 140, 60, .105);
  --orbit-accent: var(--ex-color-primary);
  color-scheme: dark;
}
html[data-amoled="1"] body { background: #000 }
html[data-amoled="1"] body::before { content: none }
html[data-amoled="1"] #aurora { display: none }
`;

fs.writeFileSync('app/expressive-colors.css', css);
const lines = css.split('\n').length;
console.log(`app/expressive-colors.css OK — ${ACCENTS.length} acentos × claro/oscuro + AMOLED (${lines} líneas)`);
for (const [k, hex] of ACCENTS) {
  const d = scheme(hex, true).s;
  const l = scheme(hex, false).s;
  console.log(`  ${k.padEnd(8)} oscuro: primary ${hexFromArgb(d.primary)} · claro: primary ${hexFromArgb(l.primary)}`);
}
const a = amoledRoles();
console.log('  AMOLED   primary', a.primary, '· secondary', a.secondary, '· tertiary', a.tertiary, '· surface', a.surface);
