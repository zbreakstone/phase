-- Named versions, like Figma's version history. A version with a title is one you added on purpose; a
-- version without one is an autosave. `note` stays as the optional description of a named version.

alter table public.palette_versions
  add column title text check (title is null or char_length(title) between 1 and 80);

-- Versions saved by hand with a note become named versions, using the note as their title.
update public.palette_versions
  set title = left(note, 80),
      note = case when char_length(note) > 80 then note else null end
  where note is not null and note <> 'Autosave';

-- Autosaves no longer carry a label.
update public.palette_versions set note = null where note = 'Autosave';

-- The title and description can be fixed afterwards. The saved palette itself still can't change.
grant update (title, note) on public.palette_versions to authenticated;
