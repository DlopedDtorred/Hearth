-- Run this once in your Supabase project's SQL Editor.
-- Only model metadata and public source URLs are stored; this table never stores model files.
create table if not exists public.model_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 2 and 100),
  category text not null check (category in ('Chat', 'Code', 'Vision', 'Embeddings', 'Audio', 'Other')),
  quantization text not null default '' check (char_length(quantization) <= 40),
  model_url text not null check (
    char_length(model_url) <= 2048
    and model_url ~* '^https://[^[:space:]]+$'
  ),
  license text not null check (char_length(license) between 1 and 80),
  description text not null check (char_length(description) between 5 and 500),
  created_at timestamptz not null default now()
);

create index if not exists model_links_created_at_idx
  on public.model_links (created_at desc);
create index if not exists model_links_category_idx
  on public.model_links (category);

alter table public.model_links enable row level security;

drop policy if exists "Anyone can browse public model links" on public.model_links;
create policy "Anyone can browse public model links"
  on public.model_links for select
  to anon, authenticated
  using (true);

drop policy if exists "Signed-in users can share model links" on public.model_links;
create policy "Signed-in users can share model links"
  on public.model_links for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Authors can delete their own model links" on public.model_links;
create policy "Authors can delete their own model links"
  on public.model_links for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.model_links to anon, authenticated;
revoke insert, update on public.model_links from anon, authenticated;
grant insert (name, category, quantization, model_url, license, description)
  on public.model_links to authenticated;
grant delete on public.model_links to authenticated;
