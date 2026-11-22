'use client';

/* Zero Trust para Orbit Next: redacción de secretos, detección de archivos
   sensibles y validación de rutas. Puerto de la capa SEGURIDAD del original. */

/* Tokens y claves que NUNCA deben aparecer en pantalla ni en registros */
export const SECRET_PAT = new RegExp([
  '\\bgh[pousr]_[A-Za-z0-9]{6}[A-Za-z0-9_-]*',
  '\\bgithub_pat_[A-Za-z0-9]{6}[A-Za-z0-9_]*',
  '\\bsk-[A-Za-z0-9_-]{10,}',
  '\\bAIza[A-Za-z0-9_-]{6}[A-Za-z0-9_-]*',
  '\\bxox[bpoas]-[A-Za-z0-9-]+',
  '\\bAKIA[0-9A-Z]{8}[0-9A-Z]*',
  '-----BEGIN [A-Z ]+PRIVATE KEY-----',
].join('|'), 'g');

/** Recorta el inicio de cualquier secreto y lo marca como redactado. */
export function redact(s: string | null | undefined): string {
  return String(s == null ? '' : s).replace(SECRET_PAT, m => m.slice(0, Math.min(8, m.length)) + '…[redactado]');
}

/* Archivos que suelen contener credenciales: se excluyen por defecto al subir */
export const SECRET_FILE_RE = /(^|\/)(\.env(\..*)?|[^/]*\.env|.*\.pem|.*\.key|id_rsa.*|id_ecdsa.*|id_ed25519.*|credentials.*|\.npmrc|\.netrc|\.htpasswd|secrets?(\..*)?|.*\.(p12|pfx|kdbx|jks|keystore))$/i;

export const BIN_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'bmp', 'pdf', 'zip', 'gz', 'tar', 'rar', '7z',
  'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp3', 'wav', 'ogg', 'mp4', 'mov', 'webm', 'exe', 'dll', 'so',
  'dylib', 'class', 'jar', 'bin', 'dat', 'db', 'sqlite', 'pyc', 'wasm',
]);

export const isBinPath = (p: string) => BIN_EXT.has((p.split('.').pop() || '').toLowerCase());
export const isGitPath = (p: string) => p.split('/').includes('.git');
export const isSecretPath = (p: string) =>
  SECRET_FILE_RE.test(p.split('/').pop() || '') && !p.split('/').includes('.git');

/** Normalización de rutas: barras rectas, sin «..», sin segmentos vacíos. */
export function normPath(p: string): string {
  if (typeof p !== 'string') return '';
  const out: string[] = [];
  for (const seg of p.replace(/\\/g, '/').split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') return '';
    out.push(seg);
  }
  return out.join('/');
}

/** Auditoría en vivo: busca credenciales embebidas en el propio documento cargado. */
export function auditSecrets(): number {
  try {
    const src = document.documentElement.outerHTML;
    return (src.match(new RegExp(SECRET_PAT.source, 'g')) || []).length;
  } catch { return -1; }
}

/* Validación estricta de datos externos */
export const V = {
  str: (x: unknown, max = 400): string => typeof x === 'string' ? x.slice(0, max) : '',
  num: (x: unknown, d = 0): number => { const n = Number(x); return Number.isFinite(n) ? n : d; },
  repo: (r: unknown): string | null =>
    typeof r === 'string' && /^[\w.\-]{1,100}\/[\w.\-]{1,100}$/.test(r) ? r : null,
  path: (p: unknown): string | null =>
    typeof p === 'string' && p.length > 0 && p.length < 4096 && !p.includes('..') && !p.startsWith('/') && !p.includes('\\') ? p : null,
  sha: (s: unknown): string | null =>
    typeof s === 'string' && /^[0-9a-f]{40}$/i.test(s) ? s.toLowerCase() : null,
};

/** SHA-1 de blob Git a partir de texto (verificación de integridad al leer archivos). */
export async function textBlobSha(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const pre = new TextEncoder().encode(`blob ${data.length}\0`);
  const buf = new Uint8Array(pre.length + data.length);
  buf.set(pre); buf.set(data, pre.length);
  const h = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
