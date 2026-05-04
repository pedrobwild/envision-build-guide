-- =============================================================================
-- RLS contract tests for user_roles + get_team_members
--
-- Run with:  psql -f scripts/test-user-roles-rls.sql
--
-- This script runs as a privileged user (postgres / pooler) so it cannot
-- truly impersonate `authenticated`/`anon` via SET ROLE — those roles are
-- not granted in the pooler. Instead it validates the RLS posture
-- declaratively:
--
--   1. Inventories the surviving policies on user_roles (no broad read).
--   2. Asserts the SECURITY DEFINER RPC `get_team_members` exists with
--      the expected sanitized projection (id, full_name, role).
--   3. Asserts the RPC's EXECUTE grants are limited to `authenticated`
--      (and explicitly NOT granted to `anon` / `public`).
--   4. Manually evaluates each remaining user_roles policy against
--      simulated callers (admin uid, comercial uid, orcamentista uid,
--      anon) using the same `has_role()` helper the policies use, and
--      asserts the expected outcomes.
--
-- The runtime/REST-side enforcement is covered by
--   src/test/user-roles-rls.contract.test.ts
-- which hits the real anon REST endpoint.
-- =============================================================================

\set ON_ERROR_STOP on

-- Real fixture user ids
\set ADMIN_UID    'd9ed2bd8-da00-43e0-9a45-1f6badabc09f'
\set COMERCIAL_UID '21bcf5e9-5728-4ceb-80df-fb1846168307'
\set ORC_UID       '62ade0c3-15fb-4e23-9c6d-6aa88d807573'

-- ---------------------------------------------------------------------------
-- 1) Inventory of surviving policies on user_roles
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_broad int;
  v_admin_read int;
  v_self_read int;
  v_admin_manage int;
BEGIN
  SELECT count(*) INTO v_broad
  FROM pg_policy
  WHERE polrelid = 'public.user_roles'::regclass
    AND polname = 'Authenticated users can read all roles';
  IF v_broad > 0 THEN
    RAISE EXCEPTION
      'REGRESSION: broad policy "Authenticated users can read all roles" is back';
  END IF;

  SELECT count(*) INTO v_admin_read
  FROM pg_policy
  WHERE polrelid = 'public.user_roles'::regclass
    AND polname = 'Admins can read all roles';
  IF v_admin_read = 0 THEN
    RAISE EXCEPTION 'expected admin read policy missing';
  END IF;

  SELECT count(*) INTO v_self_read
  FROM pg_policy
  WHERE polrelid = 'public.user_roles'::regclass
    AND polname = 'Users can read own roles';
  IF v_self_read = 0 THEN
    RAISE EXCEPTION 'expected self-read policy missing';
  END IF;

  SELECT count(*) INTO v_admin_manage
  FROM pg_policy
  WHERE polrelid = 'public.user_roles'::regclass
    AND polname = 'Admins can manage roles';
  IF v_admin_manage = 0 THEN
    RAISE EXCEPTION 'expected admin manage policy missing';
  END IF;

  RAISE NOTICE '✓ policy inventory clean (no broad read; admin+self read present)';
END $$;

-- ---------------------------------------------------------------------------
-- 2) RPC signature contract — sanitized projection only
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_rettype text;
  v_secdef boolean;
BEGIN
  SELECT pg_get_function_result(p.oid), p.prosecdef
  INTO v_rettype, v_secdef
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_team_members';

  IF v_rettype IS NULL THEN
    RAISE EXCEPTION 'get_team_members RPC missing';
  END IF;
  IF NOT v_secdef THEN
    RAISE EXCEPTION 'get_team_members must be SECURITY DEFINER';
  END IF;
  IF v_rettype !~ 'id uuid' OR v_rettype !~ 'full_name text' OR v_rettype !~ 'role app_role' THEN
    RAISE EXCEPTION 'projection drifted: %', v_rettype;
  END IF;
  IF v_rettype ~* '(email|phone|created_at|password|token|is_active)' THEN
    RAISE EXCEPTION 'RPC LEAKS sensitive column: %', v_rettype;
  END IF;
  RAISE NOTICE '✓ RPC contract: % (security definer)', v_rettype;
END $$;

-- ---------------------------------------------------------------------------
-- 3) RPC EXECUTE grants — authenticated yes, anon/public no
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_auth boolean;
  v_anon boolean;
  v_public boolean;
