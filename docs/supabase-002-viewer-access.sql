-- שלב 2: הגבלת הצפייה והעריכה.
-- מריצים פעם אחת, אחרי supabase-schema.sql ואחרי שנוצר משתמש הניהול.
--
-- לפני: כל מי שיש לו את כתובת האתר יכול לקרוא, וכל משתמש מחובר יכול לערוך.
-- אחרי: עריכה רק למנהלים (טבלת admins); צפייה רק למנהלים ולמסכים שאושרו (טבלת devices).
-- מסך חדש מקבל משתמש אנונימי, מציג קוד QR, ומנהל מאשר אותו מהטלפון.
--
-- נדרש גם ב-Supabase: Authentication > Sign In / Providers > Allow anonymous sign-ins.

create table admins (
  user_id uuid primary key references auth.users on delete cascade
);

-- כל המשתמשים הרגילים שקיימים כרגע הופכים למנהלים (כרגע: המשתמש היחיד שנוצר)
insert into admins (user_id)
select id from auth.users where coalesce(is_anonymous, false) = false;

create table devices (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null default 'מסך',
  approved_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;
alter table devices enable row level security;

create function is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;

create function can_view() returns boolean
  language sql stable security definer set search_path = public
  as $$ select is_admin() or exists (select 1 from devices where user_id = auth.uid()) $$;

-- כל משתמש רואה רק את השורה של עצמו; מנהל רואה ומנהל את כל המסכים
create policy "own row" on admins for select using (user_id = auth.uid());
create policy "read" on devices for select using (user_id = auth.uid() or is_admin());
create policy "manage" on devices for all using (is_admin()) with check (is_admin());

do $$
declare t text;
begin
  foreach t in array array['families','family_members','birthdays','activities','meals','tasks','daily_quotes','photos','settings','events'] loop
    execute format('drop policy if exists "read" on %I', t);
    execute format('drop policy if exists "write" on %I', t);
    execute format('create policy "read" on %I for select using (can_view())', t);
    execute format('create policy "write" on %I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- תמונות: העלאה ומחיקה רק למנהלים. הקבצים עצמם נשארים נגישים למי שיש לו את הקישור המלא לתמונה.
drop policy if exists "photos upload" on storage.objects;
drop policy if exists "photos delete" on storage.objects;
create policy "photos upload" on storage.objects for insert with check (bucket_id = 'photos' and is_admin());
create policy "photos delete" on storage.objects for delete using (bucket_id = 'photos' and is_admin());
