'use client';

/* Detector de actualizaciones de la app Android (APK).
   Actions reconstruye el APK en cada push a main y lo publica en el release
   «android-latest» con versionCode = número de run. Al entrar (y cada 30 min)
   la web compara el versionCode instalado —que aporta el bridge nativo con
   getVersionCode()— con el del último APK publicado: si hay uno más nuevo,
   el AppShell muestra el aviso con descarga nativa (progreso) e instalación
   directa por el sistema. En la web de GitHub Pages (sin bridge) no hace nada.
   El r-number vive en el LABEL del asset («Orbit-Android-v4.6.0.r13.apk»,
   sintaxis file#label de gh release create); el name real es Orbit-Android.apk. */
import { req } from './github';

const REPO = 'Lenoxlkz/Sync-Git-';
const RELEASE_TAG = 'android-latest';
const SNOOZE_KEY = 'orbit.update.snoozeUntil';
export const SNOOZE_MS = 30 * 60 * 1000;

export interface NativeBridge {
  getVersionCode(): number;
  getVersionName(): string;
  downloadUpdate(url: string, filename: string): void;
  installUpdate(): void;
}

declare global {
  interface Window {
    AndroidBridge?: NativeBridge;
    __orbitUpdateProgress?: (pct: number) => void;
    __orbitUpdateReady?: (apkPath: string) => void;
    __orbitUpdateError?: (msg: string) => void;
  }
}

export function nativeBridge(): NativeBridge | null {
  if (typeof window === 'undefined') return null;
  const b = window.AndroidBridge;
  return b && typeof b.getVersionCode === 'function' ? b : null;
}

export function snoozeUpdate() {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* privado */ }
}
export function snoozeActive(): boolean {
  try { return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now(); } catch { return false; }
}

interface ReleasePayload {
  html_url: string; body?: string | null; published_at: string | null;
  assets: Array<{ name: string; label?: string | null; browser_download_url: string; size: number }>;
}

export interface UpdateInfo {
  versionName: string;
  remoteCode: number;
  currentCode: number;
  assetUrl: string;
  assetName: string;
  sizeBytes: number;
  releaseUrl: string;
  notes: string;
  publishedAt: string;
}

/** Compara la app instalada con el último APK publicado. null = sin novedades. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const bridge = nativeBridge();
  if (!bridge) return null;
  const currentCode = bridge.getVersionCode();
  const rel = await req<ReleasePayload>(`/repos/${REPO}/releases/tags/${RELEASE_TAG}`);
  const apk = (rel.assets || []).find(a => /^Orbit-Android-.*\.apk$/i.test(a.label || a.name));
  if (!apk) return null;
  const tag = apk.label || apk.name;
  const m = tag.match(/r(\d+)\.apk$/i);
  const remoteCode = m ? Number(m[1]) : 0;
  if (!remoteCode || remoteCode <= currentCode) return null;
  const notes = (rel.body || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('**'))
    .slice(0, 6)
    .join('\n');
  return {
    versionName: tag.replace(/^Orbit-Android-/, '').replace(/\.apk$/i, ''),
    remoteCode,
    currentCode,
    assetUrl: apk.browser_download_url,
    assetName: apk.name,
    sizeBytes: apk.size,
    releaseUrl: rel.html_url,
    notes,
    publishedAt: rel.published_at || '',
  };
}
