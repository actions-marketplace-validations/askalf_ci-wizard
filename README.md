# ci-wizard

Where your GitHub Actions time goes, and what to fix first. ci-wizard reads a repository's
workflow runs, jobs and workflow files from the GitHub API, times every sampled step, finds the
patterns that cost the most (installs with no cache, the same commit run twice, outdated runs
nobody cancels, a workflow that fires far more often than code changes), and checks the
workflow file for the cause before it says so. Every finding carries its evidence, a confidence
and an estimated weekly saving, and every fix is written as an option with its trade-off. It is
read-only: nothing is written to the repository.

## The method

1. **Measure.** Each sampled job's steps, timed from the Actions API: queue wait, run time, and
   the time before the first step and after the last.
2. **Diagnose.** Time split into runner overhead, checkout, toolchain, dependencies, cache,
   artifacts, docker and work, by the command each step runs (read from the workflow file), not
   only by its name.
3. **Confirm.** The workflow file is read for the cause: triggers and push branch patterns,
   caches (including a setup action's cache input), concurrency and cancel-in-progress, how
   dependencies install, whether a lockfile is committed.
4. **Prove.** A fix is measured the same way before and after. The report is the before.

## Quick start

### As a GitHub Action

```yaml
name: CI audit
on:
  workflow_dispatch:
  schedule:
    - cron: '0 6 * * 1'
permissions:
  actions: read
  contents: read
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: askalf/ci-wizard@v0.1.0
```

The report lands in the job summary and in `$RUNNER_TEMP/ci-wizard/report.md` (with
`report.json` beside it). Inputs: `repository` (default: the one the workflow runs in),
`token` (default: the job's token), `days` (7), `workflows` (8), `per-workflow` (5). Outputs:
`report-path`, `findings`. The audit never fails the job for what it finds; it fails only when
it cannot read the repository. Pin the action to a full commit SHA in your own workflows.

### From the command line

```sh
npx ci-wizard owner/repo
npx ci-wizard owner/repo --days 14 --json > audit.json
npx ci-wizard owner/repo --html audit.html
```

The token comes from `GITHUB_TOKEN` or `GH_TOKEN`, or from `gh auth token` when the GitHub CLI is
signed in. Options: `--days`, `--workflows`, `--per-workflow`, `--json`, `--html <file>`. Exit
codes: 0 report written, 1 nothing to read or an API error, 2 usage, 3 stopped near the rate
limit.

## What it reads and what it needs

- Up to 500 workflow runs from the window, the jobs and steps of the newest successful runs of
  the busiest workflows, those workflows' files, and the repository's root listing (to see which
  lockfile it commits). About 50 API calls for the defaults.
- A token with **actions: read** and **contents: read**. The job's own `GITHUB_TOKEN` is enough
  for the repository a workflow runs in; a fine-grained token with those two permissions works
  from the command line.
- The client stops before the token's rate limit runs out and says how many calls were left, so
  an audit never spends the budget a team's own CI needs.

## Sample

From a run on [askalf/dario](https://github.com/askalf/dario), one of ours, trimmed to the top
findings (its 500 most recent runs covered 0.67 days):

> 1. **runs far more often than code changes** in *Fleet status* (measured): 1910 runs a week
>    (workflow_run 169, pull_request 7, pull_request_review 6 in the window); 79% of its job time
>    is fixed cost (setup, checkout, wrap-up). about 113 job-min/week (estimate).
>    Fix: trigger it from fewer upstream workflows or events, debounce it (one run per commit
>    with a concurrency group and cancel-in-progress), or fold it into the workflow that
>    triggers it.
> 2. **many small scheduled jobs** in *scheduled workflows* (measured): 5 periodic workflows
>    (scheduled or dispatched on a clock) each run a job of under 30 s; each pays its own setup,
>    checkout and wrap-up. about 107 job-min/week (estimate).
>    Fix: run them as steps of one scheduled job, or as one job with a step per check, so the
>    fixed cost is paid once per tick.
> 3. **self-hosted wrap-up tail** in *7 workflows* (measured): median 4 s after the last step
>    before the job reports done (GitHub-hosted is about 2 s). about 105 job-min/week
>    (estimate).
>    Fix: fewer steps per job (each step is an uploaded log), and a runner close to GitHub's
>    service region.

| Workflow | Runs/week | Jobs/run | Job-min/run | Job-min/week | Developer wait p50 / p90 | Queue p50 / p90 | Biggest shares |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fleet status | 1910 | 1.0 | 0.1 | 286 | 23 s / 43 s | 2 s / 2 s | tail 42%, overhead 21%, work 21% |
| Wire drift (self-hosted) | 231 | 1.0 | 0.5 | 119 | 53 s / 2.0 min | 19 s / 29 s | work 37%, deps 28%, tail 13% |
| CC template drift watch (self-hosted) | 189 | 1.0 | 0.5 | 98 | 35 s / 39 s | 2 s / 7 s | deps 36%, work 23%, tail 13% |

A fix can disagree with a repository's own history: this one keeps cancel-in-progress off for
its status job on purpose, because cancelled queued runs piled up there before. That is why
fixes are written as options.

## Limitations

- **Sampled.** The window is up to 500 runs, and job-level timing comes from a few recent
  successful runs of each busy workflow. A busy repository's 500 runs may cover less than a day;
  weekly figures scale the window to 7 days.
- **Estimates.** Savings come from simple formulas over measured time (see
  [docs/rules.md](docs/rules.md)), not from running the fix. The method's fourth step, measuring
  after the change, is what proves one.
- **GitHub-hosted and self-hosted differ.** The wrap-up tail and queue-wait rules mean different
  things on each; the report says which runners a workflow used. Self-hosted runners far from
  GitHub's service region pay more per uploaded log.
- **Names and files.** A step is classified by its command when the workflow file gives one, by
  its name otherwise; reusable workflows and composite actions are read only as far as their
  calling step.

## Development

```sh
npm ci
npm test          # node:test, no network
npm run build     # bundles src/ into dist/ (committed; the action runs from it)
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).

## License

MIT
