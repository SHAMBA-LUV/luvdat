-- 004_insert_default_data.sql
-- Default configuration data for SHAMBA LUV protection system

-- Insert default protection rules
INSERT INTO protection_rules (rule_name, rule_type, rule_value, is_active) VALUES
('max_claims_per_ip', 'ip_limit', 2, true),
('max_claims_per_device', 'device_limit', 2, true),
('min_time_between_claims', 'rate_limit', 3600, true), -- 1 hour in seconds
('max_wallets_per_ip_daily', 'ip_limit', 5, true),
('vpn_risk_threshold', 'risk_score', 70, true),
('max_daily_registrations_per_ip', 'ip_limit', 10, true),
('suspicious_activity_threshold', 'risk_score', 50, true)
ON CONFLICT (rule_name) DO NOTHING;

-- Insert some example suspicious activity patterns for reference
INSERT INTO suspicious_activity (
    ip_address, 
    activity_type, 
    severity, 
    description, 
    auto_detected,
    reviewed
) VALUES
(
    '127.0.0.1'::INET,
    'system_test',
    'low',
    'System initialization test record - can be safely ignored',
    false,
    true
)
ON CONFLICT DO NOTHING;