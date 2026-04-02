-- Run this in the Supabase SQL Editor to diagnose the signup failure.
-- It checks whether the profiles table, trigger function, and trigger all exist
-- and shows the actual column structure of profiles.

-- 1. Check profiles columns
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 2. Check trigger function exists
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'handle_new_user';

-- 3. Check trigger exists on auth.users
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'extensions' OR event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';
