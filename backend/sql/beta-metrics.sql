-- FitIt: queries for the metrics of the beta (plan 5.10) and for the cost of AI per person (product spec 11).
--
-- Read-only. Run a single query with psql, for example
--     psql "$DATABASE_URL" -f beta-metrics.sql          (all of them, one after another)
-- or copy one block into any SQL client. Each block starts with a "-- name:" line, and ends with a semicolon.
-- A test (BetaMetricsTests) runs every block against the schema the migrations make, so a renamed column or table
-- breaks the build instead of the dashboard.
--
-- Things to know when reading the numbers:
--  * Days and weeks are UTC. A person's own day (where their weather place lies) is not stored, only the dates the app
--    computed from it (usage_counters.day, outfits.worn_on, clothing_items.last_worn_on), and those are used as they are.
--  * There is no log of "opened the app". Activity is taken from what leaves a trace: a session started or refreshed
--    (refresh_tokens), a garment added, proposals requested, a proposal rated, a picture ordered.
--  * Accounts that were deleted leave nothing behind but the cost log, whose user_id is then NULL.
--  * Outfits the person built themselves (source 'manual') are not proposals: the proposal metrics leave them out.
--  * Outfits that contained a garment which was later deleted are deleted with it, so the shares of proposals saved,
--    liked and worn are measured on the proposals that still exist.


-- name: active_people_per_day
-- People with any activity on each of the last 30 days (UTC), newest first.
WITH activity AS (
    SELECT user_id, created_at AS at FROM refresh_tokens
    UNION ALL SELECT user_id, created_at FROM clothing_items
    UNION ALL SELECT user_id, created_at FROM outfits
    UNION ALL SELECT user_id, rated_at FROM outfits WHERE rated_at IS NOT NULL
    UNION ALL SELECT user_id, created_at FROM visualizations
)
SELECT (at AT TIME ZONE 'UTC')::date AS day,
       COUNT(DISTINCT user_id)       AS active_people
FROM activity
WHERE at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;


-- name: active_people_per_week
-- People with any activity in each of the last 12 weeks (weeks start on Monday, UTC), newest first.
WITH activity AS (
    SELECT user_id, created_at AS at FROM refresh_tokens
    UNION ALL SELECT user_id, created_at FROM clothing_items
    UNION ALL SELECT user_id, created_at FROM outfits
    UNION ALL SELECT user_id, rated_at FROM outfits WHERE rated_at IS NOT NULL
    UNION ALL SELECT user_id, created_at FROM visualizations
)
SELECT date_trunc('week', at AT TIME ZONE 'UTC')::date AS week,
       COUNT(DISTINCT user_id)                         AS active_people
FROM activity
WHERE at >= now() - interval '12 weeks'
GROUP BY 1
ORDER BY 1 DESC;


-- name: garments_added_per_person
-- Garments each person added, by what became of them. "added" leaves out photos that were refused as not being a
-- wearable garment; "ready" are the ones the stylist can use. People who added nothing are listed with zeros.
SELECT u.id                                                        AS user_id,
       (u.created_at AT TIME ZONE 'UTC')::date                     AS registered_on,
       COUNT(c.id) FILTER (WHERE c.status <> 'rejected')           AS added,
       COUNT(c.id) FILTER (WHERE c.status = 'ready')               AS ready,
       COUNT(c.id) FILTER (WHERE c.status = 'failed')              AS waiting_for_tags,
       COUNT(c.id) FILTER (WHERE c.status = 'processing')          AS processing,
       COUNT(c.id) FILTER (WHERE c.status = 'rejected')            AS refused
FROM users u
LEFT JOIN clothing_items c ON c.user_id = u.id
GROUP BY u.id, u.created_at
ORDER BY added DESC, u.created_at;


