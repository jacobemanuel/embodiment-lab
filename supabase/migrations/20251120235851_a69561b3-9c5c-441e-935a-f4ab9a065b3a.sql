-- Add generated_images column to scenarios table for storing AI-generated images during the study
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS generated_images JSONB DEFAULT '{"images": []}'::jsonb;

-- Add a comment to document the structure
COMMENT ON COLUMN scenarios.generated_images IS 'Stores array of generated images with structure: {"images": [{"prompt": "...", "url": "...", "timestamp": 123456}]}';