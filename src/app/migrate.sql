-- Migration: add missing tables, triggers, and fix RLS policies
-- Skip profiles since it already exists

-- Helper functions for role checks (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('staff', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Add role column to profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client' CHECK (role IN ('client', 'staff', 'admin'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Auto-create profile on signup (replace if exists)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'client')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive policy that allowed any user to manage all profiles
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Staff can view all profiles') THEN
    CREATE POLICY "Staff can view all profiles" ON public.profiles FOR SELECT USING (public.is_staff_or_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admin can update all profiles') THEN
    CREATE POLICY "Admin can update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

-- Websites table
CREATE TABLE IF NOT EXISTS public.websites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT DEFAULT 'development' CHECK (status IN ('active', 'maintenance', 'development', 'down', 'paused')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Website stats
CREATE TABLE IF NOT EXISTS public.website_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE NOT NULL,
  visitors_30d INTEGER DEFAULT 0,
  page_views_30d INTEGER DEFAULT 0,
  uptime_pct NUMERIC(5,2) DEFAULT 100.00,
  avg_load_time_ms INTEGER,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_websites_user_id ON public.websites(user_id);
CREATE INDEX IF NOT EXISTS idx_website_stats_website_id ON public.website_stats(website_id);

-- Websites RLS
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_stats ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive policies that allowed any user to manage all websites/stats
DROP POLICY IF EXISTS "Service role can manage all websites" ON public.websites;
DROP POLICY IF EXISTS "Service role can manage all website stats" ON public.website_stats;

DO $$ BEGIN
  -- Websites: user SELECT
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'websites' AND policyname = 'Users can view own websites') THEN
    CREATE POLICY "Users can view own websites" ON public.websites FOR SELECT USING (auth.uid() = user_id);
  END IF;
  -- Websites: staff/admin SELECT
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'websites' AND policyname = 'Staff can view all websites') THEN
    CREATE POLICY "Staff can view all websites" ON public.websites FOR SELECT USING (public.is_staff_or_admin());
  END IF;
  -- Websites: staff/admin INSERT
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'websites' AND policyname = 'Staff can insert websites') THEN
    CREATE POLICY "Staff can insert websites" ON public.websites FOR INSERT WITH CHECK (public.is_staff_or_admin());
  END IF;
  -- Websites: staff/admin UPDATE
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'websites' AND policyname = 'Staff can update websites') THEN
    CREATE POLICY "Staff can update websites" ON public.websites FOR UPDATE USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());
  END IF;
  -- Websites: staff/admin DELETE
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'websites' AND policyname = 'Staff can delete websites') THEN
    CREATE POLICY "Staff can delete websites" ON public.websites FOR DELETE USING (public.is_staff_or_admin());
  END IF;
  -- Website stats: user SELECT
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'website_stats' AND policyname = 'Users can view own website stats') THEN
    CREATE POLICY "Users can view own website stats" ON public.website_stats FOR SELECT USING (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));
  END IF;
  -- Website stats: staff/admin ALL
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'website_stats' AND policyname = 'Staff can view all website stats') THEN
    CREATE POLICY "Staff can view all website stats" ON public.website_stats FOR SELECT USING (public.is_staff_or_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'website_stats' AND policyname = 'Staff can manage all website stats') THEN
    CREATE POLICY "Staff can manage all website stats" ON public.website_stats FOR ALL USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());
  END IF;
END $$;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS websites_updated_at ON public.websites;
CREATE TRIGGER websites_updated_at
  BEFORE UPDATE ON public.websites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS website_stats_updated_at ON public.website_stats;
CREATE TRIGGER website_stats_updated_at
  BEFORE UPDATE ON public.website_stats
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
