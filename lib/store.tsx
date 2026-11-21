'use client';

/* Estado central de Orbit Next: sesión GitHub, preferencias, bóveda y toasts.
   Store externo ligero (useSyncExternalStore) sin dependencias. El estado de
   hidratación SIEMPRE son los valores por defecto; la restauración (sesión,
   bóveda, prefs) ocurre en el efecto de arranque — cero mismatches. */

import { useSyncExternalStore } from 'react';
import { gh, setToken, onRate, onScopes, GitHubError, type GHRepo, type GHUser } from './github';
import { vaultExists, vaultUnlock, vaultSeal, vaultDestroy } from './vault';
import { netKeep } from './netkeep';
import type { AIProvider } from './ai';

export type ThemePref = 'auto' | 'light' | 'dark';

/* Motor visual: auto = detección por User-Agent (Android ≤13 → bajo consumo,
   Android ≥14 y resto → Liquid Glass); el usuario puede fijarlo a mano. */
export type ThemeEnginePref = 'auto' | 'glass' | 'expressive';
export type Engine = 'glass' | 'expressive';

export interface Prefs {
  theme: ThemePref;
  accent: string;
  reduceMotion: boolean;
  themeEngine: ThemeEnginePref;
  netkeep: boolean;
  netkeepKbps: number;
  aiProvider: AIProvider;
  aiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  aiGatewayKey: string;
  remember: boolean;
  rememberDevice: boolean;
  live: boolean;
  liveInt: number;
  lastRepo: string;
  lastBranch: string;
}

export const ACCENTS = ['#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ff9f0a', '#30d158', '#40cbe0'];

const DEFAULT_PREFS: Prefs = {
  theme: 'auto', accent: '#0a84ff', reduceMotion: false, themeEngine: 'auto',
  netkeep: true, netkeepKbps: 40,
  aiProvider: 'openai', aiKey: '', aiModel: '', aiBaseUrl: '', aiGatewayKey: '',
  remember: false, rememberDevice: false, lastRepo: '', lastBranch: '',
  live: false, liveInt: 60,
};

export interface Toast { id: number; msg: string; type: 'ok' | 'err' | 'info'; sub?: string }

export type VaultSheet = 'none' | 'unlock' | 'create';

/** Contexto con el que se abre el Code Explorer (desde chat, ficha o búsqueda). */
export interface CodeCtx { repo?: string; branch?: string; file?: string }

export interface AppState {
  token: string | null;
  user: GHUser | null;
  connected: boolean;
  connecting: boolean;
  rate: { limit: string; rem: string } | null;
  scopes: string[];
  repos: GHRepo[];
  prefs: Prefs;
  vaultExists: boolean;
  vaultUnlocked: boolean;
  vaultSheet: VaultSheet;
  vaultError: string;
  toasts: Toast[];
  fichaRepo: string | null;
  codeCtx: CodeCtx;
  chatPrefill: string;
  /** marca de tiempo: cuando cambia, la vista Pull Requests abre su asistente de creación */
  createPRSignal: number;
}

let state: AppState = {
  token: null, user: null, connected: false, connecting: false,
  rate: null, scopes: [], repos: [], prefs: DEFAULT_PREFS,
  vaultExists: false, vaultUnlocked: false, vaultSheet: 'none', vaultError: '',
  toasts: [], fichaRepo: null, codeCtx: {}, chatPrefill: '', createPRSignal: 0,
};

const subs = new Set<() => void>();
function emit() { state = { ...state }; subs.forEach(f => f()); }
function patch(p: Partial<AppState>) { state = { ...state, ...p }; emit(); }

/* Puentes con la capa API: cuota y scopes llegan por cabeceras de cada respuesta */
let lastScopes: string[] | null = null;
if (typeof window !== 'undefined') {
  onRate((limit, rem) => { state = { ...state, rate: { limit, rem } }; subs.forEach(f => f()); });
  onScopes(s => { lastScopes = s; });
}

let toastSeq = 0;
let vaultPass: string | null = null;      // solo memoria de la pestaña actual
let pendingDeviceToken: string | null = null;

function haptic(type: Toast['type']) {
  try {
    if (type === 'err') navigator.vibrate?.([25, 45, 25]);
    else if (type === 'ok') navigator.vibrate?.(12);
  } catch { /* sin vibración */ }
}

