-- =====================================================================
-- Expense Tracker – database setup for Supabase
-- Run this whole file once in Supabase: SQL Editor → New query → Run.
-- It only creates new tables and functions; it does not delete anything.
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table public.sheets (
  id              uuid primary key default gen_random_uuid(),
  name            text not null default 'My expenses' check (char_length(name) between 1 and 60),
  monthly_budget  integer check (monthly_budget is null or monthly_budget >= 0),
  owner_id        uuid not null references auth.users(id),
  created_at      timestamptz not null default now()
);

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  display_name  text not null check (char_length(display_name) between 1 and 40),
  sheet_id      uuid references public.sheets(id),
  role          text check (role in ('owner','member')),
  status        text not null check (status in ('pending','active','unbound')),
  created_at    timestamptz not null default now()
);

create table public.join_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  target_email  text not null,
  sheet_id      uuid references public.sheets(id),
  status        text not null check (status in ('pending','approved','declined','cancelled','expired')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references public.profiles(id)
);
create unique index join_requests_one_open on public.join_requests(requester_id) where status = 'pending';

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  sheet_id    uuid not null references public.sheets(id),
  name        text not null check (char_length(trim(name)) between 1 and 30),
  is_system   boolean not null default false,
  sort_order  integer not null default 0,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);
create unique index categories_name_unique on public.categories(sheet_id, lower(trim(name))) where deleted_at is null;

create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  sheet_id        uuid not null references public.sheets(id),
  name            text not null check (char_length(trim(name)) between 1 and 100),
  amount          integer not null check (amount > 0 and amount <= 99999999),
  category_id     uuid not null references public.categories(id),
  payment_method  text not null check (payment_method in ('cash','card','transfer')),
  spent_on        date not null,
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id),
  updated_at      timestamptz,
  deleted_by      uuid references public.profiles(id),
  deleted_at      timestamptz
);
create index expenses_sheet_date on public.expenses(sheet_id, spent_on);

create table public.expense_history (
  id          bigint generated always as identity primary key,
  expense_id  uuid not null references public.expenses(id),
  action      text not null check (action in ('create','update','delete','restore','recategorize')),
  before      jsonb,
  after       jsonb,
  changed_by  uuid references public.profiles(id),
  changed_at  timestamptz not null default now()
);

-- ---------- Helper functions -----------------------------------------

-- The sheet the signed-in user is an active member of (or null).
create or replace function public.my_sheet() returns uuid
language sql stable security definer set search_path = public as $$
  select sheet_id from public.profiles where id = auth.uid() and status = 'active';
$$;

create or replace function public.is_owner_of(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role = 'owner' and sheet_id = s
  );
$$;

-- Creates a sheet with the default categories and makes the user its owner.
create or replace function public._create_sheet_for(uid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  insert into public.sheets (owner_id) values (uid) returning id into s;
  insert into public.categories (sheet_id, name, is_system, sort_order) values
    (s, 'Supplies', false, 1), (s, 'Transport', false, 2), (s, 'Meals', false, 3),
    (s, 'Utilities', false, 4), (s, 'Materials', false, 5), (s, 'Other', true, 99);
  update public.profiles set sheet_id = s, role = 'owner', status = 'active' where id = uid;
  return s;
end;
$$;

-- Creates a join request. The answer never reveals whether the email belongs to an owner.
create or replace function public._create_request_for(uid uuid, owner_email text) returns void
language plpgsql security definer set search_path = public as $$
declare s uuid; my_email text;
begin
  select email into my_email from public.profiles where id = uid;
  select p.sheet_id into s from public.profiles p
   where lower(p.email) = lower(trim(owner_email)) and p.role = 'owner' and p.status = 'active'
     and lower(p.email) <> lower(my_email)
   limit 1;
  insert into public.join_requests (requester_id, target_email, sheet_id, status)
  values (uid, lower(trim(owner_email)), s, 'pending');
  update public.profiles set sheet_id = null, role = null, status = 'pending' where id = uid;
end;
$$;

-- ---------- New account trigger ---------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dname text := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
  creator text := nullif(trim(coalesce(new.raw_user_meta_data->>'creator_email', '')), '');
begin
  insert into public.profiles (id, email, display_name, status)
  values (new.id, lower(new.email), left(coalesce(dname, split_part(new.email, '@', 1)), 40), 'unbound');
  if creator is null then
    perform public._create_sheet_for(new.id);
  else
    perform public._create_request_for(new.id, creator);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Expense trigger: protect fields and keep history ----------

create or replace function public.expenses_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_by := null; new.updated_at := null;
    new.deleted_by := null; new.deleted_at := null;
    return new;
  end if;
  -- UPDATE: these never change
  new.id := old.id;
  new.sheet_id := old.sheet_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if old.deleted_at is null and new.deleted_at is not null then
    new.deleted_at := now(); new.deleted_by := auth.uid();
  elsif old.deleted_at is not null and new.deleted_at is null then
    new.deleted_by := null;
  else
    new.deleted_at := old.deleted_at; new.deleted_by := old.deleted_by;
  end if;
  if coalesce(current_setting('app.recategorize', true), '') <> 'on' then
    new.updated_at := now(); new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger expenses_guard before insert or update on public.expenses
  for each row execute function public.expenses_guard();

create or replace function public.expenses_history() returns trigger
language plpgsql security definer set search_path = public as $$
declare act text;
begin
  if tg_op = 'INSERT' then
    insert into public.expense_history (expense_id, action, after, changed_by)
    values (new.id, 'create', to_jsonb(new), auth.uid());
    return new;
  end if;
  if old.deleted_at is null and new.deleted_at is not null then act := 'delete';
  elsif old.deleted_at is not null and new.deleted_at is null then act := 'restore';
  elsif coalesce(current_setting('app.recategorize', true), '') = 'on' then act := 'recategorize';
  else act := 'update';
  end if;
  insert into public.expense_history (expense_id, action, before, after, changed_by)
  values (new.id, act, to_jsonb(old), to_jsonb(new), auth.uid());
  return new;
end;
$$;

create trigger expenses_history after insert or update on public.expenses
  for each row execute function public.expenses_history();

-- ---------- Actions the app calls (RPC) -------------------------------

create or replace function public.create_own_sheet() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'unbound') then
    raise exception 'This account is already linked to a sheet or has a request waiting.';
  end if;
  perform public._create_sheet_for(auth.uid());
