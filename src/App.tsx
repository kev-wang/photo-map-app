import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { MapContainerProps, TileLayerProps } from 'react-leaflet';
import styled from '@emotion/styled';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { database, PhotoMarker as BasePhotoMarker, testSupabaseConnection, supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { TermsAndConditions } from './TermsAndConditions';
import ReactGA from 'react-ga4';
import { FaPencilAlt } from 'react-icons/fa';

// Initialize Google Analytics with the provided Measurement ID
ReactGA.initialize('G-Z47SXMLQPL');

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LIFETIME_HOURS = 168;

const AppContainer = styled.div`
  height: 100vh;
  width: 100vw;
  position: relative;
  overflow: hidden;
`;

const MapWrapper = styled.div`
  height: 100%;
  width: 100%;
  flex: 1 1 auto;
`;

const AddButton = styled.button`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #007AFF;
  color: white;
  font-size: 24px;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;

  &:active {
    transform: scale(0.95);
  }
`;

const Notification = styled.div<{ isVisible: boolean }>`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #4CAF50;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 1500;
  opacity: ${props => props.isVisible ? 1 : 0};
  transition: opacity 0.3s ease;
  pointer-events: none;
`;

const CameraOverlay = styled.div<{ isVisible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: black;
  z-index: 2000;
  display: ${props => props.isVisible ? 'flex' : 'none'};
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const CameraPreview = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const CameraControls = styled.div`
  position: absolute;
  bottom: 40px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 20px;
`;

const CameraButton = styled.button`
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;

  &:active {
    transform: scale(0.95);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const LoadingOverlay = styled.div<{ isVisible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  display: ${props => props.isVisible ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  z-index: 1;

  &::after {
    content: '';
    width: 30px;
    height: 30px;
    border: 3px solid #007AFF;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const StyledPopup = styled(Popup)`
  .leaflet-popup-content-wrapper {
    padding: 0;
    overflow: hidden;
    border-radius: 8px;
    box-shadow: 0 3px 14px rgba(0,0,0,0.4);
  }

  .leaflet-popup-content {
    margin: 0;
    width: 220px !important;
  }

  .leaflet-popup-close-button {
    width: 30px !important;
    height: 30px !important;
    font-size: 20px !important;
    padding: 4px !important;
    color: white !important;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    z-index: 1001;
    background: rgba(0, 0, 0, 0.3) !important;
    border-radius: 50%;
    margin: 5px;
    position: absolute !important;
    top: 30px !important;
    right: 5px !important;
  }

  .leaflet-popup-tip-container {
    margin-top: -1px;
  }
`;

const PhotoInfo = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  padding: 6px 10px;
  background: rgba(40, 40, 40, 0.85);
  color: white;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 0 0 8px 0;
  z-index: 2;
  min-width: 120px;
  width: auto;
`;

const TimeRemaining = styled.span`
  color: #00ff9d;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
`;

const InteractionCounts = styled.div`
  display: flex;
  gap: 12px;
`;

const Count = styled.span<{ type: 'like' | 'dislike' }>`
  color: ${props => props.type === 'like' ? '#00ff9d' : '#ff4d4d'};
  display: flex;
  align-items: center;
  gap: 4px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
`;

const InteractionButtons = styled.div`
  display: flex;
  justify-content: space-around;
  padding: 8px;
  background: rgba(0, 0, 0, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const InteractionButton = styled.button<{ disabled?: boolean }>`
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.5 : 1};
  padding: 8px 16px;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.1);
  }
`;

const BlurredWrapper = styled.div<{ blurred: boolean }>`
  height: 100%;
  width: 100%;
  filter: ${({ blurred }) => (blurred ? 'blur(4px)' : 'none')};
  pointer-events: ${({ blurred }) => (blurred ? 'none' : 'auto')};
  transition: filter 0.3s ease;
  display: flex;
  flex-direction: column;
`;

const CreatedByLabel = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: #1a237e;
  background: rgba(255, 255, 255, 0.8);
  padding: 2px 6px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
`;

const PencilIcon = styled(FaPencilAlt)`
  margin-left: 4px;
  font-size: 10px;
  color: #007AFF;
  cursor: pointer;
  vertical-align: middle;
`;

const InlineInput = styled.input`
  font-size: 12px;
  font-weight: 500;
  color: #1a237e;
  background: rgba(255, 255, 255, 0.8);
  padding: 2px 6px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border: 1.5px solid #007AFF;
  width: 70px;
  outline: none;
`;

