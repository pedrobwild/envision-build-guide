
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'comercial', 'orcamentista');

-- 2. Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Profiles RLS
CREATE POLICY "Authenticated users can read profiles"
ON public.profiles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- 6. User roles RLS
CREATE POLICY "Users can read own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can read all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. Extend budgets with internal ownership and workflow fields
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS commercial_owner_id uuid,
  ADD COLUMN IF NOT EXISTS estimator_owner_id uuid,
  ADD COLUMN IF NOT EXISTS internal_status text NOT NULL DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

-- 8. Create can_access_budget helper function
CREATE OR REPLACE FUNCTION public.can_access_budget(_user_id uuid, _budget_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.budgets
    WHERE id = _budget_id
    AND (
      created_by = _user_id
      OR commercial_owner_id = _user_id
      OR estimator_owner_id = _user_id
      OR public.has_role(_user_id, 'admin')
    )
  )
$$;

-- 9. Additional RLS policies on budgets for role-based access
CREATE POLICY "Admins can manage all budgets"
ON public.budgets FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Comercial can view assigned budgets"
ON public.budgets FOR SELECT TO authenticated
USING (commercial_owner_id = auth.uid());

CREATE POLICY "Comercial can update assigned budgets"
ON public.budgets FOR UPDATE TO authenticated
USING (commercial_owner_id = auth.uid())
WITH CHECK (commercial_owner_id = auth.uid());

CREATE POLICY "Orcamentista can view assigned budgets"
ON public.budgets FOR SELECT TO authenticated
USING (estimator_owner_id = auth.uid());

CREATE POLICY "Orcamentista can update assigned budgets"
ON public.budgets FOR UPDATE TO authenticated
USING (estimator_owner_id = auth.uid())
WITH CHECK (estimator_owner_id = auth.uid());

-- 10. Admin access to child tables (sections, items, adjustments, rooms, item_images)
CREATE POLICY "Admins can manage all sections"
ON public.sections FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all items"
ON public.items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all adjustments"
ON public.adjustments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all rooms"
ON public.rooms FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all item_images"
ON public.item_images FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 11. Role-based access to child tables via budget assignment
CREATE POLICY "Assigned users can view sections"
ON public.sections FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.budgets b
  WHERE b.id = sections.budget_id
  AND (b.commercial_owner_id = auth.uid() OR b.estimator_owner_id = auth.uid())
));

CREATE POLICY "Assigned users can view items"
ON public.items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sections s
  JOIN public.budgets b ON b.id = s.budget_id
  WHERE s.id = items.section_id
  AND (b.commercial_owner_id = auth.uid() OR b.estimator_owner_id = auth.uid())
));

CREATE POLICY "Assigned users can view adjustments"
ON public.adjustments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.budgets b
  WHERE b.id = adjustments.budget_id
  AND (b.commercial_owner_id = auth.uid() OR b.estimator_owner_id = auth.uid())
));

CREATE POLICY "Assigned users can view rooms"
ON public.rooms FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.budgets b
  WHERE b.id = rooms.budget_id
  AND (b.commercial_owner_id = auth.uid() OR b.estimator_owner_id = auth.uid())
));

CREATE POLICY "Assigned users can view item_images"
ON public.item_images FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.items i
  JOIN public.sections s ON s.id = i.section_id
  JOIN public.budgets b ON b.id = s.budget_id
  WHERE i.id = item_images.item_id
  AND (b.commercial_owner_id = auth.uid() OR b.estimator_owner_id = auth.uid())
));

-- 12. Orcamentista can also manage items/sections on assigned budgets
CREATE POLICY "Orcamentista can manage sections on assigned budgets"
ON public.sections FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.budgets b
  WHERE b.id = sections.budget_id AND b.estimator_owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.budgets b
  WHERE b.id = sections.budget_id AND b.estimator_owner_id = auth.uid()
));

CREATE POLICY "Orcamentista can manage items on assigned budgets"
ON public.items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sections s
  JOIN public.budgets b ON b.id = s.budget_id
  WHERE s.id = items.section_id AND b.estimator_owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sections s
  JOIN public.budgets b ON b.id = s.budget_id
  WHERE s.id = items.section_id AND b.estimator_owner_id = auth.uid()
));

CREATE POLICY "Orcamentista can manage adjustments on assigned budgets"
ON public.adjustments FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.budgets b
  WHERE b.id = adjustments.budget_id AND b.estimator_owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.budgets b
  WHERE b.id = adjustments.budget_id AND b.estimator_owner_id = auth.uid()
));

CREATE POLICY "Orcamentista can manage item_images on assigned budgets"
ON public.item_images FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.items i
  JOIN public.sections s ON s.id = i.section_id
  JOIN public.budgets b ON b.id = s.budget_id
  WHERE i.id = item_images.item_id AND b.estimator_owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.items i
  JOIN public.sections s ON s.id = i.section_id
  JOIN public.budgets b ON b.id = s.budget_id
  WHERE i.id = item_images.item_id AND b.estimator_owner_id = auth.uid()
));

CREATE POLICY "Orcamentista can manage rooms on assigned budgets"
ON public.rooms FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.budgets b
  WHERE b.id = rooms.budget_id AND b.estimator_owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.budgets b
  WHERE b.id = rooms.budget_id AND b.estimator_owner_id = auth.uid()
));
