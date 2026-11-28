-- 0019_realtime_spectator.sql
-- Autorise les spectateurs authentifiés à s'abonner au canal Realtime game:<id>:spectator.
-- Les sièges "A" et "B" restent strictement réservés aux joueurs de ces sièges.

drop policy if exists "game_seat_recv" on realtime.messages;

create policy "game_seat_recv"
  on realtime.messages
  for select
  to authenticated
  using (
    -- Cas 1 : joueur du siège (A ou B)
    exists (
      select 1
      from public.game_players gp
      where gp.user_id = auth.uid()
        and ('game:' || gp.game_id::text || ':' || gp.seat) = realtime.topic()
    )
    or
    -- Cas 2 : spectateur abonné au flux public/redacté spectateur d'une partie existante
    (
      realtime.topic() like 'game:%:spectator'
      and exists (
        select 1
        from public.games g
        where ('game:' || g.id::text || ':spectator') = realtime.topic()
      )
    )
  );
