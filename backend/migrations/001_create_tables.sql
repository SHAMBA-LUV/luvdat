-- 001_create_tables.sql
-- Initial database schema for SHAMBA LUV user tracking and airdrop protection

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - tracks all wallet connections
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE IF NOT EXISTS ip_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE IF NOT EXISTS user_ip_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    ip_hash VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    location_changed BOOLEAN DEFAULT FALSE,
    suspicious_change BOOLEAN DEFAULT FALSE
);

-- Airdrop Claims - tracks all airdrop attempts and claims
CREATE TABLE IF NOT EXISTS airdrop_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE IF NOT EXISTS auth_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE IF NOT EXISTS protection_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_name VARCHAR(100) UNIQUE NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'ip_limit', 'device_limit', 'rate_limit'
    rule_value INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suspicious Activity Log
CREATE TABLE IF NOT EXISTS suspicious_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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