export function pushToast(msg: string, type: Toast['type'] = 'info', sub?: string) {
  haptic(type);
  const id = ++toastSeq;
  patch({ toasts: [...state.toasts, { id, msg, type, sub }] });
  setTimeout(() => dismissToast(id), type === 'err' ? 9000 : 5000);
}
export function dismissToast(id: number) {
  patch({ toasts: state.toasts.filter(t => t.id !== id) });
}

/* ---------- contexto de ficha / código / chat ---------- */
export function openFicha(repo: string) { patch({ fichaRepo: repo }); }
export function closeFicha() { patch({ fichaRepo: null }); }
export function openCode(ctx: CodeCtx) { patch({ codeCtx: ctx, fichaRepo: null }); }
export function consumeCodeCtx(): CodeCtx {
  const c = state.codeCtx;
  if (c.repo || c.file) patch({ codeCtx: {} });
  return c;
}
export function setChatPrefill(t: string) { patch({ chatPrefill: t }); }
export function requestCreatePR() { patch({ createPRSignal: Date.now() }); }
export function consumeCreatePR(): number {
  const s = state.createPRSignal;
  if (s) patch({ createPRSignal: 0 });
  return s;
}

/* ---------- preferencias + apariencia ---------- */
function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem('orbit.prefs');
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}