const CenteredAddButton = styled(AddButton)`
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  outline: none !important;
  box-shadow: none !important;
  &:focus,
  &:focus-visible {
    outline: none !important;
    box-shadow: 0 0 0 4px #007AFF55 !important;
  }
`;

const InitialsRow = styled.div`
  position: absolute;
  bottom: 100px;
  left: calc(50% + 50px);
  display: flex;
  align-items: center;
  z-index: 1000;
  gap: 8px;
  height: 60px;
  margin-top: 8px;
`;

const AsText = styled.span`
  margin-left: 16px;
  font-size: 12px;
  font-weight: bold;
  color: #007AFF;
`;

// Add thumbnail_url and views to PhotoMarker type for correct typing
type PhotoMarker = BasePhotoMarker & { thumbnail_url?: string; views?: number };

// Helper to generate a thumbnail from an image blob
async function generateThumbnail(blob: Blob, maxSize = 64): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context for thumbnail'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((thumbBlob) => {
        if (thumbBlob) {
          resolve(thumbBlob);
        } else {
          reject(new Error('Could not create thumbnail blob'));
        }
        URL.revokeObjectURL(url);
      }, 'image/jpeg', 0.7);
    };
    img.onerror = () => {
      reject(new Error('Could not load image for thumbnail'));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function App() {
  const [markers, setMarkers] = useState<PhotoMarker[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number]>([1.3521, 103.8198]); // Default to Singapore
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [notification, setNotification] = useState('');
  const [userLikes, setUserLikes] = useState<number>(0);
  const [userDislikes, setUserDislikes] = useState<number>(0);
  const [userInitials, setUserInitials] = useState<string>(() => {
    return localStorage.getItem('userInitials') || 'Anonymous';
  });
  const [editingInitials, setEditingInitials] = useState(false);
  const [openPopupId, setOpenPopupId] = useState<string | null>(null);
  const [cardInteractions, setCardInteractions] = useState<Record<string, 'like' | 'dislike'>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loadedPhotoUrls, setLoadedPhotoUrls] = useState<Record<string, string>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const notificationTimeout = useRef<number | undefined>(undefined);
  const [isCapturing, setIsCapturing] = useState(false);
  const markerRefs = useRef<Record<string, L.Marker>>({});

  // Track app load (pageview)
  useEffect(() => {
    ReactGA.send({ hitType: 'pageview', page: window.location.pathname + window.location.search });
  }, []);

  // Function to load markers
  const loadMarkers = async () => {
    console.log('Starting to load markers...');
    try {
      console.log('Attempting to fetch markers from database...');
      const data = await database.getMarkers();
      console.log('Database response:', data);
      if (data) {
        console.log('Number of markers loaded:', data.length);
        console.log('Markers data:', JSON.stringify(data, null, 2));
        setMarkers(data);
      } else {
        console.log('No markers data received from database');
        setMarkers([]);
      }
    } catch (error) {
      console.error('Error loading markers:', error);
      setMarkers([]);
    }
  };

  // Load markers from database and set up real-time subscription
  useEffect(() => {
    let subscription: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      try {
        // Test database connection first
        const isConnected = await testSupabaseConnection();
        if (!isConnected) {
          showNotification('Database connection error. Please refresh the page.');
          return;
        }

        // Set up real-time subscription first
        subscription = database.subscribeToMarkers((payload) => {
          console.log('Real-time update received:', payload);
          if (payload.eventType === 'INSERT') {
            setMarkers(prev => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setMarkers(prev => prev.map(marker => 
              marker.id === payload.new.id ? payload.new : marker
            ));
          } else if (payload.eventType === 'DELETE') {
            setMarkers(prev => prev.filter(marker => marker.id !== payload.old.id));
          }
        });

        // Then load initial markers
        await loadMarkers();
      } catch (error) {
        console.error('Error setting up subscription:', error);
        showNotification('Error connecting to database. Please refresh the page.');
      }
    };

    // Start loading immediately
    setupSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Get user location with Singapore as fallback
  useEffect(() => {
    let watchId: number | null = null;
    const getLocation = () => {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const newLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
            console.log('Updating user location:', newLocation);
            setUserLocation(newLocation);
          },
          (error) => {
            console.error('Error getting location:', error);
            // Default to Singapore coordinates
            setUserLocation([1.3521, 103.8198]);
          },
          {
            enableHighAccuracy: false, // less battery
            maximumAge: 60000, // accept cached positions up to 1 min old
            timeout: 10000 // wait up to 10s for a fix
          }
        );
      } else {
        // Default to Singapore coordinates
        setUserLocation([1.3521, 103.8198]);
      }
    };

    getLocation();

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Save initials to localStorage
  useEffect(() => {
    localStorage.setItem('userInitials', userInitials);
  }, [userInitials]);

  const showNotification = (message: string) => {
    setNotification(message);
    if (notificationTimeout.current) {
      window.clearTimeout(notificationTimeout.current);
    }
    notificationTimeout.current = window.setTimeout(() => {
      setNotification('');
    }, 3000);
  };

  const startCamera = async () => {
    ReactGA.event({ category: 'Photo', action: 'Start Camera' });
    try {
      console.log('Starting camera...');
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera stream obtained:', stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.playsInline = true;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.setAttribute('x5-playsinline', 'true');
        videoRef.current.setAttribute('x5-video-player-type', 'h5');
        videoRef.current.setAttribute('x5-video-player-fullscreen', 'false');
        videoRef.current.setAttribute('x5-video-orientation', 'portraint');
        
        // iOS Safari requires this to be called after setting srcObject
        await videoRef.current.play();
        
        streamRef.current = stream;
        console.log('Camera started successfully, video element updated');
      } else {
        console.error('Video reference not found');
      }
      setIsCameraOpen(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      showNotification('Error accessing camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    console.log('Camera stopped');
  };

  // Handler for editing initials
  const handleInitialsLabelClick = () => {
    setEditingInitials(true);
  };
  const handleInitialsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 5).toUpperCase();
    setUserInitials(value);
  };
  const handleInitialsInputBlur = () => {
    if (!userInitials.trim()) setUserInitials('Anonymous');
    setEditingInitials(false);
  };
  const handleInitialsInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (!userInitials.trim()) setUserInitials('Anonymous');
      setEditingInitials(false);
    }
  };

  const capturePhoto = async () => {
    ReactGA.event({ category: 'Photo', action: 'Capture Photo' });
    if (isCapturing) return; // Prevent multiple clicks
    setIsCapturing(true);
    
    try {
      if (!videoRef.current) {
        throw new Error('Camera not initialized');
      }
      if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
        throw new Error('Camera not ready');
      }

      // Capture full image
      const originalWidth = videoRef.current.videoWidth;
      const originalHeight = videoRef.current.videoHeight;
      const targetWidth = 440;
      const scale = targetWidth / originalWidth;
      const targetHeight = Math.round(originalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not process photo');
      }
      context.drawImage(videoRef.current, 0, 0, targetWidth, targetHeight);
      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Could not create photo blob')); }, 'image/jpeg', 0.7);
      });

      // Generate thumbnail
      const thumbBlob = await generateThumbnail(compressedBlob, 64);

      // Upload only the compressed image and thumbnail to Supabase Storage
      const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { error: photoError } = await supabase.storage.from('photos').upload(`full/${fileId}.jpg`, compressedBlob, { upsert: true });
      const { error: thumbError } = await supabase.storage.from('photos').upload(`thumb/${fileId}.jpg`, thumbBlob, { upsert: true });
      
      if (photoError || thumbError) {
        throw new Error('Error uploading photo');
      }

      const { data: fullUrlData } = supabase.storage.from('photos').getPublicUrl(`full/${fileId}.jpg`);
      const { data: thumbUrlData } = supabase.storage.from('photos').getPublicUrl(`thumb/${fileId}.jpg`);
      const photoUrl = fullUrlData.publicUrl;
      const thumbnailUrl = thumbUrlData.publicUrl;

      // Get location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 0, enableHighAccuracy: true });
      });

      const newPosition: [number, number] = [position.coords.latitude, position.coords.longitude];
      const newMarker = {
        position: newPosition,
        photo_url: photoUrl,
        thumbnail_url: thumbnailUrl,
        timestamp: Date.now(),
        likes: 0,
        dislikes: 0,
        created_by: userInitials || 'Anonymous',
        last_interaction: Date.now()
      };

      const savedMarker = await database.addMarker(newMarker);
      if (savedMarker) {
        setMarkers(prev => [savedMarker, ...prev]);
        if (mapRef.current) {
          mapRef.current.setView(newPosition, mapRef.current.getZoom());
        }
      }

      stopCamera();
      showNotification('Photo added successfully!');
    } catch (error) {
      console.error('Error capturing photo:', error);
      showNotification(error instanceof Error ? error.message : 'Error adding photo. Please try again.');
      stopCamera();
    } finally {
      setIsCapturing(false);
    }
  };

  const handleLike = async (markerId: string) => {
    ReactGA.event({ category: 'Photo', action: 'Like', label: markerId });
    // Check if user has already interacted with this card
    if (cardInteractions[markerId]) {
      showNotification('You have already interacted with this photo');
      return;
    }

    try {
      const marker = markers.find(m => m.id === markerId);
      if (!marker) return;

      // Optimistically update the UI
      setMarkers(prev => prev.map(m => 
        m.id === markerId 
          ? { ...m, likes: m.likes + 1 }
          : m
      ));
      
      setUserLikes(prev => prev + 1);
      // Track this interaction
      setCardInteractions(prev => ({
        ...prev,
        [markerId]: 'like'
      }));
      showNotification('Photo liked! Time extended by 168 hours');

      // Update database in background - FIXED: ADD 168 hours to extend life
      const newTimestamp = marker.timestamp + (168 * 60 * 60 * 1000);
      console.log('Updating marker timestamp:', {
        oldTimestamp: new Date(marker.timestamp).toLocaleString(),
        newTimestamp: new Date(newTimestamp).toLocaleString(),
        difference: '168 hours added'
      });
      
      await database.updateMarker(markerId, {
        likes: marker.likes + 1,
        timestamp: newTimestamp,
        last_interaction: Date.now()
      });
    } catch (error) {
      console.error('Error liking marker:', error);
      showNotification('Error liking photo');
      loadMarkers(); // Reload on error
    }
  };

  const handleDislike = async (markerId: string) => {
    ReactGA.event({ category: 'Photo', action: 'Dislike', label: markerId });
    // Check if user has already interacted with this card
    if (cardInteractions[markerId]) {
      showNotification('You have already interacted with this photo');
      return;
    }

    if (userLikes <= userDislikes) {
      showNotification('You must like a photo before disliking');
      return;
    }

    try {
      const marker = markers.find(m => m.id === markerId);
      if (!marker) return;

      // Optimistically update the UI
      setMarkers(prev => prev.map(m => 
        m.id === markerId 
          ? { ...m, dislikes: m.dislikes + 1 }
          : m
      ));

      setUserDislikes(prev => prev + 1);
      // Track this interaction
      setCardInteractions(prev => ({
        ...prev,
        [markerId]: 'dislike'
      }));
      showNotification('Photo disliked. Time reduced by 168 hours');

      // Update database in background - FIXED: SUBTRACT 168 hours to reduce life
      const newTimestamp = marker.timestamp - (168 * 60 * 60 * 1000);
      console.log('Updating marker timestamp:', {
        oldTimestamp: new Date(marker.timestamp).toLocaleString(),
        newTimestamp: new Date(newTimestamp).toLocaleString(),
        difference: '168 hours subtracted'
      });
      
      await database.updateMarker(markerId, {
        dislikes: marker.dislikes + 1,
        timestamp: newTimestamp,
        last_interaction: Date.now()
      });
    } catch (error) {
      console.error('Error disliking marker:', error);
      showNotification('Error disliking photo');
      loadMarkers(); // Reload on error
    }
  };

  // Function to check if a marker is expired
  const isMarkerExpired = (timestamp: number): boolean => {
    const now = Date.now();
    const age = (now - timestamp) / (1000 * 60 * 60);
    return age >= LIFETIME_HOURS;
  };

  const calculateTimeRemaining = (timestamp: number): string => {
    const now = Date.now();
    const age = (now - timestamp) / (1000 * 60 * 60);
    const remaining = LIFETIME_HOURS - age;
    
    const days = Math.floor(remaining / 24);
    const hours = Math.floor(remaining % 24);
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h`;
  };

  const mapProps: MapContainerProps & { ref?: (map: L.Map) => void } = {
    center: userLocation,
    zoom: 13,
    style: { height: '100%', width: '100%' },
    scrollWheelZoom: true,
    ref: (map: L.Map | null) => {
      if (map) {
        mapRef.current = map;
      }
    }
  };

  const tileProps: TileLayerProps = {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  };

  const createCustomIcon = (initials: string, thumbnailUrl: string) => {
    const divIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          position: relative;
          width: 40px;
          height: 56px;
          background-image: url('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        ">
          <div style="
            position: absolute;
            top: calc(50% - 9px);
            left: 50%;
            transform: translate(-50%, -50%);
            width: 32px;
            height: 32px;
            border-radius: 50%;
            overflow: hidden;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 1;
          ">
            <img 
              src="${thumbnailUrl}" 
              alt="Preview" 
              style="
                width: 100%;
                height: 100%;
                object-fit: cover;
              "
            />
          </div>
          <div style="
            position: absolute;
            bottom: -28px;
            left: 50%;
            transform: translateX(-50%);
            color: #1a237e;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            z-index: 1000;
            pointer-events: none;
            background: rgba(255, 255, 255, 0.8);
            padding: 2px 6px;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          ">${initials}</div>
        </div>
      `,
      iconSize: [40, 56],
      iconAnchor: [20, 56],
      popupAnchor: [0, -56]
    });
    return divIcon;
  };

  const createUserLocationIcon = () => {
    return L.divIcon({
      className: 'user-location-marker',
      html: `
        <div style="
          position: relative;
          width: 24px;
          height: 24px;
        ">
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 18px;
            height: 18px;
            background-color: #4285F4;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 0 2px #4285F4;
            animation: pulse 2s infinite;
          "></div>
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 6px;
            height: 6px;
            background-color: white;
            border-radius: 50%;
            z-index: 1;
          "></div>
          <style>
            @keyframes pulse {
              0% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
              }
              50% {
                transform: translate(-50%, -50%) scale(1.5);
                opacity: 0.5;
              }
              100% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
              }
            }
          </style>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  };

  const handleTermsAccept = () => {
    ReactGA.event({ category: 'T&C', action: 'Accept' });
    setTermsAccepted(true);
  };

  // Example: Track marker popup open/close
  const handleMarkerPopupOpen = async (markerId: string) => {
    console.log('Opening popup for marker:', markerId);
    ReactGA.event({ category: 'Photo', action: 'Open Popup', label: markerId });
    setOpenPopupId(markerId);
    
    // Load the full photo URL if not already loaded
    if (!loadedPhotoUrls[markerId]) {
      try {
        console.log('Loading full photo URL for marker:', markerId);
        const photoUrl = await database.getPhotoUrl(markerId);
        setLoadedPhotoUrls(prev => ({
          ...prev,
          [markerId]: photoUrl
        }));
      } catch (error) {
        console.error('Error loading photo URL:', error);
        showNotification('Error loading photo');
      }
    }

    // Increment views using the atomic RPC function
    try {
      console.log('Attempting to increment views for marker:', markerId);
      const newViews = await database.incrementViews(markerId);
      console.log('Successfully updated views in state:', newViews);
      setMarkers(prev => prev.map(m => m.id === markerId ? { ...m, views: newViews } : m));
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
  };
  const handleMarkerPopupClose = (markerId: string) => {
    ReactGA.event({ category: 'Marker', action: 'Popup Close', label: markerId });
  };

  useEffect(() => {
    if (openPopupId && markerRefs.current[openPopupId]) {
      markerRefs.current[openPopupId].openPopup();
    }
  }, [openPopupId]);

  return (
    <AppContainer>
      <BlurredWrapper blurred={!termsAccepted}>
        <Notification isVisible={!!notification}>
          {notification}
        </Notification>
        <MapWrapper>
          <MapContainer {...mapProps}>
            <TileLayer {...tileProps} />
            {userLocation && (
              <Marker
                position={userLocation}
                icon={createUserLocationIcon()}
              />
            )}
            {markers
              .filter(marker => !isMarkerExpired(marker.timestamp))
              .map((marker) => {
                const isOpen = openPopupId === marker.id;
                return (
                  <Marker 
                    key={marker.id}
                    position={marker.position}
                    icon={createCustomIcon(marker.created_by, marker.thumbnail_url || '')}
                    ref={(ref: L.Marker | null) => {
                      if (ref) {
                        markerRefs.current[marker.id] = ref;
                      } else {
                        delete markerRefs.current[marker.id];
                      }
                    }}
                    eventHandlers={{
                      click: (e: { originalEvent: MouseEvent }) => {
                        e.originalEvent.stopPropagation();
                        handleMarkerPopupOpen(marker.id);
                      }
                    }}
                  >
                    {isOpen && (
                      <StyledPopup
                        closeButton={true}
                        autoClose={false}
                        closeOnClick={false}
                        closeOnEscapeKey={false}
                        maxWidth={220}
                        minWidth={220}
                        keepInView={true}
                        className="custom-popup"
                        eventHandlers={{
                          remove: () => {
                            if (openPopupId === marker.id) {
                              setOpenPopupId(null);
                              handleMarkerPopupClose(marker.id);
                            }
                          }
                        }}
                      >
                        <div 
                          style={{ 
                            pointerEvents: 'auto',
                            position: 'relative',
                            zIndex: 1000,
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            overflow: 'hidden'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                        >
                          <PhotoInfo style={{ position: 'static', borderRadius: '8px 8px 0 0', marginBottom: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span role="img" aria-label="hourglass">⏳</span>
                              <TimeRemaining>{calculateTimeRemaining(marker.timestamp)}</TimeRemaining>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span role="img" aria-label="views">👁️</span>
                                <span>{marker.views ?? 0}</span>
                              </span>
                              <InteractionCounts>
                                <Count type="like">
                                  👍 {marker.likes}
                                </Count>
                                <Count type="dislike">
                                  👎 {marker.dislikes}
                                </Count>
                              </InteractionCounts>
                            </span>
                          </PhotoInfo>
                          <div style={{ position: 'relative' }}>
                            {loadedPhotoUrls[marker.id] ? (
                              <img 
                                src={loadedPhotoUrls[marker.id]} 
                                alt="Captured photo" 
                                style={{ 
                                  width: '100%', 
                                  height: '200px', 
                                  objectFit: 'cover',
                                  pointerEvents: 'none',
                                  display: 'block',
                                  borderTopLeftRadius: '0',
                                  borderTopRightRadius: '0'
                                }}
                              />
                            ) : (
                              <div style={{ 
                                width: '100%', 
                                height: '200px', 
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: '#f0f0f0',
                                borderTopLeftRadius: '0',
                                borderTopRightRadius: '0'
                              }}>
                                Loading...
                              </div>
                            )}
                          </div>
                          <InteractionButtons>
                            <InteractionButton 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDislike(marker.id);
                              }}
                              disabled={!!cardInteractions[marker.id] || userLikes <= userDislikes}
                            >
                              👎
                            </InteractionButton>
                            <InteractionButton 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLike(marker.id);
                              }}
                              disabled={!!cardInteractions[marker.id]}
                            >
                              👍
                            </InteractionButton>
                          </InteractionButtons>
                        </div>
                      </StyledPopup>
                    )}
                  </Marker>
                );
              })}
          </MapContainer>
        </MapWrapper>
        <CenteredAddButton onClick={startCamera}>+</CenteredAddButton>
        <InitialsRow>
          <AsText>as</AsText>
          {editingInitials ? (
            <InlineInput
              type="text"
              value={userInitials}
              autoFocus
              maxLength={5}
              onChange={handleInitialsInputChange}
              onBlur={handleInitialsInputBlur}
              onKeyDown={handleInitialsInputKeyDown}
            />
          ) : (
            <CreatedByLabel onClick={handleInitialsLabelClick} title="Click to edit your initials">
              {userInitials}
              <PencilIcon onClick={handleInitialsLabelClick} />
            </CreatedByLabel>
          )}
        </InitialsRow>
        <CameraOverlay isVisible={isCameraOpen}>
          <CameraPreview 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            onLoadedMetadata={() => {}}
            onCanPlay={() => {}}
          />
          <CameraControls>
            <CameraButton 
              onClick={() => {
                stopCamera();
              }}
            >
              ✕
            </CameraButton>
            <CameraButton 
              onClick={() => {
                capturePhoto();
              }}
              disabled={isCapturing}
            >
              📸
              <LoadingOverlay isVisible={isCapturing} />
            </CameraButton>
          </CameraControls>
        </CameraOverlay>
      </BlurredWrapper>
      {!termsAccepted && (
        <TermsAndConditions onAccept={handleTermsAccept} />
      )}
    </AppContainer>
  );
}

export default App;
