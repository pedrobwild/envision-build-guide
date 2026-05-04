-- =============================================================================
-- RLS contract tests for user_roles + get_team_members
--
-- Run with:
--   psql -f scripts/test-user-roles-rls.sql
--
-- Each block sets `request.jwt.claims` to impersonate a real user of a given
-- role (admin / comercial / orcamentista / anon) and asserts that:
--
--   • Admins can SELECT every row of user_roles.
--   • Comercial/orcamentista CANNOT SELECT user_roles other than their own.
--   • Comercial/orcamentista CAN execute get_team_members and see the team.
--   • Anon CANNOT SELECT user_roles and CANNOT execute get_team_members.
--   • get_team_members returns ONLY (id, full_name, role) — no email, no
--     created_at, nothing sensitive.
--
-- Each assertion uses RAISE EXCEPTION on failure so the script aborts with a
-- non-zero exit code, making it CI-friendly.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- Real fixture user ids (one per role + a multi-role admin for sanity)
\set ADMIN_UID    '''d9ed2bd8-da00-43e0-9a45-1f6badabc09f'''
\set COMERCIAL_UID '''21bcf5e9-5728-4ceb-80df-fb1846168307'''
\set ORC_UID       '''62ade0c3-15fb-4e23-9c6d-6aa88d807573'''

-- ---------------------------------------------------------------------------
-- 1) ADMIN — full read access on user_roles
-- ---------------------------------------------------------------------------
SET LOCAL role authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :ADMIN_UID, 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  v_total bigint;
  v_distinct_roles int;
BEGIN
  SELECT count(*), count(DISTINCT role) INTO v_total, v_distinct_roles
  FROM public.user_roles;

  IF v_total < 5 THEN
    RAISE EXCEPTION 'admin should see all user_roles, got % rows', v_total;
  END IF;
  IF v_distinct_roles < 2 THEN
    RAISE EXCEPTION 'admin should see multiple distinct roles, got %', v_distinct_roles;
  END IF;
  RAISE NOTICE 'OK admin sees % user_roles rows across % roles', v_total, v_distinct_roles;
END $$;

-- ---------------------------------------------------------------------------
-- 2) COMERCIAL — must only see own user_roles row(s)
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :COMERCIAL_UID, 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  v_total bigint;
  v_other bigint;
BEGIN
  SELECT count(*) INTO v_total FROM public.user_roles;
  SELECT count(*) INTO v_other
  FROM public.user_roles
  WHERE user_id <> '21bcf5e9-5728-4ceb-80df-fb1846168307'::uuid;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'comercial should see at least their own row';
  END IF;
  IF v_other > 0 THEN
    RAISE EXCEPTION
      'PRIVACY LEAK: comercial sees % rows belonging to other users', v_other;
  END IF;
  RAISE NOTICE 'OK comercial sees only own % row(s), no leakage', v_total;
END $$;

-- COMERCIAL can call the RPC and get team members (broad, sanitized projection)
DO $$
DECLARE
  v_rows int;
  v_cols text[];
BEGIN
  SELECT count(*) INTO v_rows FROM public.get_team_members();
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'comercial should be able to list team members via RPC';
  END IF;

  -- Columns must be exactly (id, full_name, role) — no email/created_at/etc.
  SELECT array_agg(column_name ORDER BY ordinal_position) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'get_team_members';
  -- (information_schema doesn't list set-returning function columns the same
  --  way; instead inspect pg_proc returnset)

  -- Sanity: filter by role works
  PERFORM 1 FROM public.get_team_members('comercial'::app_role) LIMIT 1;
  RAISE NOTICE 'OK comercial RPC returns % team members', v_rows;
END $$;

-- ---------------------------------------------------------------------------
-- 3) ORCAMENTISTA — same isolation rules
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :ORC_UID, 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  v_total bigint;
  v_other bigint;
  v_rpc int;
BEGIN
  SELECT count(*) INTO v_total FROM public.user_roles;
  SELECT count(*) INTO v_other
  FROM public.user_roles
  WHERE user_id <> '62ade0c3-15fb-4e23-9c6d-6aa88d807573'::uuid;

  IF v_other > 0 THEN
    RAISE EXCEPTION
      'PRIVACY LEAK: orcamentista sees % rows of other users', v_other;
  END IF;

  SELECT count(*) INTO v_rpc FROM public.get_team_members('orcamentista'::app_role);
  IF v_rpc = 0 THEN
    RAISE EXCEPTION 'orcamentista RPC returned 0 orcamentistas (expected ≥1)';
  END IF;
  RAISE NOTICE 'OK orcamentista isolated (% own row), RPC returns %',
    v_total, v_rpc;
END $$;

-- ---------------------------------------------------------------------------
-- 4) ANON — fully locked out
-- ---------------------------------------------------------------------------
SET LOCAL role anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

DO $$
DECLARE
  v_total bigint;
BEGIN
  SELECT count(*) INTO v_total FROM public.user_roles;
  IF v_total > 0 THEN
    RAISE EXCEPTION 'anon should see 0 user_roles rows, got %', v_total;
  END IF;
  RAISE NOTICE 'OK anon cannot read user_roles';
END $$;

-- Anon must NOT be able to execute the RPC
DO $$
BEGIN
  BEGIN
    PERFORM public.get_team_members();
    RAISE EXCEPTION 'anon should NOT be able to execute get_team_members';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'OK anon cannot execute get_team_members (insufficient_privilege)';
  END;
END $$;

-- ---------------------------------------------------------------------------
-- 5) RPC projection contract — only safe columns are exposed
-- ---------------------------------------------------------------------------
RESET role;
DO $$
DECLARE
  v_argtypes text;
  v_rettype  text;
BEGIN
  SELECT pg_get_function_arguments(p.oid),
         pg_get_function_result(p.oid)
  INTO v_argtypes, v_rettype
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_team_members';

  IF v_rettype !~ 'id uuid' OR v_rettype !~ 'full_name text' OR v_rettype !~ 'role app_role' THEN
    RAISE EXCEPTION 'get_team_members signature drifted: %', v_rettype;
  END IF;
  IF v_rettype ~* '(email|phone|created_at|password|token)' THEN
    RAISE EXCEPTION 'get_team_members LEAKS sensitive column: %', v_rettype;
  END IF;
  RAISE NOTICE 'OK RPC contract: (%) -> %', v_argtypes, v_rettype;
END $$;

-- ---------------------------------------------------------------------------
-- 6) Old broad policy must be gone
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policy
  WHERE polrelid = 'public.user_roles'::regclass
    AND polname = 'Authenticated users can read all roles';
  IF v_count > 0 THEN
    RAISE EXCEPTION
      'REGRESSION: broad policy "Authenticated users can read all roles" is back';
  END IF;
  RAISE NOTICE 'OK broad read policy is removed';
END $$;

ROLLBACK;

\echo ''
\echo '✅ All RLS contract tests passed for user_roles + get_team_members'
