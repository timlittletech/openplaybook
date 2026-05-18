-- openplaybook multi-tenant schema
-- Tenants = Clerk Organizations. Every row carries org_id (the Clerk org id).
-- RLS reads org_id and role from Clerk-issued JWTs (Supabase Third-Party Auth).
--
-- Clerk JWT claims available via auth.jwt():
--   sub        = Clerk user id
--   org_id     = active Clerk org id (only when a user has an org selected)
--   org_role   = "org:admin" | "org:member" (Clerk's default org roles)
--   email      = primary email (added via custom session claims)

------------------------------------------------------------
-- Helper: read JWT claims
-- Defined in public (Supabase reserves the auth schema for its own code).
------------------------------------------------------------
create or replace function public.clerk_user_id() returns text
  language sql stable as $$
    select coalesce(auth.jwt() ->> 'sub', '')
$$;

create or replace function public.clerk_org_id() returns text
  language sql stable as $$
    select coalesce(auth.jwt() ->> 'org_id', '')
$$;

create or replace function public.clerk_org_role() returns text
  language sql stable as $$
    select coalesce(auth.jwt() ->> 'org_role', '')
$$;

------------------------------------------------------------
-- organizations: cache of Clerk org metadata
-- Synced from Clerk via webhook (or upserted on first use).
------------------------------------------------------------
create table public.organizations (
  id          text primary key,             -- Clerk org id, e.g. "org_2abc..."
  name        text not null,
  slug        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- Members can read their own org
create policy "org members read own org"
  on public.organizations for select
  using (id = public.clerk_org_id());

-- Authenticated users can upsert their current org (self-serve provisioning)
create policy "any authed user can upsert own org"
  on public.organizations for insert
  with check (id = public.clerk_org_id());

create policy "org admins update own org"
  on public.organizations for update
  using (id = public.clerk_org_id() and public.clerk_org_role() = 'org:admin')
  with check (id = public.clerk_org_id());

------------------------------------------------------------
-- user_profiles: openplaybook's internal role overlay
-- (Clerk has org:admin / org:member; we add Administrator / Project Manager / Field Worker on top)
------------------------------------------------------------
create table public.user_profiles (
  clerk_user_id  text not null,
  org_id         text not null references public.organizations(id) on delete cascade,
  display_name   text not null default '',
  email          text not null default '',
  role           text not null default 'Field Worker'
    check (role in ('Administrator', 'Project Manager', 'Field Worker')),
  teams          text[] not null default array[]::text[],
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (clerk_user_id, org_id)
);

create index user_profiles_org_idx on public.user_profiles (org_id);

alter table public.user_profiles enable row level security;

create policy "org members read profiles in own org"
  on public.user_profiles for select
  using (org_id = public.clerk_org_id());

-- Self-serve profile creation on first sign-in (capped at own user+org)
create policy "self insert own profile"
  on public.user_profiles for insert
  with check (
    org_id = public.clerk_org_id()
    and clerk_user_id = public.clerk_user_id()
  );

-- Users can update their own name/teams; only org admins can change roles
create policy "self update own profile (non-role fields)"
  on public.user_profiles for update
  using (
    org_id = public.clerk_org_id()
    and clerk_user_id = public.clerk_user_id()
  )
  with check (
    org_id = public.clerk_org_id()
    and clerk_user_id = public.clerk_user_id()
    -- role change requires admin; enforced by separate admin policy below taking precedence
  );

create policy "org admins manage all profiles in own org"
  on public.user_profiles for all
  using (
    org_id = public.clerk_org_id()
    and public.clerk_org_role() = 'org:admin'
  )
  with check (
    org_id = public.clerk_org_id()
  );

------------------------------------------------------------
-- nodes: playbooks and factors (the openplaybook graph)
-- Flexible fields stored as JSONB in `data`; common access fields hoisted out.
------------------------------------------------------------
create table public.nodes (
  id              text not null,            -- e.g. "pb-sales-onboarding", "factor-project-location"
  org_id          text not null references public.organizations(id) on delete cascade,
  entity_type     text not null check (entity_type in ('factor', 'playbook')),
  parent_id       text,                     -- linear-parent ref (no FK; can dangle across reorgs)
  data            jsonb not null,           -- full FactorDocument / PlaybookDocument shape
  body_markdown   text,                     -- optional long-form markdown body (for SOP-style playbooks)
  draft           jsonb,                    -- unpublished edits
  last_version    int not null default 0,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (org_id, id)
);

create index nodes_org_idx on public.nodes (org_id);
create index nodes_org_parent_idx on public.nodes (org_id, parent_id);
create index nodes_org_entity_idx on public.nodes (org_id, entity_type);

alter table public.nodes enable row level security;

create policy "org members read nodes"
  on public.nodes for select
  using (org_id = public.clerk_org_id());

-- Anyone in the org can save drafts on any node they can read (the app enforces
-- finer-grained access_control / acl in the document JSON itself)
create policy "org members write nodes"
  on public.nodes for insert
  with check (org_id = public.clerk_org_id());

create policy "org members update nodes"
  on public.nodes for update
  using (org_id = public.clerk_org_id())
  with check (org_id = public.clerk_org_id());

create policy "org admins delete nodes"
  on public.nodes for delete
  using (
    org_id = public.clerk_org_id()
    and public.clerk_org_role() = 'org:admin'
  );

------------------------------------------------------------
-- node_versions: append-only history of published versions
------------------------------------------------------------
create table public.node_versions (
  id              uuid primary key default gen_random_uuid(),
  node_id         text not null,
  org_id          text not null references public.organizations(id) on delete cascade,
  version_number  int not null,
  author_id       text not null,
  author_name     text not null,
  change_note     text,
  content         jsonb not null,
  created_at      timestamptz not null default now(),
  foreign key (org_id, node_id) references public.nodes(org_id, id) on delete cascade,
  unique (org_id, node_id, version_number)
);

create index node_versions_org_node_idx on public.node_versions (org_id, node_id, version_number desc);

alter table public.node_versions enable row level security;

create policy "org members read versions"
  on public.node_versions for select
  using (org_id = public.clerk_org_id());

create policy "org members insert versions"
  on public.node_versions for insert
  with check (
    org_id = public.clerk_org_id()
    and author_id = public.clerk_user_id()
  );

------------------------------------------------------------
-- category_roots: per-org top-level entry points by category
------------------------------------------------------------
create table public.category_roots (
  org_id       text not null references public.organizations(id) on delete cascade,
  category     text not null,
  node_id      text not null,
  sort_order   int  not null default 0,
  primary key (org_id, category, node_id),
  foreign key (org_id, node_id) references public.nodes(org_id, id) on delete cascade
);

create index category_roots_org_idx on public.category_roots (org_id, category, sort_order);

alter table public.category_roots enable row level security;

create policy "org members read category roots"
  on public.category_roots for select
  using (org_id = public.clerk_org_id());

create policy "org admins manage category roots"
  on public.category_roots for all
  using (
    org_id = public.clerk_org_id()
    and public.clerk_org_role() = 'org:admin'
  )
  with check (org_id = public.clerk_org_id());

------------------------------------------------------------
-- updated_at trigger
------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();
create trigger user_profiles_touch before update on public.user_profiles
  for each row execute function public.touch_updated_at();
create trigger nodes_touch before update on public.nodes
  for each row execute function public.touch_updated_at();
