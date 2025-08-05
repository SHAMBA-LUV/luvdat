-- SHAMBA LUV Backend Database Schema
-- PostgreSQL Database Schema for User Tracking & Airdrop Protection

-- Users table - tracks all wallet connections
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    auth_method VARCHAR(50) NOT NULL, -- 'google', 'email', 'facebook', etc.
    auth_identifier VARCHAR(255), -- email, google_id, etc.
    device_fingerprint TEXT,
    user_agent TEXT,
    screen_resolution VARCHAR(20),
    timezone VARCHAR(50),
    first_seen_ip INET NOT NULL,
    current_ip INET NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- IP Addresses table - tracks all IP usage
CREATE TABLE ip_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET UNIQUE NOT NULL,
    ip_hash VARCHAR(255) UNIQUE NOT NULL, -- hashed for privacy
    country_code VARCHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    is_vpn BOOLEAN DEFAULT FALSE,
    is_proxy BOOLEAN DEFAULT FALSE,
    risk_score INTEGER DEFAULT 0, -- 0-100 risk assessment
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_users INTEGER DEFAULT 0,
    is_banned BOOLEAN DEFAULT FALSE,
    banned_at TIMESTAMP WITH TIME ZONE,
    ban_reason TEXT
);

-- User IP History - tracks IP changes per user
CREATE TABLE user_ip_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    ip_hash VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    location_changed BOOLEAN DEFAULT FALSE,
    suspicious_change BOOLEAN DEFAULT FALSE
);

-- Airdrop Claims - tracks all airdrop attempts and claims
CREATE TABLE airdrop_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(42) NOT NULL,
    ip_address INET NOT NULL,
    ip_hash VARCHAR(255) NOT NULL,
    device_fingerprint TEXT,
    claim_amount DECIMAL(30,18) NOT NULL, -- supports large token amounts
    transaction_hash VARCHAR(66), -- blockchain tx hash
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'blocked'
    block_reason TEXT, -- reason if blocked
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Protection flags
    device_reuse_detected BOOLEAN DEFAULT FALSE,
    ip_reuse_detected BOOLEAN DEFAULT FALSE,
    vpn_detected BOOLEAN DEFAULT FALSE,
    suspicious_activity BOOLEAN DEFAULT FALSE
);

-- Authentication Events - detailed login tracking
CREATE TABLE auth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(42),
    auth_method VARCHAR(50) NOT NULL,
    auth_identifier VARCHAR(255),
    ip_address INET NOT NULL,
    device_fingerprint TEXT,
    user_agent TEXT,
    event_type VARCHAR(20) NOT NULL, -- 'login', 'wallet_creation', 'logout'
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Protection Rules - configurable anti-abuse rules
CREATE TABLE protection_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(100) UNIQUE NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'ip_limit', 'device_limit', 'rate_limit'
    rule_value INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suspicious Activity Log
CREATE TABLE suspicious_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET,
    activity_type VARCHAR(50) NOT NULL, -- 'multiple_wallets', 'rapid_claims', 'vpn_usage'
    severity VARCHAR(20) NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    description TEXT NOT NULL,
    metadata JSONB, -- additional data
    auto_detected BOOLEAN DEFAULT TRUE,
    reviewed BOOLEAN DEFAULT FALSE,
    reviewer_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_current_ip ON users(current_ip);
CREATE INDEX idx_users_auth_method ON users(auth_method);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_ip_addresses_ip_hash ON ip_addresses(ip_hash);
CREATE INDEX idx_ip_addresses_is_banned ON ip_addresses(is_banned);
CREATE INDEX idx_ip_addresses_risk_score ON ip_addresses(risk_score);

CREATE INDEX idx_user_ip_history_user_id ON user_ip_history(user_id);
CREATE INDEX idx_user_ip_history_changed_at ON user_ip_history(changed_at);

CREATE INDEX idx_airdrop_claims_user_id ON airdrop_claims(user_id);
CREATE INDEX idx_airdrop_claims_ip_hash ON airdrop_claims(ip_hash);
CREATE INDEX idx_airdrop_claims_status ON airdrop_claims(status);
CREATE INDEX idx_airdrop_claims_attempted_at ON airdrop_claims(attempted_at);

CREATE INDEX idx_auth_events_user_id ON auth_events(user_id);
CREATE INDEX idx_auth_events_ip_address ON auth_events(ip_address);
CREATE INDEX idx_auth_events_created_at ON auth_events(created_at);

CREATE INDEX idx_suspicious_activity_user_id ON suspicious_activity(user_id);
CREATE INDEX idx_suspicious_activity_severity ON suspicious_activity(severity);
CREATE INDEX idx_suspicious_activity_reviewed ON suspicious_activity(reviewed);

-- Insert default protection rules
INSERT INTO protection_rules (rule_name, rule_type, rule_value) VALUES
('max_claims_per_ip', 'ip_limit', 2),
('max_claims_per_device', 'device_limit', 2),
('min_time_between_claims', 'rate_limit', 3600), -- 1 hour in seconds
('max_wallets_per_ip_daily', 'ip_limit', 5),
('vpn_risk_threshold', 'risk_score', 70);

-- Triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_protection_rules_updated_at BEFORE UPDATE ON protection_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get IP claim count
CREATE OR REPLACE FUNCTION get_ip_claim_count(ip_hash_param VARCHAR(255))
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM airdrop_claims
        WHERE ip_hash = ip_hash_param
        AND status = 'completed'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can claim
CREATE OR REPLACE FUNCTION can_user_claim_airdrop(
    wallet_addr VARCHAR(42),
    ip_hash_param VARCHAR(255),
    device_fp TEXT
)
RETURNS TABLE(
    can_claim BOOLEAN,
    reason TEXT,
    risk_score INTEGER
) AS $$
DECLARE
    ip_claims INTEGER;
    device_claims INTEGER;
    user_already_claimed BOOLEAN;
    ip_banned BOOLEAN;
    calculated_risk INTEGER := 0;
BEGIN
    -- Check if wallet already claimed
    SELECT EXISTS(
        SELECT 1 FROM airdrop_claims 
        WHERE wallet_address = wallet_addr AND status = 'completed'
    ) INTO user_already_claimed;
    
    IF user_already_claimed THEN
        RETURN QUERY SELECT FALSE, 'Wallet already claimed airdrop', 0;
        RETURN;
    END IF;
    
    -- Check if IP is banned
    SELECT is_banned INTO ip_banned
    FROM ip_addresses
    WHERE ip_hash = ip_hash_param;
    
    IF ip_banned THEN
        RETURN QUERY SELECT FALSE, 'IP address is banned', 100;
        RETURN;
    END IF;
    
    -- Get IP claim count
    SELECT get_ip_claim_count(ip_hash_param) INTO ip_claims;
    
    -- Get device claim count
    SELECT COUNT(*) INTO device_claims
    FROM airdrop_claims
    WHERE device_fingerprint = device_fp AND status = 'completed';
    
    -- Calculate risk score
    calculated_risk := ip_claims * 30 + device_claims * 25;
    
    -- Check limits
    IF ip_claims >= 2 THEN
        RETURN QUERY SELECT FALSE, 'IP address has reached maximum claims', calculated_risk;
        RETURN;
    END IF;
    
    IF device_claims >= 2 THEN
        RETURN QUERY SELECT FALSE, 'Device has reached maximum claims', calculated_risk;
        RETURN;
    END IF;
    
    -- All checks passed
    RETURN QUERY SELECT TRUE, 'Claim allowed', calculated_risk;
END;
$$ LANGUAGE plpgsql;