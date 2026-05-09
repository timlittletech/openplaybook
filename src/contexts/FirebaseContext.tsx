/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { firebaseService } from '../services/firebaseService';
import { AppUser, PlaybookDocumentUnion } from '../types';
import { masterRegistry, seedDataRelation, mockUsers } from '../data';

interface FirebaseContextType {
  user: User | null;
  profile: AppUser | null;
  nodes: Record<string, PlaybookDocumentUnion>;
  roots: Record<string, string[]>;
  loading: boolean;
  isEditMode: boolean;
  setIsEditMode: (mode: boolean) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshData: () => Promise<void>;
  seed: () => Promise<void>;
  saveDraft: (id: string, content: Partial<PlaybookDocumentUnion>) => Promise<void>;
  publishDraft: (id: string, note?: string) => Promise<void>;
  getVersions: (id: string) => Promise<any[]>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [nodes, setNodes] = useState<Record<string, PlaybookDocumentUnion>>({});
  const [roots, setRoots] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  const fetchRegistry = async () => {
    const [fetchedNodes, fetchedRoots] = await Promise.all([
      firebaseService.getAllNodes(),
      firebaseService.getCategoryRoots()
    ]);
    
    setNodes(Object.keys(fetchedNodes).length > 0 ? fetchedNodes : masterRegistry);
    setRoots(Object.keys(fetchedRoots).length > 0 ? fetchedRoots : seedDataRelation);
  };

  const displayNodes = useMemo(() => {
    if (!isEditMode) return nodes;

    const merged: Record<string, PlaybookDocumentUnion> = {};
    for (const [id, node] of Object.entries(nodes)) {
      if (node.draft) {
        // Correcting any typings/merging if necessary
        merged[id] = { ...node, ...node.draft } as PlaybookDocumentUnion;
      } else {
        merged[id] = node;
      }
    }
    return merged;
  }, [nodes, isEditMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const fetchedProfile = await firebaseService.getUserProfile(currentUser.uid);
        if (fetchedProfile) {
          setProfile(fetchedProfile);
        } else {
          setProfile({
            id: currentUser.uid,
            name: currentUser.displayName || 'New User',
            email: currentUser.email || '',
            role: 'Field Worker',
            teams: ['General']
          });
        }
        await fetchRegistry();
      } else {
        setProfile(null);
        setNodes(masterRegistry);
        setRoots(seedDataRelation);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const seed = async () => {
    await firebaseService.seedInitialData(masterRegistry, seedDataRelation, mockUsers);
    await fetchRegistry();
  };

  const saveDraft = async (id: string, content: Partial<PlaybookDocumentUnion>) => {
    // Optimistic update
    setNodes((prev: any) => {
      const node = prev[id];
      if (!node) return prev;
      
      const updatedNode = {
        ...node,
        draft: {
          ...(node.draft || {}),
          ...content
        }
      };

      return {
        ...prev,
        [id]: updatedNode
      };
    });
    await firebaseService.saveDraft(id, content);
  };

  const publishDraft = async (id: string, note?: string) => {
    if (!profile) return;
    const updated = await firebaseService.publishDraft(id, profile.id, profile.name, note);
    if (updated) {
      setNodes(prev => ({
        ...prev,
        [id]: updated
      }));
    }
  };

  const getVersions = async (id: string) => {
    return await firebaseService.getVersions(id);
  };

  const value = useMemo(() => ({
    user,
    profile,
    nodes: displayNodes,
    roots,
    loading,
    isEditMode,
    setIsEditMode,
    login,
    logout,
    refreshData: fetchRegistry,
    seed,
    saveDraft,
    publishDraft,
    getVersions
  }), [user, profile, displayNodes, roots, loading, isEditMode]);

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
