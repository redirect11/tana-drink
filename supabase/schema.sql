-- =====================================================================
--  La Tana del Coniglio — Schema Supabase per l'app di ordinazione drink
-- =====================================================================
--  Esegui questo file nell'editor SQL di Supabase (Dashboard > SQL).
--  Crea le tabelle, la numerazione progressiva giornaliera ("salumeria"),
--  le policy di Row Level Security e abilita il Realtime.
-- =====================================================================

-- Estensione per gli UUID (di norma già attiva su Supabase).
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
--  DRINKS — menù / ricette
-- ---------------------------------------------------------------------
create table if not exists public.drinks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  category    text,
  recipe      text,
  price       numeric(8, 2) not null default 0,
  available   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  ORDERS — ordini, con numero progressivo giornaliero (tipo salumeria)
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  daily_number integer,
  order_date   date not null default (now() at time zone 'Europe/Rome')::date,
  table_label  text,
  note         text,
  status       text not null default 'ricevuto'
               check (status in ('ricevuto','in_preparazione','pronto','ritirato')),
  total        numeric(10, 2) not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  drink_id   uuid references public.drinks(id) on delete set null,
  name       text not null,
  unit_price numeric(8, 2) not null default 0,
  qty        integer not null default 1 check (qty > 0)
);

create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_orders_status on public.orders(status);

-- ---------------------------------------------------------------------
--  Numerazione progressiva giornaliera, assegnata via trigger.
--  Ogni giorno riparte da 1 (numero "da salumeria").
-- ---------------------------------------------------------------------
create or replace function public.assign_daily_number()
returns trigger
language plpgsql
as $$
declare
  next_num integer;
begin
  if new.order_date is null then
    new.order_date := (now() at time zone 'Europe/Rome')::date;
  end if;

  select coalesce(max(daily_number), 0) + 1
    into next_num
    from public.orders
   where order_date = new.order_date;

  new.daily_number := next_num;
  return new;
end;
$$;

drop trigger if exists trg_assign_daily_number on public.orders;
create trigger trg_assign_daily_number
  before insert on public.orders
  for each row
  execute function public.assign_daily_number();

-- ---------------------------------------------------------------------
--  Row Level Security
--  NB: per semplicità (locale senza login) usiamo policy permissive con
--  la chiave anon. In produzione valuta di restringere UPDATE/DELETE al
--  ruolo bartender autenticato.
-- ---------------------------------------------------------------------
alter table public.drinks enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- DRINKS: lettura pubblica, scrittura consentita (backoffice via anon key).
drop policy if exists drinks_select on public.drinks;
create policy drinks_select on public.drinks
  for select using (true);

drop policy if exists drinks_write on public.drinks;
create policy drinks_write on public.drinks
  for all using (true) with check (true);

-- ORDERS: i clienti creano e leggono ordini; il bartender li aggiorna.
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (true);

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert with check (true);

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update using (true) with check (true);

-- ORDER_ITEMS: stessa logica permissiva degli ordini.
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (true);

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert with check (true);

-- ---------------------------------------------------------------------
--  Realtime: pubblica le tabelle interessate.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.drinks;

-- ---------------------------------------------------------------------
--  Seed di esempio (facoltativo): qualche drink iniziale.
-- ---------------------------------------------------------------------
insert into public.drinks (name, description, category, recipe, price, available)
values
  ('Mojito', 'Fresco e dissetante', 'Cocktail', '5cl rum bianco, lime, menta, zucchero, soda', 7.00, true),
  ('Negroni', 'Amaro e deciso', 'Cocktail', '3cl gin, 3cl bitter, 3cl vermouth rosso', 8.00, true),
  ('Spritz', 'L''aperitivo classico', 'Aperitivi', '6cl prosecco, 4cl aperol, soda', 6.00, true),
  ('Analcolico della casa', 'Senza alcol, con frutta di stagione', 'Analcolici', 'Succhi misti, frutta fresca, soda', 5.00, true),
  ('Birra artigianale', 'Spina del momento', 'Birre', 'Birra alla spina 0,4L', 5.50, true)
on conflict do nothing;
