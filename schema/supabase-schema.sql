-- ========================================
-- OpenRouter Agent Database Schema
-- ========================================
-- 
-- This schema creates the necessary tables for the OpenRouter Agent
-- to manage per-user API keys and usage tracking.
--
-- INSTRUCTIONS:
-- 1. Open your Supabase project dashboard
-- 2. Go to SQL Editor
-- 3. Create a new query
-- 4. Paste this entire file
-- 5. Run the query
--

-- ========================================
-- USER_API_KEYS TABLE
-- ========================================
-- Stores individual OpenRouter API keys for each user

CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- References your user system
  
  -- OpenRouter key details
  openrouter_key_id TEXT NOT NULL,  -- OpenRouter's internal key ID
  key_name TEXT NOT NULL DEFAULT 'User API Key',
  key_label TEXT,  -- Optional label for organization
  
  -- Usage and limits
  monthly_limit DECIMAL(10,2),  -- Monthly spending limit in USD
  current_usage DECIMAL(10,2) DEFAULT 0.00,  -- Current month usage
  usage_reset_date DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE),
  
  -- Key status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',
    'inactive', 
    'suspended',
    'expired'
  )),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT positive_limit CHECK (monthly_limit IS NULL OR monthly_limit > 0),
  CONSTRAINT positive_usage CHECK (current_usage >= 0),
  CONSTRAINT valid_reset_date CHECK (usage_reset_date IS NOT NULL)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_status ON user_api_keys(status);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_openrouter_id ON user_api_keys(openrouter_key_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_usage_reset ON user_api_keys(usage_reset_date);

-- Add comment
COMMENT ON TABLE user_api_keys IS 'Per-user OpenRouter API keys for cost attribution and usage tracking';

-- ========================================
-- API_USAGE_LOGS TABLE
-- ========================================
-- Detailed usage tracking for billing and analytics

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  api_key_id UUID REFERENCES user_api_keys(id) ON DELETE CASCADE NOT NULL,
  
  -- Request details
  model TEXT NOT NULL,  -- e.g., 'anthropic/claude-3.5-sonnet'
  request_tokens INTEGER NOT NULL DEFAULT 0,
  response_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  
  -- Cost information
  cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0.00,
  
  -- Request metadata
  endpoint TEXT,  -- e.g., '/api/v1/chat/completions'
  agent_name TEXT,  -- Which Formul8 agent made the request
  request_duration_ms INTEGER,  -- Response time
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT positive_tokens CHECK (
    request_tokens >= 0 AND 
    response_tokens >= 0 AND 
    total_tokens >= 0
  ),
  CONSTRAINT positive_cost CHECK (cost_usd >= 0)
);

-- Create indexes for analytics and billing
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_key_id ON api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_model ON api_usage_logs(model);
CREATE INDEX IF NOT EXISTS idx_api_usage_agent ON api_usage_logs(agent_name);

-- Add comment
COMMENT ON TABLE api_usage_logs IS 'Detailed API usage logs for billing, analytics, and monitoring';

-- ========================================
-- ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

-- ========================================
-- ROW LEVEL SECURITY POLICIES - USER_API_KEYS
-- ========================================

-- Users can view their own API keys
CREATE POLICY "Users can view their own API keys"
  ON user_api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own API keys (for settings like limits)
CREATE POLICY "Users can update their own API keys"
  ON user_api_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all API keys (for system operations)
CREATE POLICY "Service role can manage all API keys"
  ON user_api_keys
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ========================================
-- ROW LEVEL SECURITY POLICIES - API_USAGE_LOGS
-- ========================================

-- Users can view their own usage logs
CREATE POLICY "Users can view their own usage logs"
  ON api_usage_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all usage logs (for system operations)
CREATE POLICY "Service role can manage all usage logs"
  ON api_usage_logs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to get user's active API key
CREATE OR REPLACE FUNCTION get_user_api_key(user_uuid UUID)
RETURNS TABLE (
  api_key_id UUID,
  openrouter_key_id TEXT,
  key_name TEXT,
  monthly_limit DECIMAL(10,2),
  current_usage DECIMAL(10,2),
  usage_reset_date DATE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uak.id,
    uak.openrouter_key_id,
    uak.key_name,
    uak.monthly_limit,
    uak.current_usage,
    uak.usage_reset_date
  FROM user_api_keys uak
  WHERE uak.user_id = user_uuid
    AND uak.status = 'active'
  ORDER BY uak.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to check if user has exceeded monthly limit
CREATE OR REPLACE FUNCTION check_usage_limit(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_limit DECIMAL(10,2);
  user_usage DECIMAL(10,2);
BEGIN
  SELECT monthly_limit, current_usage
  INTO user_limit, user_usage
  FROM user_api_keys
  WHERE user_id = user_uuid
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no limit set, allow usage
  IF user_limit IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check if usage exceeds limit
  RETURN user_usage < user_limit;
END;
$$;

-- Function to reset monthly usage (run monthly)
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  UPDATE user_api_keys
  SET 
    current_usage = 0.00,
    usage_reset_date = DATE_TRUNC('month', CURRENT_DATE),
    updated_at = NOW()
  WHERE usage_reset_date < DATE_TRUNC('month', CURRENT_DATE);
  
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$;

-- Function to get user's monthly usage summary
CREATE OR REPLACE FUNCTION get_user_usage_summary(user_uuid UUID, month_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_requests BIGINT,
  total_tokens BIGINT,
  total_cost DECIMAL(10,2),
  model_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_requests,
    SUM(aul.total_tokens) as total_tokens,
    SUM(aul.cost_usd) as total_cost,
    jsonb_object_agg(
      aul.model, 
      jsonb_build_object(
        'requests', COUNT(*),
        'tokens', SUM(aul.total_tokens),
        'cost', SUM(aul.cost_usd)
      )
    ) as model_breakdown
  FROM api_usage_logs aul
  WHERE aul.user_id = user_uuid
    AND DATE_TRUNC('month', aul.created_at) = DATE_TRUNC('month', month_date);
END;
$$;

-- ========================================
-- TRIGGERS
-- ========================================

-- Function to update usage when new log is inserted
CREATE OR REPLACE FUNCTION update_user_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update current usage in user_api_keys
  UPDATE user_api_keys
  SET 
    current_usage = current_usage + NEW.cost_usd,
    last_used_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.api_key_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to update usage on log insertion
DROP TRIGGER IF EXISTS on_api_usage_log_insert ON api_usage_logs;
CREATE TRIGGER on_api_usage_log_insert
  AFTER INSERT ON api_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_user_usage();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger to update updated_at on user_api_keys
DROP TRIGGER IF EXISTS on_user_api_keys_updated ON user_api_keys;
CREATE TRIGGER on_user_api_keys_updated
  BEFORE UPDATE ON user_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Run these to verify the schema was created correctly

-- Check if tables exist
SELECT tablename, schemaname 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user_api_keys', 'api_usage_logs');

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('user_api_keys', 'api_usage_logs');

-- Check if functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_user_api_key', 'check_usage_limit', 'reset_monthly_usage', 'get_user_usage_summary');

