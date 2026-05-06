-- ============================================
-- Migration 005 — Refresh Tokens Table
-- Handles session persistence for bare PostgreSQL
-- ============================================

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON public.refresh_tokens(token_hash);

-- Comments
COMMENT ON TABLE public.refresh_tokens IS 'Stores hashed refresh tokens for session management';
COMMENT ON COLUMN public.refresh_tokens.token_hash IS 'SHA-256 hash of the random refresh token string';
