-- The signed-in identity can read its own profile. Only provisioning writes membership.
drop trigger if exists t_profiles_enforce_org_id on public.profiles;
drop function public.profiles_enforce_org_id();
drop function public.assign_user_to_org(uuid,uuid);
drop function public._create_enforce_org_trigger(regclass);

create or replace function public.current_user_org_id() returns uuid
language sql stable security invoker set search_path = '' as $$
  select org_id from public.profiles where id = (select auth.uid())
$$;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.ensure_org(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  membership uuid;
begin
  if actor is null then raise exception 'Sign in first'; end if;
  insert into public.profiles(id,full_name)
    select actor, raw_user_meta_data->>'full_name' from auth.users where id = actor
    on conflict(id) do nothing;
  select org_id into strict membership from public.profiles where id = actor for update;
  if membership is null then
    insert into public.organizations(name) values (coalesce(nullif(left(trim(p_name),120),''),'My Organization'))
      returning id into membership;
    update public.profiles set org_id = membership where id = actor;
  end if;
  return membership;
end
$$;
create or replace function public.create_org_for_current_user(p_name text default 'My Organization') returns uuid
language sql security invoker set search_path = '' as $$ select private.ensure_org(p_name) $$;
revoke all on function private.ensure_org(text), public.create_org_for_current_user(text),
  public.current_user_org_id() from public, anon, authenticated, service_role;
grant execute on function private.ensure_org(text), public.create_org_for_current_user(text),
  public.current_user_org_id() to authenticated;

alter table public.profiles add constraint profiles_auth_user_fk foreign key (id) references auth.users(id);
do $$
declare t text;
begin
  foreach t in array array['customers','loans','payments','dues','notifications','audit_logs','loan_assets'] loop
    execute format('drop trigger if exists t_enforce_org_id on public.%I',t);
    execute format('alter table public.%I alter org_id set not null, alter org_id set default public.current_user_org_id()',t);
  end loop;
end $$;
drop function public.enforce_org_id_to_current();
alter function public.set_updated_at() set search_path = '';
revoke all on function public.set_updated_at() from public, anon, authenticated;

alter table public.customers add unique(org_id,id);
alter table public.loans add unique(org_id,id), alter customer_id set not null,
  drop constraint if exists loans_customer_id_fkey,
  add foreign key(org_id,customer_id) references public.customers(org_id,id) on delete restrict;
alter table public.payments alter loan_id set not null, drop constraint if exists payments_loan_id_fkey,
  add foreign key(org_id,loan_id) references public.loans(org_id,id) on delete restrict;
alter table public.dues alter loan_id set not null, drop constraint if exists dues_loan_id_fkey,
  add foreign key(org_id,loan_id) references public.loans(org_id,id) on delete restrict;
alter table public.loan_assets add foreign key(org_id,loan_id) references public.loans(org_id,id),
  add constraint asset_file_path check (split_part(file_url,'/',1) = loan_id::text and position('/' in file_url)>0);
alter table public.notifications add foreign key(org_id,loan_id) references public.loans(org_id,id);
alter table public.customers
  add check (profile_photo_url is null or split_part(profile_photo_url,'/',1) = id::text),
  add check (id_proof_url is null or split_part(id_proof_url,'/',1) = id::text);

revoke all on public.profiles, public.organizations, public.customers, public.loans, public.payments,
  public.dues, public.loan_assets, public.notifications, public.audit_logs from public, anon, authenticated;
grant select on public.profiles, public.organizations, public.customers, public.loans, public.payments,
  public.dues, public.loan_assets, public.notifications, public.audit_logs to authenticated;
grant insert, delete on public.customers, public.loan_assets to authenticated;
grant update(name,email,phone,alt_phone,address,id_proof_number,id_proof_url,profile_photo_url,notes)
  on public.customers to authenticated;
grant insert on public.loans to authenticated;
grant update(asset_type,asset_description,asset_value,due_date,term_months,notes) on public.loans to authenticated;
grant insert(org_id,loan_id,title,body,read,sent_at) on public.notifications to authenticated;

update storage.buckets set public = false where id in ('customers','loan_assets');
drop policy if exists "Org members can read their customer files" on storage.objects;
drop policy if exists "Org members can insert their customer files" on storage.objects;
drop policy if exists "Org members can update their customer files" on storage.objects;
drop policy if exists "Org members can delete their customer files" on storage.objects;
drop policy if exists "Users can view their org loan assets" on storage.objects;
drop policy if exists "Users can upload their org loan assets" on storage.objects;
drop policy if exists "Users can update their org loan assets" on storage.objects;
drop policy if exists "Users can delete their org loan assets" on storage.objects;
create policy pawntrack_customers_objects on storage.objects for all to authenticated
using (bucket_id = 'customers' and exists (select 1 from public.customers p where p.id::text = (storage.foldername(storage.objects.name))[1] and p.org_id = public.current_user_org_id()))
with check (bucket_id = 'customers' and exists (select 1 from public.customers p where p.id::text = (storage.foldername(storage.objects.name))[1] and p.org_id = public.current_user_org_id()));
create policy pawntrack_loan_assets_objects on storage.objects for all to authenticated
using (bucket_id = 'loan_assets' and exists (select 1 from public.loans p where p.id::text = (storage.foldername(storage.objects.name))[1] and p.org_id = public.current_user_org_id()))
with check (bucket_id = 'loan_assets' and exists (select 1 from public.loans p where p.id::text = (storage.foldername(storage.objects.name))[1] and p.org_id = public.current_user_org_id()));
