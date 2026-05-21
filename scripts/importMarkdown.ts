/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bulk-import a folder of markdown playbooks into an organization.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npm run import:md -- --folder ./content --org org_123 [--org-name "Acme"]
 *
 * Requires the Supabase service-role key (bypasses RLS). This key is server-side
 * only — never expose it to the browser/client bundle.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createPlaybookService } from '../src/services/playbookService';
import { parseMarkdownFiles, ParsedFile } from '../src/lib/markdownImport';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function collectMarkdown(dir: string): ParsedFile[] {
  const out: ParsedFile[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectMarkdown(full));
    } else if (/\.(md|markdown)$/i.test(entry)) {
      out.push({ name: entry, content: readFileSync(full, 'utf8') });
    }
  }
  return out;
}

async function main() {
  const folder = arg('folder');
  const org = arg('org');
  const orgName = arg('org-name') ?? org;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!folder || !org) {
    console.error(
      'Usage: npm run import:md -- --folder <dir> --org <orgId> [--org-name <name>]'
    );
    process.exit(1);
  }
  if (!url || !key) {
    console.error(
      'Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in the environment.'
    );
    process.exit(1);
  }

  const dir = resolve(folder);
  const files = collectMarkdown(dir);
  if (files.length === 0) {
    console.error(`No .md files found under ${dir}`);
    process.exit(1);
  }

  const { nodes, roots } = parseMarkdownFiles(files);

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const service = createPlaybookService(supabase, org);

  await service.ensureOrganization({ id: org, name: orgName!, slug: undefined });
  await service.seedInitialData(nodes, roots);

  console.log(`Imported ${Object.keys(nodes).length} playbook(s) into org ${org}:`);
  for (const n of Object.values(nodes)) {
    console.log(`  • ${n.info.title}  [${n.info.categories[0]}]`);
  }
  for (const [cat, ids] of Object.entries(roots)) {
    console.log(`  category "${cat}": ${ids.length} playbook(s)`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
