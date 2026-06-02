create table if not exists public.profiles (
  id uuid not null,
  name text not null,
  avatar_url text null,
  bio text null,
  elo_rating integer not null default 1200,
  geographic_hubs text[] not null default '{}'::text[],
  open_to_challenges boolean not null default true,
  last_played_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  first_name text null,
  last_name text null,
  gender text null,
  birthdate date null,
  updated_at timestamp with time zone null,
  previous_week_rank integer null,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade,
  constraint profiles_gender_check check (
    (
      (gender is null)
      or (
        gender = any (
          array[
            'male'::text,
            'female'::text,
            'non-binary'::text,
            'prefer_not_to_say'::text
          ]
        )
      )
    )
  )
) tablespace pg_default;
