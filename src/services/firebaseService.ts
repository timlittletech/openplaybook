/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where,
  setDoc,
  DocumentData
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { PlaybookDocumentUnion, AppUser } from '../types';

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

function handleFirestoreError(error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null): never {
  const user = auth.currentUser;
  const errorInfo: FirestoreErrorInfo = {
    error: error.message || String(error),
    operationType,
    path,
    authInfo: {
      userId: user?.uid || 'anonymous',
      email: user?.email || 'N/A',
      emailVerified: user?.emailVerified || false,
      isAnonymous: user?.isAnonymous || true,
      providerInfo: user?.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName || '',
        email: p.email || ''
      })) || []
    }
  };
  throw new Error(JSON.stringify(errorInfo));
}

export const firebaseService = {
  async getNode(id: string): Promise<PlaybookDocumentUnion | null> {
    try {
      const docRef = doc(db, 'nodes', id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as PlaybookDocumentUnion;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, 'get', `nodes/${id}`);
    }
  },

  async getAllNodes(): Promise<Record<string, PlaybookDocumentUnion>> {
    try {
      const colRef = collection(db, 'nodes');
      const snapshot = await getDocs(colRef);
      const nodes: Record<string, PlaybookDocumentUnion> = {};
      snapshot.forEach(doc => {
        nodes[doc.id] = doc.data() as PlaybookDocumentUnion;
      });
      return nodes;
    } catch (error) {
      handleFirestoreError(error, 'list', 'nodes');
    }
  },

  async getUserProfile(uid: string): Promise<AppUser | null> {
    try {
      const docRef = doc(db, 'users', uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as AppUser;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, 'get', `users/${uid}`);
    }
  },

  async getCategoryRoots(): Promise<Record<string, string[]>> {
    try {
      const docRef = doc(db, 'metadata', 'categoryRoots');
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data().nodes || {};
      }
      return {};
    } catch (error) {
      // If roots don't exist, return empty or default
      return {};
    }
  },

  async saveDraft(id: string, draftContent: Partial<PlaybookDocumentUnion>) {
    try {
      const docRef = doc(db, 'nodes', id);
      await setDoc(docRef, { draft: draftContent }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, 'update', `nodes/${id}/draft`);
    }
  },

  async publishDraft(id: string, userId: string, userName: string, changeNote?: string) {
    try {
      const docRef = doc(db, 'nodes', id);
      const snapshot = await getDoc(docRef);
      
      if (!snapshot.exists()) throw new Error('Node not found');
      
      const node = snapshot.data() as PlaybookDocumentUnion;
      if (!node.draft) throw new Error('No draft to publish');

      const nextVersion = (node.lastVersion || 0) + 1;
      const timestamp = new Date().toISOString();

      // The new published content
      const publishedContent = {
        ...node,
        ...node.draft,
        lastVersion: nextVersion,
        published_at: timestamp,
        draft: null // Clear draft
      };

      // 1. Update the main document
      await setDoc(docRef, publishedContent);

      // 2. Create entry in versions subcollection
      const versionRef = doc(collection(db, 'nodes', id, 'versions'));
      await setDoc(versionRef, {
        id: versionRef.id,
        nodeId: id,
        metadata: {
          id: versionRef.id,
          versionNumber: nextVersion,
          authorId: userId,
          authorName: userName,
          timestamp,
          changeNote: changeNote || 'Published via system'
        },
        content: publishedContent
      });

      return publishedContent;
    } catch (error) {
      handleFirestoreError(error, 'update', `nodes/${id}/publish`);
    }
  },

  async getVersions(id: string) {
    try {
      const colRef = collection(db, 'nodes', id, 'versions');
      const snapshot = await getDocs(colRef);
      const versions: any[] = [];
      snapshot.forEach(doc => {
        versions.push(doc.data());
      });
      return versions.sort((a, b) => b.metadata.versionNumber - a.metadata.versionNumber);
    } catch (error) {
      handleFirestoreError(error, 'list', `nodes/${id}/versions`);
    }
  },

  // Seed function to push mock data to Firebase (for dev/demo)
  async seedInitialData(nodes: Record<string, PlaybookDocumentUnion>, roots: Record<string, string[]>, users: AppUser[]) {
    try {
      // Seed nodes
      for (const [id, node] of Object.entries(nodes)) {
        await setDoc(doc(db, 'nodes', id), node);
      }
      // Seed roots
      await setDoc(doc(db, 'metadata', 'categoryRoots'), { nodes: roots });
      // Seed users
      for (const user of users) {
        await setDoc(doc(db, 'users', user.id), user);
      }
      console.log('Seeding complete');
    } catch (error) {
      console.error('Seeding failed', error);
    }
  }
};
