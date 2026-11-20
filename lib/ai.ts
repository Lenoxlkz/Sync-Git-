'use client';

/* IA multi-proveedor, llamada directa desde el navegador con la clave del usuario.
   La clave se guarda en local (localStorage/bóveda) y solo viaja al endpoint del
   proveedor elegido — nunca a ningún servidor intermedio. La UI nunca vuelve a
   mostrar una clave guardada: solo se puede reemplazar escribiendo una nueva. */

export type AIProvider =
  | 'openai' | 'anthropic' | 'deepseek' | 'xai' | 'glm' | 'gemini'
  | 'mistral' | 'openrouter' | 'groq' | 'ollama' | 'custom';

export type AIKind = 'openai' | 'anthropic' | 'gemini';

export interface AIProv {
  id: AIProvider;
  label: string;
  model: string;
  baseUrl: string;
  kind: AIKind;
  keyHint: string;
  needsKey: boolean;
  note?: string;
}

export const AI_PROVIDERS: AIProv[] = [
  { id: 'openai', label: 'OpenAI', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', kind: 'openai', keyHint: 'sk-…', needsKey: true },
  { id: 'anthropic', label: 'Claude · Anthropic', model: 'claude-3-5-sonnet-latest', baseUrl: 'https://api.anthropic.com/v1', kind: 'anthropic', keyHint: 'sk-ant-…', needsKey: true },
  { id: 'deepseek', label: 'DeepSeek', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1', kind: 'openai', keyHint: 'sk-…', needsKey: true },
  { id: 'xai', label: 'Grok · xAI', model: 'grok-2-latest', baseUrl: 'https://api.x.ai/v1', kind: 'openai', keyHint: 'xai-…', needsKey: true },
  { id: 'glm', label: 'GLM · Z.ai', model: 'glm-4-flash', baseUrl: 'https://api.z.ai/api/paas/v4', kind: 'openai', keyHint: 'id…', needsKey: true },
  { id: 'gemini', label: 'Gemini · Google', model: 'gemini-2.0-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', kind: 'gemini', keyHint: 'AIza…', needsKey: true },
  { id: 'mistral', label: 'Mistral AI', model: 'mistral-small-latest', baseUrl: 'https://api.mistral.ai/v1', kind: 'openai', keyHint: '…', needsKey: true },
  { id: 'openrouter', label: 'OpenRouter', model: 'openai/gpt-4o-mini', baseUrl: 'https://openrouter.ai/api/v1', kind: 'openai', keyHint: 'sk-or-…', needsKey: true },
  { id: 'groq', label: 'Groq', model: 'llama-3.3-70b-versatile', baseUrl: 'https://api.groq.com/openai/v1', kind: 'openai', keyHint: 'gsk_…', needsKey: true },
  { id: 'ollama', label: 'Ollama (local)', model: 'llama3.1', baseUrl: 'http://localhost:11434/v1', kind: 'openai', keyHint: 'sin clave', needsKey: false, note: 'requiere Ollama corriendo en tu equipo' },
  { id: 'custom', label: 'Personalizada (OpenAI-compatible)', model: '', baseUrl: '', kind: 'openai', keyHint: 'clave del endpoint', needsKey: false, note: 'define URL Base y modelo' },
];

export function provOf(id: AIProvider): AIProv {
  return AI_PROVIDERS.find(p => p.id === id) || AI_PROVIDERS[0];
}

/** URL efectiva: la personalizada manda; si no, la oficial del proveedor. */
export function resolveBase(id: AIProvider, custom?: string): string {
  const u = (custom || '').trim().replace(/\/+$/, '');
  return u || provOf(id).baseUrl;
}

export interface AIOpts { baseUrl?: string; gatewayKey?: string }

export interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }

const TIMEOUT = 45000;

async function fetchTO(url: string, init: RequestInit): Promise<Response> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const to = ctl ? setTimeout(() => ctl.abort(), TIMEOUT) : null;
  try {
    return await fetch(url, { ...init, ...(ctl ? { signal: ctl.signal } : {}) });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('El proveedor de IA no respondió en 45 s');
    throw e;
  } finally { if (to) clearTimeout(to); }
}

