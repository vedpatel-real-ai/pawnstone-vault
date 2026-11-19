alter table public.payments add column request_id uuid, add column posted_by uuid,
  add unique(org_id, request_id), alter type set not null,
  add check (amount > 0 and amount <> 'NaN'::numeric);
alter table public.dues add column paid_amount numeric(12,2) not null default 0;
update public.dues set paid_amount = amount where status = 'paid';
alter table public.dues alter status set not null,
  add check (amount >= 0 and amount <> 'NaN'::numeric and paid_amount between 0 and amount);
alter table public.loans alter status set not null,
  add check (loan_amount > 0 and loan_amount <> 'NaN'::numeric),
  add check (remaining_principal between 0 and loan_amount),
  add check (interest_rate_percent >= 0 and interest_rate_percent <> 'NaN'::numeric),
  add check (status <> 'closed' or remaining_principal = 0);
alter table public.notifications add column due_id uuid unique references public.dues(id);
create index dues_open_by_loan on public.dues(loan_id,due_date) where status in ('pending','overdue');
create index loans_next_assessment on public.loans(next_due_date) where status in ('active','overdue');

-- A client must never select an ID that was previously used for private media.
revoke insert on public.customers, public.loans from authenticated;
grant insert(org_id,name,email,phone,alt_phone,address,id_proof_number,id_proof_url,profile_photo_url,notes)
  on public.customers to authenticated;
grant insert(org_id,customer_id,loan_amount,remaining_principal,interest_rate_percent,start_date,
  next_due_date,due_date,term_months,status,last_interest_calculated,asset_type,asset_description,asset_value,notes)
  on public.loans to authenticated;

create function private.next_month(prior date, anchor date) returns date
language sql immutable strict set search_path = '' as $$
  select least((date_trunc('month',prior) + interval '2 month - 1 day')::date,
    (date_trunc('month',prior) + interval '1 month')::date + (extract(day from anchor)::int - 1))
$$;
create function private.initialize_loan() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.start_date > current_date then raise exception 'Start date cannot be in the future'; end if;
  new.remaining_principal := new.loan_amount;
  new.status := 'active';
  new.next_due_date := (new.start_date + interval '1 month')::date;
  new.last_interest_calculated := null;
  return new;
end $$;
create trigger initialize_loan before insert on public.loans for each row execute function private.initialize_loan();

create function private.first_due() returns trigger language plpgsql security definer set search_path = '' as $$
declare amount numeric := round(new.remaining_principal * new.interest_rate_percent / 100,2);
begin
  if amount > 0 then
    insert into public.dues(org_id, loan_id, due_date, amount, due_type)
      values(new.org_id,new.id,new.next_due_date,amount,'interest');
  end if;
  return new;
end $$;
create trigger first_due after insert on public.loans for each row execute function private.first_due();

-- Caller holds the loan row lock. Catch up before taking any principal off that row.
create function private.assess(l public.loans) returns integer
language plpgsql set search_path = '' as $$
declare
  period date := l.next_due_date;
  invoice public.dues;
  amount_due numeric := round(l.remaining_principal * l.interest_rate_percent / 100,2);
  generated integer := 0;
begin
  while period <= current_date loop
    if amount_due > 0 then
      insert into public.dues(org_id,loan_id,due_date,amount,due_type)
        values(l.org_id,l.id,period,amount_due,'interest')
        on conflict(loan_id,due_date,due_type) do nothing;
      select * into strict invoice from public.dues where loan_id=l.id and due_date=period and due_type='interest';
      if invoice.status in ('pending','overdue') then
        insert into public.notifications(org_id,loan_id,due_id,title,body)
          values(l.org_id,l.id,invoice.id,'Monthly interest due',
            format('₹%s outstanding on %s.',invoice.amount-invoice.paid_amount,period))
          on conflict(due_id) do nothing;
        if found then generated := generated + 1; end if;
      end if;
    end if;
    period := private.next_month(period,l.start_date);
  end loop;
  if period <> l.next_due_date then
    update public.loans set next_due_date=period,last_interest_calculated=current_date where id=l.id;
  end if;
  update public.dues set status='overdue' where loan_id=l.id and due_date<current_date and status='pending';
  return generated;
end $$;

create function private.post_payment(p_loan uuid,p_request uuid,p_amount numeric,p_type public.payment_type,p_notes text)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  tenant uuid := public.current_user_org_id();
  l public.loans;
  receipt public.payments;
  d public.dues;
  unapplied numeric := p_amount;
  applied numeric;
begin
  if tenant is null or auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_request is null or p_type is null or p_amount is null or p_amount <= 0 or
     p_amount > 9999999999.99 or p_amount <> round(p_amount,2) then raise exception 'Invalid receipt amount or request'; end if;
  select * into l from public.loans where id=p_loan and org_id=tenant for update;
  if not found then raise exception 'Loan unavailable'; end if;
  select * into receipt from public.payments where org_id=tenant and request_id=p_request;
  if found then
    if (receipt.loan_id,receipt.amount,receipt.type,receipt.notes) is distinct from
       (p_loan,p_amount,p_type,p_notes) then raise exception 'Request already used for different terms'; end if;
    return receipt;
  end if;
  if l.status not in ('active','overdue') then raise exception 'Loan is not open for collections'; end if;
  perform private.assess(l);
  if p_type='principal' then
    if p_amount>l.remaining_principal then raise exception 'Payment exceeds principal'; end if;
    update public.loans set remaining_principal=remaining_principal-p_amount where id=l.id;
  elsif p_type='interest' then
    for d in select * from public.dues where loan_id=l.id and due_type='interest'
        and status in ('pending','overdue') order by due_date,id for update loop
      applied := least(d.amount-d.paid_amount,unapplied);
      update public.dues set paid_amount=paid_amount+applied,
        status=case when paid_amount+applied=amount then 'paid'::public.due_status else status end where id=d.id;
      unapplied := unapplied-applied;
      exit when unapplied=0;
    end loop;
    if unapplied<>0 then raise exception 'Payment exceeds issued interest'; end if;
  end if;
  insert into public.payments(org_id,loan_id,amount,type,notes,request_id,posted_by,payment_date)
    values(tenant,l.id,p_amount,p_type,p_notes,p_request,auth.uid(),current_date) returning * into receipt;
  update public.loans set status='closed' where id=l.id and remaining_principal=0 and
    not exists(select 1 from public.dues where loan_id=l.id and status in ('pending','overdue') and amount>paid_amount);
  return receipt;
end $$;
create function public.post_payment(p_loan uuid,p_request uuid,p_amount numeric,p_type public.payment_type,p_notes text default null)
returns public.payments language sql security invoker set search_path = '' as $$
  select * from private.post_payment(p_loan,p_request,p_amount,p_type,p_notes)
$$;
revoke all on all functions in schema private from public,anon,authenticated,service_role;
grant execute on function private.ensure_org(text), private.post_payment(uuid,uuid,numeric,public.payment_type,text) to authenticated;
revoke all on function public.post_payment(uuid,uuid,numeric,public.payment_type,text) from public,anon,authenticated,service_role;
grant execute on function public.post_payment(uuid,uuid,numeric,public.payment_type,text) to authenticated;
