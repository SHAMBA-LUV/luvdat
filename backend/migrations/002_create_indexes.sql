-- 002_create_indexes.sql
-- Performance indexes for the SHAMBA LUV database

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_current_ip ON users(current_ip);
CREATE INDEX IF NOT EXISTS idx_users_auth_method ON users(auth_method);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_device_fingerprint ON users(device_fingerprint);

-- Indexes for ip_addresses table
CREATE INDEX IF NOT EXISTS idx_ip_addresses_ip_hash ON ip_addresses(ip_hash);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_is_banned ON ip_addresses(is_banned);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_risk_score ON ip_addresses(risk_score);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_country_code ON ip_addresses(country_code);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_is_vpn ON ip_addresses(is_vpn);

-- Indexes for user_ip_history table
CREATE INDEX IF NOT EXISTS idx_user_ip_history_user_id ON user_ip_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ip_history_changed_at ON user_ip_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_user_ip_history_ip_hash ON user_ip_history(ip_hash);
CREATE INDEX IF NOT EXISTS idx_user_ip_history_suspicious ON user_ip_history(suspicious_change);

-- Indexes for airdrop_claims table
CREATE INDEX IF NOT EXISTS idx_airdrop_claims_user_id ON airdrop_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_airdrop_claims_wallet_address ON airdrop_claims(wallet_address);
CREATE INDEX IF NOT EXISTS idx_airdrop_claims_ip_hash ON airdrop_claims(ip_hash);
CREATE INDEX IF NOT EXISTS idx_airdrop_claims_status ON airdrop_claims(status);
CREATE INDEX IF NOT EXISTS idx_airdrop_claims_attempted_at ON airdrop_claims(attempted_at);
CREATE INDEX IF NOT EXISTS idx_airdrop_claims_device_fingerprint ON airdrop_claims(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_airdrop_claims_suspicious ON airdrop_claims(suspicious_activity);

-- Indexes for auth_events table
CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_wallet_address ON auth_events(wallet_address);
CREATE INDEX IF NOT EXISTS idx_auth_events_ip_address ON auth_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_events_created_at ON auth_events(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_events_auth_method ON auth_events(auth_method);
CREATE INDEX IF NOT EXISTS idx_auth_events_event_type ON auth_events(event_type);

-- Indexes for protection_rules table
CREATE INDEX IF NOT EXISTS idx_protection_rules_rule_type ON protection_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_protection_rules_is_active ON protection_rules(is_active);

-- Indexes for suspicious_activity table
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_user_id ON suspicious_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_ip_address ON suspicious_activity(ip_address);
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_severity ON suspicious_activity(severity);
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_reviewed ON suspicious_activity(reviewed);
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_created_at ON suspicious_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_activity_type ON suspicious_activity(activity_type);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_airdrop_claims_status_attempted ON airdrop_claims(status, attempted_at);
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_severity_reviewed ON suspicious_activity(severity, reviewed);
CREATE INDEX IF NOT EXISTS idx_users_auth_method_created ON users(auth_method, created_at);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_risk_banned ON ip_addresses(risk_score, is_banned);