-- name: garments_added_summary
-- The same in one row: how many people, and the average and the median number of garments added by a person.
WITH per_person AS (
    SELECT u.id, COUNT(c.id) FILTER (WHERE c.status <> 'rejected') AS added
    FROM users u
    LEFT JOIN clothing_items c ON c.user_id = u.id
    GROUP BY u.id
)
SELECT COUNT(*)                                          AS people,
       COUNT(*) FILTER (WHERE added > 0)                 AS people_with_garments,
       ROUND(AVG(added), 1)                              AS average_added,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY added) AS median_added,
       COALESCE(MAX(added), 0)                           AS most_added
FROM per_person;


-- name: suggestions_requested_per_day
-- Requests for proposals each of the last 30 days (UTC), newest first. "requests" is what the daily counters took
-- (a request that failed gave its place back); "answered_requests" is the number of requests that produced proposals.
-- The difference are requests that ended in "your wardrobe lacks something", which are not counted at all.
WITH counted AS (
    SELECT day, SUM(count) AS requests
    FROM usage_counters
    WHERE kind = 'suggestion' AND day >= current_date - 30
    GROUP BY day
),
answered AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(DISTINCT request_id) AS answered_requests
    FROM outfits
    WHERE source <> 'manual' AND created_at >= now() - interval '30 days'
    GROUP BY 1
)
SELECT COALESCE(c.day, a.day)             AS day,
       COALESCE(c.requests, 0)            AS requests,
       COALESCE(a.answered_requests, 0)   AS answered_requests
FROM counted c
FULL JOIN answered a ON a.day = c.day
ORDER BY 1 DESC;


-- name: suggestions_requested_per_person
-- Requests for proposals per person over their whole time in the beta, most active first.
SELECT user_id,
       COUNT(DISTINCT request_id)  AS requests,
       COUNT(*)                    AS proposals,
       MIN(created_at)             AS first_request_at,
       MAX(created_at)             AS last_request_at
FROM outfits
WHERE source <> 'manual'
GROUP BY user_id
ORDER BY requests DESC, user_id;


-- name: proposals_saved_liked_worn
-- The share of proposals the person saved, liked and wore, as a whole and by week of the request (newest first).
-- The first row, week NULL, is the total.
SELECT NULL::date                                                          AS week,
       COUNT(*)                                                            AS proposals,
       ROUND(100.0 * COUNT(*) FILTER (WHERE is_saved) / NULLIF(COUNT(*), 0), 1)       AS saved_percent,
       ROUND(100.0 * COUNT(*) FILTER (WHERE rating = 'like') / NULLIF(COUNT(*), 0), 1)    AS liked_percent,
       ROUND(100.0 * COUNT(*) FILTER (WHERE rating = 'dislike') / NULLIF(COUNT(*), 0), 1) AS disliked_percent,
       ROUND(100.0 * COUNT(*) FILTER (WHERE worn_on IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS worn_percent
FROM outfits
WHERE source <> 'manual'
UNION ALL
SELECT date_trunc('week', created_at AT TIME ZONE 'UTC')::date,
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE is_saved) / NULLIF(COUNT(*), 0), 1),
       ROUND(100.0 * COUNT(*) FILTER (WHERE rating = 'like') / NULLIF(COUNT(*), 0), 1),
       ROUND(100.0 * COUNT(*) FILTER (WHERE rating = 'dislike') / NULLIF(COUNT(*), 0), 1),
       ROUND(100.0 * COUNT(*) FILTER (WHERE worn_on IS NOT NULL) / NULLIF(COUNT(*), 0), 1)
FROM outfits
WHERE source <> 'manual'
GROUP BY 1
ORDER BY week DESC NULLS FIRST;


-- name: proposals_by_kind
-- The same shares by kind of proposal: the sure bet, the discovery, the new pairing, and outfits that earned no label.
SELECT COALESCE(kind, 'none')                                                     AS kind,
       COUNT(*)                                                                    AS proposals,
       ROUND(100.0 * COUNT(*) FILTER (WHERE is_saved) / COUNT(*), 1)               AS saved_percent,
       ROUND(100.0 * COUNT(*) FILTER (WHERE rating = 'like') / COUNT(*), 1)        AS liked_percent,
       ROUND(100.0 * COUNT(*) FILTER (WHERE worn_on IS NOT NULL) / COUNT(*), 1)    AS worn_percent
