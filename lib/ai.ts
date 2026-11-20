'use client';

/* IA multi-proveedor, llamada directa desde el navegador con la clave del usuario.
   La clave se guarda local (localStorage/bóveda) y solo viaja al endpoint del
   proveedor elegido — nunca a ningún servidor intermedio. */

export type AIProvider = 'openai' | 'glm' | 'gemini';

export const AI_PROVIDERS: Array<{ id: AIProvider; label: string; model: string }> = [
  { id: 'openai', label: 'OpenAI', model: 'gpt-4o-mini' },
  { id: 'glm', label: 'GLM · Z.ai', model: 'glm-4-flash' },
  { id: 'gemini', label: 'Gemini', model: 'gemini-2.0-flash' },
];

export interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }

const TIMEOUT = 45000;

export async function aiChat(provider: AIProvider, key: string, model: string, messages: ChatMsg[]): Promise<string> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const to = ctl ? setTimeout(() => ctl.abort(), TIMEOUT) : null;
  try {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role === 'user' ? 'user' : 'user',
        parts: [{ text: m.content }],
      }));
      const system = messages.find(m => m.role === 'system');
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contents.filter(c => c.role !== 'user' || true),
          ...(system ? { systemInstruction: { parts: [{ text: system.content }] } } : {}),
        }),
        ...(ctl ? { signal: ctl.signal } : {}),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`Gemini ${res.status}: ${t.slice(0, 180)}`);
      }
      const j = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      return j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '(respuesta vacía)';
    }

    const url = provider === 'glm'
      ? 'https://api.z.ai/api/paas/v4/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, messages, temperature: 0.7 }),
      ...(ctl ? { signal: ctl.signal } : {}),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`${provider === 'glm' ? 'GLM' : 'OpenAI'} ${res.status}: ${t.slice(0, 180)}`);
    }
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return j.choices?.[0]?.message?.content || '(respuesta vacía)';
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('El proveedor de IA no respondió en 45 s');
    throw e;
  } finally { if (to) clearTimeout(to); }
}

export const ORBIT_SYSTEM =
  'Eres Orbit, la asistente personal de un centro de mando de GitHub. ' +
  'Respondes en español, breve y práctica. Ayudas con repos, commits, PRs, issues y Git en general. ' +
  'No inventas datos de repositorios: si el usuario pregunta por sus datos concretos, sugiérele los comandos de Orbit (escribe «ayuda»).';

/** Lista los modelos que la clave tiene disponibles en el proveedor. */
export async function aiListModels(provider: AIProvider, key: string): Promise<Array<{ id: string; name: string }>> {
  const fail = (status: number) => {
    if (status === 401 || status === 403) throw new Error('Clave rechazada (' + status + '): revisa la API key.');
    throw new Error('El proveedor respondió ' + status + ' al listar modelos.');
  };
  if (provider === 'gemini') {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key));
    if (!res.ok) fail(res.status);
    const j = (await res.json()) as { models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }> };
    return (j.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => ({ id: (m.name || '').replace(/^models\//, ''), name: m.displayName || m.name || '' }));
  }
  const url = provider === 'glm'
    ? 'https://api.z.ai/api/paas/v4/models'
    : 'https://api.openai.com/v1/models';
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + key } });
  if (!res.ok) fail(res.status);
  const j = (await res.json()) as { data?: Array<{ id?: string; name?: string; display_name?: string }>; models?: Array<{ id?: string; name?: string; display_name?: string }> };
  const arr = j.data || j.models || [];
  return arr
    .map(m => ({ id: m.id || m.name || '', name: m.display_name || m.name || m.id || '' }))
    .filter(m => m.id);
}
