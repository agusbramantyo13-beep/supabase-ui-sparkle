-- Create members table
CREATE TABLE public.members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  date_of_birth date,
  member_code text UNIQUE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  points integer DEFAULT 0,
  total_purchases numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Members: read all" 
ON public.members 
FOR SELECT 
USING (true);

CREATE POLICY "Members: insert all" 
ON public.members 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Members: update all" 
ON public.members 
FOR UPDATE 
USING (true);

CREATE POLICY "Members: delete all" 
ON public.members 
FOR DELETE 
USING (true);

-- Create function to generate member code
CREATE OR REPLACE FUNCTION public.generate_member_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code text;
  counter int := 1;
BEGIN
  LOOP
    new_code := 'MBR' || LPAD(counter::text, 6, '0');
    
    -- Check if this code already exists
    IF NOT EXISTS (SELECT 1 FROM public.members WHERE member_code = new_code) THEN
      RETURN new_code;
    END IF;
    
    counter := counter + 1;
  END LOOP;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-generate member code
CREATE OR REPLACE FUNCTION public.set_member_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.member_code IS NULL OR NEW.member_code = '' THEN
    NEW.member_code := public.generate_member_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_member_code_trigger
  BEFORE INSERT ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_member_code();