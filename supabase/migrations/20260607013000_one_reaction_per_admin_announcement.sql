delete from public.admin_announcement_reactions reaction
using public.admin_announcement_reactions newer_reaction
where reaction.announcement_id = newer_reaction.announcement_id
  and reaction.user_id = newer_reaction.user_id
  and (
    newer_reaction.created_at > reaction.created_at
    or (
      newer_reaction.created_at = reaction.created_at
      and newer_reaction.id > reaction.id
    )
  );

alter table public.admin_announcement_reactions
  drop constraint if exists admin_announcement_reactions_announcement_id_user_id_emoji_key;

alter table public.admin_announcement_reactions
  add constraint admin_announcement_reactions_announcement_id_user_id_key
  unique (announcement_id, user_id);

notify pgrst, 'reload schema';
