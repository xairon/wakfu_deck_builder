-- Migration 0007b : filet de sécurité de nettoyage des parties (pg_cron).
-- Réf. plan online-lifecycle (Task 9), spec §Phase 3, et la note de rétention
-- de 0002_game.sql (CdC §7.5).
--
-- DÉPLOIEMENT : l'extension pg_cron peut nécessiter une activation au niveau
-- du projet (Supabase Dashboard → Database → Extensions, ou via Management SQL :
-- « create extension pg_cron; » sur la base `postgres`). Si « create extension »
-- ci-dessous échoue (extension non disponible / non autorisée), activez-la
-- d'abord puis ré-appliquez cette migration ; ou exécutez périodiquement à la
-- main les trois requêtes du corps du job `wakfu_game_cleanup` ci-dessous.
--
-- Le job (toutes les heures) :
--   - lobby ouvert depuis > 2 h            → aborted / lobby_timeout
--   - partie active inactive depuis > 24 h → aborted / disconnect (zombie)
--   - partie terminale (finished/aborted) inactive depuis > 30 j → DELETE
--     (cascade vers game_events / game_secrets / game_players via FK).
-- `updated_at` est maintenu par append_event() + le trigger games_set_updated_at,
-- donc c'est un signal d'inactivité fiable.
-- Idempotent : rejouable sans danger (unschedule préalable + re-schedule).
-- =============================================================================

create extension if not exists pg_cron;

-- Évite les doublons si la migration est rejouée : on retire le job s'il existe.
do $$
begin
  perform cron.unschedule('wakfu_game_cleanup');
exception
  when others then null; -- job inexistant (premier passage) : rien à faire.
end;
$$;

select cron.schedule(
  'wakfu_game_cleanup',
  '0 * * * *', -- toutes les heures (à la minute 0)
  $job$
    -- 1) Lobbies jamais rejoints / abandonnés (> 2 h).
    update public.games
       set status = 'aborted', end_reason = 'lobby_timeout'
     where status = 'lobby'
       and created_at < now() - interval '2 hours';

    -- 2) Parties actives inactives (> 24 h) : zombies après déconnexion.
    update public.games
       set status = 'aborted', end_reason = 'disconnect'
     where status = 'active'
       and updated_at < now() - interval '24 hours';

    -- 3) Purge des parties terminales anciennes (> 30 j).
    --    La suppression de games cascade vers game_events / game_secrets /
    --    game_players (FK on delete cascade).
    delete from public.games
     where status in ('finished', 'aborted')
       and updated_at < now() - interval '30 days';
  $job$
);
