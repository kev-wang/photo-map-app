const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const sharp = require('sharp');

// Set these from your environment or hardcode for quick test
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ehajqagstgzdjjxgkwjc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoYWpxYWdzdGd6ZGpqeGdrd2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzM0NjAxOSwiZXhwIjoyMDU4OTIyMDE5fQ.Y7WitFYY6kxSp10pV7qUv8hcoX0fGUzHaOLF8Tw4_tU';
const storageBucket = 'photos';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
async function migrateThumbnails() {
  // 1. Fetch all markers missing a thumbnail_url
  const { data: markers, error } = await supabase
    .from('photo_markers')
    .select('id,photo_url,thumbnail_url')
    .is('thumbnail_url', null);

  if (error) {
    console.error('Error fetching markers:', error);
    return;
  }
  if (!markers.length) {
    console.log('No markers to migrate!');
    return;
  }

  for (const marker of markers) {
    if (!marker.photo_url) continue;
    try {
      // 2. Download the full image
      let buffer;
if (marker.photo_url.startsWith('data:')) {
  // Handle base64 data URL
  const base64Data = marker.photo_url.split(',')[1];
  buffer = Buffer.from(base64Data, 'base64');
} else {
  // Handle HTTP(S) URL
  const response = await fetch(marker.photo_url);
  if (!response.ok) throw new Error('Failed to download image');
  buffer = await response.buffer();
}

      // 3. Generate thumbnail (64x64)
      const thumbBuffer = await sharp(buffer)
        .resize(64, 64, { fit: 'inside' })
        .jpeg({ quality: 70 })
        .toBuffer();

      // 4. Upload thumbnail to Supabase Storage
      const fileId = `${marker.id}-thumb.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(`thumb/${fileId}`, thumbBuffer, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      // 5. Get public URL
      const { data: urlData } = supabase.storage.from(storageBucket).getPublicUrl(`thumb/${fileId}`);
      const thumbnailUrl = urlData.publicUrl;

      // 6. Update marker in DB
      const { error: updateError } = await supabase
        .from('photo_markers')
        .update({ thumbnail_url: thumbnailUrl })
        .eq('id', marker.id);

      if (updateError) throw updateError;

      console.log(`Migrated marker ${marker.id}`);
    } catch (err) {
      console.error(`Failed to migrate marker ${marker.id}:`, err);
    }
  }
  console.log('Migration complete!');
}

migrateThumbnails();