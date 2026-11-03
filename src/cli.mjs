// ci-wizard owner/repo [--days 7] [--workflows 8] [--per-workflow 5] [--json] [--html out.html]
// Prints the markdown report (or the JSON with --json). The token comes from GITHUB_TOKEN or
// GH_TOKEN, or from `gh auth token` when the GitHub CLI is signed in; it needs read access to
// the repository's Actions and contents, and nothing is written.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { audit, html, report, RateLimitError, REPO_RE } from './index.mjs';

const USAGE = `usage: ci-wizard owner/repo [--days 7] [--workflows 8] [--per-workflow 5] [--json] [--html out.html]

Reads a repository's GitHub Actions runs, jobs and workflow files (read-only) and reports where
the CI time goes and what to fix first. Token: GITHUB_TOKEN or GH_TOKEN, else \`gh auth token\`.`;

function tokenFromEnv(env) {
  if (env.GITHUB_TOKEN) return env.GITHUB_TOKEN;
  if (env.GH_TOKEN) return env.GH_TOKEN;
  try {
    // execFile, no shell: the command line is fixed.
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined;
  } catch {
    return undefined;
  }
}

function positiveNumber(name, v, { integer = false } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || (integer && !Number.isInteger(n))) throw new Error(`--${name} must be a positive ${integer ? 'integer' : 'number'}, got ${v}`);
  return n;
}

export async function main(argv = process.argv.slice(2), { env = process.env, stdout = process.stdout, stderr = process.stderr, fetchImpl } = {}) {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        days: { type: 'string', default: '7' },
        workflows: { type: 'string', default: '8' },
        'per-workflow': { type: 'string', default: '5' },
        json: { type: 'boolean', default: false },
        html: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (err) {
    stderr.write(`${err.message}\n\n${USAGE}\n`);
    return 2;
  }
  const { values, positionals } = args;
  if (values.help) {
    stdout.write(`${USAGE}\n`);
    return 0;
  }
  const repo = positionals[0];
  if (positionals.length !== 1 || !REPO_RE.test(repo)) {
    stderr.write(`${USAGE}\n`);
    return 2;
  }
  let days, workflows, perWorkflow;
  try {
    days = positiveNumber('days', values.days);
    workflows = positiveNumber('workflows', values.workflows, { integer: true });
    perWorkflow = positiveNumber('per-workflow', values['per-workflow'], { integer: true });
  } catch (err) {
    stderr.write(`${err.message}\n`);
    return 2;
  }
  let a;
  try {
    a = await audit({ repo, token: tokenFromEnv(env), fetchImpl, days, workflows, perWorkflow });
  } catch (err) {
    stderr.write(`ci-wizard: ${err.message}\n`);
    return err instanceof RateLimitError ? 3 : 1;
  }
  if (!a) {
    stderr.write(`ci-wizard: ${repo} has no workflow runs readable in the last ${days} days\n`);
    return 1;
  }
  if (values.html) writeFileSync(values.html, html([a], { title: `CI audit: ${repo}` }));
  stdout.write(values.json ? `${JSON.stringify(a, null, 1)}\n` : report(a));
  stderr.write(`ci-wizard: ${a.runs_total} runs over ${a.covered_days} d, ${a.workflows.length} workflows sampled, ${a.findings.length} findings, ${a.api_calls} API calls\n`);
  return 0;
}
