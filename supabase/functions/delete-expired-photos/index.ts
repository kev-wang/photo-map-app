// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Supabase Edge Function: Delete expired photos
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

// Environment variables are automatically injected by Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

console.log("Hello from Functions!")

Deno.serve(async (_req) => {
  // 1. Fetch expired markers based on expires_at
  const nowIso = new Date().toISOString();
  const { data: expiredMarkers, error: fetchError } = await supabase
    .from('photo_markers')
    .select('id,photo_url,thumbnail_url')
    .not('expires_at', 'is', null)
    .lt('expires_at', nowIso);
  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 })
  }
  if (!expiredMarkers || expiredMarkers.length === 0) {
    return new Response(JSON.stringify({ deleted: 0 }), { status: 200 })
  }

  // 2. Delete files from Storage
  for (const marker of expiredMarkers) {
    // Remove full image
    if (marker.photo_url && marker.photo_url.includes('/full/')) {
      const fullPath = marker.photo_url.split('/full/')[1];
      if (fullPath) {
        await supabase.storage.from('photos').remove([`full/${fullPath}`]);
      }
    }
    // Remove thumbnail
    if (marker.thumbnail_url && marker.thumbnail_url.includes('/thumb/')) {
      const thumbPath = marker.thumbnail_url.split('/thumb/')[1];
      if (thumbPath) {
        await supabase.storage.from('photos').remove([`thumb/${thumbPath}`]);
      }
    }
  }

  // 3. Delete all expired markers from DB
  const expiredIds = expiredMarkers.map((marker) => marker.id);
  const { error: deleteError } = await supabase
    .from('photo_markers')
    .delete()
    .in('id', expiredIds);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ deleted: expiredIds.length }), { status: 200 })
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/delete-expired-photos' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
