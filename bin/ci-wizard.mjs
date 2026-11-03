#!/usr/bin/env node
// The installed command runs the bundled CLI in dist/, so the package needs no dependencies.
import { main } from '../dist/cli.mjs';

process.exitCode = await main();
