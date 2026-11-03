# Changelog

## 0.1.0

First release.

- Read-only audit of a repository's GitHub Actions: up to 500 runs from a window, step timings of
  the newest successful runs of the busiest workflows, the workflow files and the committed
  lockfiles.
- Time split into runner overhead, checkout, toolchain, dependencies, cache, artifacts, docker and
  work, by the command each step runs, with the time before the first step and after the last
  measured separately.
- Rules: cache dependencies, dependency installs dominate (with the no-lockfile `npm install`
  case explained), slow checkout, toolchain setup, the same commit runs twice (with the cause
  read from the push trigger and the concurrency group), outdated runs keep going, matrix size,
  self-hosted wrap-up tail, queue wait, many short jobs, runs far more often than code changes,
  many small scheduled jobs, reruns. Each finding has evidence, a confidence (confirmed,
  measured, inferred) and an estimated weekly saving; repeated kinds are grouped.
- A GitHub Action (report in the job summary, `report-path` and `findings` outputs) and a CLI
  (`ci-wizard owner/repo`, with `--json` and `--html`), bundled with no runtime dependencies.
