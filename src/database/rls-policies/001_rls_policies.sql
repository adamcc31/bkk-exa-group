-- ============================================
-- Row Level Security Policies — BKK Automatic V3
-- Supabase RLS = Primary Defense Layer
-- ============================================

-- Helper function: extract role from database (Solves JWT sync issue)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT r.name 
  FROM public.users u
  JOIN public.roles r ON u.role_id = r.id
  WHERE u.id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: extract active company_id
-- Uses JWT app_metadata for override (switching), otherwise falls back to user's assigned company
CREATE OR REPLACE FUNCTION public.active_company_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'active_company_id')::uuid,
    (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: extract user's assigned company_id
CREATE OR REPLACE FUNCTION public.own_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- COMPANIES — All authenticated can read
-- ============================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select_all"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- ROLES — All authenticated can read
-- ============================================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select_all"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- USERS — Admin sees all, others see own company
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select"
  ON users FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN public.user_role() = 'admin' THEN true
      ELSE company_id = public.own_company_id()
    END
  );

CREATE POLICY "users_insert"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (public.user_role() = 'admin');

CREATE POLICY "users_update"
  ON users FOR UPDATE
  TO authenticated
  USING (public.user_role() = 'admin');

CREATE POLICY "users_delete"
  ON users FOR DELETE
  TO authenticated
  USING (public.user_role() = 'admin');

-- ============================================
-- TRANSACTIONS — Role-scoped access
-- Admin: all | Finance: active company | Staff: own records
-- ============================================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN public.user_role() = 'admin' THEN true
      WHEN public.user_role() = 'finance' THEN
        company_id = public.active_company_id()
      ELSE
        created_by = auth.uid()
        AND company_id = public.own_company_id()
    END
  );

CREATE POLICY "transactions_insert"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_role() IN ('admin', 'staff')
    AND company_id = public.own_company_id()
  );

CREATE POLICY "transactions_update"
  ON transactions FOR UPDATE
  TO authenticated
  USING (
    CASE
      WHEN public.user_role() = 'admin' THEN true
      WHEN public.user_role() = 'staff' THEN
        created_by = auth.uid()
        AND company_id = public.own_company_id()
      ELSE false
    END
  );

CREATE POLICY "transactions_delete"
  ON transactions FOR DELETE
  TO authenticated
  USING (
    CASE
      WHEN public.user_role() = 'admin' THEN true
      WHEN public.user_role() = 'staff' THEN
        created_by = auth.uid()
        AND company_id = public.own_company_id()
      ELSE false
    END
  );

-- ============================================
-- TRANSACTION ITEMS — follows parent transaction
-- ============================================
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_items_select"
  ON transaction_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_items.transaction_id
    )
  );

CREATE POLICY "transaction_items_insert"
  ON transaction_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_items.transaction_id
      AND (
        public.user_role() = 'admin'
        OR (public.user_role() = 'staff' AND t.created_by = auth.uid())
      )
    )
  );

CREATE POLICY "transaction_items_update"
  ON transaction_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_items.transaction_id
      AND (
        public.user_role() = 'admin'
        OR (public.user_role() = 'staff' AND t.created_by = auth.uid())
      )
    )
  );

CREATE POLICY "transaction_items_delete"
  ON transaction_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_items.transaction_id
      AND (
        public.user_role() = 'admin'
        OR (public.user_role() = 'staff' AND t.created_by = auth.uid())
      )
    )
  );

-- ============================================
-- AI PROCESSING JOBS — Role-scoped
-- ============================================
ALTER TABLE ai_processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_jobs_select"
  ON ai_processing_jobs FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN public.user_role() = 'admin' THEN true
      WHEN public.user_role() = 'finance' THEN
        company_id = public.active_company_id()
      ELSE
        initiated_by = auth.uid()
        AND company_id = public.own_company_id()
    END
  );

CREATE POLICY "ai_jobs_insert"
  ON ai_processing_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.own_company_id()
  );

-- ============================================
-- PDF ARTIFACTS — follows parent transaction
-- ============================================
ALTER TABLE pdf_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdf_artifacts_select"
  ON pdf_artifacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = pdf_artifacts.transaction_id
    )
  );

-- ============================================
-- AUDIT LOGS — Admin only
-- ============================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (public.user_role() = 'admin');

CREATE POLICY "audit_logs_insert"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
