-- Run this after creating your account to make yourself admin.
-- Replace the email with your actual email address.

UPDATE public.profiles SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'trentbtaylor@icloud.com');
