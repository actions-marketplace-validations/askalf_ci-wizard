// What a workflow file says, as the findings need it: the command behind each step, the
// triggers, the push branch patterns and the concurrency group. A file that does not parse yields
// no facts, never an error: the audit then falls back to the step names the API reports.
import { parse } from 'yaml';

/** Step categories, matched on a lower-cased step name or command (a "Post " step counts with what it posts for). */
const CATS = [
  ['overhead', /^(set up job|complete job|set up runner|complete runner)$/],
  ['checkout', /checkout/],
  ['toolchain', /setup-(node|go|python|java|dotnet|ruby|pnpm|bun|deno|uv|rust)|pnpm\/action-setup|rustup|toolchain|install (node|go|python|pnpm|bun|deno|rust)\b|setup (node|go|python|pnpm|bun|java)/],
  ['deps', /\b(npm (ci|install|i)\b|pnpm (install|i)\b|yarn( install)?\b|bun install|pip install|uv (sync|pip)|poetry install|go mod download|bundle install|cargo fetch|install (dep|package)|dependencies)/],
  ['cache', /\bcache\b/],
  ['artifacts', /(upload|download)-artifact|(upload|download) artifact/],
  ['docker', /\bdocker\b|buildx|build-push/],
];

export const CATEGORIES = ['overhead', 'checkout', 'toolchain', 'deps', 'cache', 'artifacts', 'docker', 'work'];

export function category(name) {
  let n = String(name).toLowerCase();
  if (n.startsWith('post ')) n = n.slice(5);
  for (const [c, rx] of CATS) if (rx.test(n)) return c;
  return 'work';
}

export function parseWorkflow(text) {
  if (!text) return {};
  try {
    const doc = parse(text, { uniqueKeys: false });
    return doc && typeof doc === 'object' ? doc : {};
  } catch {
    return {};
  }
}

/** Step name -> its run or uses text, naming unnamed steps the way GitHub does ("Run <uses>" or "Run <first line>"). */
export function stepCommands(doc) {
  const out = new Map();
  for (const job of Object.values(doc.jobs || {})) {
    for (const st of (job && job.steps) || []) {
      if (!st || typeof st !== 'object') continue;
      const cmd = String(st.run || st.uses || '');
      let name = st.name;
      if (!name) {
        if (st.uses) name = `Run ${st.uses}`;
        else if (st.run) name = `Run ${String(st.run).trim().split('\n')[0]}`;
      }
      if (name) out.set(String(name).trim(), cmd);
    }
  }
  return out;
}

/**
 * The category of a step: by its name first, and when the name says nothing (category "work"),
 * by the command the workflow file gives it, so a step named "Install" that runs `npm install`
 * counts as a dependency install.
 */
export function categoryOf(name, commands) {
  const c = category(name);
  if (c !== 'work') return c;
  const n = String(name).trim();
  const cmd = commands.get(n) || (n.startsWith('Post ') ? commands.get(n.slice(5)) : '') || '';
  if (!cmd) return c;
  const first = cmd.trim() ? cmd.split('\n')[0] : '';
  const c2 = category(first);
  if (c2 === 'work') {
    for (const line of cmd.split('\n')) if (category(line) === 'deps') return 'deps';
  }
  return c2;
}

function onOf(doc) {
  // YAML 1.1 parsers read a bare `on:` key as the boolean true; this parser reads YAML 1.2, but a file may say either.
  return doc.on !== undefined ? doc.on : doc.true;
}

export function triggersOf(doc) {
  const on = onOf(doc);
  if (typeof on === 'string') return [on];
  if (Array.isArray(on)) return on.map(String).sort();
  if (on && typeof on === 'object') return Object.keys(on).sort();
  return [];
}

export function pushBranchesOf(doc) {
  const on = onOf(doc);
  if (on && typeof on === 'object' && !Array.isArray(on) && on.push && typeof on.push === 'object') {
    const b = on.push.branches;
    return Array.isArray(b) ? b.map(String) : [];
  }
  return [];
}

export function concurrencyGroupOf(doc) {
  const c = doc.concurrency;
  if (c && typeof c === 'object') return String(c.group || '');
  return c ? String(c) : '';
}
