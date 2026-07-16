-- 0010 — Append ATOMIQUE d'un LOT d'events (M3).
--
-- `append_event` (0002) insère UN event par appel. Les coups multi-events
-- (MULLIGAN : recycle+mélange+repioche ; mise en place join_game ; END_TURN avec
-- pioches / recyclage 507.5) étaient appendés un par un : un crash serveur au
-- MILIEU du lot laissait un journal PARTIEL et incohérent (main à moitié
-- recyclée, partie « active » sans setup complet…) — sans rollback.
--
-- `append_events` insère TOUT le lot dans UNE transaction (une fonction plpgsql
-- = une transaction implicite) : soit tous les events passent, soit aucun. Le
-- verrou de ligne + le contrôle de parent_seq gardent l'ordre total et la
-- concurrence optimiste (comme append_event).
create or replace function public.append_events(
  p_game_id    uuid,
  p_parent_seq integer,
  p_events     jsonb          -- tableau [{actor,type,payload,payload_private}]
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last integer;
  v_seq  integer;
  v_ev   jsonb;
begin
  -- Verrou de ligne : sérialise les append concurrents sur la même partie.
  select last_seq into v_last from public.games where id = p_game_id for update;
  if v_last is null then
    raise exception 'GAME_NOT_FOUND';
  end if;
  if p_parent_seq <> v_last then
    raise exception 'OUT_OF_ORDER expected % got %', v_last, p_parent_seq;
  end if;

  v_seq := v_last;
  for v_ev in select * from jsonb_array_elements(p_events) loop
    v_seq := v_seq + 1;
    insert into public.game_events
      (game_id, seq, parent_seq, actor, type, payload, payload_private)
    values (
      p_game_id, v_seq, v_seq - 1,
      v_ev->>'actor', v_ev->>'type',
      coalesce(v_ev->'payload', '{}'::jsonb),
      v_ev->'payload_private'
    );
  end loop;

  update public.games set last_seq = v_seq, updated_at = now() where id = p_game_id;
  return v_seq;
end;
$$;
