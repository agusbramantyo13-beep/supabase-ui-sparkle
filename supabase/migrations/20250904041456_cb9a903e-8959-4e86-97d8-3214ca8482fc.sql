-- First, add the new enum value
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'store_keeper';

-- We'll update the profiles in a separate transaction later
COMMIT;

-- Start new transaction and update existing data
BEGIN;

-- Update existing cashier roles to store_keeper
UPDATE profiles SET role = 'store_keeper'::user_role WHERE role = 'cashier'::user_role;