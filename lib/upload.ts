'use client';

/* Motor de subida delta de Orbit: analiza archivos contra el árbol del repo
   por SHA-1 Git, sube solo lo nuevo o cambiado, sincroniza espejo (borra del
   repo lo que ya no exista), reintenta si la rama avanzó en medio del envío
   y verifica el resultado leyendo el árbol final ruta por ruta. */

import { gh, blobSha, fileToB64, GitHubError, type GHTreeEntry } from './github';

export interface FileEntry { path: string; file: File; secret?: boolean }
export interface Plan {
  creates: FileEntry[]; updates: Array<FileEntry & { remoteSha?: string }>; skips: FileEntry[];
  deletes: string[]; dups: string[]; tooBig: FileEntry[];
}

export interface CommitResult {
  ok: boolean; commitSha?: string; url?: string;
  uploaded: number; skipped: number; deleted: number; problems: string[];
}

const MAX_BLOB_MB = 48;

export async function analyze(
  entries: FileEntry[],
  treeEntries: GHTreeEntry[],
  sync: boolean,
  onProgress?: (done: number, total: number) => void
): Promise<Plan> {
  const remote = new Map<string, string>();
  for (const t of treeEntries) if (t.type === 'blob') remote.set(t.path, t.sha);

  const plan: Plan = { creates: [], updates: [], skips: [], deletes: [], dups: [], tooBig: [] };
  const seen = new Map<string, string>(); // lowercase → path real (duplicados por capitalización)

  let done = 0;
  const BATCH = 4;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const shas = await Promise.all(batch.map(e => blobSha(e.file)));
    for (let j = 0; j < batch.length; j++) {
      const e = batch[j];
      const sha = shas[j];
      done++;
      onProgress?.(done, entries.length);
      const lower = e.path.toLowerCase();
      if (seen.has(lower) && seen.get(lower) !== e.path) plan.dups.push(e.path);
      else seen.set(lower, e.path);
      if (e.file.size > MAX_BLOB_MB * 1024 * 1024) { plan.tooBig.push(e); continue; }
      const rs = remote.get(e.path);
      if (rs === sha) plan.skips.push(e);
      else if (rs === undefined) plan.creates.push(e);
      else plan.updates.push({ ...e, remoteSha: rs });
    }
  }

  if (sync) {
    const covered = new Set(entries.map(e => e.path));
    for (const p of remote.keys()) if (!covered.has(p)) plan.deletes.push(p);
  }
  return plan;
}

async function pMap<T, R>(items: T[], fn: (x: T) => Promise<R>, concurrency: number): Promise<void> {
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const mine = idx++;
      await fn(items[mine]);
    }
  });
  await Promise.all(workers);
}

export async function commitOrbit(opts: {
  repo: string;
  branch: string;
  message: string;
  plan: Plan;
  sync: boolean;
  onProgress?: (stage: string, done: number, total: number, detail?: string) => void;
}): Promise<CommitResult> {
  const { repo, branch, message, plan, sync, onProgress } = opts;
  const problems: string[] = [];
  if (plan.tooBig.length) {
    problems.push(`${plan.tooBig.length} archivo(s) superan ${MAX_BLOB_MB} MB y se omitieron: ${plan.tooBig.slice(0, 3).map(f => f.path).join(', ')}`);
  }
  const toUpload = [...plan.creates, ...plan.updates];
  let uploaded = 0;

  /* 1. Blobs (los SHA son estables: se reutilizan si hay reintento por carrera) */
  const shas = new Map<string, string>(); // path → blob sha
  await pMap(toUpload, async (e) => {
    const b64 = await fileToB64(e.file);
    const { sha } = await gh.blobCreate(repo, b64);
    shas.set(e.path, sha);
    uploaded++;
    onProgress?.('blobs', uploaded, toUpload.length, e.path);
  }, 4);

  /* 2. Árbol + commit + ref, con reintento si la rama avanzó (409/422) */
  let commitSha = '', commitUrl = '', deleted = 0;
  let baseSha: string | null = null;
  let hasHistory = true;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      try {
        baseSha = (await gh.ref(repo, branch)).object.sha;
        hasHistory = true;
      } catch (e) {
        if (!(e instanceof GitHubError && e.status === 404)) throw e;
        // rama inexistente: ¿repo con historial en otra rama o vacío?
        const branches = await gh.branches(repo).catch(() => []);
        if (branches.length) {
          baseSha = (await gh.ref(repo, branches[0].name)).object.sha;
          hasHistory = true;
        } else { baseSha = null; hasHistory = false; }
      }

      let baseTree: string | null = null;
      const remotePaths = new Set<string>();
      if (baseSha) {
        const t = await gh.tree(repo, baseSha);
        baseTree = t.sha;
        if (t.truncated) problems.push('El árbol del repo es demasiado grande para análisis completo (GitHub lo truncó): la sincronización espejo puede no borrar todo.');
        for (const te of t.tree) if (te.type === 'blob') remotePaths.add(te.path);
      }

      const treePayload: Array<{ path: string; mode: string; type: string; sha: string | null }> =
        toUpload.map(e => ({ path: e.path, mode: '100644', type: 'blob', sha: shas.get(e.path)! }));
      if (sync && baseSha) {
        const keep = new Set(toUpload.map(e => e.path));
        for (const p of remotePaths) {
          if (!keep.has(p)) { treePayload.push({ path: p, mode: '100644', type: 'blob', sha: null }); deleted++; }
        }
      }

      const newTree = await gh.treeCreate(repo, baseTree, treePayload);
      const commit = await gh.commitCreate(repo, message, newTree.sha, hasHistory && baseSha ? [baseSha] : []);
      commitSha = commit.sha; commitUrl = commit.html_url;

      if (hasHistory && baseSha) await gh.refUpdate(repo, branch, commit.sha);
      else await gh.refCreate(repo, branch, commit.sha);
      break;
    } catch (e) {
      const race = e instanceof GitHubError && (e.status === 409 || e.status === 422);
      if (attempt >= 3 || !race) throw e;
      deleted = 0;
      onProgress?.('reintento', attempt, 3, 'la rama avanzó en medio del envío; reintentando contra el nuevo estado');
      await new Promise(r => setTimeout(r, 800 * attempt));
    }
  }

  /* 3. Verificación leyendo el estado final real */
  onProgress?.('verificación', 0, 1);
  const finalTreeSha = (await gh.getCommit(repo, commitSha)).tree.sha;
  const finalTree = await gh.tree(repo, finalTreeSha);
  const finalMap = new Map<string, string>();
  for (const te of finalTree.tree) if (te.type === 'blob') finalMap.set(te.path, te.sha);

  for (const e of toUpload) {
    const got = finalMap.get(e.path);
    if (!got) problems.push(`Falta en el árbol final: ${e.path}`);
    else if (got !== shas.get(e.path)) problems.push(`SHA distinto tras el commit: ${e.path}`);
  }
  if (sync && baseSha) {
    for (const p of plan.deletes) {
      if (finalMap.has(p)) problems.push(`Sobrevivió al borrado espejo: ${p}`);
    }
  }
  const lowerSeen = new Map<string, number>();
  for (const p of finalMap.keys()) {
    const k = p.toLowerCase();
    lowerSeen.set(k, (lowerSeen.get(k) || 0) + 1);
  }
  for (const [k, n] of lowerSeen) if (n > 1) problems.push(`Duplicado por capitalización en el repo: ${k} (${n} variantes)`);

  return { ok: problems.length === 0, commitSha, url: commitUrl, uploaded, skipped: plan.skips.length, deleted, problems };
}
