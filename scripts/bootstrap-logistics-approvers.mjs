/**
 * Retired bulk bootstrap entry point. This command ONLY prepares Javed.
 * No DDL, roster upsert, shared password, or assignment deletion is supported.
 * See docs/logistics-source-alignment.md for the separate, unexecuted row plan.
 */
import { runJavedProvisioningCli } from "./provision-javed.mjs";

await runJavedProvisioningCli();
