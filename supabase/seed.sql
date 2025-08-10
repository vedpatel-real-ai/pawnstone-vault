-- PawnTrack seed data
-- Create a demo organization
INSERT INTO public.organizations (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'PawnTrack Demo Org')
ON CONFLICT (id) DO NOTHING;

-- Create demo customers
INSERT INTO public.customers (org_id, name, email, phone, address)
VALUES
('11111111-1111-1111-1111-111111111111','John Doe','john@example.com','+1 555 111 2222','123 Market St'),
('11111111-1111-1111-1111-111111111111','Priya Singh','priya@example.com','+91 99999 11111','B-14 Sunrise Apt'),
('11111111-1111-1111-1111-111111111111','Carlos Alvarez','carlos@example.com','+52 55 0000 1234','Av. Reforma 100');

-- Create demo loans
INSERT INTO public.loans (
  org_id, customer_id, asset_type, asset_description, asset_value,
  loan_amount, remaining_principal, interest_rate_percent, start_date,
  term_months, next_due_date, status
)
SELECT 
  '11111111-1111-1111-1111-111111111111', c.id, 'gold', '22k gold necklace', 2500.00,
  1500.00, 1500.00, 2.500, CURRENT_DATE - INTERVAL '40 days', 12,
  (CURRENT_DATE - INTERVAL '10 days')::date, 'active'
FROM public.customers c
WHERE c.name = 'John Doe'
ON CONFLICT DO NOTHING;

INSERT INTO public.loans (
  org_id, customer_id, asset_type, asset_description, asset_value,
  loan_amount, remaining_principal, interest_rate_percent, start_date,
  term_months, next_due_date, status
)
SELECT 
  '11111111-1111-1111-1111-111111111111', c.id, 'car', '2016 Honda Civic', 8000.00,
  3000.00, 3000.00, 3.000, CURRENT_DATE - INTERVAL '70 days', 10,
  (CURRENT_DATE - INTERVAL '5 days')::date, 'active'
FROM public.customers c
WHERE c.name = 'Priya Singh'
ON CONFLICT DO NOTHING;

-- Sample payment
INSERT INTO public.payments (org_id, loan_id, amount, type, notes)
SELECT '11111111-1111-1111-1111-111111111111', l.id, 75.00, 'interest', 'Initial interest payment'
FROM public.loans l
JOIN public.customers c ON c.id = l.customer_id
WHERE c.name = 'John Doe'
LIMIT 1
ON CONFLICT DO NOTHING;
