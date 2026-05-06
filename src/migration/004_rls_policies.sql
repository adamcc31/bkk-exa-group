-- ============================================
-- Migration 004 — RLS Policies (Post-Supabase)
-- Re-implements security with app.* session variables
-- FORCED for postgres user to prevent data leakage
-- ============================================

-- 1. Helper Functions for Auth Context
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- 2. AUTH_USERS
ALTER TABLE public.auth_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_users_self_select" ON public.auth_users;
DROP POLICY IF EXISTS "auth_users_self_update" ON public.auth_users;

CREATE POLICY "auth_users_self_select" ON public.auth_users
  FOR SELECT TO public 
  USING (
    public.is_authenticated() AND id = public.current_user_id()
  );

CREATE POLICY "auth_users_self_update" ON public.auth_users
  FOR UPDATE TO public 
  USING (
    public.is_authenticated() AND id = public.current_user_id()
  );

-- 3. COMPANIES
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select_all" ON public.companies;
CREATE POLICY "companies_select_all" ON public.companies
  FOR SELECT TO public 
  USING (public.is_authenticated());

-- 4. ROLES
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_all" ON public.roles;
CREATE POLICY "roles_select_all" ON public.roles
  FOR SELECT TO public 
  USING (public.is_authenticated());

-- 5. USERS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT TO public USING (
    public.is_authenticated() AND (
      public.user_role() = 'admin' OR company_id = public.own_company_id()
    )
  );

CREATE POLICY "users_insert" ON public.users
  FOR INSERT TO public WITH CHECK (
    public.is_authenticated() AND public.user_role() = 'admin'
  );

CREATE POLICY "users_update" ON public.users
  FOR UPDATE TO public USING (
    public.is_authenticated() AND public.user_role() = 'admin'
  );

CREATE POLICY "users_delete" ON public.users
  FOR DELETE TO public USING (
    public.is_authenticated() AND public.user_role() = 'admin'
  );

-- 6. TRANSACTIONS
-- ADMIN: Strictly scoped by active company tab
-- FINANCE: Scoped by active company
-- STAFF: Strictly scoped by own records AND own company
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete" ON public.transactions;

CREATE POLICY "transactions_select" ON public.transactions
  FOR SELECT TO public USING (
    public.is_authenticated() AND (
      CASE
        WHEN public.user_role() = 'admin' THEN 
          company_id = public.active_company_id()
        WHEN public.user_role() = 'finance' THEN 
          company_id = public.active_company_id()
        ELSE 
          created_by = public.current_user_id() AND company_id = public.own_company_id()
      END
    )
  );

CREATE POLICY "transactions_insert" ON public.transactions
  FOR INSERT TO public WITH CHECK (
    public.is_authenticated() AND (
      public.user_role() IN ('admin', 'staff') AND company_id = public.own_company_id()
    )
  );

CREATE POLICY "transactions_update" ON public.transactions
  FOR UPDATE TO public USING (
    public.is_authenticated() AND (
      CASE
        WHEN public.user_role() = 'admin' THEN 
          company_id = public.active_company_id()
        WHEN public.user_role() = 'staff' THEN 
          created_by = public.current_user_id() AND company_id = public.own_company_id()
        ELSE false
      END
    )
  );

CREATE POLICY "transactions_delete" ON public.transactions
  FOR DELETE TO public USING (
    public.is_authenticated() AND (
      CASE
        WHEN public.user_role() = 'admin' THEN 
          company_id = public.active_company_id()
        WHEN public.user_role() = 'staff' THEN 
          created_by = public.current_user_id() AND company_id = public.own_company_id()
        ELSE false
      END
    )
  );

-- 7. TRANSACTION ITEMS
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transaction_items_select" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items_insert" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items_update" ON public.transaction_items;
DROP POLICY IF EXISTS "transaction_items_delete" ON public.transaction_items;

CREATE POLICY "transaction_items_select" ON public.transaction_items
  FOR SELECT TO public USING (
    public.is_authenticated() AND (
      EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_items.transaction_id)
    )
  );

CREATE POLICY "transaction_items_insert" ON public.transaction_items
  FOR INSERT TO public WITH CHECK (
    public.is_authenticated() AND (
      EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.id = transaction_items.transaction_id
        AND (public.user_role() = 'admin' OR (public.user_role() = 'staff' AND t.created_by = public.current_user_id()))
      )
    )
  );

CREATE POLICY "transaction_items_update" ON public.transaction_items
  FOR UPDATE TO public USING (
    public.is_authenticated() AND (
      EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.id = transaction_items.transaction_id
        AND (public.user_role() = 'admin' OR (public.user_role() = 'staff' AND t.created_by = public.current_user_id()))
      )
    )
  );

CREATE POLICY "transaction_items_delete" ON public.transaction_items
  FOR DELETE TO public USING (
    public.is_authenticated() AND (
      EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.id = transaction_items.transaction_id
        AND (public.user_role() = 'admin' OR (public.user_role() = 'staff' AND t.created_by = public.current_user_id()))
      )
    )
  );

-- 8. AI PROCESSING JOBS
ALTER TABLE public.ai_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_processing_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_jobs_select" ON public.ai_processing_jobs;
DROP POLICY IF EXISTS "ai_jobs_insert" ON public.ai_processing_jobs;

CREATE POLICY "ai_jobs_select" ON public.ai_processing_jobs
  FOR SELECT TO public USING (
    public.is_authenticated() AND (
      CASE
        WHEN public.user_role() = 'admin' THEN 
          company_id = public.active_company_id()
        WHEN public.user_role() = 'finance' THEN 
          company_id = public.active_company_id()
        ELSE 
          initiated_by = public.current_user_id() AND company_id = public.own_company_id()
      END
    )
  );

CREATE POLICY "ai_jobs_insert" ON public.ai_processing_jobs
  FOR INSERT TO public WITH CHECK (
    public.is_authenticated() AND company_id = public.own_company_id()
  );

-- 9. PDF ARTIFACTS
ALTER TABLE public.pdf_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_artifacts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pdf_artifacts_select" ON public.pdf_artifacts;
CREATE POLICY "pdf_artifacts_select" ON public.pdf_artifacts
  FOR SELECT TO public USING (
    public.is_authenticated() AND (
      EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = pdf_artifacts.transaction_id)
    )
  );

-- 10. AUDIT LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;

CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO public USING (
    public.is_authenticated() AND public.user_role() = 'admin'
  );

CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO public WITH CHECK (public.is_authenticated());
