'use client';

/* Lectura de ZIP (con soporte ZIP64 vía fflate) → lista de FileEntry. */
import { unzip } from 'fflate';
import type { FileEntry } from './upload';

const SKIP = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)(\/|$)/;

export function readZip(file: File): Promise<FileEntry[]> {
  return new Promise((resolve, reject) => {
    file.arrayBuffer().then(buf => {
      unzip(new Uint8Array(buf), (err, data) => {
        if (err) { reject(new Error('ZIP ilegible: ' + err.message)); return; }
        const out: FileEntry[] = [];
        for (const [path, u8] of Object.entries(data)) {
          if (path.endsWith('/') || SKIP.test(path)) continue;
          const f = new File([u8], path.split('/').pop() || 'file');
          Object.defineProperty(f, 'webkitRelativePath', { value: path });
          out.push({ path, file: f });
        }
        if (!out.length) reject(new Error('El ZIP no contiene archivos útiles'));
        else resolve(out);
      });
    }).catch(reject);
  });
}
