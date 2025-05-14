-- Add a views column to track the number of times a photo popup is opened
ALTER TABLE photo_markers ADD COLUMN views integer NOT NULL DEFAULT 0;
