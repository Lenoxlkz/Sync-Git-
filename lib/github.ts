'use client';

/* Cliente de la API de GitHub para Orbit Next.
   · Timeout duro de 20 s con guardia AbortController (navegadores antiguos incluidos).
   · Diagnóstico real en 401/403: muestra el mensaje de GitHub y la causa típica.
   · El token vive solo en este módulo (lo fija la sesión del navegador);
     nunca sale hacia ningún servidor que no sea api.github.com. */

const BASE = 'https://api.github.com';

export interface GHUser {
  login: string; name?: string | null; avatar_url: string;
  bio?: string | null; public_repos?: number; html_url: string;
}
export interface GHRepo {
  id: number; name: string; full_name: string; owner: { login: string };
  private: boolean; description?: string | null; html_url: string;
  default_branch: string; stargazers_count: number; forks_count: number;
  size: number; language?: string | null; pushed_at: string; updated_at: string; fork: boolean;
  open_issues_count?: number;
}
export interface GHBranch { name: string; commit: { sha: string }; protected?: boolean }
export interface GHTreeEntry { path: string; mode: string; type: 'blob' | 'tree' | 'commit'; sha: string; size?: number }
export interface GHTree { sha: string; truncated?: boolean; tree: GHTreeEntry[] }
export interface GHPull {
  number: number; title: string; user: { login: string }; state: string;
  body?: string | null; html_url: string; created_at: string; updated_at?: string; draft?: boolean;
  head: { ref: string; sha: string }; base: { ref: string; repo: { full_name: string } }; merged?: boolean; comments?: number;
}
export interface GHIssue {
  number: number; title: string; user: { login: string }; state: string;
  body?: string | null; html_url: string; created_at: string; comments: number;
  pull_request?: { url: string };
}
export interface GHComment { id: number; user: { login: string }; body: string; created_at: string }
export interface GHCommit { sha: string; html_url: string; commit: { message: string } }
export interface GHCommitFull {
  sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } };
  author: { login: string; avatar_url: string } | null;
}
export interface GHCompareFile {
  filename: string; status: string; additions: number; deletions: number; changes: number; patch?: string;
}
export interface GHCompare {
  status: string; ahead_by: number; behind_by: number; total_commits: number;
  files: GHCompareFile[];
  commits: GHCommitFull[];
}
export interface GHSearchItem { path: string; text_matches?: Array<{ fragment?: string }> }
export interface GHRelease {
  id: number; tag_name: string; name: string | null; body: string | null;
  html_url: string; published_at: string | null; assets: Array<{ id: number; name: string; size: number }>;
}
export interface GHTag { name: string; commit: { sha: string } }

export class GitHubError extends Error {
  status: number; github?: string;
  constructor(message: string, status: number, github?: string) {
    super(message); this.status = status; this.github = github;
  }
}

let _token: string | null = null;
export function setToken(t: string | null) { _token = t; }
export function getToken() { return _token; }

export let rateListener: null | ((limit: string, rem: string) => void) = null;
export function onRate(fn: (limit: string, rem: string) => void) { rateListener = fn; }
export let scopesListener: null | ((scopes: string[]) => void) = null;
export function onScopes(fn: (scopes: string[]) => void) { scopesListener = fn; }

