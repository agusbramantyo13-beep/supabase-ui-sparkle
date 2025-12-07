-- Add status column to purchase_sessions to track returns
ALTER TABLE public.purchase_sessions 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';

-- Add returned_at and returned_by columns for audit
ALTER TABLE public.purchase_sessions 
ADD COLUMN IF NOT EXISTS returned_at timestamp with time zone DEFAULT NULL;

ALTER TABLE public.purchase_sessions 
ADD COLUMN IF NOT EXISTS returned_by uuid DEFAULT NULL;