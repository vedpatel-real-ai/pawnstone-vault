create function public.generate_scheduled_dues() returns integer
language plpgsql security invoker set search_path = '' as $$
declare l public.loans; generated integer := 0;
begin
  for l in select * from public.loans where status in ('active','overdue') and next_due_date<=current_date
    order by next_due_date,id limit 100 for update skip locked loop
    generated := generated + private.assess(l);
  end loop;
  update public.dues set status='overdue' where due_date<current_date and status='pending';
  return generated;
end $$;
grant usage on schema private to service_role;
grant execute on function private.assess(public.loans), private.next_month(date,date) to service_role;

-- Claim before contacting the mail provider. Ambiguous delivery stays claimed for operator review.
alter table public.notifications add column mail_state text
  check (mail_state in ('claimed','accepted','rejected','unknown')),
  add column mail_attempted_at timestamptz;
create function public.claim_due_mail() returns table(notice_id uuid, recipient text, message text)
language sql security invoker set search_path = '' as $$
  with eligible as (
    select n.id,c.email,format('Monthly interest of ₹%s is due on %s.',d.amount-d.paid_amount,d.due_date) as body
    from public.notifications n join public.dues d on d.id=n.due_id
    join public.loans l on l.id=d.loan_id join public.customers c on c.id=l.customer_id
    where n.mail_state is null and d.due_date=current_date and d.status='pending'
      and d.amount>d.paid_amount and nullif(trim(c.email),'') is not null
    order by n.id limit 20 for update of n skip locked
  )
  update public.notifications n set mail_state='claimed',mail_attempted_at=now()
    from eligible e where n.id=e.id returning n.id,e.email,e.body
$$;
revoke all on function public.generate_scheduled_dues(), public.claim_due_mail() from public, anon, authenticated;
grant execute on function public.generate_scheduled_dues(), public.claim_due_mail() to service_role;
