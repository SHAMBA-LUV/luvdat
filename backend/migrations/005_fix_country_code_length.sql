-- 005_fix_country_code_length.sql
-- Fix country_code column length to accommodate longer country codes

ALTER TABLE ip_addresses 
ALTER COLUMN country_code TYPE VARCHAR(10);

-- Update any existing data (if any)
-- This migration is safe to run multiple times