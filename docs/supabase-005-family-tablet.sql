-- שלב 5: הטאבלט המשפחתי. מכשיר משותף שבו כל ילד מסמן את ההכנות והמשימות שלו.
-- מריצים פעם אחת, אחרי supabase-004-evening-rewards.sql.
-- אפשר להריץ לפני שהקוד החדש עולה: הקוד הישן לא מושפע מהתוספות.

-- לכל הכנה ציור, ושיוך לערב או לבוקר
alter table routine_items add column icon text not null default '✅';
alter table routine_items add column period text not null default 'evening' check (period in ('evening', 'morning'));
update routine_items set icon = case text
  when 'תיק מוכן' then '🎒' when 'בגדים למחר' then '👕' when 'מקלחת' then '🚿' when 'צחצוח שיניים' then '🦷' else icon end;

-- סוג המכשיר: מסך הבית, מכשיר של ילד, או טאבלט משותף
alter table devices add column kind text not null default 'screen' check (kind in ('screen', 'kid', 'shared'));
update devices set kind = 'kid' where member_id is not null;

create function is_shared_device() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from devices where user_id = auth.uid() and kind = 'shared') $$;

-- הטאבלט המשותף רשאי לסמן הכנות ומשימות של כל ילד, ולא שום דבר אחר
create function tablet_toggle_routine(p_item text, p_date date) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_item routine_items;
  v_id text := p_date::text || '-' || p_item;
begin
  if not is_shared_device() then raise exception 'not a shared device'; end if;
  select * into v_item from routine_items where id = p_item;
  if not found then raise exception 'no such item'; end if;
  if exists (select 1 from routine_checks where id = v_id) then
    delete from routine_checks where id = v_id;
  else
    insert into routine_checks (id, family_id, item_id, member_id, date) values (v_id, v_item.family_id, p_item, v_item.member_id, p_date);
  end if;
end $$;

create function tablet_toggle_task(p_task text) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_task tasks;
  v_amount int;
begin
  if not is_shared_device() then raise exception 'not a shared device'; end if;
  select * into v_task from tasks where id = p_task and member_id is not null;
  if not found then raise exception 'no such task'; end if;
  v_amount := case when v_task.done then -v_task.stars else v_task.stars end;
  update tasks set done = not v_task.done, completed_at = case when v_task.done then null else now() end where id = p_task;
  update family_members set stars = greatest(0, stars + v_amount) where id = v_task.member_id;
  insert into star_log (id, family_id, member_id, amount, kind)
  values (gen_random_uuid()::text, v_task.family_id, v_task.member_id, v_amount, 'task');
end $$;

revoke execute on function tablet_toggle_routine(text, date), tablet_toggle_task(text) from public, anon;
grant execute on function tablet_toggle_routine(text, date), tablet_toggle_task(text) to authenticated;
