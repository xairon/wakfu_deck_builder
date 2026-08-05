-- Migration 0011 : lobby NON ÉNUMÉRABLE.
--
-- Avant : `games` était lisible par TOUT utilisateur authentifié — un client
-- pouvait lister toutes les parties (codes de salon compris) et s'inviter dans
-- n'importe quel lobby. Après : lecture réservée aux PARTICIPANTS ; la
-- découverte d'un salon par CODE passe par une fonction SECURITY DEFINER au
-- périmètre minimal (id + assisted, lobbies/actives seulement) — connaître le
-- code reste la seule porte d'entrée, comme prévu.

drop policy if exists "games_select_auth" on public.games;
drop policy if exists "games_select_participant" on public.games;
create policy "games_select_participant" on public.games
  for select using (auth.uid() = seat_a or auth.uid() = seat_b);

create or replace function public.find_game_by_code(p_code text)
returns table (id uuid, assisted boolean)
language sql
security definer
set search_path = public
stable
as $$
  select g.id, g.assisted
  from public.games g
  where g.code = p_code
    and g.status in ('lobby', 'active')
  limit 1;
$$;

revoke all on function public.find_game_by_code(text) from public;
grant execute on function public.find_game_by_code(text) to authenticated;
