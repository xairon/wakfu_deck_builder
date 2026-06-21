-- 0006_realtime_authorization.sql
-- Canaux Realtime PRIVÉS par siège : un utilisateur ne peut RECEVOIR le topic
-- game:<id>:<seat> que s'il est le joueur de ce siège. Le service_role (Edge
-- Functions) contourne la RLS, donc la diffusion serveur reste autorisée.
-- Réf. spec docs/superpowers/specs/2026-06-21-multiplayer-p0-security-design.md (C2).

-- RLS sur realtime.messages est gérée par Supabase (Realtime Authorization) ;
-- l'instruction est idempotente / sans effet si déjà activée.
alter table realtime.messages enable row level security;

drop policy if exists "game_seat_recv" on realtime.messages;
create policy "game_seat_recv"
  on realtime.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.game_players gp
      where gp.user_id = auth.uid()
        and ('game:' || gp.game_id::text || ':' || gp.seat) = realtime.topic()
    )
  );
