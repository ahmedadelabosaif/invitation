create table if not exists public.invitation_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.events (
  id text primary key,
  emoji text not null default '',
  kicker text not null default '',
  names text not null default '',
  event text not null default '',
  date date,
  time time,
  venue text not null default '',
  message text not null default '',
  info text not null default '',
  env text not null default 'classic'
    check (env in ('classic', 'garden', 'beach', 'sunset', 'night')),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invitation_settings (
  id smallint primary key default 1 check (id = 1),
  featured_event_id text references public.events (id) on delete set null
);

insert into public.invitation_settings (id)
values (1)
on conflict (id) do nothing;

insert into public.events (
  id, emoji, kicker, names, event, date, time, venue, message, info, env, is_public
)
values (
  'wedding',
  '💍',
  'You’re invited to the wedding of',
  'Sara & Ahmed',
  'Sara & Ahmed’s wedding',
  '2027-06-12',
  '16:00',
  'Venue name, City',
  'We would be honored to celebrate with you. Join us for dinner, music and dancing.',
  E'Dress code: formal.\nParking is available at the venue.',
  'garden',
  true
)
on conflict (id) do nothing;

update public.invitation_settings
set featured_event_id = 'wedding'
where id = 1 and featured_event_id is null;

create or replace function public.update_event_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.update_event_timestamp() from public;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.update_event_timestamp();

create or replace function public.is_invitation_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.invitation_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_invitation_admin() from public;
grant execute on function public.is_invitation_admin() to anon, authenticated;

alter table public.invitation_admins enable row level security;
alter table public.events enable row level security;
alter table public.invitation_settings enable row level security;

grant select on public.invitation_admins to authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant select on public.invitation_settings to anon, authenticated;
grant update on public.invitation_settings to authenticated;

drop policy if exists "Admin can read own admin record" on public.invitation_admins;
create policy "Admin can read own admin record"
  on public.invitation_admins for select
  using (user_id = auth.uid());

drop policy if exists "Public can read public events" on public.events;
create policy "Public can read public events"
  on public.events for select
  using (is_public or public.is_invitation_admin());

drop policy if exists "Admin can insert events" on public.events;
create policy "Admin can insert events"
  on public.events for insert
  to authenticated
  with check (public.is_invitation_admin());

drop policy if exists "Admin can update events" on public.events;
create policy "Admin can update events"
  on public.events for update
  to authenticated
  using (public.is_invitation_admin())
  with check (public.is_invitation_admin());

drop policy if exists "Admin can delete events" on public.events;
create policy "Admin can delete events"
  on public.events for delete
  to authenticated
  using (public.is_invitation_admin());

drop policy if exists "Public can read invitation settings" on public.invitation_settings;
create policy "Public can read invitation settings"
  on public.invitation_settings for select
  using (true);

drop policy if exists "Admin can update invitation settings" on public.invitation_settings;
create policy "Admin can update invitation settings"
  on public.invitation_settings for update
  to authenticated
  using (public.is_invitation_admin())
  with check (public.is_invitation_admin());

do $$
begin
  alter publication supabase_realtime add table public.events;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.invitation_settings;
exception
  when duplicate_object then null;
end
$$;
