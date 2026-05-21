/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Seed data shipped with new tenants. Eight generic playbooks across three
 * categories — enough to demonstrate the app without overwhelming a brand-new
 * signup. Real organization content is added on top by the customer.
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
  roles: { Administrator: ADMIN_PERMS },
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
  { id: 'demo-pm', name: 'Demo PM', email: 'pm@example.com', role: 'Project Manager', teams: ['Operations'] },
  { id: 'demo-field', name: 'Demo Field Worker', email: 'field@example.com', role: 'Field Worker', teams: ['Team'] },
];

export const currentUser = mockUsers[0];

// ---------- Eight generic seed playbooks ----------

export const masterRegistry: Record<string, PlaybookDocumentUnion> = {
  welcome: {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'welcome',
      title: 'Welcome to Open Playbook',
      version: '1.0.0',
      description: 'Orientation for new users — what Open Playbook is, how the app is organized, and how to get value fast.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Getting Started'],
      department: 'General',
    },
    cadence: 'Reference',
    subType: 'Standard',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: [], downstream: ['writing-playbooks'], related: [] },
    resources: [
      { id: 'r1', name: 'Writing a Great Playbook', title: 'Writing a Great Playbook', description: 'Authoring conventions and structure tips', type: 'sop', url: '#writing-playbooks' },
    ],
    steps: [],
    body_markdown: `# Welcome to Open Playbook

Open Playbook is your team's living library of **standard operating procedures**. Every recurring process — onboarding, customer escalations, weekly meetings, anything that has a "right way" of being done — lives here as a playbook.

## Why a playbook library matters

When procedures live in chat threads, scattered docs, and people's heads, things slip:

- New hires take weeks to figure out how things work
- Different team members do the same task differently
- Knowledge walks out the door when someone leaves
- Quality suffers under pressure because the steps weren't written down

A central, easy-to-edit playbook fixes all of that.

## How the app is organized

The left sidebar groups playbooks by **category**. Click any category to expand it; click a playbook to open it. Use search at the top to find anything across all categories.

| Element | What it does |
|---|---|
| **Sidebar categories** | Group related playbooks. Click to expand/collapse |
| **Search** | Filter playbooks by title across every category |
| **Favorites (right rail)** | Click the star on any playbook to pin it for quick access |
| **Edit mode (top right)** | Toggle on to draft changes; click Publish to save a new version |

## Getting started in 3 steps

1. **Browse the seed playbooks** in the sidebar to see how a good SOP is structured
2. **Read the [Writing a Great Playbook](#writing-playbooks) guide** for authoring conventions
3. **Replace the seed content** with your team's actual procedures — start with one and grow from there

> **Tip:** Don't try to document everything at once. Pick the process that causes the most confusion or rework on your team and write that one first. Compounding starts immediately.`,
    tags: ['orientation', 'getting-started'],
    acl: ACL_EVERYONE,
  },

  'writing-playbooks': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'writing-playbooks',
      title: 'Writing a Great Playbook',
      version: '1.0.0',
      description: 'Authoring conventions: structure, voice, markdown formatting, and what makes a playbook actually useful.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Getting Started'],
      department: 'General',
    },
    cadence: 'Reference',
    subType: 'Standard',
    parent_id: 'welcome',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: ['welcome'], downstream: [], related: [] },
    resources: [
      { id: 'r1', name: 'Welcome to Open Playbook', title: 'Welcome to Open Playbook', description: 'Start here if you\'re new', type: 'sop', url: '#welcome' },
    ],
    steps: [],
    body_markdown: `# Writing a Great Playbook

A playbook earns its keep when someone can read it under pressure and **do the right thing without asking anyone**. That's the bar.

## Anatomy of a strong playbook

### 1. Title that names the *job*, not the topic
- Good: "Onboarding a New Hire", "Escalating a Stuck Support Ticket"
- Weak: "Onboarding", "Tickets"

### 2. One-line description
The grey description under the title should answer: *when do I open this playbook?* If someone can't tell from a glance, rewrite it.

### 3. Numbered steps for procedures, prose for context
If the playbook describes a procedure, use **numbered headings (H3)** so the reader can follow along without losing their place. If it's reference material, prose is fine.

### 4. Surface the decisions, not just the actions
The hardest part of any procedure isn't the steps — it's knowing what to do when reality doesn't match the happy path. Call out the branch points:

> **If the customer is on annual billing:** skip step 4 and go directly to step 6.

### 5. Link related playbooks
Use \`[Link text](#playbook-id)\` to cross-reference other playbooks. Internal links keep users from re-searching.

## Markdown cheat sheet

| Syntax | Renders as |
|---|---|
| \`# Heading 1\` | Page title — only one per playbook |
| \`## Heading 2\` | Section header |
| \`### Heading 3\` | Sub-section / step header |
| \`**bold**\` | **bold** — for emphasis on critical actions |
| \`*italic*\` | *italic* — for software names, field names, document titles |
| \`\`\`backticks\`\`\` | \`inline code\` — for system values, columns, button labels |
| \`> blockquote\` | callout box — perfect for tips, warnings, branch decisions |
| \`- bullet\` | unordered list |
| \`1. number\` | ordered list — use for sequential steps |
| \`[text](url)\` | external link |
| \`[text](#id)\` | internal link to another playbook |

## Voice and tone

- Write in the **imperative**: "Click Submit" beats "You should click Submit"
- Use **present tense**, not future ("The customer receives an email", not "will receive")
- Be specific about *who* does what when the answer isn't obvious

## What to skip

- Don't write a preamble — readers came here to do something
- Don't restate the title in the first paragraph
- Don't link to documents you could just *embed the contents of* — copy the relevant 3 lines in
- Don't write "TBD" — leave the section out until you have an answer

> **The publish bar:** if a new hire can complete the procedure on their first read without asking a teammate, the playbook is done.`,
    tags: ['authoring', 'meta'],
    acl: ACL_EVERYONE,
  },

  'new-hire-onboarding': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'new-hire-onboarding',
      title: 'New Hire Onboarding (First 30 Days)',
      version: '1.0.0',
      description: 'Day-by-day plan for getting a new team member productive, connected, and confident in their first month.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Team Operations'],
      department: 'People',
    },
    cadence: 'Per Hire',
    subType: 'Course',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: [], downstream: [], related: ['weekly-team-meeting'] },
    resources: [
      { id: 'r1', name: 'New Hire Checklist', title: 'New Hire Checklist Template', description: 'Printable / shareable checklist version', type: 'document', url: 'https://example.com/onboarding-checklist' },
    ],
    steps: [],
    body_markdown: `# New Hire Onboarding

A great first month builds **confidence, context, and connection**. This playbook covers what to do, when, and who owns each step. The hiring manager owns the overall experience; HR handles paperwork; the team handles culture.

## Before day one

| When | Who | Action |
|---|---|---|
| Offer accepted | HR | Send welcome email with start date logistics |
| 1 week prior | IT | Order hardware; create accounts |
| 1 week prior | Manager | Assign onboarding buddy; share team roster |
| 2 days prior | Manager | Send personal welcome note with day-one schedule |

## Week 1 — Setup & context

### Day 1: Welcome and logistics
- Manager meets the hire at start of day (in person or video)
- Tour office / virtual workspace
- Hardware handoff; verify access to email, chat, calendar, repository
- Lunch with the team or buddy
- **No real work today.** First impressions matter more than productivity

### Day 2–3: Context immersion
- Read the company handbook and team mission doc
- Shadow the buddy through their day
- 1:1 with manager — discuss the role, expectations, and the [Weekly Team Meeting](#weekly-team-meeting) cadence
- Introduce to key cross-functional partners

### Day 4–5: First small contribution
- Pair on a small, well-scoped task that touches the team's core workflow
- End-of-week 1:1: what's clear, what's confusing, what would help

## Week 2 — First real ownership

- Hand off a small but meaningful piece of work the hire owns end-to-end
- Buddy is still available; manager checks in 2x
- Schedule introductions with 3–5 cross-team partners

## Week 3 — Expanding scope

- Take on a second concurrent project
- Begin participating in regular team rituals (standups, retros, planning)
- Solo present something — even a 2-minute update — at a team meeting

## Week 4 — Calibration

- 30-day review: manager + hire discuss
  - **What's working** — keep doing
  - **What's not** — adjust
  - **What's missing** — fill the gaps
- Hire writes a "what I'd want a new hire to know" doc that becomes a training resource

> **The 30-day signal:** by end of month one, the new hire should be able to answer "what does our team do and why does it matter" without hesitation. If they can't, the issue is yours, not theirs — go fix it.

## Common stumbles

- **Under-scheduled week 1** — silence feels like neglect. Err toward over-scheduling
- **No clear first project** — uncertainty kills momentum. Have something concrete by day 4
- **Buddy isn't available** — pick someone with bandwidth, not just the most experienced person`,
    tags: ['people', 'onboarding'],
    acl: ACL_EVERYONE,
  },

  'weekly-team-meeting': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'weekly-team-meeting',
      title: 'Weekly Team Meeting',
      version: '1.0.0',
      description: 'Format, agenda, and ground rules for a weekly meeting that\'s actually worth the hour.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Team Operations'],
      department: 'People',
    },
    cadence: 'Weekly',
    subType: 'Course',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: [], downstream: [], related: ['new-hire-onboarding'] },
    resources: [
      { id: 'r1', name: 'Meeting Agenda Template', title: 'Shared Agenda Doc', description: 'Live editable agenda used during the meeting', type: 'document', url: 'https://example.com/team-agenda' },
    ],
    steps: [],
    body_markdown: `# Weekly Team Meeting

A 45-minute synchronous meeting that builds **alignment and momentum**. If yours feels like a status report, it isn't working — fix it.

## When and who

- **Frequency:** Weekly, same day and time
- **Duration:** 45 minutes (hard stop)
- **Attendees:** Whole team. Skip optional? It's not optional
- **Owner:** Rotates monthly among team members

## Agenda (45 min)

| Time | Block | Purpose |
|---|---|---|
| 5 min | Wins | Celebrate concrete progress from the past week |
| 10 min | Metrics review | Look at the 2-3 numbers that matter |
| 20 min | Decisions | Discuss items that need group input, not status |
| 5 min | Blockers | Who needs unblocking, by whom, by when |
| 5 min | Action review | Restate commitments; assign owners |

## Ground rules

### Status is async, not synchronous
**Never use this meeting for "what I did this week" updates.** That belongs in a written async update. Live time is for things that genuinely benefit from discussion.

### Decisions, not deliberation
If a topic needs more than 5 minutes, table it — spin up a separate 30-minute working session with the relevant people. Don't burn everyone's time on a debate that involves three of them.

### Every action item has an owner and a date
"Someone should look into X" doesn't count. The format is: **[Name] will [verb] [object] by [date].**

### Notes are taken in real time, in a shared doc
The owner appoints a note-taker at the start. Notes are visible during the meeting so everyone sees what's being captured.

## Pre-meeting prep (everyone)

- Add agenda items to the shared doc by EOD the day before
- Skim the metrics dashboard
- Note any blockers you're hitting

## Post-meeting (owner)

- Send a summary in chat within 30 minutes — wins, decisions, action items
- Tag action item owners with their commitments
- File the agenda doc in the team folder

## Killing the meeting

If the team finds the meeting consistently not worth it, **kill it or shrink it**. Two questions answered honestly:

1. Did we make a decision today that needed the whole team to make?
2. Did anyone learn something they couldn't have learned async?

If both answers are no for 3 weeks running, the meeting needs to change.

> **The goal:** people leave feeling unblocked and aligned, not drained.`,
    tags: ['people', 'rituals'],
    acl: ACL_EVERYONE,
  },

  'performance-review': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'performance-review',
      title: 'Quarterly Performance Review',
      version: '1.0.0',
      description: 'Admin-only: structure for a useful performance conversation that strengthens trust and surfaces real growth areas.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Team Operations'],
      department: 'People',
    },
    cadence: 'Quarterly',
    subType: 'Course',
    access_control: ACCESS_ADMIN_ONLY,
    linktree: { upstream: [], downstream: [], related: ['new-hire-onboarding'] },
    resources: [],
    steps: [],
    body_markdown: `# Quarterly Performance Review

> 🔒 **Admin-only SOP** — contains evaluation criteria and compensation guidance.

A quarterly performance review done well **strengthens the relationship and clarifies the path forward**. Done poorly, it damages trust for a year. This playbook is the bar.

## Before the conversation

### 1 week prior — gather inputs
- Pull the past quarter's goals and outcomes
- Collect peer feedback from 2–3 colleagues (use a standard prompt)
- Review notes from your last 1:1s
- Look at any relevant metrics for the role

### 3 days prior — write your draft
Write the review document **before** the conversation, not during. Three sections:

1. **What worked** — specific accomplishments with impact
2. **Where you grew** — capability or judgment that visibly improved
3. **Where to focus next** — the one or two areas with the highest leverage

### 1 day prior — share the draft
Send the draft to the report 24 hours before. **The conversation is about the doc, not a surprise reveal.**

## The conversation (60 min)

| Time | Block |
|---|---|
| 5 min | Open with a personal check-in. How are *they* doing |
| 15 min | They walk through their own self-assessment first |
| 20 min | You walk through your written review section by section |
| 15 min | Discuss the focus areas — what would meaningful progress look like |
| 5 min | Compensation context if applicable (or schedule a separate conversation) |

## What makes feedback land

- **Specific:** "In the launch retro, you reframed the team's blocker into a solvable problem" beats "you have great judgment"
- **Owned:** "I noticed..." beats "people are saying..."
- **Bidirectional:** Ask "what could I do differently as your manager?" and *actually listen*

## After the conversation

- Send written follow-up the same day capturing what was discussed
- Both of you commit to one concrete thing for the next quarter
- Schedule a 30-day check-in to revisit

## Red flags that mean fix something *now*, not next quarter

- They're surprised by anything in the review
- You realize you don't have enough specific examples to back your points
- They mention something they've been frustrated about for months
- You leave feeling worse about their performance than when you started

> **The bar:** they walk out clearer on where they stand, motivated about what's next, and trusting that you'll be straight with them. If any of those is missing, you didn't do the job.`,
    tags: ['people', 'admin'],
    acl: ACL_ADMIN_ONLY,
  },

  'discovery-call': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'discovery-call',
      title: 'Customer Discovery Call',
      version: '1.0.0',
      description: 'How to run a 30-minute first-call with a new prospect that surfaces real need and moves the deal forward.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Customer Success'],
      department: 'Sales',
    },
    cadence: 'Per Lead',
    subType: 'Course',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: [], downstream: [], related: ['support-escalation', 'churn-save'] },
    resources: [
      { id: 'r1', name: 'CRM', title: 'CRM (Pipeline)', description: 'Log call notes here', type: 'link', url: 'https://example.com/crm' },
    ],
    steps: [],
    body_markdown: `# Customer Discovery Call

The point of a discovery call is **not to pitch**. It's to figure out whether there's a real problem worth solving and whether you're the right ones to solve it. If you do this well, the next steps are obvious to both sides.

## Before the call (15 min)

- Read everything public about the company (website, recent news, LinkedIn of attendees)
- Find one specific, non-generic thing to mention — shows you did the work
- Confirm the agenda by email the day before
- Have your CRM / notes doc open and ready

## The call (30 min)

### Minute 0–5 — Set the frame
> "Thanks for the time. I want to spend most of this hearing about your situation — what you're trying to do, what's getting in the way. I'll save the product walkthrough for next time once I understand whether we'd actually help. Sound good?"

This single move changes the dynamic from sales-pitch to conversation.

### Minute 5–20 — Diagnose
Three questions you must answer before the call ends:

1. **What are you trying to accomplish?** (the business goal, not the symptom)
2. **What's getting in the way today?** (what's broken about the current approach)
3. **What happens if you don't solve it?** (urgency — the cost of inaction)

Listen for **specifics**: numbers, recent incidents, names of people involved. Vague answers mean keep asking.

### Minute 20–28 — Position lightly
*Only if* you've heard a real problem you can solve, give a one-paragraph version of how you'd approach it. **No demo.** No deck. Just the shape of the solution.

### Minute 28–30 — Define next step
End with a concrete next step that both sides commit to:

| Their reaction | Next step |
|---|---|
| Enthusiastic | Schedule technical deep-dive within 2 weeks |
| Curious but skeptical | Share 1–2 case studies; reconvene in a week |
| Not the right fit | Be honest, refer them elsewhere if you can |
| Stalling | Don't schedule a follow-up. Send a polite "feel free to reach out when timing is right" |

## After the call (10 min)

- Log notes in the CRM **same day** — memory degrades fast
- Send the follow-up email within 24 hours summarizing what you heard and the agreed next step
- If you committed to anything, do it within the timeframe

## Red flags worth respecting

- They can't articulate what success looks like — they're not ready
- Multiple people on the call but no one is the decision-maker — get to them
- They're price-shopping with vague problem definitions — likely won't close, or won't be a good customer

> **The signal of a great discovery call:** at the end, *they* describe the next step, not you.`,
    tags: ['sales', 'customer'],
    acl: ACL_EVERYONE,
  },

  'support-escalation': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'support-escalation',
      title: 'Support Ticket Escalation',
      version: '1.0.0',
      description: 'When and how to escalate a customer support issue beyond first-line response.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Customer Success'],
      department: 'Support',
    },
    cadence: 'As Needed',
    subType: 'Course',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: [], downstream: [], related: ['discovery-call', 'churn-save'] },
    resources: [
      { id: 'r1', name: 'Support Queue', title: 'Support Queue', description: 'Live ticket queue', type: 'link', url: 'https://example.com/support' },
    ],
    steps: [],
    body_markdown: `# Support Ticket Escalation

Most tickets resolve at first-line. The ones that don't need to move fast and to the right person. This playbook covers the **when, how, and what-not-to-do** of escalation.

## When to escalate

Escalate immediately if **any** of these are true:

| Trigger | Why |
|---|---|
| Customer reports data loss or corruption | Severity 1 — needs engineering eyes now |
| Customer mentions cancelling | Save attempts work best within 24 hours |
| Ticket has been open >48 hours without resolution | Stale tickets erode trust |
| You don't know the answer and don't know who does | Don't guess. Ask |
| Customer specifically asks for a manager | Always honor the request |

## How to escalate

### 1. Don't drop the customer
Tell the customer what's happening **before** you escalate:

> "I'm bringing in our [engineering team / account manager / [you]] to make sure we get this right. You'll hear back within [4 hours / by end of day / within 24 hours] with a real update — not just an acknowledgement."

Set a specific time window. Then meet it.

### 2. Hand off with context, not a forward
The escalation receiver shouldn't have to dig through the thread. Write a 3-line summary:

\`\`\`
Customer: [name + plan]
Problem: [one sentence — the actual issue, not the symptom]
What I've tried: [bullets]
What I need: [a decision / engineering investigation / sign-off / etc.]
\`\`\`

### 3. Tag the right owner
- **Bug or data issue** → engineering on-call
- **Pricing, contract, or churn risk** → account manager
- **Policy exception** → support lead
- **Genuine emergency** → manager + on-call together

## What not to do

- ❌ Forward the entire ticket history without a summary
- ❌ CC five people hoping someone responds
- ❌ Escalate silently — the customer doesn't know what's happening
- ❌ Promise the customer something you haven't confirmed with the receiver

## After resolution

- Send the customer a follow-up the next day asking how things are going
- Write a short note in the ticket on **what would prevent this from happening again** (a doc update? a code fix? a clearer error message?)
- File the prevention idea wherever your team tracks improvements

> **The goal:** the customer feels heard, the right person has the right context, and the next ticket like this resolves faster.`,
    tags: ['support', 'customer'],
    acl: ACL_EVERYONE,
  },

  'churn-save': {
    openplaybook: '1.0.0',
    entity_type: 'playbook',
    info: {
      id: 'churn-save',
      title: 'Customer Churn Save Conversation',
      version: '1.0.0',
      description: 'How to run a conversation with a customer who has signaled they\'re leaving — without sounding desperate.',
      last_updated: '2026-05-18T00:00:00Z',
      categories: ['Customer Success'],
      department: 'Customer Success',
    },
    cadence: 'As Needed',
    subType: 'Course',
    access_control: ACCESS_EVERYONE,
    linktree: { upstream: [], downstream: [], related: ['discovery-call', 'support-escalation'] },
    resources: [],
    steps: [],
    body_markdown: `# Customer Churn Save Conversation

A customer telling you they're leaving is a gift — most just leave silently. Use the opportunity well: even if you don't save them, you learn something that protects the next 10 customers.

## Before the call

- Pull their account history: how long, plan, usage trend, last 5 support tickets
- Identify the **one most-likely real reason** based on the data — even if their stated reason is different
- Decide in advance what you're willing to offer (discount, plan change, free month, escalation to engineering). Don't improvise on the call

## The conversation (30 min)

### Open without defensiveness
> "I appreciate you taking the call. I'd rather understand what's not working than pitch you on staying — even if you've already decided. Mind walking me through what's behind the decision?"

This signals you're listening, not selling. People relax.

### Listen for the **real** reason

Stated reasons and real reasons are often different:

| Stated | Often actually means |
|---|---|
| "Too expensive" | Not getting enough value to justify the price |
| "We're going with [competitor]" | Competitor's salesperson outworked you for the past 3 months |
| "We're building it ourselves" | Got tired of waiting on a feature |
| "We don't have time to use it" | Onboarding fell off, they never got to value |
| "Reorg / budget cuts" | Often genuine, but ask anyway |

Ask follow-ups until you understand what's actually going on. **Don't pitch yet.**

### Diagnose: is this savable?

| Signal | Save likelihood |
|---|---|
| They're already paying a competitor | Low |
| Decision made by someone not on the call | Low |
| Specific gap you can plausibly close | Medium-high |
| Onboarding never finished | High — re-onboard, don't discount |
| "We just don't use it much" | Medium — find the value or let them go gracefully |

### Make one specific offer, not a menu

If savable, offer the one thing most likely to address the actual problem. Don't pitch three options — that signals desperation. Examples:

> "What if I paired you with one of our solutions engineers for two weeks to get [specific use case] working? No charge, and if it's not solving the problem at the end of that time, we cancel."

> "I can move you to the [Plan X] which gives you [feature they need] for the same price you're paying today. Worth trying for a month?"

### Don't beg, don't blame

If they're leaving, leave well:

> "I get it. We'd love another shot if anything changes. I'll keep your account in a paused state for 90 days so you can come back without losing your data — sound okay?"

## After the call

- Log the **real reason** in the CRM, separate from the stated reason
- If you uncovered a systemic issue (product gap, onboarding hole, pricing problem) write it up and route to the relevant team within 48 hours
- If you saved them, schedule a 30-day check-in
- If you didn't, send a gracious farewell and close cleanly

> **The hidden value:** even churn-save calls you "lose" are worth the time, because the patterns across them tell you what to fix.`,
    tags: ['customer-success', 'retention'],
    acl: ACL_EVERYONE,
  },
};

// Category → ordered root nodes for the sidebar
export const seedDataRelation: Record<string, string[]> = {
  'Getting Started': ['welcome', 'writing-playbooks'],
  'Team Operations': ['new-hire-onboarding', 'weekly-team-meeting', 'performance-review'],
  'Customer Success': ['discovery-call', 'support-escalation', 'churn-save'],
};
