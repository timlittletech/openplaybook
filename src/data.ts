/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlaybookDocumentUnion, AppUser, AccessControlList, Permissions, UserRole } from './types';

const ADMIN_PERMS: Permissions = { create: true, read: true, update: true, delete: true };
const PM_PERMS: Permissions = { create: true, read: true, update: true, delete: false };
const FIELD_PERMS: Permissions = { create: false, read: true, update: true, delete: false };

const DEFAULT_ACL: AccessControlList = {
  roles: {
    'Administrator': ADMIN_PERMS,
    'Project Manager': PM_PERMS,
    'Field Worker': FIELD_PERMS
  },
  users: [],
  teams: ['Engineering']
};

export const mockUsers: AppUser[] = [
  { id: 'u1', name: 'Alice Admin', email: 'alice@company.com', role: 'Administrator', teams: ['Management'] },
  { id: 'u2', name: 'Bob PM', email: 'bob@company.com', role: 'Project Manager', teams: ['Engineering'] },
  { id: 'u3', name: 'Charlie Field', email: 'charlie@company.com', role: 'Field Worker', teams: ['Field Ops'] }
];

export const masterRegistry: Record<string, PlaybookDocumentUnion> = {
  'root-factor': {
    id: 'root-factor',
    entity_type: 'factor',
    label: 'Project Value > $100k',
    description: 'Standard routing for major commercial projects.',
    controlType: 'boolean',
    categories: ['Sales', 'Finance', 'Operations'],
    children: [
      { type: 'playbook', ref_id: 'pb-sales-high-value', matchValue: 'Yes' }
    ],
    related_playbooks: [
      { type: 'playbook', ref_id: 'pb-enterprise-kickoff', matchValue: 'Yes' },
      { type: 'playbook', ref_id: 'pb-enterprise-site-setup', matchValue: 'Yes' }
    ],
    parent_id: 'pb-sales-onboarding', 
    acl: DEFAULT_ACL
  },

  'pb-sales-onboarding': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'pb-sales-onboarding',
      title: 'Sales Strategy: High Value',
      version: '1.0.0',
      description: 'Primary pathway for sales discovery on large accounts.',
      last_updated: '2026-03-01T09:00:00Z',
      categories: ['Sales'],
      department: 'Sales'
    },
    cadence: 'On-demand',
    subType: 'Course',
    resources: [{ name: 'Sales Deck', type: 'pdf', url: '#' }],
    access_control: {
      view: { roles: ['Administrator', 'Project Manager'] },
      edit: { roles: ['Administrator'] },
      approve: { roles: ['Administrator'] }
    },
    linktree: { upstream: [], downstream: ['root-factor'], related: [] },
    related_playbooks: [
      { type: 'playbook', ref_id: 'pb-finance-review' }
    ],
    steps: [
      { step_id: 'sales-1', action: 'Draft initial proposal using [Proposal Template](https://example.com/template)', type: 'human_intervention' },
      { step_id: 'sales-2', action: 'Schedule executive review. See [Policy Guidelines](https://example.com/policy)', type: 'human_intervention' }
    ],
    acl: DEFAULT_ACL
  },

  'pb-sales-high-value': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'pb-sales-high-value',
      title: 'High Value Sales Steps',
      version: '1.0.0',
      description: 'Specific closing steps for projects over $100k.',
      last_updated: '2026-03-10T09:00:00Z',
      categories: ['Sales'],
      department: 'Sales'
    },
    cadence: 'Per Account',
    subType: 'Step',
    parent_id: 'root-factor',
    resources: [{ name: 'Closing Script', type: 'pdf', url: '#' }],
    access_control: {
      view: { roles: ['Administrator', 'Project Manager'] },
      edit: { roles: ['Administrator'] },
      approve: { roles: ['Administrator'] }
    },
    linktree: { upstream: ['root-factor'], downstream: [], related: [] },
    steps: [
      { step_id: 'hv-1', action: 'Perform depth-of-wallet analysis via [Analysis Portal](https://example.com/portal)', type: 'human_intervention' },
      { step_id: 'hv-2', action: 'Coordinate with VP of Sales', type: 'human_intervention', note: 'Use the [VP Communication Protocol](https://example.com/protocol) for this step.' }
    ],
    acl: DEFAULT_ACL
  },

  'pb-finance-review': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'pb-finance-review',
      title: 'Finance Compliance Audit',
      version: '1.0.0',
      description: 'Audit procedure for major capital investments.',
      last_updated: '2026-03-05T09:00:00Z',
      categories: ['Finance'],
      department: 'Finance'
    },
    cadence: 'Monthly',
    subType: 'Course',
    resources: [{ name: 'Audit Cheat Sheet', type: 'pdf', url: '#' }],
    access_control: {
      view: { roles: ['Administrator'] },
      edit: { roles: ['Administrator'] },
      approve: { roles: ['Administrator'] }
    },
    linktree: { upstream: [], downstream: ['root-factor'], related: [] },
    steps: [
      { step_id: 'fin-1', action: 'Check credit limit', type: 'human_intervention' },
      { step_id: 'fin-2', action: 'Verify ROI projections', type: 'human_intervention' }
    ],
    acl: DEFAULT_ACL
  },

  'pb-enterprise-kickoff': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'pb-enterprise-kickoff',
      title: 'Enterprise Kickoff',
      version: '1.0.0',
      description: 'Ensuring alignment between sales, estimating, and production teams.',
      last_updated: '2026-01-16T09:00:00Z',
      categories: ['Operations'],
      department: 'Management'
    },
    cadence: 'Weekly',
    subType: 'Course',
    parent_id: 'root-factor',
    references: ['pb-sales-onboarding', 'pb-finance-review'],
    resources: [
      { name: 'Kickoff Video Guide', type: 'video', url: '#' },
      { name: 'Standard Scope Template', type: 'pdf', url: '#' }
    ],
    access_control: {
      view: { roles: ['Administrator', 'Project Manager', 'Field Worker'] },
      edit: { roles: ['Administrator', 'Project Manager'] },
      approve: { roles: ['Administrator'] }
    },
    linktree: { upstream: ['root-factor'], downstream: ['pb-enterprise-site-setup'], related: [] },
    steps: [
      { step_id: 'step-review-contract', action: 'Review contract scope with client', type: 'human_intervention' },
      { step_id: 'step-finalize-budget', action: 'Finalize baseline budget', type: 'human_intervention' },
      { step_id: 'step-internal-kickoff', action: 'Record internal kick-off meeting', type: 'human_intervention' }
    ],
    tags: ['Alignment', 'Management'],
    acl: DEFAULT_ACL
  },

  'pb-enterprise-site-setup': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'pb-enterprise-site-setup',
      title: 'Enterprise Site Setup',
      version: '1.1.0',
      description: 'Standard procedure for setting up a high-value job site.',
      last_updated: '2026-02-01T08:30:00Z',
      categories: ['Operations'],
      department: 'Field Ops'
    },
    cadence: 'Daily',
    subType: 'Course',
    parent_id: 'pb-enterprise-kickoff',
    resources: [
      { name: 'Site Map Layout PDF', type: 'pdf', url: '#' },
      { name: 'Logistics Best Practices', type: 'link', url: '#' }
    ],
    access_control: {
      view: { roles: ['Administrator', 'Project Manager', 'Field Worker'] },
      edit: { roles: ['Administrator', 'Project Manager'] },
      approve: { roles: ['Administrator'] }
    },
    linktree: { 
      upstream: ['pb-enterprise-kickoff'], 
      downstream: [], 
      related: ['pb-safety-global'] 
    },
    steps: [
      { step_id: 'step-secure-perimeter', action: 'Secure perimeter', type: 'human_intervention' },
      { step_id: 'step-install-signage', action: 'Install signage', type: 'human_intervention' },
      { step_id: 'step-temp-power', action: 'Setup temporary power', type: 'human_intervention' }
    ],
    tags: ['Site Ops', 'Logistics'],
    acl: DEFAULT_ACL,
  },

  'factor-project-location': {
    id: 'factor-project-location',
    entity_type: 'factor',
    label: 'Project Location (State)',
    description: 'Routing based on state-specific compliance and weather needs.',
    controlType: 'enum',
    categories: ['Operations'],
    parent_id: 'pb-enterprise-site-setup',
    children: [
      { type: 'playbook', ref_id: 'pb-ca-permit', matchValue: 'California' },
      { type: 'playbook', ref_id: 'pb-co-permit', matchValue: 'Colorado' }
    ],
    acl: DEFAULT_ACL
  },

  'pb-ca-permit': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'pb-ca-permit',
      title: 'California Permit & Environment Compliance',
      version: '1.0.4',
      description: 'Strict environmental and safety regulations for CA sites.',
      last_updated: '2026-02-03T10:00:00Z',
      categories: ['Operations']
    },
    cadence: 'On-demand',
    parent_id: 'factor-project-location',
    access_control: {
      view: { roles: ['Administrator', 'Project Manager'] },
      edit: { roles: ['Administrator'] },
      approve: { roles: ['Administrator'] }
    },
    linktree: { upstream: [], downstream: [], related: [] },
    steps: [
      { step_id: 'step-ca-noise', action: 'Submit Noise Control Plan', type: 'human_intervention' },
      { step_id: 'step-ca-swppp', action: 'Verify Stormwater Pollution Prevention (SWPPP)', type: 'human_intervention' }
    ],
    acl: DEFAULT_ACL
  },

  'pb-co-permit': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'pb-co-permit',
      title: 'Colorado Cold Weather Site Setup',
      version: '1.0.2',
      description: 'Winterization steps and mountain logistics permits.',
      last_updated: '2026-02-03T11:00:00Z',
      categories: ['Operations']
    },
    cadence: 'Seasonal',
    parent_id: 'factor-project-location',
    access_control: {
      view: { roles: ['Administrator', 'Project Manager'] },
      edit: { roles: ['Administrator'] },
      approve: { roles: ['Administrator'] }
    },
    linktree: { upstream: [], downstream: [], related: [] },
    steps: [
      { step_id: 'step-co-blankets', action: 'Order heating blankets', type: 'human_intervention' },
      { step_id: 'step-co-snow', action: 'Verify snow removal contract', type: 'human_intervention' }
    ],
    acl: DEFAULT_ACL
  },

  'factor-crane-access': {
    id: 'factor-crane-access',
    entity_type: 'factor',
    label: 'Crane Access Required',
    description: 'Evaluates if high-lift structural support is needed.',
    controlType: 'boolean',
    categories: ['Operations'],
    parent_id: 'pb-enterprise-site-setup',
    children: [
      { type: 'playbook', ref_id: 'pb-crane-pad', matchValue: 'Yes' }
    ],
    acl: DEFAULT_ACL
  },

  'pb-crane-pad': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'pb-crane-pad',
      title: 'Crane Pad Pour',
      version: '1.2.0',
      description: 'Structural stability for heavy lift operations.',
      last_updated: '2026-02-12T11:00:00Z',
      categories: ['Operations']
    },
    cadence: 'Per Site',
    parent_id: 'factor-crane-access',
    access_control: {
      view: { roles: ['Administrator', 'Project Manager', 'Field Worker'] },
      edit: { roles: ['Administrator', 'Project Manager'] },
      approve: { roles: ['Administrator'] }
    },
    linktree: { upstream: [], downstream: [], related: [] },
    steps: [
      { step_id: 'step-soil-test', action: 'Soil compaction test', type: 'human_intervention' },
      { step_id: 'step-pour-concrete', action: 'Pour concrete', type: 'human_intervention', owner: { id: 'u3', name: 'Charlie Field', role: 'Field Worker' } }
    ],
    acl: DEFAULT_ACL
  }
};

// Map original tree structure to reference-based children strings (Primary Category Roots)
export const seedDataRelation: Record<string, string[]> = {
  'Sales': ['pb-sales-onboarding'],
  'Finance': ['pb-finance-review'],
  'Operations': ['pb-enterprise-kickoff', 'pb-enterprise-site-setup']
};

export const currentUser = mockUsers[0];
