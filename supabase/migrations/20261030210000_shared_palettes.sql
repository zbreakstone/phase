-- Short share links: an immutable snapshot of a palette behind a random 6-character code.
-- The table has no insert or public read policy; codes are only created and looked up through
-- the two functions below, so nobody can list or enumerate them.

create table public.shared_palettes (
  code text primary key check (code ~ '^[1-9A-HJ-NP-Za-km-z]{6}$'),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  state jsonb not null check (pg_column_size(state) < 262144),
  state_hash text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, state_hash)
);

create index shared_palettes_owner_idx on public.shared_palettes (owner_id, created_at desc);

alter table public.shared_palettes enable row level security;

create policy "own shares: read" on public.shared_palettes
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "own shares: revoke" on public.shared_palettes
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Returns the code for this exact palette state, creating one if you haven't shared it before.
create function public.create_share(p_state jsonb) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  alphabet constant text := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  h text;
  existing text;
  bytes bytea;
  candidate text;
  attempt int := 0;
begin
  if uid is null then
    raise exception 'Sign in to create share links.' using errcode = '28000';
  end if;
  if jsonb_typeof(p_state) is distinct from 'object' then
    raise exception 'Invalid palette.' using errcode = '22023';
  end if;
  if pg_column_size(p_state) >= 262144 then
    raise exception 'That palette is too large to share.' using errcode = '22023';
  end if;

  h := encode(sha256(convert_to(p_state::text, 'utf8')), 'hex');
  select code into existing from public.shared_palettes where owner_id = uid and state_hash = h;
  if existing is not null then
    return existing;
  end if;

  if (select count(*) from public.shared_palettes where owner_id = uid) >= 1000 then
    raise exception 'You have reached the limit of 1000 share links.' using errcode = '54000';
  end if;

  loop
    attempt := attempt + 1;
    bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    candidate := '';
    for i in 0..5 loop
      candidate := candidate || substr(alphabet, (get_byte(bytes, i) % 58) + 1, 1);
    end loop;
    begin
      insert into public.shared_palettes (code, owner_id, state, state_hash) values (candidate, uid, p_state, h);
      return candidate;
    exception when unique_violation then
      -- Either the code is taken (try another) or a concurrent request shared the same state.
      select code into existing from public.shared_palettes where owner_id = uid and state_hash = h;
      if existing is not null then
        return existing;
      end if;
      if attempt >= 10 then
        raise exception 'Could not create a share link. Try again.';
      end if;
    end;
  end loop;
end;
$$;

-- Anyone with a code can read that one snapshot.
create function public.get_shared_palette(p_code text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select state from public.shared_palettes where code = p_code;
$$;

revoke execute on function public.create_share(jsonb) from public, anon;
grant execute on function public.create_share(jsonb) to authenticated;
revoke execute on function public.get_shared_palette(text) from public;
grant execute on function public.get_shared_palette(text) to anon, authenticated;
