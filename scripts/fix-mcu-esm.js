// Fix ESM extension-less imports en la copia de material-color-utilities (/tmp/mcu)
// y prueba de generación del esquema vibrante. El paquete real (node_modules) no se toca.
const fs = require('fs');
const path = require('path');

const ROOT = '/tmp/mcu';

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}

let n = 0;
for (const file of walk(ROOT)) {
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  // import X from './a/b' → './a/b.js'  (también ../)
  s = s.replace(/from '(\.[^']*?)'/g, (m, p1) => (/\.js$/.test(p1) ? m : `from '${p1}.js'`));
  s = s.replace(/from "(\.[^"]*?)"/g, (m, p1) => (/\.js$/.test(p1) ? m : `from "${p1}.js"`));
  if (s !== before) { fs.writeFileSync(file, s); n++; }
}
console.log('archivos parcheados:', n);

const { SchemeVibrant, argbFromHex, hexFromArgb } = require(ROOT + '/index.js');
const d = new SchemeVibrant({ sourceColorArgb: argbFromHex('#7C5CFF'), dark: true, contrastLevel: 0 });
const l = new SchemeVibrant({ sourceColorArgb: argbFromHex('#7C5CFF'), dark: false, contrastLevel: 0 });
console.log('oscuro · primary', hexFromArgb(d.primary), '· surface', hexFromArgb(d.surface));
console.log('claro  · primary', hexFromArgb(l.primary), '· surface', hexFromArgb(l.surface));
