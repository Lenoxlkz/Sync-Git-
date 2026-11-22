// Genera la paleta M3 Expressive (claro + oscuro) de Orbit con el algoritmo
// oficial de Google (material-color-utilities, HCT · SchemeVibrant) y escribe
// app/expressive-colors.css con TODOS los roles de color.
// Semilla violeta Orbit — más expresiva que el azul #0a84ff anterior.
// Nota: usa la copia /tmp/mcu con extensiones ESM corregidas (scripts/fix-mcu-esm.js);
// el paquete de node_modules no se toca (Next resuelve sus imports sin problema).
const fs = require('fs');
const {
  argbFromHex, hexFromArgb, SchemeVibrant, Hct,
} = require('/tmp/mcu/index.js');

const SEED = '#7C5CFF';
const seedHct = Hct.fromInt(argbFromHex(SEED));

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

const light = new SchemeVibrant(seedHct, false, 0);
const dark = new SchemeVibrant(seedHct, true, 0);

const kebab = (r) => r.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
const val = (s, r) => hexFromArgb(s[r]);

/* Contenedores tonales afinados al estilo de las referencias: en oscuro,
   superficies casi negras con tinte del seed y capas bien marcadas; en claro,
   blancos con tinte suave. Esto es lo que da el aspecto "expresivo". */
const darkTuned = {
  surface: '#0b0912',
  surfaceDim: '#0b0912',
  surfaceBright: '#3b3750',
  surfaceContainerLowest: '#060509',
  surfaceContainerLow: '#181522',
  surfaceContainer: '#1d1a2b',
  surfaceContainerHigh: '#282438',
  surfaceContainerHighest: '#332f45',
};
const lightTuned = {
  surface: '#fcf9ff',
  surfaceDim: '#dcd9e4',
  surfaceBright: '#fcf9ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f6f2fa',
  surfaceContainer: '#f0ecf5',
  surfaceContainerHigh: '#eae6f0',
  surfaceContainerHighest: '#e4e1ea',
};

function block(selector, s, tuned) {
  const lines = ROLES.map((r) => `  --ex-color-${kebab(r)}: ${tuned[r] || val(s, r)};`);
  return `${selector} {\n${lines.join('\n')}\n}\n`;
}

const css = `/* Paleta M3 Expressive de Orbit — generada con material-color-utilities
   (algoritmo oficial de Google, HCT) · SchemeVibrant · semilla ${SEED}.
   Contenedores tonales afinados al estilo de las referencias (capas visibles).
   Este archivo SOLO sobreescribe los roles de color de expressive.css (se importa
   después) y alimenta también los tokens --md-sys-color-* que consumen los
   componentes OFICIALES de @material/web. Regenerar: node scripts/fix-mcu-esm.js && node scripts/gen-m3-colors.js */
${block(':root', light, lightTuned)}
.dark {
${ROLES.map((r) => `  --ex-color-${kebab(r)}: ${val(dark, r)};`).join('\n')}
${ROLES.filter((r) => darkTuned[r]).map((r) => `  --ex-color-${kebab(r)}: ${darkTuned[r]};`).join('\n')}
}

/* ---- Tokens oficiales --md-sys-color-* (los consumen los md-* de @material/web) ---- */
:root {
${ROLES.map((r) => `  --md-sys-color-${kebab(r)}: ${val(light, r)};`).join('\n')}
}
.dark {
${ROLES.map((r) => `  --md-sys-color-${kebab(r)}: ${val(dark, r)};`).join('\n')}
}
`;

fs.writeFileSync('app/expressive-colors.css', css);
console.log('app/expressive-colors.css OK — seed', SEED, '· SchemeVibrant');
console.log('oscuro · primary', val(dark, 'primary'), '· primaryContainer', val(dark, 'primaryContainer'), '· secondaryContainer', val(dark, 'secondaryContainer'), '· outline', val(dark, 'outline'));
console.log('claro  · primary', val(light, 'primary'), '· primaryContainer', val(light, 'primaryContainer'), '· secondaryContainer', val(light, 'secondaryContainer'));
