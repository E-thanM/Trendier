-- Add unique constraint to trends.name for upsert operations
ALTER TABLE public.trends ADD CONSTRAINT trends_name_key UNIQUE (name);