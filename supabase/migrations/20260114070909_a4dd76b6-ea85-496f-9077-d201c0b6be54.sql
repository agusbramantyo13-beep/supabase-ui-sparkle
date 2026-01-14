-- Delete the incorrect profile with wrong ID
DELETE FROM public.profiles 
WHERE id = '76518da5-e88e-48f3-a18c-c22f07f160b2' 
AND email = 'maratus.ratu005@gmail.com';

-- Create correct profile with proper auth.users ID
INSERT INTO public.profiles (id, email, name, role, created_at)
VALUES (
  '7f105a93-c653-403c-94cd-305b51d3e427',
  'maratus.ratu005@gmail.com',
  'ratu',
  'store_keeper',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role;