'use client';

/* Motor de código de Orbit: detección de lenguaje, resaltado ligero por
   tokenizer, árbol de rutas y diff de líneas (LCS) — puerto fiel del original. */

export type Lang = 'js' | 'json' | 'py' | 'html' | 'css' | 'sh' | 'md';

export function detectLang(path: string): Lang | null {
  const e = (path.split('.').pop() || '').toLowerCase();
  const map: Record<string, Lang> = {
    js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'js', tsx: 'js', swift: 'js', cpp: 'js', cc: 'js',
    h: 'js', c: 'js', java: 'js', kt: 'js', go: 'js', rs: 'js', rb: 'js', php: 'js', sql: 'js',
    json: 'json', py: 'py', html: 'html', htm: 'html', css: 'css', scss: 'css',
    md: 'md', markdown: 'md', sh: 'sh', bash: 'sh', yml: 'json', yaml: 'json',
  };
  return map[e] || null;
}

/* Reglas por lenguaje: [regex sticky, clase]. El orden importa. */
type Rule = [RegExp, string];

const LANG_RULES: Record<Lang, Rule[]> = {
  js: [
    [/\/\/.*|\/\*[\s\S]*?\*\//y, 'tk-c'],
    [/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/y, 'tk-s'],
    [/\b(?:const|let|var|function|return|if|else|for|while|do|class|extends|new|import|from|export|default|async|await|try|catch|finally|throw|switch|case|break|continue|typeof|instanceof|this|super|null|undefined|true|false|of|in|yield|static|delete|void|interface|type|enum|implements|readonly|public|private|protected|namespace|declare|abstract|as)\b/y, 'tk-k'],
    [/\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/y, 'tk-n'],
    [/\b[A-Za-z_$][\w$]*(?=\s*\()/y, 'tk-f'],
    [/[{}()[\].,;=+\-*/<>!&|?:%]+/y, 'tk-p'],
  ],
  json: [
    [/"(?:[^"\\]|\\.)*"(?=\s*:)/y, 'tk-p'],
    [/"(?:[^"\\]|\\.)*"/y, 'tk-s'],
    [/\b(?:true|false|null)\b/y, 'tk-k'],
    [/\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/y, 'tk-n'],
    [/[{}[\],:]/y, 'tk-p'],
  ],
  py: [
    [/#.*|'''[\s\S]*?'''|"""[\s\S]*"""/y, 'tk-c'],
    [/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/y, 'tk-s'],
    [/\b(?:def|class|import|from|as|if|elif|else|for|while|return|with|try|except|finally|lambda|None|True|False|and|or|not|in|is|self|pass|raise|yield|async|await|global|assert|del)\b/y, 'tk-k'],
    [/\b\d+(?:\.\d+)?\b/y, 'tk-n'],
    [/\b[A-Za-z_][\w]*(?=\s*\()/y, 'tk-f'],
  ],
  html: [
    [/<!--[\s\S]*?-->|<!doctype[^>]*>/iy, 'tk-c'],
    [/<\/?[a-zA-Z][\w-]*|\/?>/y, 'tk-t'],
    [/"(?:[^"\\]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y, 'tk-s'],
    [/\b[a-zA-Z-]+(?==)/y, 'tk-a'],
  ],
  css: [
    [/\/\*[\s\S]*?\*\//y, 'tk-c'],
    [/'(?:[^'\\\n]|\\.)*'|"(?:[^'\\\n]|\\.)*"/y, 'tk-s'],
    [/@[\w-]+/y, 'tk-k'],
    [/#[0-9a-fA-F]{3,8}\b/y, 'tk-n'],
    [/\b[a-zA-Z-]+(?=\s*:)/y, 'tk-p'],
    [/\b\d+(?:\.\d+)?(?:px|rem|em|%|s|ms|vh|vw|fr|deg)?\b/y, 'tk-n'],
    [/[{};:,]/y, 'tk-p'],
  ],
  sh: [
    [/#.*/y, 'tk-c'],
    [/'(?:[^'\\\n]|\\.)*'|"(?:[^'\\\n]|\\.)*"/y, 'tk-s'],
    [/\b(?:cd|ls|npm|pip|python|python3|node|git|cmake|make|echo|export|source|sudo|brew|apt|bun|deno)\b/y, 'tk-k'],
  ],
  md: [
    [/^#{1,6} .*$/my, 'tk-h'],
    [/```[\s\S]*?```/y, 'tk-s'],
    [/\*\*[^*]+\*\*/y, 'tk-f'],
    [/`[^`\n]+`/y, 'tk-p'],
  ],
};

export interface Token { c: string; t: string }

/** Tokeniza una línea (o bloque) en spans con clase CSS. */
export function tokenize(src: string, lang: Lang | null): Token[] {
  if (!lang) {
    // fallback: comentarios de línea en gris
    return src.split(/(^\/\/.*|^#.*)/m).filter(Boolean).map(t =>
      /^(\/\/|#)/.test(t) ? { c: 'tk-c', t } : { c: '', t });
  }
  const rules = LANG_RULES[lang];
  const out: Token[] = [];
  let pos = 0;
  const plain = (from: number, to: number) => {
    if (to > from) out.push({ c: '', t: src.slice(from, to) });
  };
  outer: while (pos < src.length) {
    for (const [re, cls] of rules) {
      re.lastIndex = pos;
      const m = re.exec(src);
      if (m && m.index === pos && m[0].length) {
        out.push({ c: cls, t: m[0] });
        pos += m[0].length;
        continue outer;
      }
    }
    out.push({ c: '', t: src[pos] });
    pos++;
  }
  return out;
}

/* ---------- árbol de rutas ---------- */
export interface TreeFile { path: string; size: number }
export interface TreeNode { name: string; dirs: Map<string, TreeNode>; files: TreeFile[] }

export function buildTree(paths: TreeFile[]): TreeNode {
  const root: TreeNode = { name: '', dirs: new Map(), files: [] };
  for (const it of paths) {
    const seg = it.path.split('/');
    let cur = root;
    for (let i = 0; i < seg.length - 1; i++) {
      const nm = seg[i];
      if (!cur.dirs.has(nm)) cur.dirs.set(nm, { name: nm, dirs: new Map(), files: [] });
      cur = cur.dirs.get(nm)!;
    }
    cur.files.push(it);
  }
  return root;
}

/* ---------- diff de líneas (LCS, filas lado a lado) ---------- */
export interface DiffLine { n: number; t: string; cls: '' | 'add' | 'del' | 'chg' }
export interface DiffRow { l: DiffLine | null; r: DiffLine | null }
export interface DiffResult { rows: DiffRow[]; stats: { added: number; removed: number } }

const CAP = 2500;

export function lineDiff(aText: string, bText: string): DiffResult | null {
  const a = (aText || '').split('\n');
  const b = (bText || '').split('\n');
  if (a.length > CAP || b.length > CAP || a.length * b.length > 6e6) return null;
  const M = b.length + 1;
  const dp = new Int32Array((a.length + 1) * M);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i * M + j] = a[i] === b[j] ? dp[(i + 1) * M + j + 1] + 1 : Math.max(dp[(i + 1) * M + j], dp[i * M + j + 1]);
    }
  }
  const ops: Array<{ t: '=' | '-' | '+'; a?: string; b?: string; na?: number; nb?: number }> = [];
  let i = 0, j = 0, la = 1, lb = 1;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { ops.push({ t: '=', a: a[i], na: la++, b: b[j], nb: lb++ }); i++; j++; }
    else if (dp[(i + 1) * M + j] >= dp[i * M + j + 1]) { ops.push({ t: '-', a: a[i], na: la++ }); i++; }
    else { ops.push({ t: '+', b: b[j], nb: lb++ }); j++; }
  }
  while (i < a.length) { ops.push({ t: '-', a: a[i], na: la++ }); i++; }
  while (j < b.length) { ops.push({ t: '+', b: b[j], nb: lb++ }); j++; }

  const rows: DiffRow[] = [];
  const stats = { added: 0, removed: 0 };
  let k = 0;
  while (k < ops.length) {
    if (ops[k].t === '=') {
      rows.push({ l: { n: ops[k].na!, t: ops[k].a!, cls: '' }, r: { n: ops[k].nb!, t: ops[k].b!, cls: '' } });
      k++; continue;
    }
    const dels: Array<{ n: number; t: string }> = [];
    const adds: Array<{ n: number; t: string }> = [];
    while (k < ops.length && ops[k].t === '-') { dels.push({ n: ops[k].na!, t: ops[k].a! }); stats.removed++; k++; }
    while (k < ops.length && ops[k].t === '+') { adds.push({ n: ops[k].nb!, t: ops[k].b! }); stats.added++; k++; }
    const pairs = Math.max(dels.length, adds.length);
    for (let q = 0; q < pairs; q++) {
      rows.push({
        l: dels[q] ? { n: dels[q].n, t: dels[q].t, cls: adds[q] ? 'chg' : 'del' } : null,
        r: adds[q] ? { n: adds[q].n, t: adds[q].t, cls: dels[q] ? 'chg' : 'add' } : null,
      });
    }
  }
  return { rows, stats };
}

/* ---------- parche unificado (diff de la API compare) → filas ---------- */
export interface PatchRow { kind: 'hunk' | 'add' | 'del' | 'ctx'; old: number | null; new: number | null; text: string }

export function parsePatch(patch: string): PatchRow[] {
  if (!patch) return [];
  const out: PatchRow[] = [];
  let no = 0, nn = 0;
  for (const l of patch.split('\n')) {
    if (l.startsWith('@@')) {
      const m = l.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) { no = +m[1]; nn = +m[2]; }
      out.push({ kind: 'hunk', old: null, new: null, text: l });
    } else if (l.startsWith('+')) {
      out.push({ kind: 'add', old: null, new: nn++, text: l.slice(1) });
    } else if (l.startsWith('-')) {
      out.push({ kind: 'del', old: no++, new: null, text: l.slice(1) });
    } else if (l) {
      out.push({ kind: 'ctx', old: no++, new: nn++, text: l.slice(1) });
    }
  }
  return out;
}

/* Guardar un archivo editado: blob → árbol → commit → ref, con verificación */
export async function saveFileEdit(opts: {
  repo: string; branch: string; path: string; text: string; message: string;
  onProgress?: (stage: string) => void;
}): Promise<{ sha: string; url: string }> {
  const { gh } = await import('./github');
  const { repo, branch, path, text, message, onProgress } = opts;
  onProgress?.('leyendo rama');
  let baseSha: string | null = null;
  let baseTree: string | null = null;
  try {
    baseSha = (await gh.ref(repo, branch)).object.sha;
    baseTree = (await gh.getCommit(repo, baseSha)).tree.sha;
  } catch { /* repo/rama vacíos: commit raíz */ }
  onProgress?.('subiendo blob');
  const bytes = new TextEncoder().encode(text);
  let b64 = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) b64 += String.fromCharCode(...bytes.subarray(i, i + CH));
  const blob = await gh.blobCreate(repo, btoa(b64));
  onProgress?.('creando commit');
  const tree = await gh.treeCreate(repo, baseTree, [{ path, mode: '100644', type: 'blob', sha: blob.sha }]);
  const commit = await gh.commitCreate(repo, message, tree.sha, baseSha ? [baseSha] : []);
  if (baseSha) await gh.refUpdate(repo, branch, commit.sha);
  else await gh.refCreate(repo, branch, commit.sha);
  onProgress?.('verificando');
  const finalRef = (await gh.ref(repo, branch)).object.sha;
  if (finalRef !== commit.sha) throw new Error('La rama no refleja el commit (¿protección de rama o carrera?)');
  return { sha: commit.sha, url: commit.html_url };
}
