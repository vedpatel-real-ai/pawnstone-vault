alter table public.loans add check (isfinite(start_date) and isfinite(next_due_date)),
  add check (due_date is null or (isfinite(due_date) and due_date>=start_date)),
  add check (asset_value is null or (asset_value >= 0 and asset_value <> 'NaN'::numeric));

-- Retain the parent that authorizes access to private files.
create function private.retain_customer_media() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from storage.objects where bucket_id='customers'
      and (storage.foldername(name))[1]=old.id::text) then
    raise exception 'Customer has private attachments. Remove them before deleting the customer.';
  end if;
  return old;
end $$;
revoke all on function private.retain_customer_media() from public,anon,authenticated,service_role;
create trigger retain_customer_media before delete on public.customers
  for each row execute function private.retain_customer_media();
