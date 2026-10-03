-- סכמת PostgreSQL ל-Supabase. תואמת את src/types/index.ts (שמות שדות ב-snake_case).
-- עדיין לא הורצה מול פרויקט Supabase אמיתי: זו טיוטה לשלב החיבור לענן.

create table families (
  id text primary key,
  name text not null
);

create table family_members (
  id text primary key,
  family_id text not null references families on delete cascade,
  name text not null,
  birth_date date,
  color text not null,
  icon text,
  gets_sandwich boolean not null default false,
  sort_order int not null default 0
);

-- ימי הולדת של אנשים שאינם בני המשפחה
create table birthdays (
  id text primary key,
  family_id text not null references families on delete cascade,
  name text not null,
  birth_date date not null,
  year_known boolean not null default true,
  icon text not null default '🎂',
  color text not null default '#c98a3a'
);

create table activities (
  id text primary key,
  family_id text not null references families on delete cascade,
  member_id text not null references family_members on delete cascade,
  title text not null,
  weekday smallint not null check (weekday between 0 and 6),
  start_time text not null, -- HH:MM
  end_time text not null,
  place text not null default '',
  icon text not null default '🤸'
);

-- שורה בתפריט השבועי: כריך לילד, או צהריים/ערב/הערה לכל המשפחה
create table meals (
  id text primary key,
  family_id text not null references families on delete cascade,
  date date not null,
  kind text not null check (kind in ('sandwich', 'lunch', 'dinner', 'note')),
  member_id text references family_members on delete cascade,
  text text not null,
  unique (family_id, date, kind, member_id)
);

create table tasks (
  id text primary key,
  family_id text not null references families on delete cascade,
  title text not null,
  done boolean not null default false,
  completed_at timestamptz,
  due_date date,
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  member_id text references family_members on delete set null,
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly', 'monthly'))
);

create table daily_quotes (
  id text primary key,
  family_id text not null references families on delete cascade,
  text text not null,
  active boolean not null default true,
  date date
);

-- url מצביע לקובץ ב-Supabase Storage (bucket: photos)
create table photos (
  id text primary key,
  family_id text not null references families on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create table settings (
  id text primary key,
  family_id text not null unique references families on delete cascade,
  style text not null default 'glass' check (style in ('glass', 'board')),
  board_font text not null default 'hand' check (board_font in ('hand', 'print')),
  city text not null,
  latitude double precision not null,
  longitude double precision not null,
  units text not null default 'c' check (units in ('c', 'f')),
  text_scale real not null default 1,
  night_dim jsonb not null,
  widgets jsonb not null,
  calendar jsonb not null default '{"holidays": true, "funDays": true, "hidden": []}',
  photo_interval_sec int not null default 30,
  photo_shuffle boolean not null default true
  -- קוד ה-PIN לא עובר לענן: מוחלף בהתחברות Supabase Auth
);

-- אירועים בלוח השנה שהמשפחה מוסיפה (חגים נכנסים אוטומטית ואינם נשמרים כאן)
create table events (
  id text primary key,
  family_id text not null references families on delete cascade,
  title text not null,
  kind text not null default 'family' check (kind in ('family', 'vacation', 'fun')),
  date date not null,
  end_date date,
  time text,
  member_id text references family_members on delete set null,
  icon text not null default '📌',
  yearly boolean not null default false
);

-- Realtime: המסך בבית מאזין לשינויים בכל הטבלאות
alter publication supabase_realtime add table
  families, family_members, birthdays, activities, meals, tasks, daily_quotes, photos, settings, events;

-- הרשאות: קריאה למסך, כתיבה רק למשתמש מחובר. לחדד לפני עלייה לאוויר.
do $$
declare t text;
begin
  foreach t in array array['families','family_members','birthdays','activities','meals','tasks','daily_quotes','photos','settings','events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "read" on %I for select using (true)', t);
    execute format('create policy "write" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- אחסון התמונות: bucket ציבורי לקריאה, העלאה ומחיקה רק למשתמש מחובר
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
create policy "photos upload" on storage.objects for insert to authenticated with check (bucket_id = 'photos');
create policy "photos delete" on storage.objects for delete to authenticated using (bucket_id = 'photos');
