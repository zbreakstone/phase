-- Palettes and their saved versions. Each save is an immutable snapshot, so history is never rewritten.

create table public.palettes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.palette_versions (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references public.palettes (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note text check (note is null or char_length(note) <= 200),
  state jsonb not null check (pg_column_size(state) < 262144),
  created_at timestamptz not null default now()
);

create index palettes_owner_updated_idx on public.palettes (owner_id, updated_at desc);
create index palette_versions_palette_created_idx on public.palette_versions (palette_id, created_at desc);
create index palette_versions_owner_idx on public.palette_versions (owner_id);

-- Keep updated_at honest: on rename, and whenever a new version is saved.
create function public.touch_palette() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'palettes' then
    new.updated_at := now();
    return new;
  end if;
  update public.palettes set updated_at = now() where id = new.palette_id;
  return new;
end;
$$;

create trigger palettes_touch before update on public.palettes
  for each row execute function public.touch_palette();
create trigger palette_versions_touch after insert on public.palette_versions
  for each row execute function public.touch_palette();

alter table public.palettes enable row level security;
alter table public.palette_versions enable row level security;

create policy "own palettes: read" on public.palettes
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "own palettes: create" on public.palettes
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "own palettes: rename" on public.palettes
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "own palettes: delete" on public.palettes
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "own versions: read" on public.palette_versions
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "own versions: create" on public.palette_versions
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.palettes p where p.id = palette_id and p.owner_id = (select auth.uid()))
  );
create policy "own versions: delete" on public.palette_versions
  for delete to authenticated using (owner_id = (select auth.uid()));
-- No update policy on purpose: versions are never edited.
