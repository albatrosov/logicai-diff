#!/usr/bin/env node
// render.mjs — render a logicAI-diff JSON into a self-contained HTML file.
// Theme follows the device (prefers-color-scheme). File refs open in the user's editor.
//
// Usage:
//   node render.mjs <input.json> [output.html]
// Prints the absolute path of the written HTML file on stdout.
// The model supplies only the DATA; this script owns the layout and styling.

import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let ROOT = '';                                  // absolute repo root (data.root)
let OPEN_TPL = 'vscode://file{path}:{line}';    // editor open-URL template (data.open_url_template)
let EDITOR_NAME = 'your editor';                // friendly name for the link tooltip (data.editor)

// Built-in templates for common editors. Placeholders: {path}, {path_enc}, {line}.
const EDITOR_TEMPLATES = {
  vscode: 'vscode://file{path}:{line}',
  'vscode-insiders': 'vscode-insiders://file{path}:{line}',
  cursor: 'cursor://file{path}:{line}',
  windsurf: 'windsurf://file{path}:{line}',
  vscodium: 'vscodium://file{path}:{line}',
  zed: 'zed://file{path}:{line}',
  phpstorm: 'phpstorm://open?file={path_enc}&line={line}',
  webstorm: 'webstorm://open?file={path_enc}&line={line}',
  idea: 'idea://open?file={path_enc}&line={line}',
  intellij: 'idea://open?file={path_enc}&line={line}',
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TYPE_META = {
  added: { label: 'Added' },
  modified: { label: 'Modified' },
  removed: { label: 'Removed' },
};

function cell(side, type, text) {
  const has = text != null && String(text).trim().length > 0;
  if (!has) return `<td class="cell empty"><span class="dash">—</span></td>`;
  let cls = '';
  if (side === 'before') cls = type === 'removed' ? 'del' : type === 'modified' ? 'mod' : '';
  else cls = (type === 'added' || type === 'modified') ? 'add' : '';
  return `<td class="cell ${cls}">${esc(text)}</td>`;
}

function openHref(file, lineStr) {
  const firstLine = (String(lineStr || '').match(/\d+/) || ['1'])[0];
  const abs = ROOT ? `${ROOT}/${file}` : `/${file}`;
  return OPEN_TPL
    .replaceAll('{path_enc}', encodeURIComponent(abs))
    .replaceAll('{path}', abs)
    .replaceAll('{line}', firstLine);
}

function chip(file, lineStr) {
  const idx = file.lastIndexOf('/');
  const dir = idx >= 0 ? file.slice(0, idx + 1) : '';
  const name = idx >= 0 ? file.slice(idx + 1) : file;
  const href = openHref(file, lineStr);
  const ln = lineStr ? `<span class="ref-ln">:${esc(lineStr)}</span>` : '';
  const toggle = dir
    ? `<button class="ref-dots" type="button" aria-label="Show full path"><span class="sl">/</span><span class="dt">…</span></button>`
    : '';
  const dirSpan = dir ? `<span class="ref-dir">${esc(dir)}</span>` : '';
  return `<span class="ref">${toggle}<a class="ref-link" href="${esc(href)}" title="Open in ${esc(EDITOR_NAME)}">${dirSpan}<span class="ref-name">${esc(name)}</span></a>${ln}</span>`;
}

// side = 'before' (left, removed/changed) | 'after' (right, added/changed)
function refsCell(side, list) {
  const items = (list || []).filter((r) => r[side] != null && String(r[side]).trim() !== '');
  if (items.length === 0) return `<td class="refs-cell empty"><span class="dash">—</span></td>`;
  const chips = items.map((r) => chip(r.file, r[side])).join('');
  return `<td class="refs-cell"><div class="refs">${chips}</div></td>`;
}

function refsRow(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  const any = list.some(
    (r) => (r.before && String(r.before).trim()) || (r.after && String(r.after).trim()),
  );
  if (!any) return '';
  return `<tr class="sec-refs">${refsCell('before', list)}${refsCell('after', list)}</tr>`;
}

function section(c, i) {
  const label = (TYPE_META[c.type] || TYPE_META.modified).label;
  const typeClass = TYPE_META[c.type] ? c.type : 'modified';
  const num = c.order != null ? c.order : i + 1;
  return `
  <tbody class="section">
    <tr class="sec-head">
      <td colspan="2">
        <span class="num">${esc(num)}</span>
        <span class="sec-title">${esc(c.title)}</span>
        <span class="badge ${typeClass}">${label}</span>
      </td>
    </tr>
    <tr class="sec-body">
      ${cell('before', c.type, c.before)}
      ${cell('after', c.type, c.after)}
    </tr>
    ${refsRow(c.refs)}
  </tbody>`;
}

const CSS = `
:root{
  color-scheme:light dark;
  --bg:#f5f6f8; --card:#ffffff; --card-border:#e8eaef;
  --shadow:0 1px 2px rgba(16,24,40,.04),0 1px 3px rgba(16,24,40,.03);
  --title:#2b2f36; --text:#2f343b; --muted:#6b7280; --faint:#c8cdd4;
  --divider:#f1f3f6; --divider-strong:#edeff3;
  --head-bg:#fafbfc; --sec-bg:#fcfcfd; --th:#8a929c;
  --num-bg:#eef0f4; --num-fg:#5a626d;
  --del:#fde7e4; --mod:#fcf1d4; --add:#e6f6ec; --empty:#fbfbfc;
  --refs-bg:#fbfcfd; --chip-bg:#f2f4f7; --chip-border:#e9ecf1; --chip-file:#475467; --chip-ln:#6f76d6; --chip-ico:#aeb6c0;
  --bdg-add-bg:#e8f4ed; --bdg-add-fg:#3f8b5e;
  --bdg-mod-bg:#fbf2dd; --bdg-mod-fg:#9a7530;
  --bdg-rm-bg:#fbeceb;  --bdg-rm-fg:#bb5a54;
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#0f1116; --card:#16181d; --card-border:#262a31;
    --shadow:none;
    --title:#e6e9ee; --text:#cfd4db; --muted:#8b929c; --faint:#3a3f47;
    --divider:#20242b; --divider-strong:#262a31;
    --head-bg:#14161b; --sec-bg:#15171c; --th:#7b828d;
    --num-bg:#23272e; --num-fg:#aab2bd;
    --del:#361f20; --mod:#352f1b; --add:#173622; --empty:#13151a;
    --refs-bg:#13151a; --chip-bg:#1b1f26; --chip-border:#2a2f38; --chip-file:#aeb6c0; --chip-ln:#8b91e8; --chip-ico:#5b636e;
    --bdg-add-bg:#1c3326; --bdg-add-fg:#7fce9e;
    --bdg-mod-bg:#33291a; --bdg-mod-fg:#e0b366;
    --bdg-rm-bg:#341f1e;  --bdg-rm-fg:#e09a95;
  }
}
*{box-sizing:border-box;}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--text);background:var(--bg);-webkit-font-smoothing:antialiased;}
.wrap{max-width:1440px;margin:0 auto;padding:32px 28px;}
header{margin-bottom:18px;}
h1{font-size:19px;font-weight:650;letter-spacing:-.01em;margin:0 0 6px;color:var(--title);}
.summary{color:var(--muted);font-size:13.5px;margin:0;max-width:92ch;line-height:1.6;}
.card{background:var(--card);border:1px solid var(--card-border);border-radius:12px;box-shadow:var(--shadow);overflow:hidden;}
table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px;}
thead th{width:50%;text-align:left;padding:10px 16px;background:var(--head-bg);color:var(--th);font-weight:600;font-size:11px;letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid var(--divider-strong);}
thead th:first-child{border-right:1px solid var(--divider-strong);}
tbody.section{border-top:1px solid var(--divider-strong);}
tbody.section:first-of-type{border-top:none;}
.sec-head td{background:var(--sec-bg);padding:11px 16px;border-bottom:1px solid var(--divider);}
.num{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--num-bg);color:var(--num-fg);font-size:11px;font-weight:700;margin-right:11px;vertical-align:middle;}
.sec-title{font-weight:600;color:var(--title);vertical-align:middle;}
.badge{float:right;padding:3px 11px;border-radius:999px;font-size:10.5px;font-weight:600;letter-spacing:.02em;line-height:1.7;}
.badge.added{background:var(--bdg-add-bg);color:var(--bdg-add-fg);}
.badge.modified{background:var(--bdg-mod-bg);color:var(--bdg-mod-fg);}
.badge.removed{background:var(--bdg-rm-bg);color:var(--bdg-rm-fg);}
.cell{width:50%;vertical-align:top;padding:14px 16px;line-height:1.6;font-weight:450;color:var(--text);border-right:1px solid var(--divider);}
td.cell:last-child{border-right:none;}
.cell.del{background:var(--del);}
.cell.mod{background:var(--mod);}
.cell.add{background:var(--add);}
.cell.empty{background:var(--empty);text-align:center;font-weight:400;}
.dash{color:var(--faint);}
.refs-cell{width:50%;vertical-align:top;padding:10px 16px;background:var(--refs-bg);border-right:1px solid var(--divider);border-bottom:1px solid var(--divider);}
td.refs-cell:last-child{border-right:none;}
.refs-cell.empty{text-align:center;}
.refs{display:flex;flex-wrap:wrap;gap:6px 7px;align-items:flex-start;}
.ref{display:inline-flex;align-items:flex-start;gap:0;max-width:100%;min-width:0;padding:3px 9px;border-radius:7px;background:var(--chip-bg);border:1px solid var(--chip-border);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.55;}
.ref-dots{flex:none;background:none;border:none;padding:0;margin:0 1px 0 0;font:inherit;cursor:pointer;color:var(--chip-ico);}
.ref-dots:hover{color:var(--chip-ln);}
.ref.expanded .dt{display:none;}
.ref-link{min-width:0;color:var(--chip-file);text-decoration:none;overflow-wrap:anywhere;word-break:break-word;}
.ref-link:hover{text-decoration:underline;}
.ref-dir{display:none;color:var(--chip-ico);}
.ref.expanded .ref-dir{display:inline;}
.ref-name{color:var(--chip-file);}
.ref-ln{flex:none;color:var(--chip-ln);font-weight:500;}
footer{margin-top:14px;color:var(--muted);font-size:11px;text-align:left;opacity:.85;}
`;

const SCRIPT = `
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.ref-dots');
  if (!btn) return;
  e.preventDefault();
  var ref = btn.closest('.ref');
  if (ref) ref.classList.toggle('expanded');
});
`;

function render(data) {
  ROOT = (data.root || '').replace(/\/+$/, '');
  EDITOR_NAME = data.editor || 'your editor';
  OPEN_TPL =
    data.open_url_template ||
    data.openUrlTemplate ||
    EDITOR_TEMPLATES[String(data.editor || '').toLowerCase()] ||
    'vscode://file{path}:{line}';

  const sections = (data.changes || []).map(section).join('\n');
  const title = esc(data.title || 'logicAI-diff');
  const summary = data.summary ? `<p class="summary">${esc(data.summary)}</p>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${title}</h1>
    ${summary}
  </header>
  <div class="card">
    <table>
      <thead><tr><th>Before</th><th>After</th></tr></thead>
      ${sections}
    </table>
  </div>
  <footer>logicAI-diff · behaviour-level changes in logical order</footer>
</div>
<script>${SCRIPT}</script>
</body>
</html>`;
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node render.mjs <input.json> [output.html]');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (e) {
  console.error(`Failed to read/parse ${inputPath}: ${e.message}`);
  process.exit(1);
}

let outPath = process.argv[3];
if (!outPath) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  outPath = join(tmpdir(), `logicai-diff-${ts}.html`);
}

writeFileSync(outPath, render(data), 'utf8');
console.log(resolve(outPath));
