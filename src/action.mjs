// Entry point of the bundled action (dist/action.mjs).
import { run } from './action-run.mjs';

process.exitCode = await run();