export async function req<T>(
  path: string,
  opts: { method?: string; body?: unknown; tmo?: number; headers?: Record<string, string> } = {}
): Promise<T> {
  const tmo = opts.tmo ?? 20000;
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const to = ctl ? setTimeout(() => ctl.abort(), tmo) : null;
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        ...(_token ? { Authorization: 'Bearer ' + _token } : {}),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers || {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
      ...(ctl ? { signal: ctl.signal } : {}),
    });
  } catch (e) {
    const abort = e instanceof DOMException && e.name === 'AbortError';
    throw new GitHubError(
      abort
        ? `api.github.com no respondió en ${Math.round(tmo / 1000)} s (red lenta o bloqueada)`
        : 'Sin conexión con api.github.com: ' + (e instanceof Error ? e.message : 'desconocido'),
      0
    );
  } finally { if (to) clearTimeout(to); }

  const rl = res.headers.get('x-ratelimit-limit');
  const rr = res.headers.get('x-ratelimit-remaining');
  if (rl && rr && rateListener) rateListener(rl, rr);
  const sc = res.headers.get('x-oauth-scopes');
  if (sc !== null && scopesListener) scopesListener(sc.split(',').map(s => s.trim()).filter(Boolean));

  if (!res.ok) {
    let gm = '';
    try { gm = ((await res.json()) as { message?: string }).message || ''; } catch { /* cuerpo no-JSON */ }
    if (res.status === 401) {
      throw new GitHubError('Token inválido o expirado (401)' + (gm ? ` — GitHub responde: «${gm}»` : ''), 401, gm);
    }
    if (res.status === 403) {
      throw new GitHubError(
        'Permiso denegado o límite de peticiones alcanzado (403)' + (gm ? ` — GitHub responde: «${gm}»` : '') +
        '. Con tokens classic el PAT necesita scope repo; con fine-grained, permisos de Contents; si tu organización usa SSO, autoriza el token para ella.',
        403, gm
      );
    }
    if (res.status === 404) throw new GitHubError('Recurso no encontrado (404): ' + path, 404, gm);
    if (res.status === 409) throw new GitHubError('Conflicto de estado (409): la rama avanzó mientras operabas', 409, gm);
    if (res.status === 422) throw new GitHubError('Petición rechazada (422): ' + (gm || 'datos duplicados o inválidos'), 422, gm);
    throw new GitHubError(`La API de GitHub devolvió ${res.status}` + (gm ? `: ${gm}` : ''), res.status, gm);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const enc = encodeURIComponent;

export const gh = {
  user: () => req<GHUser>('/user'),

  repos: async (): Promise<GHRepo[]> => {
    const out: GHRepo[] = [];
    for (let page = 1; page <= 3; page++) {
      const chunk = await req<GHRepo[]>(`/user/repos?per_page=100&sort=pushed&page=${page}`);
      out.push(...chunk);
      if (chunk.length < 100) break;
    }
    return out;
  },

  branches: (repo: string) => req<GHBranch[]>(`/repos/${repo}/branches?per_page=100`),
  ref: (repo: string, branch: string) =>
    req<{ object: { sha: string } }>(`/repos/${repo}/git/ref/heads/${enc(branch)}`),
  tree: (repo: string, sha: string) => req<GHTree>(`/repos/${repo}/git/trees/${sha}?recursive=1`),
  /* árbol de una rama pelando commit→tree: el árbol vacío (4b825dc…) no es
     un objeto consultable en la API (404), así que se devuelve vacío —
     fixes: repos recién creados o con commits sin contenido */
  treeAt: async (repo: string, branch: string): Promise<GHTree> => {
    /* repo vacío: la ref responde 404 o 409 «Git Repository is empty.» */
    try {
      const ref = await gh.ref(repo, branch);
      const c = await gh.getCommit(repo, ref.object.sha);
      if (c.tree.sha === '4b825dc642cb6eb9a060e54bf8d69288fbee4904') {
        return { sha: c.tree.sha, truncated: false, tree: [] };
      }
      return gh.tree(repo, c.tree.sha);
    } catch (e) {
      if (e instanceof GitHubError && (e.status === 404 || e.status === 409)) {
        return { sha: '4b825dc642cb6eb9a060e54bf8d69288fbee4904', truncated: false, tree: [] };
      }
      throw e;
    }
  },
  getCommit: (repo: string, sha: string) =>
    req<{ sha: string; tree: { sha: string }; message: string; html_url?: string }>(`/repos/${repo}/git/commits/${sha}`),

  blobCreate: (repo: string, contentB64: string) =>
    req<{ sha: string }>(`/repos/${repo}/git/blobs`, { method: 'POST', body: { content: contentB64, encoding: 'base64' } }),
  treeCreate: (repo: string, baseTree: string | null, tree: Array<{ path: string; mode: string; type: string; sha: string | null }>) =>
    req<{ sha: string }>(`/repos/${repo}/git/trees`, { method: 'POST', body: { base_tree: baseTree || undefined, tree } }),
  commitCreate: (repo: string, message: string, treeSha: string, parents: string[]) =>
    req<{ sha: string; html_url: string }>(`/repos/${repo}/git/commits`, { method: 'POST', body: { message, tree: treeSha, parents } }),
  refUpdate: (repo: string, branch: string, sha: string) =>
    req<{ object: { sha: string } }>(`/repos/${repo}/git/refs/heads/${enc(branch)}`, { method: 'PATCH', body: { sha, force: false } }),
  refCreate: (repo: string, branch: string, sha: string) =>
    req<{ ref: string }>(`/repos/${repo}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${branch}`, sha } }),
  /* Fallback de inicialización: Contents API por archivo (crea un commit por
     archivo; el primero también inicializa el repo vacío). */
  putContents: (repo: string, branch: string, path: string, message: string, contentB64: string) =>
    req<{ commit: { sha: string; html_url: string } }>(
      `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,
      { method: 'PUT', body: { message, content: contentB64, branch } },
    ),

  createRepo: (name: string, description: string, isPrivate: boolean) =>
    req<GHRepo>('/user/repos', { method: 'POST', body: { name, description, private: isPrivate, auto_init: false } }),
  deleteRepo: (repo: string) => req<null>(`/repos/${repo}`, { method: 'DELETE' }),

  pulls: (repo: string, state: string) =>
    req<GHPull[]>(`/repos/${repo}/pulls?state=${state}&per_page=50&sort=updated&direction=desc`),
  prDetail: (repo: string, num: number) => req<GHPull>(`/repos/${repo}/pulls/${num}`),
  issueComments: (repo: string, num: number) => req<GHComment[]>(`/repos/${repo}/issues/${num}/comments?per_page=100`),
  addComment: (repo: string, num: number, body: string) =>
    req<GHComment>(`/repos/${repo}/issues/${num}/comments`, { method: 'POST', body: { body } }),
  prMerge: (repo: string, num: number, method: string) =>
    req<{ sha: string; merged: boolean }>(`/repos/${repo}/pulls/${num}/merge`, { method: 'PUT', body: { merge_method: method } }),
  prSetState: (repo: string, num: number, state: string) =>
    req<GHPull>(`/repos/${repo}/pulls/${num}`, { method: 'PATCH', body: { state } }),

  issues: (repo: string, state: string) => req<GHIssue[]>(`/repos/${repo}/issues?state=${state}&per_page=50`),
  issuesAll: (state: string) =>
    req<GHIssue[]>(`/issues?state=${state}&per_page=60&sort=updated&filter=all`),
  issueCreate: (repo: string, title: string, body: string, labels?: string[]) =>
    req<GHIssue>(`/repos/${repo}/issues`, { method: 'POST', body: { title, body, labels: labels || undefined } }),
  issueEdit: (repo: string, num: number, patch: { title?: string; body?: string }) =>
    req<GHIssue>(`/repos/${repo}/issues/${num}`, { method: 'PATCH', body: patch }),
  issueSetState: (repo: string, num: number, state: string) =>
    req<GHIssue>(`/repos/${repo}/issues/${num}`, { method: 'PATCH', body: { state } }),

  commits: (repo: string, branch: string, n = 8) =>
    req<GHCommitFull[]>(`/repos/${repo}/commits?sha=${enc(branch)}&per_page=${n}`),
  compare: (repo: string, base: string, head: string) =>
    req<GHCompare>(`/repos/${repo}/compare/${enc(base)}...${enc(head)}`),
  searchCode: (repo: string, term: string) =>
    req<{ items: GHSearchItem[] }>('/search/code?q=' + enc(`${term} repo:${repo}`) + '&per_page=30',
      { headers: { Accept: 'application/vnd.github.text-match+json' } }),

  tags: (repo: string) => req<GHTag[]>(`/repos/${repo}/tags?per_page=30`),
  releases: (repo: string) => req<GHRelease[]>(`/repos/${repo}/releases?per_page=20`),
  releaseCreate: (repo: string, body: { tag_name: string; name?: string; body?: string; target_commitish?: string }) =>
    req<GHRelease>(`/repos/${repo}/releases`, { method: 'POST', body }),

  releaseDelete: (repo: string, id: number) => req<null>(`/repos/${repo}/releases/${id}`, { method: 'DELETE' }),
  releaseEdit: (repo: string, id: number, patch: { body?: string; name?: string }) =>
    req<GHRelease>(`/repos/${repo}/releases/${id}`, { method: 'PATCH', body: patch }),
  releaseAssetDelete: (repo: string, id: number) => req<null>(`/repos/${repo}/releases/assets/${id}`, { method: 'DELETE' }),
  tagDelete: (repo: string, tag: string) => req<null>(`/repos/${repo}/git/refs/tags/${enc(tag)}`, { method: 'DELETE' }),
  tagCreate: (repo: string, tag: string, sha: string) =>
    req<{ ref: string }>(`/repos/${repo}/git/refs`, { method: 'POST', body: { ref: 'refs/tags/' + tag, sha } }),
  contentGet: (repo: string, path: string, ref?: string) =>
    req<{ sha: string; content?: string; encoding?: string }>(`/repos/${repo}/contents/${path.split('/').map(enc).join('/')}${ref ? '?ref=' + enc(ref) : ''}`),
  contentPut: (repo: string, path: string, contentB64: string, opts: { branch?: string; message?: string; sha?: string }) =>
    req<{ content: { sha: string }; commit: { sha: string } }>(`/repos/${repo}/contents/${path.split('/').map(enc).join('/')}`, {
      method: 'PUT',
      body: { content: contentB64, message: opts.message || 'Orbit: adjunto de release', branch: opts.branch, sha: opts.sha },
    }),

  blob: (repo: string, sha: string) =>
    req<{ content: string; encoding: string; size: number }>(`/repos/${repo}/git/blobs/${sha}`),

  fork: (repo: string) => req<GHRepo>(`/repos/${repo}/forks`, { method: 'POST' }),
  setVisibility: (repo: string, isPrivate: boolean) =>
    req<GHRepo>(`/repos/${repo}`, { method: 'PATCH', body: { private: isPrivate } }),
  branchDelete: (repo: string, branch: string) =>
    req<null>(`/repos/${repo}/git/refs/heads/${enc(branch)}`, { method: 'DELETE' }),

  /* «pullsAll» se retiró: la API de GitHub no tiene /pulls global (devolvía 404
     — por eso la sección de PRs fallaba). La página itera gh.repos() + gh.pulls(). */
  pullCreate: (repo: string, body: { title: string; body?: string; head: string; base: string }) =>
    req<GHPull>(`/repos/${repo}/pulls`, { method: 'POST', body }),
  pullReview: (repo: string, num: number, event: string, bodyText: string) =>
    req<unknown>(`/repos/${repo}/pulls/${num}/reviews`, { method: 'POST', body: { event, body: bodyText } }),
};

/* Helpers de Git que necesitan bytes: SHA-1 de blob y base64 por bloques */
export async function blobSha(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const full = new Uint8Array(header.length + bytes.length);
  full.set(header); full.set(bytes, header.length);
  const digest = await crypto.subtle.digest('SHA-1', full);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function fileToB64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let out = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    out += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return btoa(out);
}

/** SHA-1 de blob Git a partir de texto UTF-8 (verificación de integridad). */
export async function blobShaText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const header = new TextEncoder().encode(`blob ${data.length}\0`);
  const full = new Uint8Array(header.length + data.length);
  full.set(header); full.set(data, header.length);
  const digest = await crypto.subtle.digest('SHA-1', full);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Contenido de un blob por SHA (base64 → texto) con verificación de integridad. */
export async function blobText(repo: string, sha: string, pathForError = ''): Promise<string> {
  const b = await gh.blob(repo, sha);
  if (b.encoding !== 'base64') throw new GitHubError('Blob con codificación inesperada: ' + b.encoding, 0);
  const bin = atob(b.content.replace(/\n/g, ''));
  const text = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  const real = await blobShaText(text).catch(() => null);
  if (real && real !== sha.toLowerCase()) {
    throw new GitHubError(`Integridad: el contenido no coincide con el árbol Git (${pathForError})`, 0);
  }
  return text;
}

/** Crea una rama desde otra (resuelve el SHA de la rama origen). */
export async function createBranch(repo: string, name: string, from: string): Promise<void> {
  const ref = (await gh.ref(repo, from)).object.sha;
  await req<{ ref: string }>(`/repos/${repo}/git/refs`, {
    method: 'POST',
    body: { ref: 'refs/heads/' + name, sha: ref },
  });
}

/** Sube un paquete adjunto a una release (uploads.github.com, con progreso).
    OJO: GitHub no responde a las preflights CORS de uploads.github.com (OPTIONS
    → 400 sin Access-Control-*), así que un navegador estándar NO puede completar
    esta llamada: xhr.onerror salta siempre que no haya una extensión que relaje
    CORS. Reintentamos por si es red puntual y el error final explica el motivo y
    la alternativa (modo compatible en ReleaseSheet: archivo al repo + enlace). */
export function uploadReleaseAsset(repo: string, releaseId: number, file: File,
  onProgress?: (p: { loaded: number; total: number }) => void, attempt = 0): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://uploads.github.com/repos/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader('Authorization', 'Bearer ' + _token);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress({ loaded: e.loaded, total: e.total }); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let r: unknown = null;
        try { r = JSON.parse(xhr.responseText); } catch { /* sin cuerpo */ }
        resolve(r);
      } else {
        reject(new Error('La subida devolvió ' + xhr.status + (xhr.status === 422 ? ' (nombre duplicado en la release)' : '')));
      }
    };
    xhr.onerror = () => {
      if (attempt < 2) {
        setTimeout(() => uploadReleaseAsset(repo, releaseId, file, onProgress, attempt + 1).then(resolve, reject), 1200 * (attempt + 1));
        return;
      }
      reject(new GitHubError('uploads.github.com inalcanzable desde el navegador: GitHub bloquea la subida directa de adjuntos por CORS (no es un fallo de tu red). Usa «Modo compatible» para publicar el archivo en el repo y enlazarlo en la release.', 0));
    };
    xhr.send(file);
  });
}
