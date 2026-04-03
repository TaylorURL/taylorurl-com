-- Debug: check active_visitors rows for hollingsheadharbor.com
SELECT av.visitor_id, av.last_seen, w.domain
FROM active_visitors av
JOIN websites w ON w.id = av.website_id
WHERE w.domain ILIKE '%hollingshead%'
ORDER BY av.last_seen DESC
LIMIT 10;

-- Debug: check website_stats row for hollingsheadharbor.com
SELECT ws.visitors_now, ws.visitors_30d, ws.is_up_now, ws.updated_at, w.domain
FROM website_stats ws
JOIN websites w ON w.id = ws.website_id
WHERE w.domain ILIKE '%hollingshead%';

-- Debug: confirm the website record and its exact domain value
SELECT id, domain, status FROM websites WHERE domain ILIKE '%hollingshead%';

-- Debug: check if beacon is successfully inserting page_views for hollingsheadharbor.com
SELECT pv.page_url, pv.visitor_id, pv.created_at, w.domain
FROM page_views pv
JOIN websites w ON w.id = pv.website_id
WHERE w.domain ILIKE '%hollingshead%'
ORDER BY pv.created_at DESC
LIMIT 10;
