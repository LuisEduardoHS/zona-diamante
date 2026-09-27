-- ZONA DIAMANTE
-- Automatic profile creation


-- Crea automaticamente un perfil cuando Supabase Auth crea un nuevo usuario

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

    insert into public.profiles (
        id,
        username,
        display_name
    )
    values (
        new.id,

        coalesce(
            nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
            'user_' || replace(new.id::text, '-', '')
        ),

        nullif(
            trim(new.raw_user_meta_data ->> 'display_name'),
            ''
        )
    );

    return new;
end;
$$;


create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();