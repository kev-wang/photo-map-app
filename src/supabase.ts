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
  photo_url: string;
  timestamp: number;
  likes: number;
  dislikes: number;
  created_by: string;
  last_interaction: number;
}

export const database = {
  // Get all active markers
  getMarkers: async () => {
    console.log('Executing getMarkers query...');
    const { data, error } = await supabase
      .from('photo_markers')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100); // Limit to 100 markers to prevent overloading

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }
    console.log('Query successful, markers found:', data?.length || 0);
    return data;
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

  // Delete expired markers
  deleteExpiredMarkers: async () => {
    const LIFETIME_HOURS = 24;
    const currentTime = Date.now();
    const expirationTime = currentTime - (LIFETIME_HOURS * 60 * 60 * 1000);

    const { error } = await supabase
      .from('photo_markers')
      .delete()
      .lt('timestamp', expirationTime);

    if (error) throw error;
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
  }
}; 