FROM outfits
WHERE source <> 'manual'
GROUP BY kind
ORDER BY proposals DESC;


-- name: worn_outfits_with_forgotten_garment
-- Of the outfits worn, the share that were a "discovery", the kind that contains at least one garment the person had
-- not worn for thirty days. Whether a garment was forgotten at the moment of wearing is not stored, only that the
-- proposal was labelled a discovery when it was made, so this is the share of discoveries among the worn outfits.
SELECT COUNT(*)                                                                   AS worn_outfits,
       COUNT(*) FILTER (WHERE kind = 'discovery')                                 AS worn_discoveries,
       ROUND(100.0 * COUNT(*) FILTER (WHERE kind = 'discovery') / NULLIF(COUNT(*), 0), 1) AS discovery_percent
FROM outfits
WHERE source <> 'manual' AND worn_on IS NOT NULL;


-- name: wardrobe_usage_per_person
-- For each person with ready garments: how many were worn in the last 30 days out of how many there are. 100 means
-- the whole wardrobe was in use; the beta wants to see this rise (the app exists to make people wear what they own).
SELECT user_id,
       COUNT(*)                                                                    AS ready_garments,
       COUNT(*) FILTER (WHERE last_worn_on > current_date - 30)                    AS worn_last_30_days,
       ROUND(100.0 * COUNT(*) FILTER (WHERE last_worn_on > current_date - 30) / COUNT(*), 1) AS usage_percent
FROM clothing_items
WHERE status = 'ready'
GROUP BY user_id
ORDER BY usage_percent DESC, user_id;


-- name: wardrobe_usage_summary
-- The same for everybody at once: the average and the median usage of a wardrobe, and the share of people who wore
-- at least one garment in the last 30 days.
WITH per_person AS (
    SELECT user_id,
           COUNT(*) AS ready,
           COUNT(*) FILTER (WHERE last_worn_on > current_date - 30) AS worn
    FROM clothing_items
    WHERE status = 'ready'
    GROUP BY user_id
)
SELECT COUNT(*)                                                                  AS people_with_ready_garments,
       ROUND(AVG(100.0 * worn / ready), 1)                                       AS average_usage_percent,
       ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY 100.0 * worn / ready))::numeric, 1) AS median_usage_percent,
       ROUND(100.0 * COUNT(*) FILTER (WHERE worn > 0) / NULLIF(COUNT(*), 0), 1)  AS people_wearing_something_percent
FROM per_person;


-- name: ai_cost_per_person
-- What the AI calls cost, per person, in US dollars, over the whole beta. user_id NULL is the sum of everybody whose
-- account was deleted: the cost stays known, who it was spent on does not.
SELECT user_id,
       COUNT(*)                                       AS calls,
       COUNT(*) FILTER (WHERE NOT success)            AS failed_calls,
       ROUND(SUM(cost_usd), 4)                        AS cost_usd,
       MIN(created_at)                                AS first_call_at,
       MAX(created_at)                                AS last_call_at
FROM ai_usage_log
GROUP BY user_id
ORDER BY cost_usd DESC, user_id;


-- name: ai_cost_per_person_per_operation
-- The same split by operation: background removal, tagging, styling, visualization.
SELECT user_id,
       operation,
       COUNT(*)                AS calls,
       ROUND(SUM(cost_usd), 4) AS cost_usd
FROM ai_usage_log
GROUP BY user_id, operation
ORDER BY user_id NULLS LAST, cost_usd DESC;


-- name: ai_cost_per_operation
-- Per operation, for everybody: calls, how many succeeded, what they cost on average and in total, how long they took.
SELECT operation,
       model,
       COUNT(*)                                                     AS calls,
       ROUND(100.0 * COUNT(*) FILTER (WHERE success) / COUNT(*), 1) AS success_percent,
       ROUND(SUM(cost_usd), 4)                                      AS cost_usd,
       ROUND(AVG(cost_usd), 6)                                      AS average_cost_usd,
       ROUND(AVG(duration_ms))                                      AS average_ms,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)    AS p95_ms
