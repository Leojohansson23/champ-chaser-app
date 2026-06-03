drop policy if exists "active announcements viewable by authenticated" on public.admin_announcements;

create policy "recent active announcements viewable by authenticated" on public.admin_announcements
  for select to authenticated using (
    public.has_role(auth.uid(), 'admin')
    or (
      is_active
      and created_at >= now() - interval '24 hours'
    )
  );

notify pgrst, 'reload schema';
