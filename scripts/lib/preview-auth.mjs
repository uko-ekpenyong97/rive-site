/**
 * Extra HTTP headers the browser gates need to reach a PROTECTED Vercel preview.
 *
 * Vercel guards preview deployments with Deployment Protection by default, so a
 * headless browser gets an HTML login page instead of the site and every
 * assertion below it measures Vercel's auth screen. The documented way through
 * is a Protection Bypass for Automation secret, sent as `x-vercel-protection-
 * bypass` on every request.
 *
 * THE SECRET IS READ HERE, FROM .env.local, RATHER THAN FROM THE ENVIRONMENT.
 * That is deliberate: putting it in the shell means every subsequent command in
 * that session inherits it, and one stray `env` or a crash dump prints it. Read
 * at the point of use, held in a local, never logged.
 *
 * `.env.local` is gitignored (`.env.*`). That rule was added in afb6476, before
 * the file existed — this repo commits with `git add -A`, so a secret sitting in
 * an unignored file would have been pushed to a public repo by the next commit.
 * If you are adding another secret, check the rule still covers it first.
 *
 * Returns {} when there is no secret, so the gates run unchanged against
 * localhost and against unprotected production.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function previewAuthHeaders() {
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*VERCEL_AUTOMATION_BYPASS_SECRET\s*=\s*(.+?)\s*$/);
    if (m) {
      const secret = m[1].replace(/^['"]|['"]$/g, "");
      if (secret) return { "x-vercel-protection-bypass": secret };
    }
  }
  return {};
}

/** True when a bypass is available — safe to print, reveals nothing. */
export function hasPreviewAuth() {
  return Object.keys(previewAuthHeaders()).length > 0;
}
