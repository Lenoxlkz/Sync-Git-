'use client';

/* Markdown ligero → React (sin dangerouslySetInnerHTML: cero XSS).
   Soporta: encabezados, listas, negrita/cursiva, `código`, bloques de código,
   enlaces, citas, tablas simples y separadores. */

import { Fragment, type ReactNode } from 'react';

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // dividir preservando `código`, **negrita**, *cursiva* y [texto](url)
  const re = /(`[^`\n]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith('`')) {
      nodes.push(<code key={key} className="md-code">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith('**')) {
      nodes.push(<b key={key}>{tok.slice(2, -2)}</b>);
    } else if (tok.startsWith('*')) {
      nodes.push(<i key={key}>{tok.slice(1, -1)}</i>);
    } else {
      const mm = tok.match(/\[([^\]]+)\]\(([^)\s]+)\)/);
      if (mm) nodes.push(<a key={key} href={mm[2]} target="_blank" rel="noopener noreferrer" className="md-link">{mm[1]}</a>);
      else nodes.push(tok);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Md({ src, className }: { src: string; className?: string }) {
  const lines = (src || '').split('\n');
  const out: ReactNode[] = [];
  let list: 'ul' | 'ol' | null = null;
  let listItems: ReactNode[] = [];
  let table: string[][] | null = null;
  let buf: string[] = [];
  let inCode = false;
  let key = 0;

  const closeList = () => {
    if (list && listItems.length) {
      const Tag = list === 'ul' ? 'ul' : 'ol';
      out.push(<Tag key={`l${key++}`} className="md-list">{listItems.map((li, i) => <li key={i}>{li}</li>)}</Tag>);
    }
    list = null; listItems = [];
  };
  const closeTable = () => {
    if (table && table.length) {
      const [head, ...rows] = table;
      out.push(
        <div key={`t${key++}`} className="table-wrap md-table-wrap">
          <table className="md-table">
            <thead><tr>{head.map((c, i) => <th key={i}>{inline(c, `th${i}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c, `td${ri}-${ci}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
    }
    table = null;
  };
  const flushBuf = () => {
    if (buf.length) {
      out.push(<pre key={`p${key++}`} className="md-pre"><code>{buf.join('\n')}</code></pre>);
      buf = [];
    }
  };

  for (const raw of lines) {
    if (/^```/.test(raw)) {
      if (inCode) { flushBuf(); inCode = false; }
      else { closeList(); closeTable(); inCode = true; }
      continue;
    }
    if (inCode) { buf.push(raw); continue; }
    const t = raw.trim();
    if (/^\|.*\|$/.test(t)) {
      closeList();
      const cells = t.slice(1, -1).split('|').map(c => c.trim());
      if (/^[\s:|-]+$/.test(t)) continue;
      if (!table) table = [];
      table.push(cells);
      continue;
    }
    closeTable();
    if (/^(-{3,}|\*{3,})$/.test(t)) { closeList(); out.push(<hr key={`h${key++}`} className="md-hr" />); continue; }
    const h = t.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      closeList();
      const lv = h[1].length;
      const Tag = (lv === 1 ? 'h1' : lv === 2 ? 'h2' : 'h3') as 'h1' | 'h2' | 'h3';
      out.push(<Tag key={`hd${key++}`} className="md-h">{inline(h[2], `hd${key}`)}</Tag>);
      continue;
    }
    const ul = t.match(/^[-*]\s+(.*)/);
    const ol = t.match(/^\d+\.\s+(.*)/);
    if (ul || ol) {
      const kind: 'ul' | 'ol' = ul ? 'ul' : 'ol';
      if (list !== kind) { closeList(); list = kind; }
      listItems.push(inline((ul || ol)![1], `li${key}`));
      continue;
    }
    if (/^>\s?/.test(t)) {
      closeList();
      out.push(<blockquote key={`bq${key++}`} className="md-bq">{inline(t.replace(/^>\s?/, ''), `bq${key}`)}</blockquote>);
      continue;
    }
    if (t === '') { closeList(); continue; }
    closeList();
    out.push(<p key={`pp${key++}`} className="md-p">{inline(t, `pp${key}`)}</p>);
  }
  flushBuf();
  closeList();
  closeTable();
  return <div className={className ? `md ${className}` : 'md'}>{out.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</div>;
}