/** Versión mayor de Android según el User-Agent (null si no es Android). */
export function detectAndroidVersion(): number | null {
  if (typeof navigator === 'undefined') return null;
  const m = navigator.userAgent.match(/Android\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Motor efectivo: reduceMotion fuerza el de bajo consumo (sin blur ni
    filtros SVG); auto resuelve por User-Agent; manual manda si se fijó. */
export function effectiveEngine(p: Pick<Prefs, 'reduceMotion' | 'themeEngine'>): Engine {
  if (p.reduceMotion) return 'expressive';
  if (p.themeEngine === 'glass' || p.themeEngine === 'expressive') return p.themeEngine;
  const av = detectAndroidVersion();
  return av !== null && av <= 13 ? 'expressive' : 'glass';
}

export function applyAppearance(p: Prefs) {
  const html = document.documentElement;
  const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  /* «Reducir movimiento» fuerza el modo oscuro AMOLED: negro puro, sin aurora;
     al desactivarlo se vuelve al tema guardado y AMOLED deja de estar disponible. */
  let theme: 'dark' | 'light';
  if (p.reduceMotion) {
    theme = 'dark';
    html.dataset.amoled = '1';
  } else {
    theme = p.theme === 'auto' ? (sysDark ? 'dark' : 'light') : p.theme;
    delete html.dataset.amoled;
  }
  html.dataset.theme = theme;
  /* Expressive (Material) usa la clase .dark en un ancestro para su esquema */
  html.classList.toggle('dark', theme === 'dark');
  html.dataset.engine = effectiveEngine(p);
  html.style.setProperty('--orbit-accent', p.accent);
  if (p.reduceMotion) html.dataset.motion = 'reduce';
  else delete html.dataset.motion;
}

export function setPrefs(p: Partial<Prefs>) {
  const prefs = { ...state.prefs, ...p };
  try { localStorage.setItem('orbit.prefs', JSON.stringify(prefs)); } catch { /* privado */ }
  patch({ prefs });
}

/* ---------- conexión ---------- */
export async function connect(token: string, opts: { remember?: boolean; device?: boolean } = {}): Promise<void> {
  setToken(token);
  patch({ connecting: true });
  try {
    const user = await gh.user();
    lastScopes = lastScopes || [];
    const remember = opts.remember ?? false;
    const device = opts.device ?? false;
    let vaultSheet: VaultSheet = 'none';
    if (device) {
      if (state.vaultUnlocked && vaultPass) {
        await vaultSeal({ token }, vaultPass);
      } else if (vaultExists()) {
        vaultSheet = 'unlock';
        pendingDeviceToken = token;
      } else {
        vaultSheet = 'create';
        pendingDeviceToken = token;
      }
    }
    try { if (remember) sessionStorage.setItem('orbit.token', token); else sessionStorage.removeItem('orbit.token'); } catch { /* privado */ }
    patch({
      token, user, connected: true, connecting: false, scopes: lastScopes || [],
      vaultSheet, vaultExists: state.vaultExists || vaultExists(),
      prefs: remember || device ? { ...state.prefs, remember, rememberDevice: device || state.prefs.rememberDevice } : state.prefs,
    });
    setPrefs(remember || device ? { remember, rememberDevice: device || state.prefs.rememberDevice } : {});
    pushToast('Conectado a GitHub', 'ok', '@' + user.login + (lastScopes?.length ? ' · scopes: ' + lastScopes.join(', ') : ''));
    loadRepos().catch(() => { /* la lista se recarga al usarse */ });
  } catch (e) {
    patch({ connecting: false });
    throw e;
  }
}

export function disconnect() {
  try { sessionStorage.removeItem('orbit.token'); } catch { /* privado */ }
  vaultPass = null;
  pendingDeviceToken = null;
  setToken(null);
  patch({ token: null, user: null, connected: false, connecting: false, scopes: [], vaultUnlocked: false });
  pushToast('Sesión desconectada', 'info');
}

export async function loadRepos(): Promise<GHRepo[]> {
  const repos = await gh.repos();
  patch({ repos });
  return repos;
}

/* ---------- bóveda ---------- */
export function openVaultSheet(which: VaultSheet) {
  patch({ vaultSheet: which, vaultError: '' });
}

export async function unlockVault(pass: string): Promise<boolean> {
  const payload = await vaultUnlock<{ token?: string }>(pass);
  if (!payload) {
    patch({ vaultError: 'Contraseña incorrecta — la bóveda no se abre' });
    return false;
  }
  vaultPass = pass;
  patch({ vaultUnlocked: true, vaultSheet: 'none', vaultError: '' });
  if (payload.token) {
    setToken(payload.token);
    try {
      const user = await gh.user();
      patch({ token: payload.token, user, connected: true });
      pushToast('Sesión restaurada desde la bóveda', 'ok', '@' + user.login);
      loadRepos().catch(() => { /* silencio */ });
    } catch {
      setToken(null);
      pushToast('El token guardado ya no es válido', 'err', 'Conéctate de nuevo en Control Center');
    }
  }
  if (pendingDeviceToken) {
    await vaultSeal({ token: pendingDeviceToken }, pass);
    pendingDeviceToken = null;
    pushToast('Token cifrado en este dispositivo', 'ok');
  }
  return true;
}

export async function createVault(pass1: string, pass2: string): Promise<boolean> {
  if (pass1.length < 6) { patch({ vaultError: 'La contraseña debe tener al menos 6 caracteres' }); return false; }
  if (pass1 !== pass2) { patch({ vaultError: 'Las contraseñas no coinciden' }); return false; }
  await vaultSeal({ token: state.token || pendingDeviceToken }, pass1);
  vaultPass = pass1;
  pendingDeviceToken = null;
  patch({ vaultUnlocked: true, vaultSheet: 'none', vaultError: '', vaultExists: true });
  pushToast('Bóveda creada', 'ok', 'El token queda cifrado con AES-256-GCM en este dispositivo');
  return true;
}

export function destroyVault() {
  vaultDestroy();
  vaultPass = null;
  patch({ vaultExists: false, vaultUnlocked: false });
  pushToast('Bóveda eliminada', 'info');
}

export function wipeAll() {
  try {
    localStorage.removeItem('orbit.prefs');
    sessionStorage.clear();
    vaultDestroy();
  } catch { /* privado */ }
  vaultPass = null;
  pendingDeviceToken = null;
  setToken(null);
  try { localStorage.removeItem('orbit.chat'); } catch { /* privado */ }
  state = { ...state, token: null, user: null, connected: false, connecting: false, rate: null, scopes: [], repos: [], vaultExists: false, vaultUnlocked: false, vaultSheet: 'none', prefs: DEFAULT_PREFS };
  emit();
  pushToast('Datos locales borrados', 'info');
}

/* ---------- arranque ---------- */
export async function boot(): Promise<void> {
  const prefs = loadPrefs();
  const vault = vaultExists();
  patch({ prefs, vaultExists: vault });
  applyAppearance(prefs);
  netKeep.setTarget(prefs.netkeepKbps);
  if (prefs.netkeep) netKeep.start();

  let token: string | null = null;
  try { token = sessionStorage.getItem('orbit.token'); } catch { /* privado */ }
  if (token) {
    setToken(token);
    try {
      const user = await gh.user();
      patch({ token, user, connected: true, scopes: lastScopes || [] });
      loadRepos().catch(() => { /* silencio */ });
      return;
    } catch (e) {
      setToken(null);
      pushToast('El token guardado ya no es válido', 'err', e instanceof GitHubError ? e.message : 'Conéctate de nuevo');
    }
  }
  if (vault) {
    patch({ vaultSheet: 'unlock' });
  }
}

/* ---------- hook ---------- */
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
export function useOrbit(): AppState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
