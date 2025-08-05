-- 003_create_functions.sql
-- Database functions for SHAMBA LUV protection system

-- Function to update timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_protection_rules_updated_at ON protection_rules;
CREATE TRIGGER update_protection_rules_updated_at 
    BEFORE UPDATE ON protection_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get IP claim count
CREATE OR REPLACE FUNCTION get_ip_claim_count(ip_hash_param VARCHAR(255))
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM airdrop_claims
        WHERE ip_hash = ip_hash_param
        AND status = 'completed'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get device claim count
CREATE OR REPLACE FUNCTION get_device_claim_count(device_fp TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM airdrop_claims
        WHERE device_fingerprint = device_fp
        AND status = 'completed'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can claim airdrop
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
    max_ip_claims INTEGER := 2;
    max_device_claims INTEGER := 2;
BEGIN
    -- Get configurable limits from protection_rules
    SELECT rule_value INTO max_ip_claims
    FROM protection_rules
    WHERE rule_name = 'max_claims_per_ip' AND is_active = true;
    
    SELECT rule_value INTO max_device_claims
    FROM protection_rules
    WHERE rule_name = 'max_claims_per_device' AND is_active = true;
    
    -- Use defaults if not configured
    max_ip_claims := COALESCE(max_ip_claims, 2);
    max_device_claims := COALESCE(max_device_claims, 2);
    
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
    SELECT COALESCE(is_banned, FALSE) INTO ip_banned
    FROM ip_addresses
    WHERE ip_hash = ip_hash_param;
    
    IF ip_banned THEN
        RETURN QUERY SELECT FALSE, 'IP address is banned', 100;
        RETURN;
    END IF;
    
    -- Get claim counts
    SELECT get_ip_claim_count(ip_hash_param) INTO ip_claims;
    SELECT get_device_claim_count(device_fp) INTO device_claims;
    
    -- Calculate risk score
    calculated_risk := (ip_claims * 30) + (device_claims * 25);
    
    -- Add risk if IP has high risk score
    SELECT COALESCE(risk_score, 0) INTO calculated_risk
    FROM ip_addresses
    WHERE ip_hash = ip_hash_param;
    
    -- Check limits
    IF ip_claims >= max_ip_claims THEN
        RETURN QUERY SELECT FALSE, 
            format('IP address has reached maximum claims (%s/%s)', ip_claims, max_ip_claims), 
            calculated_risk;
        RETURN;
    END IF;
    
    IF device_claims >= max_device_claims THEN
        RETURN QUERY SELECT FALSE, 
            format('Device has reached maximum claims (%s/%s)', device_claims, max_device_claims), 
            calculated_risk;
        RETURN;
    END IF;
    
    -- All checks passed
    RETURN QUERY SELECT TRUE, 'Claim allowed', calculated_risk;
END;
$$ LANGUAGE plpgsql;

-- Function to get user statistics
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS TABLE(
    total_users INTEGER,
    new_users_today INTEGER,
    active_users_today INTEGER,
    total_claims INTEGER,
    successful_claims INTEGER,
    blocked_claims INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM users) as total_users,
        (SELECT COUNT(*)::INTEGER FROM users WHERE created_at > CURRENT_DATE) as new_users_today,
        (SELECT COUNT(DISTINCT user_id)::INTEGER FROM auth_events WHERE created_at > CURRENT_DATE) as active_users_today,
        (SELECT COUNT(*)::INTEGER FROM airdrop_claims) as total_claims,
        (SELECT COUNT(*)::INTEGER FROM airdrop_claims WHERE status = 'completed') as successful_claims,
        (SELECT COUNT(*)::INTEGER FROM airdrop_claims WHERE status = 'blocked') as blocked_claims;
END;
$$ LANGUAGE plpgsql;

-- Function to get IP risk assessment
CREATE OR REPLACE FUNCTION assess_ip_risk(ip_hash_param VARCHAR(255))
RETURNS TABLE(
    risk_level TEXT,
    risk_score INTEGER,
    total_claims INTEGER,
    is_banned BOOLEAN,
    is_vpn BOOLEAN,
    country_code VARCHAR(2)
) AS $$
DECLARE
    claims_count INTEGER;
    ip_risk INTEGER;
    ip_banned BOOLEAN;
    vpn_detected BOOLEAN;
    country VARCHAR(2);
BEGIN
    -- Get IP information
    SELECT 
        COALESCE(ia.risk_score, 0),
        COALESCE(ia.is_banned, FALSE),
        COALESCE(ia.is_vpn, FALSE),
        ia.country_code
    INTO ip_risk, ip_banned, vpn_detected, country
    FROM ip_addresses ia
    WHERE ia.ip_hash = ip_hash_param;
    
    -- Get claim count for this IP
    SELECT get_ip_claim_count(ip_hash_param) INTO claims_count;
    
    -- Calculate final risk score
    ip_risk := COALESCE(ip_risk, 0) + (claims_count * 20);
    
    -- Determine risk level
    RETURN QUERY SELECT 
        CASE 
            WHEN ip_banned THEN 'BANNED'
            WHEN ip_risk > 80 THEN 'CRITICAL'
            WHEN ip_risk > 60 THEN 'HIGH'
            WHEN ip_risk > 30 THEN 'MEDIUM'
            ELSE 'LOW'
        END as risk_level,
        ip_risk,
        claims_count,
        ip_banned,
        vpn_detected,
        country;
END;
$$ LANGUAGE plpgsql;