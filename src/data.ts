/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Seed data — ported from blok-playbook's 9 SOPs.
 * Each SOP becomes a `playbook` node with the markdown body stored as `body_markdown`.
 * Step arrays are intentionally empty: blok SOPs are prose, not discrete steps.
 *
 * To add factors/branching on top of these, create `factor` nodes that reference these
 * playbook IDs via their `children` array.
 */

import { PlaybookDocumentUnion, AppUser, AccessControlList, Permissions } from './types';

const ADMIN_PERMS: Permissions = { create: true, read: true, update: true, delete: true };
const PM_PERMS: Permissions = { create: true, read: true, update: true, delete: false };
const FIELD_PERMS: Permissions = { create: false, read: true, update: true, delete: false };

const ACL_EVERYONE: AccessControlList = {
  roles: {
    Administrator: ADMIN_PERMS,
    'Project Manager': PM_PERMS,
    'Field Worker': FIELD_PERMS,
  },
  users: [],
  teams: [],
};

const ACL_ADMIN_ONLY: AccessControlList = {
  roles: {
    Administrator: ADMIN_PERMS,
  },
  users: [],
  teams: [],
};

const ACCESS_EVERYONE = {
  view: { roles: ['Administrator', 'Project Manager', 'Field Worker'] },
  edit: { roles: ['Administrator', 'Project Manager'] },
  approve: { roles: ['Administrator'] },
};
const ACCESS_ADMIN_ONLY = {
  view: { roles: ['Administrator'] },
  edit: { roles: ['Administrator'] },
  approve: { roles: ['Administrator'] },
};

export const mockUsers: AppUser[] = [
  { id: 'demo-admin', name: 'Demo Admin', email: 'admin@example.com', role: 'Administrator', teams: ['Management'] },
  { id: 'demo-pm', name: 'Demo PM', email: 'pm@example.com', role: 'Project Manager', teams: ['Engineering'] },
  { id: 'demo-field', name: 'Demo Field Worker', email: 'field@example.com', role: 'Field Worker', teams: ['Field Ops'] },
];

export const currentUser = mockUsers[0];

// ---------- Blok SOPs as playbook nodes ----------

