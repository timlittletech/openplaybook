/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Markdown <-> PlaybookDocument conversion.
 *
 * Pure module — no fs, no React, no Supabase — so the exact same code powers the
 * in-app uploader (browser) and the CLI seeding script (Node).
 *
 * File format:
 *   - YAML frontmatter carries structured metadata (cadence, priority, category,
 *     tags, access, resources, relations) that drives the special UI.
 *   - The markdown body becomes `body_markdown` (rendered by BrandedMarkdown).
 *   - A `## Checklist` (or `## Steps`) section written as a GFM task list is
 *     lifted out of the body into `steps[]` (the Playbook Checklist UI).
 */

import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import {
  PlaybookDocument,
  ResourceItem,
  OpenPlaybookStep,
  PlaybookReference,
  AccessControlConfig,
} from '../types';

export interface ParsedFile {
  name: string;
  content: string;
}

export interface ImportResult {
  nodes: Record<string, PlaybookDocument>;
  roots: Record<string, string[]>;
}

// Mirrors the "everyone can view, editors can edit, admins approve" default.
const DEFAULT_ACCESS = {
  view: { roles: ['Administrator', 'Project Manager', 'Field Worker'] },
  edit: { roles: ['Administrator', 'Project Manager'] },
  approve: { roles: ['Administrator'] },
};

const CHECKLIST_HEADING = /^(#{1,6})\s+(checklist|steps)\s*$/i;
const TASK_ITEM = /^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/;
const ANY_HEADING = /^(#{1,6})\s+/;

// ---------- small helpers ----------

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'playbook'
  );
}

function toArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  return String(v)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeSubType(v: unknown): 'Course' | 'Step' | 'Standard' {
  switch (String(v ?? '').toLowerCase()) {
    case 'course':
      return 'Course';
    case 'step':
      return 'Step';
    default:
      return 'Standard';
  }
}

function asAccessConfig(v: unknown): AccessControlConfig | undefined {
  if (v == null) return undefined;
  // Accept a bare list of roles or a { roles, teams, users } object.
  if (Array.isArray(v)) return { roles: toArray(v) };
  if (typeof v !== 'object') return undefined;
  const obj = v as Record<string, unknown>;
  const out: AccessControlConfig = {};
  if (obj.roles != null) out.roles = toArray(obj.roles);
  if (obj.teams != null) out.teams = toArray(obj.teams);
  if (obj.users != null) out.users = toArray(obj.users);
  return out;
}

function normalizeResources(v: unknown): ResourceItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((raw, i): ResourceItem => {
    if (typeof raw === 'string') {
      return { id: `r${i + 1}`, name: raw, title: raw, type: 'link', url: raw };
    }
    const r = (raw ?? {}) as Record<string, unknown>;
    const title = String(r.title ?? r.name ?? r.url ?? 'Resource');
    return {
      id: r.id != null ? String(r.id) : `r${i + 1}`,
      name: String(r.name ?? title),
      title,
      description: r.description != null ? String(r.description) : undefined,
      type: r.type != null ? String(r.type) : 'link',
      url: String(r.url ?? '#'),
      thumbnail: r.thumbnail != null ? String(r.thumbnail) : undefined,
    };
  });
}

// Split leading YAML frontmatter (--- ... ---) from the markdown body.
function splitFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const text = raw.replace(/^﻿/, ''); // strip BOM
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { data: {}, content: text };
  let data: Record<string, unknown> = {};
  try {
    const parsed = yamlLoad(match[1]);
    if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
  } catch (e) {
    throw new Error(`Invalid YAML frontmatter: ${(e as Error).message}`);
  }
  return { data, content: text.slice(match[0].length) };
}

// Lift the first `## Checklist`/`## Steps` GFM task list into steps[].
// Only removes the section from the body when it actually held task items,
// so a prose "Steps" section is never silently dropped.
function extractChecklist(body: string): { steps: OpenPlaybookStep[]; body: string } {
  const lines = body.split('\n');
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = CHECKLIST_HEADING.exec(lines[i]);
    if (m) {
      start = i;
      level = m[1].length;
      break;
    }
  }
  if (start === -1) return { steps: [], body };

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const h = ANY_HEADING.exec(lines[i]);
    if (h && h[1].length <= level) {
      end = i;
      break;
    }
  }

  const steps: OpenPlaybookStep[] = [];
  lines.slice(start + 1, end).forEach(line => {
    const t = TASK_ITEM.exec(line);
    if (t) {
      steps.push({ step_id: `step_${steps.length + 1}`, action: t[2].trim(), type: 'task' });
    }
  });

  if (steps.length === 0) return { steps: [], body };

  const remaining = [...lines.slice(0, start), ...lines.slice(end)];
  const newBody = remaining.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { steps, body: newBody };
}

// Drop a leading "# Title" that duplicates the frontmatter title (the card
// already renders the title separately).
function stripLeadingTitle(body: string, title: string): string {
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  const m = i < lines.length ? /^#\s+(.+)$/.exec(lines[i].trim()) : null;
  if (m && m[1].trim().toLowerCase() === title.trim().toLowerCase()) {
    return lines.slice(i + 1).join('\n').replace(/^\n+/, '').trimEnd();
  }
  return body.trim();
}