end;
$$;

create or replace function public.request_join(owner_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(owner_email), '') = '' then
    raise exception 'Enter the sheet creator''s email.';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'unbound') then
    raise exception 'This account is already linked to a sheet or has a request waiting.';
  end if;
  if (select count(*) from public.join_requests
      where requester_id = auth.uid() and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many requests. Please try again in an hour.';
  end if;
  perform public._create_request_for(auth.uid(), owner_email);
end;
$$;

-- Latest request of the signed-in user; expires it after 14 days.
create or replace function public.my_request()
returns table (status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  update public.join_requests r set status = 'expired', decided_at = now()
   where r.requester_id = auth.uid() and r.status = 'pending' and r.created_at < now() - interval '14 days';
  if found then
    update public.profiles set status = 'unbound' where id = auth.uid() and profiles.status = 'pending';
  end if;
  return query
    select r.status, r.created_at from public.join_requests r
     where r.requester_id = auth.uid() order by r.created_at desc limit 1;
end;
$$;

create or replace function public.cancel_join_request() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.join_requests set status = 'cancelled', decided_at = now()
   where requester_id = auth.uid() and status = 'pending';
  update public.profiles set status = 'unbound', sheet_id = null, role = null
   where id = auth.uid() and status = 'pending';
end;
$$;

-- Owner: open requests for their sheet.
create or replace function public.list_join_requests()
returns table (id uuid, display_name text, email text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, p.display_name, p.email, r.created_at
    from public.join_requests r join public.profiles p on p.id = r.requester_id
   where r.status = 'pending' and r.created_at >= now() - interval '14 days'
     and r.sheet_id is not null and public.is_owner_of(r.sheet_id)
   order by r.created_at;
$$;

create or replace function public.respond_join(request_id uuid, approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.join_requests;
begin
  select * into r from public.join_requests where id = request_id for update;
  if r.id is null or r.sheet_id is null or not public.is_owner_of(r.sheet_id) then
    raise exception 'Request not found.';
  end if;
  if r.status <> 'pending' then
    raise exception 'This request has already been handled.';
  end if;
  if approve then
    update public.join_requests set status = 'approved', decided_at = now(), decided_by = auth.uid() where id = r.id;
    update public.profiles set sheet_id = r.sheet_id, role = 'member', status = 'active'
     where id = r.requester_id and status = 'pending';
  else
    update public.join_requests set status = 'declined', decided_at = now(), decided_by = auth.uid() where id = r.id;
    update public.profiles set status = 'unbound', sheet_id = null, role = null
     where id = r.requester_id and status = 'pending';
  end if;
end;
$$;

create or replace function public.remove_member(member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s uuid := public.my_sheet();
begin
  if s is null or not public.is_owner_of(s) then raise exception 'Only the owner can remove members.'; end if;
  if member_id = auth.uid() then raise exception 'Transfer ownership before leaving the sheet.'; end if;
  update public.profiles set status = 'unbound', sheet_id = null, role = null
   where id = member_id and sheet_id = s and role = 'member' and status = 'active';
  if not found then raise exception 'Member not found.'; end if;
end;
$$;

create or replace function public.transfer_ownership(member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s uuid := public.my_sheet();
begin
  if s is null or not public.is_owner_of(s) then raise exception 'Only the owner can transfer ownership.'; end if;
  if not exists (select 1 from public.profiles where id = member_id and sheet_id = s and status = 'active' and role = 'member') then
    raise exception 'Member not found.';
  end if;
  update public.profiles set role = 'member' where id = auth.uid();
  update public.profiles set role = 'owner' where id = member_id;
  update public.sheets set owner_id = member_id where id = s;
end;
$$;

-- Owner: remove a category; its expenses move to "Other".
create or replace function public.remove_category(target_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare c public.categories; other_id uuid; moved integer;
begin
  select * into c from public.categories where id = target_id;
  if c.id is null or not public.is_owner_of(c.sheet_id) then raise exception 'Category not found.'; end if;
  if c.is_system then raise exception 'This category cannot be removed.'; end if;
  if c.deleted_at is not null then raise exception 'This category was already removed.'; end if;
  select id into other_id from public.categories where sheet_id = c.sheet_id and is_system limit 1;
  perform set_config('app.recategorize', 'on', true);
  update public.expenses e set category_id = other_id where e.category_id = c.id;
  get diagnostics moved = row_count;
  perform set_config('app.recategorize', 'off', true);
  update public.categories set deleted_at = now() where id = c.id;
  return moved;
end;
$$;

-- Everyone who appears in the signed-in user's sheet: current members and former members with expenses.
create or replace function public.sheet_people()
returns table (id uuid, display_name text, email text, role text, is_current boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.email,
         case when p.sheet_id = public.my_sheet() and p.status = 'active' then p.role else null end,
         (p.sheet_id = public.my_sheet() and p.status = 'active')
    from public.profiles p
   where public.my_sheet() is not null
     and ((p.sheet_id = public.my_sheet() and p.status = 'active')
          or p.id in (select e.created_by from public.expenses e where e.sheet_id = public.my_sheet()));
$$;

-- Number of (not removed) expenses per category in the user's sheet.
create or replace function public.category_counts()
returns table (category_id uuid, n bigint)
language sql stable security definer set search_path = public as $$
  select e.category_id, count(*) from public.expenses e
   where e.sheet_id = public.my_sheet() and e.deleted_at is null
   group by e.category_id;
$$;

-- ---------- Row Level Security ---------------------------------------

alter table public.sheets          enable row level security;
alter table public.profiles        enable row level security;
alter table public.join_requests   enable row level security;
alter table public.categories      enable row level security;
alter table public.expenses        enable row level security;
alter table public.expense_history enable row level security;

create policy "members read their sheet" on public.sheets
  for select to authenticated using (id = public.my_sheet());
create policy "owner updates sheet" on public.sheets
  for update to authenticated using (public.is_owner_of(id)) with check (public.is_owner_of(id));

create policy "read own and sheet profiles" on public.profiles
  for select to authenticated
  using (id = auth.uid() or (sheet_id is not null and sheet_id = public.my_sheet() and status = 'active'));

create policy "read own requests" on public.join_requests
  for select to authenticated using (requester_id = auth.uid());

create policy "members read categories" on public.categories
  for select to authenticated using (sheet_id = public.my_sheet());
create policy "owner adds categories" on public.categories
  for insert to authenticated
  with check (public.is_owner_of(sheet_id) and is_system = false and deleted_at is null);

create policy "members read expenses" on public.expenses
  for select to authenticated using (sheet_id = public.my_sheet());
create policy "members add expenses" on public.expenses
  for insert to authenticated
  with check (
    sheet_id = public.my_sheet() and created_by = auth.uid()
    and exists (select 1 from public.categories c
                where c.id = category_id and c.sheet_id = public.my_sheet() and c.deleted_at is null)
  );
create policy "edit own, owner edits all" on public.expenses
  for update to authenticated
  using (sheet_id = public.my_sheet() and (created_by = auth.uid() or public.is_owner_of(sheet_id)))
  with check (
    sheet_id = public.my_sheet()
    and exists (select 1 from public.categories c
                where c.id = category_id and c.sheet_id = public.my_sheet())
  );

create policy "members read history" on public.expense_history
  for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id and e.sheet_id = public.my_sheet()));

-- The app may only change the sheet's name and budget directly.
revoke update on public.sheets from anon, authenticated;
grant update (name, monthly_budget) on public.sheets to authenticated;

-- Internal helpers are not callable from the app.
revoke execute on function public._create_sheet_for(uuid) from public, anon, authenticated;
revoke execute on function public._create_request_for(uuid, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------- Live updates ---------------------------------------------

alter publication supabase_realtime add table public.expenses, public.categories, public.join_requests, public.profiles, public.sheets;
