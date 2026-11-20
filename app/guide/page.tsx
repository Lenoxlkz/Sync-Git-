'use client';

/* Guía y ayuda: conceptos en palabras simples, comandos del chat y notas de
   seguridad. Puerto de la vista Guía del original, ajustado a Orbit Next. */
import Link from 'next/link';
import { GlassButton } from '@zakisheriff/liquid-glass';
import { Md } from '@/lib/md';
import { Section } from '@/components/bits';
import { IcSparkles, IcTerminal, IcLayers, IcShield, IcChevR } from '@/components/Icons';

const CONCEPTOS: Array<[string, string]> = [
  ['Repositorio (repo)', 'La carpeta de un proyecto en GitHub. Guarda todos los archivos **y toda su historia**: cada cambio queda registrado con quién lo hizo y cuándo. Puede ser **público** (cualquiera lo ve) o **privado** (solo tú y quien invites).'],
  ['Rama (branch)', 'Una línea de trabajo independiente. La rama **main** suele ser la versión estable; creas una rama nueva para trabajar sin romper nada, y cuando terminas, juntas los cambios con un pull request. En Orbit: «crea una rama llamada development».'],
  ['Commit', 'Una "fotografía" del proyecto en un momento concreto. Guarda qué archivos cambiaron, el autor, la fecha y un mensaje que explica el cambio. La historia del repositorio es la lista de sus commits.'],
  ['Push / enviar', 'Mandar tus commits desde tu equipo al repositorio en GitHub. En Orbit el Explorer lo hace por ti: compara cada archivo por su **hash Git**, crea un commit y actualiza la rama.'],
  ['Issue', 'Una nota dentro del repositorio para seguir un **problema, idea o tarea**: "el botón no funciona en móvil", "añadir modo oscuro". Tiene número, etiquetas (bug, enhancement…), responsable y comentarios. No cambia código: organiza el trabajo.'],
  ['Pull Request (PR)', 'La propuesta formal de **juntar los cambios de una rama en otra**. Muestra el diff (qué cambió línea a línea), permite comentar, pedir cambios o aprobar, y al aceptarse se hace *merge*. Es cómo se revisa código antes de integrarlo.'],
  ['Merge (fusionar)', 'El acto de combinar los cambios de una rama en otra. Si dos personas tocaron lo mismo, puede haber un **conflicto** que se resuelve eligiendo qué versión queda.'],
  ['Fork', 'Tu **copia personal** del repositorio de otra persona. Sirve para experimentar o proponer cambios sin afectar el original.'],
  ['Tag', 'Una **etiqueta** puesta sobre un commit concreto, normalmente para marcar versiones: v1.0.0, v2.3.1.'],
  ['Release', 'Una **publicación** oficial de una versión: junta un tag con notas de cambios y **archivos descargables** (hasta 350 MB por paquete) para quien use tu proyecto.'],
  ['Diff', 'La **comparación línea a línea** entre dos versiones: verde lo que se añade, rojo lo que se elimina. La base de cualquier revisión.'],
  ['Hash Git (SHA-1)', 'La **huella digital del contenido** de un archivo: si cambia una coma, cambia el hash. Orbit lo usa para saber con certeza qué archivos son nuevos, cuáles cambiaron y cuáles son idénticos — por contenido, no por fecha.'],
  ['Blob y árbol', 'Cómo Git guarda las cosas por dentro: cada archivo es un *blob* (contenido + hash) y las carpetas son *árboles* que apuntan a sus blobs. Orbit construye el árbol completo de tu carpeta y lo compara con el del repo.'],
  ['Rate limit', 'El **límite de peticiones por hora** que la API de GitHub permite a tu token (5.000 con un PAT clásico). Orbit lo muestra en Control Center para que sepas cuánto te queda.'],
];

const COMANDOS: Array<[string, string]> = [
  ['«muéstrame mis repositorios»', 'Lista tus repos con descripción y lenguaje'],
  ['«crea un repositorio llamado mi-proyecto»', 'Crea un repo nuevo (te pide confirmar escribiendo el nombre)'],
  ['«crea una rama llamada development»', 'Crea la rama desde main, con confirmación en la tarjeta'],
  ['«muéstrame las ramas»', 'Lista las ramas del repositorio activo'],
  ['«muéstrame los últimos commits»', 'Historial reciente del repositorio activo'],
  ['«abre los issues pendientes» / «los cerrados»', 'Issues abiertos o cerrados de todos tus repos'],
  ['«muéstrame los pull requests»', 'PRs abiertos con estado y ramas'],
  ['«prepara un pull request»', 'Abre el asistente de creación de PR'],
  ['«compara main con development»', 'Diff entre ramas con estadísticas'],
  ['«busca archivos que contengan función X»', 'Búsqueda de código en el repo activo'],
  ['«sube esta carpeta al repositorio»', 'Te lleva al Explorer con el flujo de envío'],
  ['«estado de la conexión»', 'Tarjeta con conexión, IA y cuota de la API'],
  ['«modo oscuro» / «modo claro»', 'Cambia el tema al instante'],
  ['«limpia el chat»', 'Borra el historial local (con confirmación)'],
  ['«guía» / «ayuda»', 'Abre esta vista'],
];

