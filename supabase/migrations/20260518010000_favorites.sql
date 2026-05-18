-- Per-user, per-org favorites list (ordered).
-- One row per favorited node; sort_order lets the user reorder if we add that later.

create table public.favorites (
  clerk_user_id  text not null,
  org_id         text not null references public.organizations(id) on delete cascade,
  node_id        text not null,
  sort_order     int  not null default 0,
  created_at     timestamptz not null default now(),
  primary key (clerk_user_id, org_id, node_id),
  foreign key (org_id, node_id) references public.nodes(org_id, id) on delete cascade
);

create index favorites_user_org_idx on public.favorites (clerk_user_id, org_id, sort_order);

alter table public.favorites enable row level security;

-- Only the owner can read/write their own favorites
create policy "self read own favorites"
  on public.favorites for select
  using (
    org_id = public.clerk_org_id()
    and clerk_user_id = public.clerk_user_id()
  );

create policy "self insert own favorites"
  on public.favorites for insert
  with check (
    org_id = public.clerk_org_id()
    and clerk_user_id = public.clerk_user_id()
  );

create policy "self update own favorites"
  on public.favorites for update
  using (
    org_id = public.clerk_org_id()
    and clerk_user_id = public.clerk_user_id()
  )
  with check (
    org_id = public.clerk_org_id()
    and clerk_user_id = public.clerk_user_id()
  );

create policy "self delete own favorites"
  on public.favorites for delete
  using (
    org_id = public.clerk_org_id()
    and clerk_user_id = public.clerk_user_id()
  );
