-- שלב 4: מצב ערב (הכנות לכל ילד), פרסים לכוכבים, סיכום שבועי והודעות למסך.
-- מריצים פעם אחת, אחרי supabase-003-features.sql.
-- אפשר להריץ לפני שהקוד החדש עולה: הקוד הישן לא מושפע מהתוספות.

alter table settings add column evening jsonb not null default '{"enabled": true, "from": "18:00", "to": "20:30", "days": [0, 1, 2, 3, 4, 6]}';
alter table settings add column summary jsonb not null default '{"enabled": true, "weekday": 6, "from": "17:00", "to": "18:00"}';
alter table settings add column kids_can_message boolean not null default true;

create table routine_items (
  id text primary key,
  family_id text not null references families on delete cascade,
  member_id text not null references family_members on delete cascade,
  text text not null,
  sort_order int not null default 0
);

create table routine_checks (
  id text primary key,
  family_id text not null references families on delete cascade,
  item_id text not null references routine_items on delete cascade,
  member_id text not null references family_members on delete cascade,
  date date not null
);

create table rewards (
  id text primary key,
  family_id text not null references families on delete cascade,
  title text not null,
  icon text not null default '🎁',
  cost int not null check (cost > 0),
  member_id text references family_members on delete cascade
);

create table reward_requests (
  id text primary key,
  family_id text not null references families on delete cascade,
  member_id text not null references family_members on delete cascade,
  reward_id text not null,
  title text not null,
  cost int not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now()
);

create table messages (
  id text primary key,
  family_id text not null references families on delete cascade,
  text text not null,
  sender text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table star_log (
  id text primary key,
  family_id text not null references families on delete cascade,
  member_id text not null references family_members on delete cascade,
  amount int not null,
  kind text not null default 'task' check (kind in ('task', 'reward', 'manual')),
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['routine_items','routine_checks','rewards','reward_requests','messages','star_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "read" on %I for select using (can_view())', t);
    execute format('create policy "write" on %I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

alter publication supabase_realtime add table routine_items, routine_checks, rewards, reward_requests, messages, star_log;

-- ---------- פעולות נוספות מ"מסך הילד" ----------

-- סימון משימה: כמו קודם, ובנוסף רישום ביומן הכוכבים (לסיכום השבועי)
create or replace function kid_toggle_task(p_task text) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_member text := kid_member();
  v_task tasks;
  v_amount int;
begin
  if v_member is null then raise exception 'not a kid device'; end if;
  select * into v_task from tasks where id = p_task and member_id = v_member;
  if not found then raise exception 'not your task'; end if;
  v_amount := case when v_task.done then -v_task.stars else v_task.stars end;
  update tasks set done = not v_task.done, completed_at = case when v_task.done then null else now() end where id = p_task;
  update family_members set stars = greatest(0, stars + v_amount) where id = v_member;
  insert into star_log (id, family_id, member_id, amount, kind)
  values (gen_random_uuid()::text, v_task.family_id, v_member, v_amount, 'task');
end $$;

-- סימון הכנה בשגרת הערב של הילד עצמו
create function kid_toggle_routine(p_item text, p_date date) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_member text := kid_member();
  v_item routine_items;
  v_id text := p_date::text || '-' || p_item;
begin
  if v_member is null then raise exception 'not a kid device'; end if;
  select * into v_item from routine_items where id = p_item and member_id = v_member;
  if not found then raise exception 'not your routine'; end if;
  if exists (select 1 from routine_checks where id = v_id) then
    delete from routine_checks where id = v_id;
  else
    insert into routine_checks (id, family_id, item_id, member_id, date) values (v_id, v_item.family_id, p_item, v_member, p_date);
  end if;
end $$;

-- בקשת פרס: רק אם יש מספיק כוכבים. הכוכבים יורדים כשהורה מאשר.
create function kid_request_reward(p_id text, p_reward text) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_member text := kid_member();
  v_reward rewards;
  v_stars int;
begin
  if v_member is null then raise exception 'not a kid device'; end if;
  select * into v_reward from rewards where id = p_reward and (member_id is null or member_id = v_member);
  if not found then raise exception 'no such reward'; end if;
  select stars into v_stars from family_members where id = v_member;
  if v_stars < v_reward.cost then raise exception 'not enough stars'; end if;
  insert into reward_requests (id, family_id, member_id, reward_id, title, cost)
  values (p_id, v_reward.family_id, v_member, v_reward.id, v_reward.title, v_reward.cost);
end $$;

-- הודעה למסך מילד: מוצגת מיד, לרבע שעה, אם ההגדרה מאפשרת
create function kid_send_message(p_id text, p_text text) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_member text := kid_member();
  v_row family_members;
begin
  if v_member is null then raise exception 'not a kid device'; end if;
  if length(trim(p_text)) = 0 or length(p_text) > 80 then raise exception 'bad text'; end if;
  select * into v_row from family_members where id = v_member;
  if not (select kids_can_message from settings where family_id = v_row.family_id) then raise exception 'messages are off'; end if;
  insert into messages (id, family_id, text, sender, expires_at)
  values (p_id, v_row.family_id, trim(p_text), v_row.name, now() + interval '15 minutes');
end $$;

revoke execute on function kid_toggle_routine(text, date), kid_request_reward(text, text), kid_send_message(text, text) from public, anon;
grant execute on function kid_toggle_routine(text, date), kid_request_reward(text, text), kid_send_message(text, text) to authenticated;
