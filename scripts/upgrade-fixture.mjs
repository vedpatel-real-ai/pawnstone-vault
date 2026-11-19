// Used only between two versioned migration steps on the disposable verification stack.
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
const sql = s => execFileSync('docker',['exec','-i','supabase_db_pawntrack-local','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-tA'],{input:s,encoding:'utf8'})
const org = '443b978b-4fa1-4ba0-8a93-28dc503e8a6b'
if(process.argv[2] === 'seed') {
  const customer=randomUUID(),loan=randomUUID()
  sql(`begin;
    select set_config('request.jwt.claim.role','service_role',true);
    insert into public.organizations(id,name) values('${org}','Synthetic upgrade fixture');
    insert into public.customers(id,org_id,name) values('${customer}','${org}','Synthetic borrower');
    insert into public.loans(id,org_id,customer_id,loan_amount,remaining_principal,interest_rate_percent,start_date,next_due_date)
      values('${loan}','${org}','${customer}',1000,900,2,'2024-01-31','2024-03-31');
    insert into public.payments(org_id,loan_id,amount,type) values('${org}','${loan}',100,'principal');
    insert into public.dues(org_id,loan_id,due_date,amount,due_type,status) values('${org}','${loan}','2024-02-29',20,'interest','paid');
    delete from supabase_migrations.schema_migrations where version='20250801000000';
    commit;`)
} else {
  const result=sql(`select l.remaining_principal,p.amount,d.paid_amount,d.status,p.request_id is null
    from public.loans l join public.payments p on p.loan_id=l.id join public.dues d on d.loan_id=l.id where l.org_id='${org}'`).trim()
  if(result!=='900.00|100.00|20.00|paid|t') throw Error('Legacy financial records changed during migration')
  console.log('Preserved synthetic principal, receipt, paid due and original membership key')
}
