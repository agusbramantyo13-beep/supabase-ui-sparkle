-- Update user_role enum to have owner and store_keeper roles
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'store_keeper';

-- Update existing cashier roles to store_keeper for clarity
UPDATE profiles SET role = 'store_keeper' WHERE role = 'cashier';