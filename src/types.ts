/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Administrator' | 'Project Manager' | 'Field Worker' | string;

export interface Permissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export interface AccessControlList {
  roles: Partial<Record<UserRole, Permissions>>;
  users: string[]; 
  teams: string[]; 
}

// Open Playbook Schema Types
export type EntityType = 'factor' | 'playbook';

export interface OpenPlaybookInfo {
  title: string;
  id: string;
  version: string;
  description: string;
  last_updated: string;
  categories: string[];
  department?: string;
}

export interface AccessControlConfig {
  roles?: string[];
  teams?: string[];
  users?: string[];
}

export interface PlaybookReference {
  type: EntityType;
  ref_id: string;
  matchValue?: string;
}

export type ResourceType =
  | 'sop'        // internal reference to another playbook (url starts with '#')
  | 'board'      // monday.com / Linear / Trello / etc. board
  | 'document'   // generic doc (Google Doc, Notion, etc.)
  | 'folder'     // file/folder location
  | 'video'      // recording
  | 'pdf'        // attached PDF
  | 'link'       // arbitrary external link
  | 'other';

export interface ResourceItem {
  id?: string;
  name: string;                       // legacy field (openplaybook seed used this)
  title?: string;                     // preferred display field
  description?: string;
  type: ResourceType | string;
  url: string;
  thumbnail?: string;
}

export interface OpenPlaybookStep {
  step_id: string;
  action?: string;
  type?: string;
  owner?: { id: string; name: string; role: string };
  resources?: ResourceItem[];
  linktree?: { 
    dependent_on?: string[]; 
    triggers?: string[]; 
    referenced_playbooks?: string[] 
  };
  automation_candidate?: boolean;
  is_reference?: boolean;
  note?: string;
  // Branching support integration
  matchValue?: string;
}

export interface VersionMetadata {
  id: string;
  versionNumber: number;
  authorId: string;
  authorName: string;
  timestamp: string;
  changeNote?: string;
}

export interface NodeVersion {
  id: string;
  nodeId: string;
  metadata: VersionMetadata;
  content: PlaybookDocumentUnion;
}

export interface FactorDocument {
  id: string;
  entity_type: 'factor';
  label: string;
  description: string;
  controlType: 'boolean' | 'enum' | 'text';
  placeholder?: string;
  categories?: string[];
  children: PlaybookReference[];
  related_playbooks?: PlaybookReference[]; // Cross-category or many-to-many references
  parent_id?: string; // Standard linear parent
  references?: string[]; // IDs of other nodes that reference this
  acl?: AccessControlList; // Proprietary RBAC overlay
  draft?: Partial<FactorDocument>;
  lastVersion?: number;
  published_at?: string;
}

export interface PlaybookDocument {
  openplaybook: string;
  entity_type: 'playbook';
  info: OpenPlaybookInfo;
  cadence?: string; 
  owner?: { id: string; name: string; email: string };
  resources?: ResourceItem[];
  parent_id?: string; // Standard linear parent
  references?: string[]; // IDs of other nodes that reference this
  access_control: {
    view: AccessControlConfig;
    edit: AccessControlConfig;
    approve: AccessControlConfig;
  };
  linktree: { 
    upstream: string[]; 
    downstream: string[]; 
    related: string[] 
  };
  steps: OpenPlaybookStep[];
  related_playbooks?: PlaybookReference[]; // Cross-category or many-to-many references
  // Optional long-form markdown body (SOP-style). When present, rendered above steps;
  // when steps are empty the body is the entire playbook view.
  body_markdown?: string;
  // Metadata for the BOS Tree
  tags?: string[];
  subType?: 'Course' | 'Step' | 'Standard';
  acl?: AccessControlList; // Proprietary RBAC overlay for granular control
  draft?: Partial<PlaybookDocument>;
  lastVersion?: number;
  published_at?: string;
}

export type PlaybookDocumentUnion = FactorDocument | PlaybookDocument;

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teams: string[];
}

export interface Organization {
  id: string;       // Clerk org id (e.g. "org_2abc...")
  name: string;
  slug?: string;
}