export async function aiChat(
  provider: AIProvider, key: string, model: string, messages: ChatMsg[], opts: AIOpts = {},
): Promise<string> {
  const prov = provOf(provider);
  const base = resolveBase(provider, opts.baseUrl);
  const authKey = (opts.gatewayKey || '').trim() || key;

  if (prov.kind === 'gemini') {
    const url = `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const system = messages.find(m => m.role === 'system');
    const res = await fetchTO(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system.content }] } } : {}),
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Gemini ${res.status}: ${t.slice(0, 180)}`);
    }
    const j = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '(respuesta vacía)';
  }

  if (prov.kind === 'anthropic') {
    const system = messages.find(m => m.role === 'system');
    const res = await fetchTO(`${base}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        ...(system ? { system: system.content } : {}),
        messages: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Claude ${res.status}: ${t.slice(0, 180)}`);
    }
    const j = (await res.json()) as { content?: Array<{ text?: string }> };
    return j.content?.map(c => c.text || '').join('') || '(respuesta vacía)';
  }

  /* kind openai-compatible: OpenAI, DeepSeek, xAI, GLM, Mistral, OpenRouter, Groq, Ollama, custom */
  const res = await fetchTO(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authKey ? { Authorization: 'Bearer ' + authKey } : {}),
    },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`${prov.label} ${res.status}: ${t.slice(0, 180)}`);
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content || '(respuesta vacía)';
}

export const ORBIT_SYSTEM =
  'Eres Orbit, la asistente personal de un centro de mando de GitHub. ' +
  'Respondes en español, breve y práctica. Ayudas con repos, commits, PRs, issues y Git en general. ' +
  'No inventas datos de repositorios: si el usuario pregunta por sus datos concretos, sugiérele los comandos de Orbit (escribe «ayuda»).';

/** Lista los modelos que la clave tiene disponibles en el proveedor. */
export async function aiListModels(provider: AIProvider, key: string, opts: AIOpts = {}): Promise<Array<{ id: string; name: string }>> {
  const prov = provOf(provider);
  const base = resolveBase(provider, opts.baseUrl);
  const authKey = (opts.gatewayKey || '').trim() || key;
  const fail = (status: number) => {
    if (status === 401 || status === 403) throw new Error('Clave rechazada (' + status + '): revisa la API key.');
    throw new Error('El proveedor respondió ' + status + ' al listar modelos.');
  };
  if (prov.kind === 'gemini') {
    const res = await fetchTO(`${base}/models?key=${encodeURIComponent(key)}`, {});
    if (!res.ok) fail(res.status);
    const j = (await res.json()) as { models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }> };
    return (j.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => ({ id: (m.name || '').replace(/^models\//, ''), name: m.displayName || m.name || '' }));
  }
  if (prov.kind === 'anthropic') {
    const res = await fetchTO(`${base}/models`, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } });
    if (!res.ok) fail(res.status);
    const j = (await res.json()) as { data?: Array<{ id?: string; display_name?: string }> };
    return (j.data || []).map(m => ({ id: m.id || '', name: m.display_name || m.id || '' })).filter(m => m.id);
  }
  const res = await fetchTO(`${base}/models`, { headers: authKey ? { Authorization: 'Bearer ' + authKey } : {} });
  if (!res.ok) fail(res.status);
  const j = (await res.json()) as { data?: Array<{ id?: string; name?: string; display_name?: string }>; models?: Array<{ id?: string; name?: string; display_name?: string }> };
  const arr = j.data || j.models || [];
  return arr
    .map(m => ({ id: m.id || m.name || '', name: m.display_name || m.name || m.id || '' }))
    .filter(m => m.id);
}
