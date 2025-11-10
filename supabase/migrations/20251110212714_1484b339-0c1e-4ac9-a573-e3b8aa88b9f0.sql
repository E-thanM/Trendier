-- Update existing ratings from 0-10 scale to 0-100 scale
-- Only update ratings that are 10 or less (old scale)
UPDATE public.outfits
SET rating = rating * 10
WHERE rating IS NOT NULL AND rating <= 10;