-- =============================================
-- TaylorURL Client Portal Database Schema
-- =============================================

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

-- Profiles table: stores user role and metadata
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'client' CHECK (role IN ('client', 'staff', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'client');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Staff can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_staff_or_admin());

CREATE POLICY "Admin can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Websites table: tracks each client website
CREATE TABLE public.websites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT DEFAULT 'development' CHECK (status IN ('active', 'maintenance', 'development', 'down', 'paused')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Website stats: rolling analytics per site
CREATE TABLE public.website_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE NOT NULL,
  visitors_30d INTEGER DEFAULT 0,
  page_views_30d INTEGER DEFAULT 0,
  uptime_pct NUMERIC(5,2) DEFAULT 100.00,
  avg_load_time_ms INTEGER,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_websites_user_id ON public.websites(user_id);
CREATE INDEX idx_website_stats_website_id ON public.website_stats(website_id);

-- Enable RLS
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only see their own websites
CREATE POLICY "Users can view own websites"
  ON public.websites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own website stats"
  ON public.website_stats FOR SELECT
  USING (
    website_id IN (
      SELECT id FROM public.websites WHERE user_id = auth.uid()
    )
  );

-- Staff/admin policies
CREATE POLICY "Staff can view all websites"
  ON public.websites FOR SELECT
  USING (public.is_staff_or_admin());

CREATE POLICY "Staff can insert websites"
  ON public.websites FOR INSERT
  WITH CHECK (public.is_staff_or_admin());

CREATE POLICY "Staff can update websites"
  ON public.websites FOR UPDATE
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

CREATE POLICY "Staff can delete websites"
  ON public.websites FOR DELETE
  USING (public.is_staff_or_admin());

CREATE POLICY "Staff can view all website stats"
  ON public.website_stats FOR SELECT
  USING (public.is_staff_or_admin());

CREATE POLICY "Staff can manage all website stats"
  ON public.website_stats FOR ALL
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER websites_updated_at
  BEFORE UPDATE ON public.websites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER website_stats_updated_at
  BEFORE UPDATE ON public.website_stats
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
