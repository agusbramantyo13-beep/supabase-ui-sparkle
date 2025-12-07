-- Add status column to sales to track returns
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';

-- Add returned_at and returned_by columns for audit
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS returned_at timestamp with time zone DEFAULT NULL;

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS returned_by uuid DEFAULT NULL;