const FLUJOS: Array<[string, string]> = [
  ['Conectar tu cuenta', 'Crea un PAT en GitHub (scope **repo** en tokens classic; en fine-grained, permisos de **Contents**), pégalo en **Control Center → Conexión con GitHub** y pulsa *Verificar y conectar*. Orbit comprueba tu identidad, muestra tus permisos (scopes) y carga tus repositorios. Puedes recordar la sesión solo para esta pestaña (`sessionStorage`) o mantenerla **cifrada en este dispositivo** con la bóveda.'],
  ['Proteger tus secretos · Zero Trust', 'El token opcionalmente se guarda en una **bóveda local**: PBKDF2-SHA-256 (150.000 iteraciones) deriva la clave desde tu frase y **AES-256-GCM** cifra el contenido; sin la frase no hay lectura posible y la frase **no se guarda**. Los mensajes de la app **redactan** cualquier token que pudiera filtrarse en pantalla, la auditoría de Control Center comprueba que el código cargado contiene **0 credenciales**, y los archivos que parecen secretos (`.env`, `.pem`, `id_rsa`…) se **excluyen por defecto** al subir y exigen el interruptor «incluir secretos» para enviarse. Borrar datos locales elimina todo en un clic.'],
  ['Explorar y administrar repos', 'En **Repositories** tienes los filtros por lenguaje, el buscador, el orden (recientes, A-Z, ★) y la **ficha de cada proyecto**: descripción, ramas (crear y eliminar), commits, tags y releases. El **menú contextual** (clic derecho o el botón ···) abre la ficha, el Code Explorer, el fork o el borrado con confirmación escribiendo el nombre.'],
  ['Subir una carpeta o ZIP', 'En **Explorer**: arrastra la carpeta o importa el ZIP (ZIP64 soportado, se abre en tu navegador). Elige repo y rama (se recuerdan para la próxima), escribe un mensaje de commit y pulsa **Analizar**: cada archivo se compara contra el repo **por hash Git, no por fecha**. Con **Sincronizar espejo** activado, lo que falte en tu carpeta se borra del repo. Antes de subir puedes **comparar cualquier archivo cambiado** con un diff lado a lado contra la versión del repo, y nada se envía sin pulsar **Subir**: el resultado se verifica leyendo el árbol final ruta por ruta.'],
  ['Mantener la red activa (NetKeep)', 'Orbit puede descargar un **caudal mínimo y constante** (10–200 kbps configurable) para que la conexión esté «tibia»: TCP activo, NAT sin expirar y DNS caliente, de modo que subir archivos no empiece con un pico repentino. No gasta cuota de la API (el goteo baja de un CDN público de pruebas) y se **retira solo** mientras la app hace trabajo real. La sonda cada 15 s mide la latencia real a GitHub; System Status muestra el caudal instantáneo, la media y los MB de la sesión.'],
  ['Publicar releases con paquetes', 'En la ficha del repo → pestaña **Releases** → *Crear release*: defines tag, título y notas y puedes **adjuntar paquetes** (.apk, .exe, .ipa, .deb, .zip…) de hasta **350 MB por archivo**. Al publicar, una **ventana de 120 segundos** te deja cancelar o publicar ya; luego la subida es directa (sin límite de velocidad) con barra de progreso por archivo y reintentos de los fallidos.'],
  ['Revisar y editar código', 'En **Code Explorer** eliges explícitamente el repositorio; abres cualquier archivo con **resaltado de sintaxis**, números de línea, **búsqueda interna** con saltos, copiar, descargar y previsualización de **Markdown** o HTML (iframe aislado sin scripts). El botón **Comparar ramas** muestra el diff archivo por archivo con contexto. El lápiz entra en **modo edición**: al confirmar, Orbit crea un **commit real** en la rama con el contenido del editor (con mensaje de commit).'],
  ['Trabajar con PRs e issues', 'En **Pull Requests** ves los de toda tu cuenta, abres el detalle con el **diff de archivos del cambio**, comentas, **apruebas o pides cambios**, y fusionas (merge/squash/rebase) tras confirmación. En **Issues** creas con etiquetas, **editas** título y descripción, cierras/reabres y filtras por etiqueta. También desde el chat: «prepara un pull request».'],
  ['Chatear y usar IA', 'Escribe un comando en lenguaje natural («mis repos») y Orbit lo ejecuta al instante con tarjetas visuales. Si activas un proveedor de IA en Control Center, cualquier otra frase la responde el modelo **con el contexto de tu cuenta** — y puede ejecutar comandos por ti con un clic. El botón *Ver modelos disponibles* lista los modelos que tu clave tiene accesibles en el proveedor y te deja elegir uno.'],
];

