-- Add a content hash column to support import-time deduplication.
-- The hash is SHA-256 of the original (plaintext) file bytes. Storing it in
-- clear is safe: SHA-256 is one-way, and the only thing it leaks is whether
-- two byte-identical files exist — irrelevant in our single-user model.
--
-- Run this in the Supabase SQL editor (or via `supabase db push` if you wire
-- up the CLI later).

alter table public.photos
  add column if not exists content_hash text;

-- Prevent the same user from re-uploading byte-identical files. The partial
-- predicate keeps existing rows (without a hash) from blocking the migration.
create unique index if not exists photos_user_content_hash_unique
  on public.photos (user_id, content_hash)
  where content_hash is not null;
