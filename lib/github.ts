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
}
export interface GHBranch { name: string; commit: { sha: string }; protected?: boolean }
export interface GHTreeEntry { path: string; mode: string; type: 'blob' | 'tree' | 'commit'; sha: string; size?: number }
export interface GHTree { sha: string; truncated?: boolean; tree: GHTreeEntry[] }
export interface GHPull {
  number: number; title: string; user: { login: string }; state: string;
  body?: string | null; html_url: string; created_at: string;
  head: { ref: string; sha: string }; base: { ref: string }; merged?: boolean; comments?: number;
}
export interface GHIssue {
  number: number; title: string; user: { login: string }; state: string;
  body?: string | null; html_url: string; created_at: string; comments: number;
  pull_request?: { url: string };
}
export interface GHComment { id: number; user: { login: string }; body: string; created_at: string }
export interface GHCommit { sha: string; html_url: string; commit: { message: string } }

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

  createRepo: (name: string, description: string, isPrivate: boolean) =>
    req<GHRepo>('/user/repos', { method: 'POST', body: { name, description, private: isPrivate, auto_init: false } }),
  deleteRepo: (repo: string) => req<null>(`/repos/${repo}`, { method: 'DELETE' }),

  pulls: (repo: string, state: string) => req<GHPull[]>(`/repos/${repo}/pulls?state=${state}&per_page=50`),
  prDetail: (repo: string, num: number) => req<GHPull>(`/repos/${repo}/pulls/${num}`),
  issueComments: (repo: string, num: number) => req<GHComment[]>(`/repos/${repo}/issues/${num}/comments?per_page=100`),
  addComment: (repo: string, num: number, body: string) =>
    req<GHComment>(`/repos/${repo}/issues/${num}/comments`, { method: 'POST', body: { body } }),
  prMerge: (repo: string, num: number, method: string) =>
    req<{ sha: string; merged: boolean }>(`/repos/${repo}/pulls/${num}/merge`, { method: 'PUT', body: { merge_method: method } }),
  prSetState: (repo: string, num: number, state: string) =>
    req<GHPull>(`/repos/${repo}/pulls/${num}`, { method: 'PATCH', body: { state } }),

  issues: (repo: string, state: string) => req<GHIssue[]>(`/repos/${repo}/issues?state=${state}&per_page=50`),
  issueCreate: (repo: string, title: string, body: string) =>
    req<GHIssue>(`/repos/${repo}/issues`, { method: 'POST', body: { title, body } }),
  issueSetState: (repo: string, num: number, state: string) =>
    req<GHIssue>(`/repos/${repo}/issues/${num}`, { method: 'PATCH', body: { state } }),
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
