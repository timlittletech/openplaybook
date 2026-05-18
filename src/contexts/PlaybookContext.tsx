/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth, useUser, useOrganization } from '@clerk/clerk-react';
import { createSupabaseClient } from '../lib/supabase';
import { createPlaybookService, PlaybookService } from '../services/playbookService';
import { AppUser, PlaybookDocumentUnion } from '../types';
import { masterRegistry, seedDataRelation } from '../data';

interface PlaybookContextType {
  profile: AppUser | null;
  nodes: Record<string, PlaybookDocumentUnion>;
  roots: Record<string, string[]>;
  loading: boolean;
  orgId: string | null;
  orgName: string | null;
  isEditMode: boolean;
  setIsEditMode: (mode: boolean) => void;
  refreshData: () => Promise<void>;
  seed: () => Promise<void>;
  saveDraft: (id: string, content: Partial<PlaybookDocumentUnion>) => Promise<void>;
  publishDraft: (id: string, note?: string) => Promise<void>;
  getVersions: (id: string) => Promise<any[]>;
  // Favorites (per-user, per-org)
  favorites: string[];
  isFavorite: (nodeId: string) => boolean;
  toggleFavorite: (nodeId: string) => Promise<void>;
}

const PlaybookContext = createContext<PlaybookContextType | undefined>(undefined);

