/* Mapeo scopes del token ↔ funcionalidades de Orbit, en lenguaje natural.
   GitHub expone los scopes clásicos en la cabecera X-OAuth-Scopes de cada
   respuesta autenticada. Los tokens fine-grained NO envían esa cabecera:
   se marcan como «permisos no declarados» y se habilita lo esencial con
   aviso; los permisos reales se descubren al usar cada función. */

export type Cap =
  | 'repos' | 'code' | 'upload' | 'pulls' | 'issues'
  | 'workflow' | 'deleteRepo' | 'org' | 'notifications' | 'gists' | 'profile';

export interface CapInfo {
  cap: Cap;
  title: string;
  plain: string;
  scopes: string;
  features: string[];
  missingNote: string;
}

export const CAPS: CapInfo[] = [
  {
    cap: 'repos', title: 'Leer y escribir repositorios',
    plain: 'Crear, ver y modificar tus repositorios (públicos con public_repo, todos con repo).',
    scopes: 'repo / public_repo',
    features: ['Repos', 'Ficha de repositorio', 'Crear y editar repos'],
    missingNote: 'Sin repo/public_repo, la sección Repos y la ficha no aparecen en el menú.',
  },
  {
    cap: 'code', title: 'Leer y editar código',
    plain: 'Explorar el árbol de archivos, leer contenido y guardar cambios (permiso Contents).',
    scopes: 'repo / public_repo · Contents',
    features: ['Code Explorer', 'Commits y ramas', 'Editor de archivos'],
    missingNote: 'Sin Contents, el Code Explorer no puede abrir ni guardar archivos.',
  },
  {
    cap: 'upload', title: 'Subir archivos',
    plain: 'Crear blobs, árbol y commit para enviar archivos verificados a un repositorio.',
    scopes: 'repo / public_repo · Contents (write)',
    features: ['Explorer (subida delta)', 'Subir ZIP', 'Nueva carpeta'],
    missingNote: 'La sección Subir no estará disponible.',
  },
  {
    cap: 'pulls', title: 'Gestionar pull requests',
    plain: 'Ver, crear, comentar, revisar y fusionar pull requests.',
    scopes: 'repo / public_repo',
    features: ['Pull Requests', 'Revisión con diff', 'Crear PR con IA'],
    missingNote: 'La sección de PRs se oculta.',
  },
  {
    cap: 'issues', title: 'Gestionar issues',
    plain: 'Abrir, comentar, etiquetar y cerrar issues.',
    scopes: 'repo / public_repo',
    features: ['Issues', 'Crear y cerrar issues', 'Etiquetas'],
    missingNote: 'La sección de issues se oculta.',
  },
  {
    cap: 'workflow', title: 'Actualizar GitHub Actions',
    plain: 'Enviar cambios a .github/workflows (CI/CD). Con repo solo, GitHub rechaza esos commits.',
    scopes: 'workflow',
    features: ['Subir workflows', 'Editar CI en Code Explorer'],
    missingNote: 'Sin workflow, los commits que toquen .github/workflows fallan con 422 «refusing to allow…».',
  },
  {
    cap: 'deleteRepo', title: 'Eliminar repositorios',
    plain: 'Borrar repositorios completos (operación peligrosa e irreversible).',
    scopes: 'delete_repo',
    features: ['Eliminar repo desde la ficha'],
    missingNote: 'El botón de eliminar repositorio no aparece.',
  },
  {
    cap: 'org', title: 'Organizaciones',
    plain: 'Ver equipos y repositorios de organizaciones a las que perteneces.',
    scopes: 'admin:org / read:org',
    features: ['Repos de organizaciones'],
    missingNote: 'Solo verás repositorios personales.',
  },
  {
    cap: 'notifications', title: 'Notificaciones',
    plain: 'Leer tus notificaciones de GitHub (menciones, revisiones, CI).',
    scopes: 'notifications',
    features: ['Centro de notificaciones'],
    missingNote: 'Sin acceso al centro de notificaciones.',
  },
  {
    cap: 'gists', title: 'Gists',
    plain: 'Crear y editar gists (fragmentos de código rápidos).',
    scopes: 'gist',
    features: ['Guardar fragmentos como gist'],
    missingNote: 'No se pueden guardar fragmentos como gist.',
  },
  {
    cap: 'profile', title: 'Perfil y datos de cuenta',
    plain: 'Ver tu usuario, avatar y datos públicos de la cuenta.',
    scopes: 'user / read:user',
    features: ['Identidad en la topbar', 'Saludo personalizado'],
    missingNote: 'No se muestra tu identidad de GitHub.',
  },
];

export interface Caps {
  fineGrained: boolean;
  raw: string[];
  map: Record<Cap, boolean>;
}

export function capsFromScopes(scopes: string[]): Caps {
  const s = new Set((scopes || []).map(x => x.trim().toLowerCase()).filter(Boolean));
  const fineGrained = s.size === 0;
  const has = (...any: string[]) => any.some(x => s.has(x));
  const repoRW = has('repo', 'public_repo');
  /* fine-grained: GitHub no declara scopes — se habilita lo básico y se avisa */
  const maybe = (classic: boolean) => (fineGrained ? true : classic);
  return {
    fineGrained,
    raw: scopes || [],
    map: {
      repos: maybe(repoRW),
      code: maybe(repoRW),
      upload: maybe(repoRW),
      pulls: maybe(repoRW),
      issues: maybe(repoRW),
      workflow: fineGrained ? true : has('workflow'),
      deleteRepo: fineGrained ? false : has('delete_repo'),
      org: fineGrained ? true : has('admin:org', 'read:org', 'write:org'),
      notifications: fineGrained ? false : has('notifications'),
      gists: fineGrained ? false : has('gist'),
      profile: fineGrained ? true : has('user', 'read:user'),
    },
  };
}
