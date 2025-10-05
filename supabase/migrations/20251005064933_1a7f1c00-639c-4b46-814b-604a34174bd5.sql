-- Create attendance table
CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  check_in_time timestamp with time zone NOT NULL DEFAULT now(),
  check_out_time timestamp with time zone,
  selfie_url text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own attendance"
  ON public.attendance
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attendance"
  ON public.attendance
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendance"
  ON public.attendance
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Owners can view all attendance
CREATE POLICY "Owners can view all attendance"
  ON public.attendance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'owner'
    )
  );

-- Create storage bucket for selfies
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-selfies', 'attendance-selfies', false);

-- Storage policies for selfies
CREATE POLICY "Users can upload their own selfies"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'attendance-selfies' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own selfies"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'attendance-selfies' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners can view all selfies"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'attendance-selfies'
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'owner'
    )
  );