#!/usr/bin/env node
/**
 * Regenerates userscript/Trakt2Infuse.user.js from the extension sources:
 *   - extension/content.js     -> the userscript body
 *   - extension/interceptor.js -> the injected MAIN-world interceptor
 *   - extension/styles.css     -> the GM_addStyle block
 *
 * The userscript keeps a compact base64 icon (the extension PNG is far too
 * large to inline), which is preserved from the previous userscript build.
 *
 * Usage: npm run build:userscript
 */
const fs = require('fs');
const path = require('path');
const { buildMark } = require('./build-icons.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const content = read('extension/content.js');
const interceptor = read('extension/interceptor.js');
const styles = read('extension/styles.css');
const target = 'userscript/Trakt2Infuse.user.js';
const previous = fs.existsSync(path.join(ROOT, target)) ? read(target) : '';

const version = JSON.parse(read('extension/manifest.json')).version;

// --- icon --------------------------------------------------------------------
// The transparent brand mark is inlined as a data URL (the extension PNG with
// its white plate would look wrong on the in-page buttons).
buildMark();
const iconUrl = `data:image/png;base64,${fs
  .readFileSync(path.join(ROOT, 'extension/icons/infuse-mark.png'))
  .toString('base64')}`;

// --- header ------------------------------------------------------------------
const headerMatch = previous.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\n/);
if (!headerMatch) {
  throw new Error('existing userscript header not found');
}
const header = headerMatch[0].replace(
  /(\/\/ @version\s+)\S+/,
  `$1${version}`
);

// --- body parts --------------------------------------------------------------
const start = content.indexOf('  const CACHE_KEY');
if (start < 0) throw new Error('CACHE_KEY marker not found in content.js');
const end = content.lastIndexOf('})();');
const body = content.slice(start, end).replace(/\s+$/, '') + '\n';

// content.js uses 2-space indentation, the userscript nests one level deeper
const indentBody = body
  .split('\n')
  .map((line) => (line.trim() ? '  ' + line : line))
  .join('\n');

const escapeForTemplate = (text) =>
  text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const indentInterceptor = escapeForTemplate(interceptor.replace(/\s+$/, ''))
  .split('\n')
  .map((line) => (line.trim() ? '      ' + line : line))
  .join('\n');

const css = escapeForTemplate(styles.replace(/\s+$/, ''));

const out = `${header}
(function () {
    'use strict';

    // Infuse icon asset (Base64 encoded)
    const INFUSE_ICON_URL = '${iconUrl}';

    const css = \`
${css}
    \`;

    GM_addStyle(css);

    // Inject interceptor directly into the page's execution context
    const interceptorCode = \`
${indentInterceptor}
    \`;

    const scriptEl = document.createElement('script');
    scriptEl.textContent = interceptorCode;
    (document.head || document.documentElement).appendChild(scriptEl);
    scriptEl.remove();

${indentBody}})();
`;

fs.writeFileSync(path.join(ROOT, target), out);
console.log(`wrote ${target} (${out.length} bytes, v${version})`);
