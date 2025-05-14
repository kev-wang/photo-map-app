import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

// In Vite, we use import.meta.env instead of process.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials:', { supabaseUrl, supabaseAnonKey });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Test the connection
export const testSupabaseConnection = async () => {
  const { error } = await supabase.from('photo_markers').select('count');
  if (error) {
    console.error('Supabase connection error:', error);
    return false;
  }
  console.log('Supabase connected successfully');
  return true;
};

export interface PhotoMarker {
  id: string;
  position: [number, number];
  photo_url?: string;
  timestamp: number;
  likes: number;
  dislikes: number;
  created_by: string;
  last_interaction: number;
  thumbnail_url?: string;
  views?: number;
}

export const database = {
  // Get all active markers
  getMarkers: async () => {
    console.log('Executing getMarkers query...');
    const { data, error } = await supabase
      .from('photo_markers')
      .select('id,position,created_by,timestamp,likes,dislikes,last_interaction,thumbnail_url,views')
      .order('timestamp', { ascending: false })
      .limit(100); // Limit to 100 markers to prevent overloading

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }
    console.log('Query successful, markers found:', data?.length || 0);
    return data;
  },

  // Get full photo URL for a specific marker
  getPhotoUrl: async (markerId: string) => {
    const { data, error } = await supabase
      .from('photo_markers')
      .select('photo_url')
      .eq('id', markerId)
      .single();

    if (error) {
      console.error('Error fetching photo URL:', error);
      throw error;
    }
    return data.photo_url;
  },

  // Add a new marker
  addMarker: async (marker: Omit<PhotoMarker, 'id'>) => {
    const { data, error } = await supabase
      .from('photo_markers')
      .insert([marker])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update a marker (for likes/dislikes)
  updateMarker: async (id: string, updates: Partial<PhotoMarker>) => {
    const { data, error } = await supabase
      .from('photo_markers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Subscribe to marker changes
  subscribeToMarkers: (callback: (payload: any) => void): RealtimeChannel => {
    const channel = supabase.channel('photo_markers_changes');
    
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'photo_markers'
        },
        (payload) => {
          console.log('New marker inserted:', payload);
          callback({ eventType: 'INSERT', new: payload.new });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'photo_markers'
        },
        (payload) => {
          console.log('Marker updated:', payload);
          callback({ eventType: 'UPDATE', new: payload.new });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'photo_markers'
        },
        (payload) => {
          console.log('Marker deleted:', payload);
          callback({ eventType: 'DELETE', old: payload.old });
        }
      );

    channel.subscribe((status) => {
      console.log('Subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to real-time changes');
      } else if (status === 'CLOSED') {
        console.log('Subscription closed');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Error in real-time subscription');
      }
    });

    return channel;
  },

  // Increment views for a marker using the atomic RPC function
  incrementViews: async (markerId: string) => {
    console.log('Incrementing views for marker:', markerId);
    const { data, error } = await supabase
      .rpc('increment_photo_marker_views', { marker_id: markerId });

    if (error) {
      console.error('Error in increment_photo_marker_views RPC:', error);
      throw error;
    }
    console.log('Views incremented successfully. New count:', data);
    return data;
  }
}; 