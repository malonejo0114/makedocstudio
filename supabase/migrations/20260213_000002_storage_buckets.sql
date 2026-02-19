-- Storage setup for AdGenius Pro assets.
-- Buckets:
-- - references: reference images for benchmarking/trending gallery
-- - products: product images uploaded by users

insert into storage.buckets (id, name, public)
values
  ('references', 'references', true),
  ('products', 'products', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_public_read_refs_products'
  ) then
    create policy storage_objects_public_read_refs_products
      on storage.objects
      for select
      using (bucket_id in ('references', 'products'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_auth_insert_refs_products'
  ) then
    create policy storage_objects_auth_insert_refs_products
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id in ('references', 'products'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_auth_update_refs_products'
  ) then
    create policy storage_objects_auth_update_refs_products
      on storage.objects
      for update
      to authenticated
      using (bucket_id in ('references', 'products'))
      with check (bucket_id in ('references', 'products'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_auth_delete_refs_products'
  ) then
    create policy storage_objects_auth_delete_refs_products
      on storage.objects
      for delete
      to authenticated
      using (bucket_id in ('references', 'products'));
  end if;
end
$$;
