'use client';

/* Bóveda local de Orbit: guarda el token cifrado en este dispositivo.
   PBKDF2-SHA256 (150k iteraciones) → AES-GCM 256.
   El texto claro jamás se escribe en disco: solo el blob cifrado en localStorage. */

const KEY = 'orbit.vault';
const VERIFIER = 'orbit-verifier-ok';

function b64(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function deriveKey(pass: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 150000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptWith(key: CryptoKey, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, new TextEncoder().encode(plain));
  return b64(iv) + ':' + b64(ct);
}

async function decryptWith(key: CryptoKey, blob: string): Promise<string> {
  const [ivB, ctB] = blob.split(':');
  const iv = unb64(ivB);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, unb64(ctB) as unknown as BufferSource);
  return new TextDecoder().decode(pt);
}

export function vaultExists(): boolean {
  try { return typeof localStorage !== 'undefined' && !!localStorage.getItem(KEY); } catch { return false; }
}

/** Crea o reemplaza la bóveda con un objeto cualquiera (p. ej. { token }). */
export async function vaultSeal(payload: unknown, pass: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(pass, salt);
  const data = JSON.stringify(payload);
  const wrapped = await encryptWith(key, VERIFIER) + '|' + await encryptWith(key, data);
  localStorage.setItem(KEY, b64(salt) + '|' + wrapped);
}

/** Desbloquea y devuelve el payload, o null si la contraseña es incorrecta. */
export async function vaultUnlock<T>(pass: string): Promise<T | null> {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const [saltB, verB, dataB] = raw.split('|');
    const key = await deriveKey(pass, unb64(saltB));
    const ver = await decryptWith(key, verB);
    if (ver !== VERIFIER) return null;
    return JSON.parse(await decryptWith(key, dataB)) as T;
  } catch { return null; }
}

export function vaultDestroy(): void {
  try { localStorage.removeItem(KEY); } catch { /* nada */ }
}
