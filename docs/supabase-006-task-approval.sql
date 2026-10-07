-- שלב 6: אישור הורה למשימות כוכבים. ילד מסמן "עשיתי", המשימה ממתינה, והכוכבים נכנסים רק כשהורה מאשר.
-- מריצים פעם אחת, אחרי supabase-005-family-tablet.sql, ולפני שהקוד החדש עולה.

-- מתי הילד סימן; ריק כשאין בקשה פתוחה
alter table tasks add column pending_at timestamptz;

-- מכשיר של ילד: משימת כוכבים עוברת ל"ממתין לאישור" (נגיעה נוספת מבטלת). משימה בלי כוכבים נסגרת מיד.
create or replace function kid_toggle_task(p_task text) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_member text := kid_member();
  v_task tasks;
begin
  if v_member is null then raise exception 'not a kid device'; end if;
  select * into v_task from tasks where id = p_task and member_id = v_member;
  if not found then raise exception 'not your task'; end if;
  if v_task.stars > 0 then
    if v_task.done then raise exception 'רק אמא או אבא יכולים לבטל משימה שאושרה'; end if;
    update tasks set pending_at = case when pending_at is null then now() else null end where id = p_task;
  else
    update tasks set done = not v_task.done, completed_at = case when v_task.done then null else now() end, pending_at = null where id = p_task;
  end if;
end $$;

-- הטאבלט המשפחתי: אותו כלל, לכל ילד
create or replace function tablet_toggle_task(p_task text) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_task tasks;
begin
  if not is_shared_device() then raise exception 'not a shared device'; end if;
  select * into v_task from tasks where id = p_task and member_id is not null;
  if not found then raise exception 'no such task'; end if;
  if v_task.stars > 0 then
    if v_task.done then raise exception 'רק אמא או אבא יכולים לבטל משימה שאושרה'; end if;
    update tasks set pending_at = case when pending_at is null then now() else null end where id = p_task;
  else
    update tasks set done = not v_task.done, completed_at = case when v_task.done then null else now() end, pending_at = null where id = p_task;
  end if;
end $$;
