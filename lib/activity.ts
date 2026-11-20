'use client';

/* Registro de actividad reciente de Orbit (rail lateral). Se guarda en
   localStorage; los textos pasan por redact() para no mostrar nunca secretos. */
import { useSyncExternalStore } from 'react';
import { redact } from './security';

export interface ActItem { icon: string; text: string; sub: string; t: number }

const KEY = 'orbit.activity';
const MAX = 40;

let items: ActItem[] = [];
try { items = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(items)) items = []; } catch { items = []; }

const subs = new Set<() => void>();
function emit() { items = [...items]; subs.forEach(f => f()); }

function nowTime(): string {
  return new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export function logAct(icon: string, text: string, sub?: string) {
  items = [{ icon, text: redact(text), sub: redact(sub || nowTime()), t: Date.now() }, ...items].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* privado */ }
  emit();
}

export function clearActivity() {
  items = [];
  try { localStorage.removeItem(KEY); } catch { /* privado */ }
  emit();
}

export function useActivity(): ActItem[] {
  return useSyncExternalStore(
    (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
    () => items,
    () => items,
  );
}
