'use client';

/* Parser de comandos del Personal Chat de Orbit. */

export type Cmd =
  | { kind: 'ayuda' }
  | { kind: 'estado' }
  | { kind: 'sube' }
  | { kind: 'repos'; arg?: string }
  | { kind: 'ramas'; arg: string }
  | { kind: 'prs'; arg: string }
  | { kind: 'issues'; arg: string }
  | { kind: 'crea'; arg: string }
  | { kind: 'borra'; arg: string }
  | { kind: 'tema'; arg: 'claro' | 'oscuro' | 'auto' }
  | { kind: 'limpiar' };

export function parseCommand(text: string): Cmd | null {
  const t = text.trim();
  if (!t) return null;
  const l = t.toLowerCase();

  if (/^(ayuda|help|comandos|\?)$/.test(l)) return { kind: 'ayuda' };
  if (/^(estado|status|cuota|conexi[oó]n)$/.test(l)) return { kind: 'estado' };
  if (/^(sube|subir|explorador|upload)$/.test(l)) return { kind: 'sube' };
  if (/^tema\s+(claro|oscuro|auto)$/.test(l)) return { kind: 'tema', arg: l.replace(/^tema\s+/, '') as 'claro' | 'oscuro' | 'auto' };
  if (/^(limpia(r| el chat)|clear)$/.test(l)) return { kind: 'limpiar' };

  let m = l.match(/^(?:mis\s+)?(?:repos|repositorios)(?:\s+(.+))?$/);
  if (m) return { kind: 'repos', arg: m[1]?.trim() || undefined };

  m = t.match(/^(?:ramas|branches)\s+(\S+)$/i);
  if (m) return { kind: 'ramas', arg: m[1] };

  m = t.match(/^(?:prs|pulls|pull\s?requests)\s+(\S+)$/i);
  if (m) return { kind: 'prs', arg: m[1] };

  m = t.match(/^(?:issues|incidencias)\s+(\S+)$/i);
  if (m) return { kind: 'issues', arg: m[1] };

  m = t.match(/^(?:crea(?:r)?|nuevo)\s+repo\s+(\S+)$/i);
  if (m) return { kind: 'crea', arg: m[1] };

  m = t.match(/^(?:borra(?:r)?|elimina(?:r)?|remove)\s+repo\s+(\S+)$/i);
  if (m) return { kind: 'borra', arg: m[1] };

  return null;
}

export const HELP_TEXT = `Comandos de Orbit:
· repos [texto] — lista tus repositorios (con filtro opcional)
· ramas <repo> — ramas de un repositorio
· prs <repo> — pull requests abiertos
· issues <repo> — issues abiertos
· crea repo <nombre> — crea un repositorio
· borra repo <nombre> — elimina un repositorio (con confirmación)
· sube — abre el Explorador de subida delta
· estado — conexión y cuota de la API
· tema claro | oscuro | auto — cambia la apariencia
· limpiar — vacía esta conversación

Todo lo demás va a la IA si has configurado una clave en Control Center.`;