export default function GuidePage() {
  return (
    <>
      <Section title="Guía y ayuda" sub="Conceptos en palabras simples, todos los comandos y notas de seguridad">
        <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <IcSparkles size={16} />
            <b style={{ fontSize: 13.5 }}>¿Qué es cada cosa?</b>
            <span className="tiny" style={{ marginLeft: 'auto' }}>Toca para desplegar</span>
          </div>
          <div style={{ padding: '8px 12px 12px' }}>
            {CONCEPTOS.map(([t, d]) => (
              <details key={t} className="gi">
                <summary>{t}<span className="chev"><IcChevR size={13} /></span></summary>
                <div className="gi-b"><Md src={d} /></div>
              </details>
            ))}
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', overflow: 'hidden', marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <IcTerminal size={16} />
            <b style={{ fontSize: 13.5 }}>Comandos del chat</b>
            <span className="tiny" style={{ marginLeft: 'auto' }}>Se escriben tal cual, en español</span>
          </div>
          <div style={{ padding: '8px 16px 14px' }}>
            {COMANDOS.map(([c, d]) => (
              <div key={c} className="cmd-row">
                <span className="cmd">{c}</span>
                <span className="what">{d}</span>
              </div>
            ))}
            <div className="note" style={{ marginTop: 12 }}>
              <IcSparkles size={15} />
              <span><b>¿Y si escribo cualquier otra cosa?</b> Con un proveedor de IA activado (Control Center), la frase va al modelo con el contexto de tu cuenta: responde, explica y puede ejecutar comandos por ti con un clic. Sin IA, verás la lista de comandos disponibles.</span>
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', overflow: 'hidden', marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <IcLayers size={16} />
            <b style={{ fontSize: 13.5 }}>Guía de uso, paso a paso</b>
          </div>
          <div style={{ padding: '8px 12px 12px' }}>
            {FLUJOS.map(([t, d], i) => (
              <details key={t} className="gi" open={i === 0}>
                <summary>{i + 1} · {t}<span className="chev"><IcChevR size={13} /></span></summary>
                <div className="gi-b"><Md src={d} /></div>
              </details>
            ))}
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', overflow: 'hidden', marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <IcShield size={16} />
            <b style={{ fontSize: 13.5 }}>Seguridad, en claro</b>
          </div>
          <div style={{ padding: '8px 18px 16px', fontSize: 12.8, lineHeight: 1.7, color: 'var(--text-2)' }} className="md">
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li><b>Tu PAT</b> vive en la memoria del navegador; opcionalmente en <code className="md-code">sessionStorage</code> (solo la pestaña) o cifrado en la <b>bóveda local</b> (este dispositivo). Nunca se escribe en commits ni se envía a otro sitio distinto de <code className="md-code">api.github.com</code>.</li>
              <li><b>Las claves de IA</b> se guardan en localStorage de este dispositivo y viajan únicamente al proveedor que las configure (OpenAI · GLM · Gemini).</li>
              <li><b>Nada se ejecuta</b>: los archivos que importas o abres se muestran y suben, pero Orbit nunca los ejecuta. La previsualización HTML usa un <code className="md-code">iframe</code> aislado sin scripts.</li>
              <li><b>Las operaciones de escritura</b> (crear rama, crear repo, eliminar, subir, publicar releases) siempre piden confirmación; eliminar un repositorio exige <b>escribir su nombre</b>.</li>
              <li><b>El ZIP se abre en tu navegador</b>: tus archivos no pasan por ningún servidor intermedio; van de tu equipo a la API de GitHub.</li>
              <li><b>Para un producto multiusuario real</b>, la recomendación profesional es GitHub App + OAuth + backend propio que custodie las credenciales. Esta app está pensada para uso personal desde tu navegador.</li>
            </ul>
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/control/"><GlassButton variant="filled" tint="var(--orbit-accent)">Ir a Control Center</GlassButton></Link>
          <Link href="/"><GlassButton>Volver al chat</GlassButton></Link>
        </div>
      </Section>
    </>
  );
}
