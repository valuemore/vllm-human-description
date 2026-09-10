-- 0007: Private 영상 버킷. public 접근 없음, 참여자는 서버가 발급한 signed URL 만 사용.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 524288000, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "videos admin select" on storage.objects for select to authenticated
  using (bucket_id = 'videos' and is_admin());
create policy "videos admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and is_admin());
create policy "videos admin update" on storage.objects for update to authenticated
  using (bucket_id = 'videos' and is_admin());
create policy "videos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and is_admin());