export const PlaybookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { organization } = useOrganization();

  const [profile, setProfile] = useState<AppUser | null>(null);
  const [nodes, setNodes] = useState<Record<string, PlaybookDocumentUnion>>(masterRegistry);
  const [roots, setRoots] = useState<Record<string, string[]>>(seedDataRelation);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Build a service instance tied to the current Clerk session + active org.
  // Recreated whenever the active org changes.
  const service: PlaybookService | null = useMemo(() => {
    if (!isSignedIn) return null;
    const supabase = createSupabaseClient(() => getToken());
    return createPlaybookService(supabase, organization?.id ?? null);
  }, [isSignedIn, organization?.id, getToken]);

  const refreshData = useCallback(async () => {
    if (!service || !organization) {
      setNodes(masterRegistry);
      setRoots(seedDataRelation);
      return;
    }
    try {
      // Make sure the org row exists before any RLS-gated read
      await service.ensureOrganization({
        id: organization.id,
        name: organization.name,
        slug: organization.slug ?? undefined,
      });
      const [fetchedNodes, fetchedRoots] = await Promise.all([
        service.getAllNodes(),
        service.getCategoryRoots(),
      ]);
      setNodes(Object.keys(fetchedNodes).length > 0 ? fetchedNodes : masterRegistry);
      setRoots(Object.keys(fetchedRoots).length > 0 ? fetchedRoots : seedDataRelation);
      // Favorites are best-effort: missing favorites table (pre-migration) shouldn't break data load
      if (user) {
        try {
          const favs = await service.listFavorites(user.id);
          setFavorites(favs);
        } catch (e) {
          console.warn('listFavorites failed (run favorites migration?)', e);
          setFavorites([]);
        }
      }
    } catch (e) {
      console.error('refreshData failed', e);
      setNodes(masterRegistry);
      setRoots(seedDataRelation);
    }
  }, [service, organization, user]);

  // Load profile + data when signed-in user / active org changes
  useEffect(() => {
    if (!authLoaded) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (!isSignedIn || !user || !service || !organization) {
        if (!cancelled) {
          setProfile(null);
          setNodes(masterRegistry);
          setRoots(seedDataRelation);
          setLoading(false);
        }
        return;
      }

      try {
        await service.ensureOrganization({
          id: organization.id,
          name: organization.name,
          slug: organization.slug ?? undefined,
        });

        let p = await service.getUserProfile(user.id);
        if (!p) {
          p = {
            id: user.id,
            name: user.fullName || user.primaryEmailAddress?.emailAddress || 'New User',
            email: user.primaryEmailAddress?.emailAddress || '',
            // Map Clerk org role to internal role (admin → Administrator)
            role:
              organization.publicMetadata?.role === 'Administrator' ||
              organization.id // org owner
                ? 'Administrator'
                : 'Field Worker',
            teams: ['General'],
          };
          await service.upsertUserProfile(p);
        }
        if (cancelled) return;
        setProfile(p);
        await refreshData();
      } catch (e) {
        console.error('Failed to load profile/data', e);
        if (!cancelled) {
          setProfile(null);
          setNodes(masterRegistry);
          setRoots(seedDataRelation);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoaded, isSignedIn, user, service, organization, refreshData]);

  const displayNodes = useMemo(() => {
    if (!isEditMode) return nodes;
    const merged: Record<string, PlaybookDocumentUnion> = {};
    for (const [id, node] of Object.entries(nodes)) {
      if (node.draft) {
        merged[id] = { ...node, ...(node.draft as any) } as PlaybookDocumentUnion;
      } else {
        merged[id] = node;
      }
    }
    return merged;
  }, [nodes, isEditMode]);

  const seed = useCallback(async () => {
    if (!service || !organization) {
      throw new Error('Sign in and select an organization before seeding.');
    }
    // Self-heal: make sure the organizations row exists before we insert nodes
    // (the FK on nodes.org_id → organizations.id will fail otherwise).
    await service.ensureOrganization({
      id: organization.id,
      name: organization.name,
      slug: organization.slug ?? undefined,
    });
    await service.seedInitialData(masterRegistry, seedDataRelation);
    await refreshData();
  }, [service, organization, refreshData]);

  const saveDraft = useCallback(
    async (id: string, content: Partial<PlaybookDocumentUnion>) => {
      if (!service) return;
      // Optimistic update
      setNodes(prev => {
        const node = prev[id];
        if (!node) return prev;
        const updated = { ...node, draft: { ...(node.draft || {}), ...content } } as PlaybookDocumentUnion;
        return { ...prev, [id]: updated };
      });
      await service.saveDraft(id, content);
    },
    [service]
  );

  const publishDraft = useCallback(
    async (id: string, note?: string) => {
      if (!service || !profile) return;
      const updated = await service.publishDraft(id, profile.id, profile.name, note);
      if (updated) {
        setNodes(prev => ({ ...prev, [id]: updated }));
      }
    },
    [service, profile]
  );

  const getVersions = useCallback(
    async (id: string) => {
      if (!service) return [];
      return service.getVersions(id);
    },
    [service]
  );

  const isFavorite = useCallback((nodeId: string) => favorites.includes(nodeId), [favorites]);

  const toggleFavorite = useCallback(
    async (nodeId: string) => {
      if (!service || !user) return;
      const currently = favorites.includes(nodeId);
      // Optimistic update
      setFavorites(prev => (currently ? prev.filter(n => n !== nodeId) : [...prev, nodeId]));
      try {
        if (currently) {
          await service.removeFavorite(user.id, nodeId);
        } else {
          await service.addFavorite(user.id, nodeId, favorites.length);
        }
      } catch (e) {
        console.error('toggleFavorite failed', e);
        // Revert on failure
        setFavorites(prev => (currently ? [...prev, nodeId] : prev.filter(n => n !== nodeId)));
      }
    },
    [service, user, favorites]
  );

  const value: PlaybookContextType = useMemo(
    () => ({
      profile,
      nodes: displayNodes,
      roots,
      loading,
      orgId: organization?.id ?? null,
      orgName: organization?.name ?? null,
      isEditMode,
      setIsEditMode,
      refreshData,
      seed,
      saveDraft,
      publishDraft,
      getVersions,
      favorites,
      isFavorite,
      toggleFavorite,
    }),
    [profile, displayNodes, roots, loading, organization, isEditMode, refreshData, seed, saveDraft, publishDraft, getVersions, favorites, isFavorite, toggleFavorite]
  );

  return <PlaybookContext.Provider value={value}>{children}</PlaybookContext.Provider>;
};

export const usePlaybook = () => {
  const ctx = useContext(PlaybookContext);
  if (!ctx) throw new Error('usePlaybook must be used within a PlaybookProvider');
  return ctx;
};
