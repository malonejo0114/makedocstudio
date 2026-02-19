-- Storage bucket for MKDoc diagnosis assets (store photos, insight captures, etc.)

insert into storage.buckets (id, name, public)
values
  ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_public_read_store_assets'
  ) then
    create policy storage_objects_public_read_store_assets
      on storage.objects
      for select
      using (bucket_id in ('store-assets'));
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
      and policyname = 'storage_objects_auth_insert_store_assets'
  ) then
    create policy storage_objects_auth_insert_store_assets
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id in ('store-assets'));
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
      and policyname = 'storage_objects_auth_update_store_assets'
  ) then
    create policy storage_objects_auth_update_store_assets
      on storage.objects
      for update
      to authenticated
      using (bucket_id in ('store-assets'))
      with check (bucket_id in ('store-assets'));
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
      and policyname = 'storage_objects_auth_delete_store_assets'
  ) then
    create policy storage_objects_auth_delete_store_assets
      on storage.objects
      for delete
      to authenticated
      using (bucket_id in ('store-assets'));
  end if;
end
$$;

