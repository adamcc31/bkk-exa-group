-- ============================================================
-- Migration 011 — Fix RLS Policies with WITH CHECK
-- ============================================================

-- 1. USERS
DROP POLICY IF EXISTS "users_insert" ON public.users;
CREATE POLICY "users_insert" ON public.users
  FOR INSERT TO public 
  WITH CHECK (
    public.is_authenticated() AND public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update" ON public.users
  FOR UPDATE TO public 
  USING (
    public.is_authenticated() AND public.user_role() = 'admin'
  )
  WITH CHECK (
    public.is_authenticated() AND public.user_role() = 'admin'
  );

-- 2. TRANSACTIONS
DROP POLICY IF EXISTS "transactions_insert" ON public.transactions;
CREATE POLICY "transactions_insert" ON public.transactions
  FOR INSERT TO public 
  WITH CHECK (
    public.is_authenticated() AND (
      public.user_role() IN ('admin', 'staff', 'finance') AND company_id = public.own_company_id()
    )
  );

DROP POLICY IF EXISTS "transactions_update" ON public.transactions;
CREATE POLICY "transactions_update" ON public.transactions
  FOR UPDATE TO public 
  USING (
    public.is_authenticated() AND (
      CASE
        WHEN public.user_role() = 'admin' THEN company_id = public.active_company_id()
        WHEN public.user_role() = 'staff' THEN created_by = public.current_user_id() AND company_id = public.own_company_id()
        WHEN public.user_role() = 'finance' THEN company_id = public.active_company_id()
        ELSE false
      END
    )
  )
  WITH CHECK (
    public.is_authenticated() AND (
      CASE
        WHEN public.user_role() = 'admin' THEN company_id = public.active_company_id()
        WHEN public.user_role() = 'staff' THEN created_by = public.current_user_id() AND company_id = public.own_company_id()
        WHEN public.user_role() = 'finance' THEN company_id = public.active_company_id()
        ELSE false
      END
    )
  );

-- 3. TRANSACTION ITEMS
DROP POLICY IF EXISTS "transaction_items_insert" ON public.transaction_items;
CREATE POLICY "transaction_items_insert" ON public.transaction_items
  FOR INSERT TO public 
  WITH CHECK (
    public.is_authenticated() AND (
      EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.id = transaction_items.transaction_id
        AND (
          public.user_role() IN ('admin', 'finance') 
          OR (public.user_role() = 'staff' AND t.created_by = public.current_user_id())
        )
      )
    )
  );

DROP POLICY IF EXISTS "transaction_items_update" ON public.transaction_items;
CREATE POLICY "transaction_items_update" ON public.transaction_items
  FOR UPDATE TO public 
  USING (
    public.is_authenticated() AND (
      EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.id = transaction_items.transaction_id
        AND (
          public.user_role() IN ('admin', 'finance') 
          OR (public.user_role() = 'staff' AND t.created_by = public.current_user_id())
        )
      )
    )
  )
  WITH CHECK (
    public.is_authenticated() AND (
      EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.id = transaction_items.transaction_id
        AND (
          public.user_role() IN ('admin', 'finance') 
          OR (public.user_role() = 'staff' AND t.created_by = public.current_user_id())
        )
      )
    )
  );

-- 4. AI PROCESSING JOBS
DROP POLICY IF EXISTS "ai_jobs_insert" ON public.ai_processing_jobs;
CREATE POLICY "ai_jobs_insert" ON public.ai_processing_jobs
  FOR INSERT TO public 
  WITH CHECK (
    public.is_authenticated() AND company_id = public.own_company_id()
  );

-- 5. AUDIT LOGS
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO public 
  WITH CHECK (public.is_authenticated());

-- 6. AUTH USERS (Self update)
DROP POLICY IF EXISTS "auth_users_self_update" ON public.auth_users;
CREATE POLICY "auth_users_self_update" ON public.auth_users
  FOR UPDATE TO public 
  USING (
    public.is_authenticated() AND id = public.current_user_id()
  )
  WITH CHECK (
    public.is_authenticated() AND id = public.current_user_id()
  );
