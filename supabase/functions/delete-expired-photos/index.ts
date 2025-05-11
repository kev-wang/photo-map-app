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
  // 7 days in ms
  const BASE_LIFESPAN_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Fetch all markers
  const { data: markers, error: fetchError } = await supabase
    .from('photo_markers')
    .select('*');
  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 })
  }
  if (!markers) {
    return new Response(JSON.stringify({ deleted: 0 }), { status: 200 })
  }

  // Find expired marker IDs
  const expiredIds = markers
    .filter((marker) => {
      const lifespanMs = BASE_LIFESPAN_MS + (marker.likes * BASE_LIFESPAN_MS) - (marker.dislikes * BASE_LIFESPAN_MS);
      const expiryTime = marker.timestamp + lifespanMs;
      return now > expiryTime;
    })
    .map((marker) => marker.id);

  if (expiredIds.length === 0) {
    return new Response(JSON.stringify({ deleted: 0 }), { status: 200 })
  }

  // Delete all expired markers
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
