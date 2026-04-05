insert into public.user_roles (user_id, role)
select '9fdd5fe2-be98-48c4-8c78-3ae12eaf0bc0'::uuid, 'admin'::public.app_role
where exists (
  select 1
  from auth.users
  where id = '9fdd5fe2-be98-48c4-8c78-3ae12eaf0bc0'::uuid
)
on conflict (user_id, role) do nothing;
