create policy "Members can read org files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

create policy "Managers can upload org files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (
      public.has_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
      or public.has_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'knowledge_manager')
    )
  );

create policy "Managers can update org files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.has_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
      or public.has_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'knowledge_manager')
    )
  );

create policy "Managers can delete org files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.has_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
      or public.has_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'knowledge_manager')
    )
  );