#!/usr/bin/env node
// npm run doctor -- [--json]   Exit 1 if any check fails. Prints no secret (there are none).
import { formatReport, runDoctor } from '../server/src/doctor.js';
const report = await runDoctor();
console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : formatReport(report));
process.exit(report.ok ? 0 : 1);
