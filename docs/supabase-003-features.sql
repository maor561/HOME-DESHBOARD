-- שלב 3: רשימת קניות, מסך בוקר, מסך הילד, כוכבים ובקשות כריך.
-- מריצים פעם אחת, אחרי supabase-002-viewer-access.sql.
-- אפשר להריץ לפני שהקוד החדש עולה: הקוד הישן לא מושפע מהתוספות.

alter table family_members add column has_device boolean not null default false;
alter table family_members add column stars int not null default 0;
alter table activities add column bring text not null default '';
alter table tasks add column stars int not null default 1;
alter table settings add column morning jsonb not null default '{"enabled": true, "from": "06:30", "leave": "07:40", "days": [0, 1, 2, 3, 4, 5]}';

-- מכשיר של ילד מקושר לבן המשפחה שלו; מסך הבית נשאר בלי קישור
alter table devices add column member_id text references family_members on delete cascade;

create table shopping_items (
  id text primary key,
  family_id text not null references families on delete cascade,
  text text not null,
  done boolean not null default false,
  done_at timestamptz,
  added_by text references family_members on delete set null,
  created_at timestamptz not null default now()
);

create table meal_requests (
  id text primary key,
  family_id text not null references families on delete cascade,
  member_id text not null references family_members on delete cascade,
  date date not null,
  text text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now()
);

alter table shopping_items enable row level security;
alter table meal_requests enable row level security;
create policy "read" on shopping_items for select using (can_view());
create policy "write" on shopping_items for all using (is_admin()) with check (is_admin());
create policy "read" on meal_requests for select using (can_view());
create policy "write" on meal_requests for all using (is_admin()) with check (is_admin());

alter publication supabase_realtime add table shopping_items, meal_requests;

-- ---------- פעולות מ"מסך הילד" ----------
-- מכשיר של ילד אינו מנהל ואין לו הרשאת כתיבה. שלוש הפונקציות האלה הן הדברים היחידים
-- שהוא יכול לשנות, וכל אחת בודקת שהוא נוגע רק במה ששייך לו.

create function kid_member() returns text
  language sql stable security definer set search_path = public
  as $$ select member_id from devices where user_id = auth.uid() $$;

create function kid_toggle_task(p_task text) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_member text := kid_member();
  v_task tasks;
begin
  if v_member is null then raise exception 'not a kid device'; end if;
  select * into v_task from tasks where id = p_task and member_id = v_member;
  if not found then raise exception 'not your task'; end if;
  update tasks set done = not v_task.done, completed_at = case when v_task.done then null else now() end where id = p_task;
  update family_members set stars = greatest(0, stars + case when v_task.done then -v_task.stars else v_task.stars end) where id = v_member;
end $$;

create function kid_add_shopping(p_id text, p_text text) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_member text := kid_member();
begin
  if v_member is null then raise exception 'not a kid device'; end if;
  if length(trim(p_text)) = 0 or length(p_text) > 80 then raise exception 'bad text'; end if;
  insert into shopping_items (id, family_id, text, added_by)
  select p_id, family_id, trim(p_text), v_member from family_members where id = v_member;
end $$;

create function kid_request_sandwich(p_id text, p_date date, p_text text) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_member text := kid_member();
begin
  if v_member is null then raise exception 'not a kid device'; end if;
  if length(trim(p_text)) = 0 or length(p_text) > 80 then raise exception 'bad text'; end if;
  insert into meal_requests (id, family_id, member_id, date, text)
  select p_id, family_id, v_member, p_date, trim(p_text) from family_members where id = v_member
  on conflict (id) do update set text = excluded.text, status = 'pending', created_at = now();
end $$;

revoke execute on function kid_toggle_task(text), kid_add_shopping(text, text), kid_request_sandwich(text, date, text) from public, anon;
grant execute on function kid_toggle_task(text), kid_add_shopping(text, text), kid_request_sandwich(text, date, text) to authenticated;
