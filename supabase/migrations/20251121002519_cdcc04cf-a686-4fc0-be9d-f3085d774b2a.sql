-- Rename tax_experience column to digital_experience in demographics table
ALTER TABLE public.demographics 
RENAME COLUMN tax_experience TO digital_experience;