export const masterRegistry: Record<string, PlaybookDocumentUnion> = {
  overview: {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'overview',
      title: 'Operations Handbook Overview',
      version: '1.0.0',
      description: 'Welcome and orientation for the blok & co. operations playbook.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Overview'],
      department: 'Operations',
    },
    cadence: 'Reference',
    subType: 'Standard',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: [], downstream: [], related: [] },
    resources: [
      { id: 'r1', name: 'Work Order Submissions board', title: 'Work Order Submissions board', description: 'Central hub for all 1,224 work orders', type: 'board', url: 'https://blok4.monday.com/boards/2762491237' },
      { id: 'r2', name: 'TI / Maint Projects board', title: 'TI / Maint Projects board', description: '91 active multi-work-order projects', type: 'board', url: 'https://blok4.monday.com/boards/3131873528' },
      { id: 'r3', name: 'Time Sheet board', title: 'Time Sheet board', description: 'Bi-monthly payroll entries by employee', type: 'board', url: 'https://blok4.monday.com/boards/6769916585' },
      { id: 'r4', name: 'Customers board', title: 'Customers board', description: '93 customers with billing settings', type: 'board', url: 'https://blok4.monday.com/boards/2762521632' },
    ],
    steps: [],
    body_markdown: `# Operations Handbook

Welcome to the **blok & co.** operations playbook. This handbook documents every process across our monday.com workspace — from FastField submissions through final invoicing.

## At a glance

- **1,224** work order submissions tracked
- **91** active TI / maintenance projects
- **93** customers
- **Bi-monthly** time sheet periods

## The board ecosystem

\`\`\`flow
FastField submission → Work order → Labor + materials → Invoice
TI project → Work orders (linked) → Project invoices
Time sheet entry → Linked to work order → Labor cost auto-calculated
\`\`\`

## How to use this playbook

Each section in the sidebar covers one part of the operation. Admins can click **Edit** on any SOP to update it. Use the search bar to quickly find a specific procedure.

> **Tip:** The resources table at the top of every SOP links to related boards, videos, and other SOPs. Scroll continuously through an entire category, or click any individual SOP to jump to it.`,
    tags: ['orientation'],
    acl: ACL_EVERYONE,
  },

  workorders: {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'workorders',
      title: 'Work Order Submissions',
      version: '1.0.0',
      description: 'The central hub for all jobs — full work order lifecycle from FastField to invoice.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Field Operations'],
      department: 'Field Operations',
    },
    cadence: 'Daily',
    subType: 'Course',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: [], downstream: ['types', 'materials'], related: ['customers', 'billing'] },
    resources: [
      { id: 'r1', name: 'Work Orders board', title: 'Work Orders board', description: 'Open the live board on monday.com', type: 'board', url: 'https://blok4.monday.com/boards/2762491237' },
      { id: 'r2', name: 'Work Order Types SOP', title: 'Work Order Types SOP', description: 'Classification reference for every type', type: 'sop', url: '#types' },
      { id: 'r3', name: 'Customers SOP', title: 'Customers SOP', description: 'How to add and link customers', type: 'sop', url: '#customers' },
    ],
    steps: [],
    body_markdown: `# Work Order Submissions

The central hub for all jobs — **1,224 items tracked**. Maintenance calls, TI project work, subcontractor invoices, and non-billable items all live here.

## Life cycle

### 1. Submit via FastField
Field tech submits a FastField report on-site. The submission ID auto-populates the work order. Status is set to **Submitted**.

### 2. Link customer & property
Connect the work order to a customer from the Customers board. Fill in the property / TI project fields. If the customer isn't listed, **add them to QuickBooks first**, then sync to monday.

### 3. Log labor & materials
Link time entries from the Labor board and receipts from the Materials board. Cost columns calculate automatically — **do not edit them manually**.

### 4. Mark job completed
Set "Job Completed?" to **Yes** when all work is done. Verify labor hours, materials, and subcontractor costs are accurate before proceeding.

### 5. Create & send invoice
Use the *Create Invoice* button on the work order or Customers board. Once invoiced, move status to **Invoiced** and link the invoice record in the "Link to Invoice" column.

### 6. Archive or close
Move fully paid or non-billable items to **Archive** or **Not going to invoice**. Move manually invoiced jobs to **Manually Invoiced**.

## Status definitions

| Status | Meaning |
|---|---|
| Submitted | New, awaiting triage |
| Stuck | Blocked, needs manager attention |
| HOLDING | Paused, waiting on something |
| Invoiced | Completed and invoiced |
| Manually Invoiced | Invoiced outside the system |
| Not going to invoice | Warranty, goodwill, or non-billable |
| Archive | Complete and closed |

## Board groups

- **Subcontractor work orders** — jobs performed by external subs
- **TI / maint project work orders** — items tied to a TI or larger project
- **Maintenance work orders** — standard day-to-day calls
- **Manually invoiced** — invoiced outside the system
- **Invoiced** — completed and invoiced
- **Not going to invoice** — warranty, goodwill, non-billable

> **Note:** Subitems on each work order capture individual employee hours, rate, and cost. These roll up into the parent work order's totals automatically.`,
    tags: ['field-ops', 'core'],
    acl: ACL_EVERYONE,
  },

  types: {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'types',
      title: 'Work Order Types',
      version: '1.0.0',
      description: 'Classification reference: every work order Type and what it means for invoicing.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Field Operations'],
      department: 'Field Operations',
    },
    cadence: 'Reference',
    subType: 'Standard',
    parent_id: 'workorders',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: ['workorders'], downstream: [], related: ['materials'] },
    resources: [
      { id: 'r1', name: 'Work Order Submissions SOP', title: 'Work Order Submissions SOP', description: 'Parent SOP for the full work order lifecycle', type: 'sop', url: '#workorders' },
      { id: 'r2', name: 'Materials & Subs SOP', title: 'Materials & Subs SOP', description: 'How sub-invoice types link to work orders', type: 'sop', url: '#materials' },
    ],
    steps: [],
    body_markdown: `# Work Order Types

The **Type** column on every work order classifies what kind of job it is. This affects how it's grouped, invoiced, and reported.

## Type definitions

### TI / maint project work
Work tied to a larger tenant improvement or maintenance project. **Always link this to a TI / Maint Projects board item.**

### Maintenance
Standard property maintenance calls — the most common type. Submitted by techs via FastField on-site.

### Call center maintenance
Maintenance requests that originated through a call center or dispatch system.

### Estimate preparation
Time or costs incurred while preparing a bid or estimate. Linked to the Bids board.

### blok non-job related receipt
Internal company expense — not tied to any billable job. Examples: office supplies, vehicle costs.

### blok fuel receipt
Fuel purchases for company vehicles. Tracked here for reporting and cost control.

### Subcontractor invoice
A cost passed through from a subcontractor. Requires "Subcontractor Invoice Type" to also be set. **Always link a sub invoice record.**

## Subcontractor invoice type

When the Type is "Subcontractor invoice," set the Subcontractor Invoice Type:

- **Maintenance** — sub invoice for a routine maintenance job
- **TI / maint project** — sub invoice under a larger project
- **Tenant improvement** — sub invoice for a full TI build-out
- **N/A** — not applicable

## Special flags

- **Warranty?** — check if the work is under warranty. **Do not invoice.**
- **Extra scope?** — check if this work was outside the original project scope.
- **Estimate work?** — marks whether the work order is part of an estimate.
- **Catchup bill?** — indicates a backlogged or retroactive billing entry.`,
    tags: ['field-ops', 'reference'],
    acl: ACL_EVERYONE,
  },

  materials: {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'materials',
      title: 'Materials & Subcontractors',
      version: '1.0.0',
      description: 'How materials and subcontractor costs link to work orders and feed total charge.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Field Operations'],
      department: 'Field Operations',
    },
    cadence: 'Per Job',
    subType: 'Course',
    parent_id: 'workorders',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: ['workorders'], downstream: [], related: ['billing'] },
    resources: [
      { id: 'r1', name: 'Work Order Submissions SOP', title: 'Work Order Submissions SOP', description: 'How materials link to work orders', type: 'sop', url: '#workorders' },
      { id: 'r2', name: 'Billing & Invoicing SOP', title: 'Billing & Invoicing SOP', description: 'How materials affect total charge', type: 'sop', url: '#billing' },
    ],
    steps: [],
    body_markdown: `# Materials & Subcontractors

Materials costs come from the Receipts board. Subcontractor costs come from the Subcontractor Invoices board. Both link to work orders and calculate into the total charge.

## Logging a material receipt

### 1. Add receipt to Materials/Receipts board
Enter the cost and set the standard markup percentage for this receipt.

### 2. Link to work order
On the work order, use the "Materials" (link to receipts) column to connect the receipt. The "Materials Cost" mirror will populate automatically.

### 3. Adjust markup if needed
The standard markup mirrors from the receipt. To override, enter a percentage in "Actual Materials Markup" on the work order.

## Logging a subcontractor invoice

### 1. Add to Subcontractor Invoices board
Enter the sub invoice amount. The standard sub markup is set at the sub invoice level.

### 2. Link to work order
On the work order, use "Subcontractor Invoices" column to connect it. "Sub Invoice Amount" mirror populates automatically.

### 3. Set subcontractor invoice type
On the work order, set "Subcontractor Invoice Type" — Maintenance, TI / Maint Project, or Tenant Improvement.

### 4. Adjust markup if needed
Use "Actual Subcontractor Markup" on the work order to override the standard markup.

## Cost summary on work orders

- **Total Cost** — Labor Cost + Materials Cost + Sub Invoice Amount (auto-calculated, read-only)
- **Work Order Profit** — Total Charge minus Total Cost. Shows "N/A" if no labor or sub costs are logged.
- **Customer Discount** — Difference between Standard Total Charge and Actual Total Charge

> **Tip:** The "Connection Count" formula shows how many items are linked (receipts, sub invoices, invoices, TI links, time entries). A low count on an invoiced work order may mean something is missing.`,
    tags: ['field-ops'],
    acl: ACL_EVERYONE,
  },

  ti: {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'ti',
      title: 'TI / Maintenance Projects',
      version: '1.0.0',
      description: 'Multi-work-order project tracking — budget, invoicing, and project life cycle.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Projects'],
      department: 'Operations',
    },
    cadence: 'Project-based',
    subType: 'Course',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: [], downstream: ['workorders'], related: ['billing'] },
    resources: [
      { id: 'r1', name: 'TI / Maint Projects board', title: 'TI / Maint Projects board', description: '91 projects with budget tracking', type: 'board', url: 'https://blok4.monday.com/boards/3131873528' },
      { id: 'r2', name: 'Work Order Submissions SOP', title: 'Work Order Submissions SOP', description: 'How work orders link into projects', type: 'sop', url: '#workorders' },
    ],
    steps: [],
    body_markdown: `# TI / Maintenance Projects

**91 items** tracked on the TI / Maint Projects board. This board manages larger multi-work-order jobs, tracking budget vs. actual spend, invoicing, and project status.

## Project life cycle

### 1. Create project record
Add a new item in the *Work in Progress* group. Set the project name, link to the customer, and enter the budget and tenant allowance amounts.

### 2. Link estimate
Connect to the Bids/Estimates board. The estimate number, Excel file, and invoicing details will mirror automatically.

### 3. Set wage type
Designate **Prevailing Wage** or **Standard**. This affects how labor costs are calculated on linked work orders.

### 4. Log work orders
Create work orders and link them to this project via the "Work Orders" relation column. Costs and status from those work orders mirror up automatically.

### 5. Track spend vs. budget
The "Total Logged/Spent to Date" mirror shows running actual costs. Compare against the Budget field. "Invoiced Created to Date" shows what has been invoiced.

### 6. Invoice project
Use the *Create Invoice* button on the project record. Link the resulting invoice. **Update "Total Invoice Sent to Date" manually after each invoice is sent.**

### 7. Mark complete
Move to the *Completed* group. Status → **Done**. The project will be removed from FastField lookup lists.

## Key fields

| Field | Purpose |
|---|---|
| Budget | Total approved project budget |
| Tenant allowance | Amount the tenant contributes toward the build-out |
| Property code | Prefix used for all work order request numbers on this project |
| FastField changelog | Set to "Changed" when an update requires syncing the FastField lookup list |

## Status definitions

- **Working on it** — active in FastField
- **Done** — project closed and removed from FastField
- **Stuck** — blocked, needs attention`,
    tags: ['projects'],
    acl: ACL_EVERYONE,
  },

  timesheets: {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'timesheets',
      title: 'Time Sheets',
      version: '1.0.0',
      description: 'Bi-monthly time entry, sign-off, and payroll-email procedure.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Payroll'],
      department: 'Operations',
    },
    cadence: 'Bi-monthly',
    subType: 'Course',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: [], downstream: [], related: ['employees'] },
    resources: [
      { id: 'r1', name: 'Time Sheet board', title: 'Time Sheet board', description: 'Bi-monthly hour entries by employee', type: 'board', url: 'https://blok4.monday.com/boards/6769916585' },
      { id: 'r2', name: 'Team & Employees SOP', title: 'Team & Employees SOP', description: 'Roster and rate policy reference', type: 'sop', url: '#employees' },
    ],
    steps: [],
    body_markdown: `# Time Sheets

Time is recorded **bi-monthly** (two periods per month). Each period is a group on the Time Sheet board. Employees log hours per day as subitems under each date row.

## How time gets recorded

### 1. Navigate to current period group
Each bi-monthly period is its own group (e.g., "May 1–15 2026"). Open the current group and find or create the date row for today.

### 2. Add a subitem for the date
Each row represents a work date. Subitems hold the actual hours per employee per wage type.

### 3. Enter hours by wage type
Use the correct column: **Standard**, **OT** (overtime), **Prevailing Wage**, or **PTO**. Every employee has their own set of columns.

### 4. Employee sign-off
Each employee has a "Signoff" status. Set to **Yes** once hours are confirmed. If disputed, set to **No**. Track punctuality with the "On Time?" column.

### 5. Send payroll email
Use the *Send Payroll Email* button at the end of each period to notify payroll. The per-period totals roll up automatically.

## Wage types

- **Standard** — regular hours at base rate
- **OT (overtime)** — hours above standard threshold, billed at OT rate
- **Prevailing wage** — government/public jobs requiring prevailing wage rates
- **PTO** — paid time off, not charged to any job

## Team members tracked

Jon · Steven · Carlos · Anthony · Cloudy · Michael · Jesus · Jose · Bryan

> **Tip:** The "Daily Hour Checker" broadcast view gives a quick visual summary of who has submitted hours each day. Use it at end-of-day to catch missing entries.`,
    tags: ['payroll'],
    acl: ACL_EVERYONE,
  },

  customers: {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'customers',
      title: 'Customers',
      version: '1.0.0',
      description: 'How to add, sync, and configure customers for invoicing.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Customers & Billing'],
      department: 'Operations',
    },
    cadence: 'On-demand',
    subType: 'Course',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: [], downstream: ['billing'], related: ['workorders'] },
    resources: [
      { id: 'r1', name: 'Customers board', title: 'Customers board', description: '93 customers with full billing settings', type: 'board', url: 'https://blok4.monday.com/boards/2762521632' },
      { id: 'r2', name: 'Billing & Invoicing SOP', title: 'Billing & Invoicing SOP', description: 'How customer settings affect invoices', type: 'sop', url: '#billing' },
    ],
    steps: [],
    body_markdown: `# Customers

**93 customers** tracked. The Customers board connects every customer to their work orders, invoices, TI projects, and subcontractor invoices.

## Adding a new customer

### 1. Add to QuickBooks first
Create the customer record in QB **before** adding to monday. QB is the source of truth for billing.

### 2. Add to monday Customers board
Create a new item. Fill in name, emails, and mailing address fields.

### 3. Sync to QuickBooks
Click *Sync to QB* button. This will populate the QuickBooks ID field — **required for invoicing automation to work**.

### 4. Add to FastField manually
FastField lookup lists require a manual add. Set "Show in FastField?" to **Yes** once the customer is in FastField.

### 5. Configure invoice settings
- Set "Invoice Attachment" method (Google Drive folder or attach directly)
- Set "Invoice Note" to "Mailing Address" if the customer needs blok's mailing address on invoices
- Enable physical mail if needed

## Invoice delivery options

| Method | When to use |
|---|---|
| **Email** | Default. Email(s) column holds all recipient addresses |
| **Physical mail** | Set "Send Invoice in the Mail" to Yes. All mailing fields must be filled |
| **Google Drive folder** | Customer prefers docs in a shared folder |`,
    tags: ['customers'],
    acl: ACL_EVERYONE,
  },

  billing: {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'billing',
      title: 'Billing & Invoicing',
      version: '1.0.0',
      description: 'Admin-only: how invoices are calculated and generated from work orders and projects.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Customers & Billing'],
      department: 'Finance',
    },
    cadence: 'On-demand',
    subType: 'Course',
    parent_id: 'customers',
    access_control: ACCESS_ADMIN_ONLY,
    linktree: { upstream: ['customers'], downstream: [], related: ['materials', 'workorders'] },
    resources: [
      { id: 'r1', name: 'Customers SOP', title: 'Customers SOP', description: 'Customer billing settings reference', type: 'sop', url: '#customers' },
      { id: 'r2', name: 'Materials & Subs SOP', title: 'Materials & Subs SOP', description: 'How costs feed into the total charge', type: 'sop', url: '#materials' },
    ],
    steps: [],
    body_markdown: `# Billing & Invoicing

> 🔒 **Admin-only SOP** — contains financial procedures and rate information.

Invoices are generated from work orders or TI projects. The system auto-calculates charges based on actual labor, materials, and subcontractor costs.

## How billing is calculated

- **Labor charge** — Hours × Actual Labor Rate Per Hour. The **Standard rate is $74/hr** baseline. Override with the "Actual Labor Rate" column per work order.
- **Materials charge** — Materials cost × (1 + Markup%). Standard markup is set per receipt. Actual markup can be overridden on the work order.
- **Sub invoice charge** — Subcontractor invoice amount passes through directly (or with markup). Set the "Actual Subcontractor Markup" % on the work order.
- **Total charge** — Labor + Materials + Sub invoices. "Actual Total Charge" is the final billable amount. "Standard Total Charge" uses the $74/hr baseline for comparison.

## Invoice creation process

### 1. Verify all costs are correct
Check labor hours, materials, and sub invoices are all linked and accurate. Review "Work Order Profit" and "Customer Discount" columns.

### 2. Click "Create Invoice"
Use the button on the work order or customer record. For TI projects, use the button on the project record.

### 3. Link invoice record
The invoice will appear in the Invoices board. Link it back to the work order via "Link to Invoice" column. The "Invoice Status" mirror will update automatically.

### 4. Update work order status
Set work order status to **Invoiced** and fill in "Date Invoiced". The "Invoiced Amount" formula will activate.

> **Note:** If status is set to "Not going to Invoice," the Total Charge formula returns $0 automatically — no manual clearing needed.`,
    tags: ['billing', 'admin'],
    acl: ACL_ADMIN_ONLY,
  },

  employees: {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'employees',
      title: 'Team & Employees',
      version: '1.0.0',
      description: 'Admin-only: team roster, quality tracking, and labor rate policy.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Team'],
      department: 'HR',
    },
    cadence: 'Reference',
    subType: 'Standard',
    access_control: ACCESS_ADMIN_ONLY,
    linktree: { upstream: [], downstream: [], related: ['timesheets'] },
    resources: [
      { id: 'r1', name: 'Time Sheets SOP', title: 'Time Sheets SOP', description: 'How employees log hours', type: 'sop', url: '#timesheets' },
    ],
    steps: [],
    body_markdown: `# Team & Employees

> 🔒 **Admin-only SOP** — contains employee rate and quality tracking information.

The team consists of field technicians and project leads. Each employee appears on time sheets, work order lead assignments, and sub-items for labor tracking.

## Current team members

| Name | Role |
|---|---|
| Jon | Field technician |
| Steven | Field technician |
| Bryan | Field technician / project manager |
| Carlos | Field technician |
| Anthony | Field technician |
| Cloudy | Field technician |
| Michael | Field technician |
| Jesus | Field technician |
| Jose | Field technician |
| Miguel, Angel, Carlos (alt) | Additional leads (Lead Employee column) |

## Quality tracking

- Each employee has a "Quality Issues?" checkbox on time sheet subitems — flag any workmanship concerns here
- "On Time?" tracks punctuality per period — options: Yes, No, Absent, Unexcused Absent
- "Signoff" status must be marked Yes each period to confirm hours are reviewed

## Labor rate policy

- **Standard rate:** $74/hr baseline for all field technicians
- **Actual rate:** Can be overridden per work order using "Actual Labor Rate Per Hour" column
- **Prevailing wage:** Government/public jobs use higher prevailing wage rates — set Wage Type on the TI project
- **After hours:** The "Labor After Hours?" mirror flags any time entries marked as after-hours on labor records`,
    tags: ['team', 'admin'],
    acl: ACL_ADMIN_ONLY,
  },
};

// Map blok categories → ordered root nodes for the sidebar
export const seedDataRelation: Record<string, string[]> = {
  Overview: ['overview'],
  'Field Operations': ['workorders', 'types', 'materials'],
  Projects: ['ti'],
  Payroll: ['timesheets'],
  'Customers & Billing': ['customers', 'billing'],
  Team: ['employees'],
};
