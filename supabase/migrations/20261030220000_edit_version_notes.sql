-- Versions stay immutable except for their note, so typos can be fixed.
-- A column-level grant means the saved palette itself can never be changed, whatever the app does.

revoke update on public.palette_versions from anon, authenticated;
grant update (note) on public.palette_versions to authenticated;

create policy "own versions: edit note" on public.palette_versions
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
