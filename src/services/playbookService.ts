/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PlaybookDocumentUnion,
  PlaybookDocument,
  FactorDocument,
  AppUser,
  Organization,
} from '../types';

// ---------- Row <-> Document mapping ----------

interface NodeRow {
  id: string;
  org_id: string;
  entity_type: 'factor' | 'playbook';
  parent_id: string | null;
  data: any;
  body_markdown: string | null;
  draft: any | null;
  last_version: number;
  published_at: string | null;
}

function rowToDocument(row: NodeRow): PlaybookDocumentUnion {
  // `data` holds the full document JSON; we hoist the columns back into it on read.
  const base = row.data ?? {};
  const merged: any = {
    ...base,
    entity_type: row.entity_type,
    parent_id: row.parent_id ?? base.parent_id,
    draft: row.draft ?? undefined,
    lastVersion: row.last_version,
    published_at: row.published_at ?? base.published_at,
  };
  if (row.entity_type === 'playbook' && row.body_markdown != null) {
    merged.body_markdown = row.body_markdown;
  }
  return merged as PlaybookDocumentUnion;
}

function documentToInsert(
  id: string,
  orgId: string,
  doc: PlaybookDocumentUnion
): NodeRow {
  const { draft, lastVersion, published_at, parent_id, entity_type, ...rest } = doc as any;
  const body_markdown =
    entity_type === 'playbook' ? (doc as PlaybookDocument).body_markdown ?? null : null;
  // Strip body_markdown from `data` to avoid duplication
  if (body_markdown !== null && 'body_markdown' in rest) {
    delete rest.body_markdown;
  }
  return {
    id,
    org_id: orgId,
    entity_type,
    parent_id: parent_id ?? null,
    data: rest,
    body_markdown,
    draft: draft ?? null,
    last_version: lastVersion ?? 0,
    published_at: published_at ?? null,
  };
}

function nodeId(doc: PlaybookDocumentUnion): string {
  return doc.entity_type === 'playbook'
    ? (doc as PlaybookDocument).info.id
    : (doc as FactorDocument).id;
}

// ---------- Service ----------

