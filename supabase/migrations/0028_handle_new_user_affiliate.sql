-- 0028 — Let new-user provisioning set phone + the external 'affiliate' role.
--
-- A Sales user creates affiliates, but cannot set role/phone on someone else's
-- profile (the profiles UPDATE policy is own-row/super-admin, and
-- protect_profile_privileges blocks non-super-admin role writes — even for the
-- service client, which has no auth.uid()). So instead of a post-create UPDATE,
-- set these at profile-CREATION time from the signup metadata (this INSERT does
-- not fire the BEFORE-UPDATE privilege trigger).
--
-- SAFETY: only the external 'affiliate' role (zero internal-area access) may be
-- self-declared via metadata. Any other requested role is ignored and the
-- profile stays role=NULL (pending) — staff invites still get their role
-- assigned by a super admin. This is safe because public signup is disabled and
-- only the service-role admin API can set user_metadata.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    case
      when new.raw_user_meta_data ->> 'role' = 'affiliate'
        then 'affiliate'::public.app_role
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
