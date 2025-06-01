-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    user_initials TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    likes INTEGER DEFAULT 0 NOT NULL,
    dislikes INTEGER DEFAULT 0 NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS comments_photo_id_idx ON comments(photo_id);
CREATE INDEX IF NOT EXISTS comments_created_at_idx ON comments(created_at DESC);

-- Enable Row Level Security
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read comments
CREATE POLICY "Allow anyone to read comments" ON comments
    FOR SELECT USING (true);

-- Create policy to allow anyone to insert comments
CREATE POLICY "Allow anyone to insert comments" ON comments
    FOR INSERT WITH CHECK (true);

-- Create policy to allow anyone to update likes/dislikes
CREATE POLICY "Allow anyone to update likes/dislikes" ON comments
    FOR UPDATE USING (true)
    WITH CHECK (true);