export function createPlaybookService(supabase: SupabaseClient, orgId: string | null) {
  function requireOrg(): string {
    if (!orgId) {
      throw new Error('No active organization. Select or create an organization to continue.');
    }
    return orgId;
  }

  return {
    async ensureOrganization(org: Organization): Promise<void> {
      const { error } = await supabase
        .from('organizations')
        .upsert({ id: org.id, name: org.name, slug: org.slug ?? null }, { onConflict: 'id' });
      if (error) throw new Error(`Failed to upsert organization: ${error.message}`);
    },

    async getNode(id: string): Promise<PlaybookDocumentUnion | null> {
      const oid = requireOrg();
      const { data, error } = await supabase
        .from('nodes')
        .select('*')
        .eq('org_id', oid)
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(`getNode(${id}): ${error.message}`);
      if (!data) return null;
      return rowToDocument(data as NodeRow);
    },

    async getAllNodes(): Promise<Record<string, PlaybookDocumentUnion>> {
      const oid = requireOrg();
      const { data, error } = await supabase
        .from('nodes')
        .select('*')
        .eq('org_id', oid);
      if (error) throw new Error(`getAllNodes: ${error.message}`);
      const out: Record<string, PlaybookDocumentUnion> = {};
      (data as NodeRow[] | null)?.forEach(r => {
        out[r.id] = rowToDocument(r);
      });
      return out;
    },

    async getUserProfile(clerkUserId: string): Promise<AppUser | null> {
      const oid = requireOrg();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('org_id', oid)
        .eq('clerk_user_id', clerkUserId)
        .maybeSingle();
      if (error) throw new Error(`getUserProfile: ${error.message}`);
      if (!data) return null;
      return {
        id: data.clerk_user_id,
        name: data.display_name,
        email: data.email,
        role: data.role,
        teams: data.teams ?? [],
      };
    },

    async upsertUserProfile(profile: AppUser): Promise<void> {
      const oid = requireOrg();
      const { error } = await supabase.from('user_profiles').upsert(
        {
          clerk_user_id: profile.id,
          org_id: oid,
          display_name: profile.name,
          email: profile.email,
          role: profile.role,
          teams: profile.teams,
        },
        { onConflict: 'clerk_user_id,org_id' }
      );
      if (error) throw new Error(`upsertUserProfile: ${error.message}`);
    },

    async getCategoryRoots(): Promise<Record<string, string[]>> {
      const oid = requireOrg();
      const { data, error } = await supabase
        .from('category_roots')
        .select('category, node_id, sort_order')
        .eq('org_id', oid)
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw new Error(`getCategoryRoots: ${error.message}`);
      const out: Record<string, string[]> = {};
      (data as { category: string; node_id: string }[] | null)?.forEach(r => {
        (out[r.category] = out[r.category] || []).push(r.node_id);
      });
      return out;
    },

    async saveDraft(id: string, draftContent: Partial<PlaybookDocumentUnion>): Promise<void> {
      const oid = requireOrg();
      const { error } = await supabase
        .from('nodes')
        .update({ draft: draftContent })
        .eq('org_id', oid)
        .eq('id', id);
      if (error) throw new Error(`saveDraft(${id}): ${error.message}`);
    },

    async publishDraft(
      id: string,
      userId: string,
      userName: string,
      changeNote?: string
    ): Promise<PlaybookDocumentUnion> {
      const oid = requireOrg();
      const { data: row, error: readErr } = await supabase
        .from('nodes')
        .select('*')
        .eq('org_id', oid)
        .eq('id', id)
        .maybeSingle();
      if (readErr) throw new Error(`publishDraft read: ${readErr.message}`);
      if (!row) throw new Error('Node not found');

      const node = rowToDocument(row as NodeRow);
      if (!node.draft) throw new Error('No draft to publish');

      const nextVersion = (node.lastVersion || 0) + 1;
      const timestamp = new Date().toISOString();
      const published = {
        ...node,
        ...(node.draft as any),
        lastVersion: nextVersion,
        published_at: timestamp,
        draft: undefined,
      } as PlaybookDocumentUnion;

      const update = documentToInsert(id, oid, published);
      const { error: updErr } = await supabase
        .from('nodes')
        .update({
          data: update.data,
          body_markdown: update.body_markdown,
          parent_id: update.parent_id,
          entity_type: update.entity_type,
          draft: null,
          last_version: nextVersion,
          published_at: timestamp,
        })
        .eq('org_id', oid)
        .eq('id', id);
      if (updErr) throw new Error(`publishDraft update: ${updErr.message}`);

      const { error: verErr } = await supabase.from('node_versions').insert({
        node_id: id,
        org_id: oid,
        version_number: nextVersion,
        author_id: userId,
        author_name: userName,
        change_note: changeNote ?? 'Published via UI',
        content: published,
      });
      if (verErr) throw new Error(`publishDraft version: ${verErr.message}`);

      return published;
    },

    async getVersions(id: string): Promise<any[]> {
      const oid = requireOrg();
      const { data, error } = await supabase
        .from('node_versions')
        .select('*')
        .eq('org_id', oid)
        .eq('node_id', id)
        .order('version_number', { ascending: false });
      if (error) throw new Error(`getVersions(${id}): ${error.message}`);
      return (data ?? []).map((v: any) => ({
        id: v.id,
        nodeId: v.node_id,
        metadata: {
          id: v.id,
          versionNumber: v.version_number,
          authorId: v.author_id,
          authorName: v.author_name,
          timestamp: v.created_at,
          changeNote: v.change_note ?? '',
        },
        content: v.content,
      }));
    },

    async listFavorites(clerkUserId: string): Promise<string[]> {
      const oid = requireOrg();
      const { data, error } = await supabase
        .from('favorites')
        .select('node_id, sort_order')
        .eq('org_id', oid)
        .eq('clerk_user_id', clerkUserId)
        .order('sort_order', { ascending: true });
      if (error) throw new Error(`listFavorites: ${error.message}`);
      return (data ?? []).map((r: { node_id: string }) => r.node_id);
    },

    async addFavorite(clerkUserId: string, nodeId: string, sortOrder = 0): Promise<void> {
      const oid = requireOrg();
      const { error } = await supabase.from('favorites').upsert(
        {
          clerk_user_id: clerkUserId,
          org_id: oid,
          node_id: nodeId,
          sort_order: sortOrder,
        },
        { onConflict: 'clerk_user_id,org_id,node_id' }
      );
      if (error) throw new Error(`addFavorite: ${error.message}`);
    },

    async removeFavorite(clerkUserId: string, nodeId: string): Promise<void> {
      const oid = requireOrg();
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('org_id', oid)
        .eq('clerk_user_id', clerkUserId)
        .eq('node_id', nodeId);
      if (error) throw new Error(`removeFavorite: ${error.message}`);
    },

    async seedInitialData(
      nodes: Record<string, PlaybookDocumentUnion>,
      roots: Record<string, string[]>
    ): Promise<void> {
      const oid = requireOrg();

      const rows = Object.entries(nodes).map(([id, doc]) => documentToInsert(id, oid, doc));
      const { error: nodesErr } = await supabase.from('nodes').upsert(rows, {
        onConflict: 'org_id,id',
      });
      if (nodesErr) throw new Error(`seedInitialData nodes: ${nodesErr.message}`);

      const rootRows: { org_id: string; category: string; node_id: string; sort_order: number }[] = [];
      Object.entries(roots).forEach(([category, ids]) => {
        ids.forEach((node_id, i) => {
          rootRows.push({ org_id: oid, category, node_id, sort_order: i });
        });
      });
      if (rootRows.length > 0) {
        const { error: rootsErr } = await supabase.from('category_roots').upsert(rootRows, {
          onConflict: 'org_id,category,node_id',
        });
        if (rootsErr) throw new Error(`seedInitialData roots: ${rootsErr.message}`);
      }
    },
  };
}

export type PlaybookService = ReturnType<typeof createPlaybookService>;

// Helpers used at the call site that don't need a service instance
export { nodeId, rowToDocument, documentToInsert };