// ---------- public API ----------

export function parseMarkdown(file: ParsedFile): PlaybookDocument {
  const { data, content } = splitFrontmatter(file.content);

  const baseName =
    (file.name.split(/[\\/]/).pop() || 'playbook').replace(/\.(md|markdown)$/i, '');

  let title = data.title != null ? String(data.title) : '';
  if (!title) {
    const h1 = /^#\s+(.+)$/m.exec(content);
    title = h1 ? h1[1].trim() : baseName;
  }

  const id = slugify(data.id != null ? String(data.id) : title || baseName);

  const categories = toArray(data.categories ?? data.category);
  const finalCategories = categories.length ? categories : ['Uncategorized'];

  const { steps, body: bodyNoChecklist } = extractChecklist(content);
  const body_markdown = stripLeadingTitle(bodyNoChecklist, title);

  const related = toArray(data.related);
  const access = (data.access ?? {}) as Record<string, unknown>;

  return {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id,
      title,
      version: data.version != null ? String(data.version) : '1.0.0',
      description: data.description != null ? String(data.description) : '',
      last_updated: new Date().toISOString(),
      categories: finalCategories,
      department: data.department != null ? String(data.department) : undefined,
    },
    cadence:
      data.cadence != null
        ? String(data.cadence)
        : data.frequency != null
          ? String(data.frequency)
          : 'Reference',
    priority: data.priority != null ? String(data.priority) : undefined,
    subType: normalizeSubType(data.subType),
    access_control: {
      view: asAccessConfig(access.view) ?? DEFAULT_ACCESS.view,
      edit: asAccessConfig(access.edit) ?? DEFAULT_ACCESS.edit,
      approve: asAccessConfig(access.approve) ?? DEFAULT_ACCESS.approve,
    },
    linktree: {
      upstream: toArray(data.upstream),
      downstream: toArray(data.downstream),
      related,
    },
    related_playbooks: related.map(
      (ref_id): PlaybookReference => ({ type: 'playbook', ref_id: slugify(ref_id) })
    ),
    steps,
    resources: normalizeResources(data.resources),
    tags: toArray(data.tags),
    parent_id: data.parent != null ? slugify(String(data.parent)) : undefined,
    body_markdown: body_markdown || undefined,
  };
}

export function parseMarkdownFiles(files: ParsedFile[]): ImportResult {
  const nodes: Record<string, PlaybookDocument> = {};
  const order: string[] = [];
  for (const f of files) {
    const doc = parseMarkdown(f);
    nodes[doc.info.id] = doc;
    if (!order.includes(doc.info.id)) order.push(doc.info.id);
  }
  const roots: Record<string, string[]> = {};
  for (const id of order) {
    const cat = nodes[id].info.categories[0] || 'Uncategorized';
    (roots[cat] = roots[cat] || []).push(id);
  }
  return { nodes, roots };
}

// Serialize a playbook back to the import format (export / round-trip; the
// future structured editor can use this to write .md files).
export function toMarkdown(doc: PlaybookDocument): string {
  const fm: Record<string, unknown> = { title: doc.info.title, id: doc.info.id };
  if (doc.info.description) fm.description = doc.info.description;
  if (doc.info.categories?.length) {
    fm.category = doc.info.categories.length === 1 ? doc.info.categories[0] : doc.info.categories;
  }
  if (doc.info.department) fm.department = doc.info.department;
  if (doc.cadence) fm.cadence = doc.cadence;
  if (doc.priority) fm.priority = doc.priority;
  if (doc.subType) fm.subType = doc.subType;
  if (doc.tags?.length) fm.tags = doc.tags;
  if (doc.parent_id) fm.parent = doc.parent_id;
  if (doc.linktree?.related?.length) fm.related = doc.linktree.related;
  if (doc.linktree?.upstream?.length) fm.upstream = doc.linktree.upstream;
  if (doc.linktree?.downstream?.length) fm.downstream = doc.linktree.downstream;

  const access: Record<string, string[]> = {};
  if (doc.access_control?.view?.roles) access.view = doc.access_control.view.roles;
  if (doc.access_control?.edit?.roles) access.edit = doc.access_control.edit.roles;
  if (doc.access_control?.approve?.roles) access.approve = doc.access_control.approve.roles;
  if (Object.keys(access).length) fm.access = access;

  if (doc.resources?.length) {
    fm.resources = doc.resources.map(r => ({
      title: r.title ?? r.name,
      type: r.type,
      url: r.url,
      ...(r.description ? { description: r.description } : {}),
    }));
  }

  const frontmatter = yamlDump(fm, { lineWidth: 100, noRefs: true }).trimEnd();
  let out = `---\n${frontmatter}\n---\n\n`;
  if (doc.body_markdown) out += `${doc.body_markdown.trim()}\n`;
  if (doc.steps?.length) {
    out += `\n## Checklist\n`;
    for (const s of doc.steps) out += `- [ ] ${s.action ?? ''}\n`;
  }
  return out;
}