FROM ai_usage_log
GROUP BY operation, model
ORDER BY cost_usd DESC, operation;


-- name: ai_cost_per_day
-- The day's total against the daily budget (Limits:AiBudgetUsdPerDay, 10 by default), last 30 days, newest first.
-- The budget is counted in the zone of the server's configuration (App:TimeZone, Europe/Warsaw by default), which
-- this query does not know; the days here are UTC and so can differ from the budget's by the offset.
SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
       COUNT(*)                              AS calls,
       ROUND(SUM(cost_usd), 4)               AS cost_usd
FROM ai_usage_log
WHERE created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;


-- name: ai_cost_per_active_person_per_week
-- Cost per active person, week by week (activity as in active_people_per_week): the number that decides what a free
-- user costs, to be compared with product spec 11.2.
WITH activity AS (
    SELECT user_id, created_at AS at FROM refresh_tokens
    UNION ALL SELECT user_id, created_at FROM clothing_items
    UNION ALL SELECT user_id, created_at FROM outfits
    UNION ALL SELECT user_id, rated_at FROM outfits WHERE rated_at IS NOT NULL
    UNION ALL SELECT user_id, created_at FROM visualizations
),
people AS (
    SELECT date_trunc('week', at AT TIME ZONE 'UTC')::date AS week, COUNT(DISTINCT user_id) AS active_people
    FROM activity
    WHERE at >= now() - interval '12 weeks'
    GROUP BY 1
),
costs AS (
    SELECT date_trunc('week', created_at AT TIME ZONE 'UTC')::date AS week, SUM(cost_usd) AS cost_usd
    FROM ai_usage_log
    WHERE created_at >= now() - interval '12 weeks'
    GROUP BY 1
)
SELECT p.week,
       p.active_people,
       ROUND(COALESCE(c.cost_usd, 0), 4)                                   AS cost_usd,
       ROUND(COALESCE(c.cost_usd, 0) / NULLIF(p.active_people, 0), 4)      AS cost_usd_per_active_person
FROM people p
LEFT JOIN costs c ON c.week = p.week
ORDER BY p.week DESC;


-- name: fallback_share
-- How often the rules composed the proposals instead of the model (the model failed, refused, gave nothing valid, or the
-- day's AI budget was used up). Counted per request, as a whole and by week (newest first); week NULL is the total.
WITH requests AS (
    SELECT request_id,
           MIN(created_at)                        AS created_at,
           BOOL_OR(source = 'rules')              AS by_rules
    FROM outfits
    WHERE source <> 'manual'
    GROUP BY request_id
)
SELECT NULL::date                                                                  AS week,
       COUNT(*)                                                                    AS requests,
       COUNT(*) FILTER (WHERE by_rules)                                            AS by_rules,
       ROUND(100.0 * COUNT(*) FILTER (WHERE by_rules) / NULLIF(COUNT(*), 0), 1)    AS fallback_percent
FROM requests
UNION ALL
SELECT date_trunc('week', created_at AT TIME ZONE 'UTC')::date,
       COUNT(*),
       COUNT(*) FILTER (WHERE by_rules),
       ROUND(100.0 * COUNT(*) FILTER (WHERE by_rules) / NULLIF(COUNT(*), 0), 1)
FROM requests
GROUP BY 1
ORDER BY week DESC NULLS FIRST;


-- name: visualizations_by_outcome
-- Pictures ordered by how they ended: completed, blocked by the provider's filter, failed (with the reason), or still
-- in progress, with what they cost and the average time from the order to the end.
SELECT status,
       error_code,
       COUNT(*)                                                         AS visualizations,
       ROUND(SUM(cost_usd), 4)                                          AS cost_usd,
       ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)))::numeric, 1) AS average_seconds
FROM visualizations
GROUP BY status, error_code
ORDER BY visualizations DESC;
