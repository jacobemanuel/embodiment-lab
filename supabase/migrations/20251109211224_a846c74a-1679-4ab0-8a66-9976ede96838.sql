-- Rename ai_experience column to tax_experience in demographics table
ALTER TABLE public.demographics 
RENAME COLUMN ai_experience TO tax_experience;