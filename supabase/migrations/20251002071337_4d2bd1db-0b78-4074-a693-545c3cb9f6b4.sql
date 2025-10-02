-- Align profiles with auth.users by email and ensure correct IDs, create trigger for future users, and set owner role for Agus.

-- 1) Update mismatched profile IDs to match auth.users.id when emails match
update public.profiles p
set id = u.id
from auth.users u
where p.email is not null
  and u.email = p.email
  and p.id <> u.id;

-- 2) Insert missing profiles for any auth.users that don't have a matching profiles.id
insert into public.profiles (id, email, role)
select u.id, u.email, coalesce(p.role, 'store_keeper'::user_role)
from auth.users u
left join public.profiles p on p.email = u.email
where not exists (
  select 1 from public.profiles p2 where p2.id = u.id
);

-- 3) Explicitly set role to 'owner' for Agus' account
update public.profiles
set role = 'owner'
where email = 'agusbramantyo13@gmail.com';

-- 4) Create or replace function to auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'store_keeper'::user_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 5) Create trigger if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_profiles'
  ) THEN
    CREATE TRIGGER on_auth_user_created_profiles
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END;
$$;