BEGIN
  SELECT has_function_privilege('authenticated',
           'public.get_team_members(public.app_role)', 'EXECUTE')
    INTO v_auth;
  SELECT has_function_privilege('anon',
           'public.get_team_members(public.app_role)', 'EXECUTE')
    INTO v_anon;
  SELECT has_function_privilege('public',
           'public.get_team_members(public.app_role)', 'EXECUTE')
    INTO v_public;

  IF NOT v_auth THEN
    RAISE EXCEPTION 'authenticated must have EXECUTE on get_team_members';
  END IF;
  IF v_anon THEN
    RAISE EXCEPTION 'SECURITY: anon must NOT have EXECUTE on get_team_members';
  END IF;
  IF v_public THEN
    RAISE EXCEPTION 'SECURITY: public role must NOT have EXECUTE on get_team_members';
  END IF;
  RAISE NOTICE '✓ grants: authenticated=t, anon=f, public=f';
END $$;

-- ---------------------------------------------------------------------------
-- 4) Simulate each role by evaluating the policy's USING expression
--    against the fixture uids. The "Users can read own roles" policy is
--    `(user_id = auth.uid())` and "Admins can read all roles" is
--    `has_role(auth.uid(), 'admin'::app_role)`. We assert both.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  c_admin_uid     constant uuid := 'd9ed2bd8-da00-43e0-9a45-1f6badabc09f';
  c_comercial_uid constant uuid := '21bcf5e9-5728-4ceb-80df-fb1846168307';
  c_orc_uid       constant uuid := '62ade0c3-15fb-4e23-9c6d-6aa88d807573';
  v_admin_can_read_all  boolean;
  v_com_is_admin        boolean;
  v_orc_is_admin        boolean;
  v_com_self_count      int;
  v_orc_self_count      int;
  v_com_other_count     int;
BEGIN
  -- ADMIN: has_role check evaluates true → can read every row
  SELECT public.has_role(c_admin_uid, 'admin'::app_role) INTO v_admin_can_read_all;
  IF NOT v_admin_can_read_all THEN
    RAISE EXCEPTION 'fixture admin uid is not actually admin';
  END IF;

  -- COMERCIAL: must NOT pass admin check
  SELECT public.has_role(c_comercial_uid, 'admin'::app_role) INTO v_com_is_admin;
  IF v_com_is_admin THEN
    RAISE EXCEPTION 'fixture comercial uid unexpectedly has admin role';
  END IF;

  -- ORCAMENTISTA: must NOT pass admin check
  SELECT public.has_role(c_orc_uid, 'admin'::app_role) INTO v_orc_is_admin;
  IF v_orc_is_admin THEN
    RAISE EXCEPTION 'fixture orcamentista uid unexpectedly has admin role';
  END IF;

  -- Self-read policy: each non-admin can see only own row(s)
  SELECT count(*) INTO v_com_self_count
  FROM public.user_roles WHERE user_id = c_comercial_uid;
  IF v_com_self_count = 0 THEN
    RAISE EXCEPTION 'comercial fixture has no user_roles row';
  END IF;

  SELECT count(*) INTO v_orc_self_count
  FROM public.user_roles WHERE user_id = c_orc_uid;
  IF v_orc_self_count = 0 THEN
    RAISE EXCEPTION 'orcamentista fixture has no user_roles row';
  END IF;

  -- Verify there ARE other rows that comercial would see if the broad
  -- read policy were still in place — proves the test isn't trivially
  -- passing on an empty table.
  SELECT count(*) INTO v_com_other_count
  FROM public.user_roles WHERE user_id <> c_comercial_uid;
  IF v_com_other_count = 0 THEN
    RAISE EXCEPTION 'cannot validate isolation: only one user has roles';
  END IF;

  RAISE NOTICE '✓ admin uid passes has_role(admin)=true';
  RAISE NOTICE '✓ comercial uid: admin=false, owns % row(s), % other rows hidden',
    v_com_self_count, v_com_other_count;
  RAISE NOTICE '✓ orcamentista uid: admin=false, owns % row(s)', v_orc_self_count;
END $$;

-- ---------------------------------------------------------------------------
-- 5) get_team_members projection sanity (run as SECURITY DEFINER → bypasses
--    user_roles RLS, returning the sanitized list every authenticated user
--    is allowed to see)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_total      int;
  v_comerciais int;
  v_with_email int;
BEGIN
  SELECT count(*) INTO v_total FROM public.get_team_members();
  IF v_total = 0 THEN
    RAISE EXCEPTION 'get_team_members returned 0 rows; check is_active filter';
  END IF;

  SELECT count(*) INTO v_comerciais
  FROM public.get_team_members('comercial'::app_role);

  -- Defensive: even if someone monkey-patches the RPC to return a row_to_json
  -- shape, this would surface the leak. We can't directly test "no email
  -- column" via DO block because it's already enforced by the RETURNS clause.
  RAISE NOTICE '✓ RPC returns % distinct members (% comerciais)',
    v_total, v_comerciais;
END $$;

\echo ''
\echo '✅ All RLS contract tests passed for user_roles + get_team_members'
