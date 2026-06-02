create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (
    id,
    name,
    email,
    first_name,
    last_name,
    elo_rating,
    geographic_hubs,
    open_to_challenges
  )
  values (
    new.id,
    'New Player',
    new.email,
    null,
    null,
    1200,
    array[]::text[],
    true
  )
  on conflict (id) do update set
    email = coalesce(public.profiles.email, new.email),
    updated_at = now();

  return new;
end;
$$;
