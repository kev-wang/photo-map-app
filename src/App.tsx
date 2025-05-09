import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { MapContainerProps, TileLayerProps } from 'react-leaflet';
import styled from '@emotion/styled';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { database, PhotoMarker, testSupabaseConnection } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

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
`;

const MapWrapper = styled.div`
  height: 100%;
  width: 100%;
`;

const AddButton = styled.button`
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
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
    transform: translateX(-50%) scale(0.95);
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
  }

  .leaflet-popup-tip-container {
    margin-top: -1px;
  }
`;

const InitialsInput = styled.input`
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  padding: 8px 12px;
  border: 2px solid #007AFF;
  border-radius: 8px;
  font-size: 16px;
  width: 120px;
  text-align: center;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  color: #1a237e;

  &::placeholder {
    color: #999;
  }

  &:focus {
    outline: none;
    border-color: #0056b3;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
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

function App() {
  const [markers, setMarkers] = useState<PhotoMarker[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number]>([1.3521, 103.8198]); // Default to Singapore
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [notification, setNotification] = useState('');
  const [userLikes, setUserLikes] = useState<number>(0);
  const [userDislikes, setUserDislikes] = useState<number>(0);
  const [userInitials, setUserInitials] = useState<string>('');
  const [openPopupId, setOpenPopupId] = useState<string | null>(null);
  const [cardInteractions, setCardInteractions] = useState<Record<string, 'like' | 'dislike'>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const notificationTimeout = useRef<number | undefined>(undefined);
  const [isCapturing, setIsCapturing] = useState(false);

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
    const getLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
          console.log('Setting user location:', newLocation);
          setUserLocation(newLocation);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Default to Singapore coordinates
          setUserLocation([1.3521, 103.8198]);
        },
        { timeout: 5000, maximumAge: 0, enableHighAccuracy: true }
      );
    };

    getLocation();
  }, []);

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

  const handleInitialsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 5).toUpperCase();
    setUserInitials(value);
  };

  const capturePhoto = async () => {
    if (isCapturing) return; // Prevent multiple clicks
    
    setIsCapturing(true);
    console.log('Capture photo button clicked');
    
    if (!videoRef.current) {
      console.error('Video reference not found');
      showNotification('Error: Camera not initialized');
      setIsCapturing(false);
      return;
    }

    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      console.error('Video dimensions not available:', {
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      });
      showNotification('Error: Camera not ready');
      setIsCapturing(false);
      return;
    }

    try {
      console.log('Starting photo capture process...');
      const canvas = document.createElement('canvas');
      
      // Ensure canvas dimensions match video dimensions
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      console.log('Canvas created with dimensions:', { width: canvas.width, height: canvas.height });
      
      const context = canvas.getContext('2d');
      if (!context) {
        console.error('Could not get canvas context');
        showNotification('Error: Could not process photo');
        setIsCapturing(false);
        return;
      }

      // Draw the current video frame to the canvas
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      // Convert to blob first for better iOS compatibility
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/jpeg', 0.95);
      });
      
      // Convert blob to data URL
      const photoUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      
      console.log('Photo captured successfully, size:', photoUrl.length, 'bytes');

      console.log('Getting current location...');
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log('Location obtained:', pos.coords);
            resolve(pos);
          },
          (error) => {
            console.error('Geolocation error:', error);
            reject(error);
          },
          { timeout: 10000, maximumAge: 0, enableHighAccuracy: true }
        );
      });

      const newPosition: [number, number] = [position.coords.latitude, position.coords.longitude];
      console.log('Preparing marker data with position:', newPosition);
      
      const newMarker = {
        position: newPosition,
        photo_url: photoUrl,
        timestamp: Date.now(),
        likes: 0,
        dislikes: 0,
        created_by: userInitials || 'Anonymous',
        last_interaction: Date.now()
      };
      
      console.log('Attempting to save marker to database...');
      try {
        const savedMarker = await database.addMarker(newMarker);
        console.log('Marker saved successfully:', savedMarker);
        
        // Immediately add the new marker to the state
        if (savedMarker) {
          setMarkers(prev => [savedMarker, ...prev]);
          // Center the map on the new marker
          if (mapRef.current) {
            mapRef.current.setView(newPosition, mapRef.current.getZoom());
          }
        }
        
        stopCamera();
        showNotification('Photo added successfully!');
      } catch (dbError) {
        console.error('Database error in capturePhoto:', {
          error: dbError,
          message: dbError instanceof Error ? dbError.message : 'Unknown error',
          stack: dbError instanceof Error ? dbError.stack : undefined
        });
        showNotification('Error saving photo to database. Please try again.');
      }
    } catch (error) {
      console.error('Error in capturePhoto:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      if (error instanceof GeolocationPositionError) {
        console.error('Geolocation error details:', {
          code: error.code,
          message: error.message
        });
        showNotification('Error: Could not get location. Please enable location services.');
      } else {
        showNotification('Error adding photo. Please try again.');
      }
    } finally {
      // Reset capturing state after 2 seconds
      setTimeout(() => {
        setIsCapturing(false);
      }, 2000);
    }
  };

  const handleLike = async (markerId: string) => {
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

  const createCustomIcon = (initials: string, photoUrl: string) => {
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
              src="${photoUrl}" 
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

  return (
    <AppContainer>
      <InitialsInput
        type="text"
        placeholder="Display Initials"
        value={userInitials}
        onChange={handleInitialsChange}
        maxLength={5}
      />
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
                  icon={createCustomIcon(marker.created_by, marker.photo_url)}
                  eventHandlers={{
                    click: (e: { originalEvent: MouseEvent }) => {
                      e.originalEvent.stopPropagation();
                      console.log('Marker clicked:', marker.id);
                      setOpenPopupId(marker.id);
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
                          console.log('Popup removed for marker:', marker.id);
                          if (openPopupId === marker.id) {
                            setOpenPopupId(null);
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
                        <div style={{ position: 'relative' }}>
                          <img 
                            src={marker.photo_url} 
                            alt="Captured photo" 
                            style={{ 
                              width: '100%', 
                              height: '200px', 
                              objectFit: 'cover',
                              pointerEvents: 'none',
                              display: 'block',
                              borderTopLeftRadius: '8px',
                              borderTopRightRadius: '8px'
                            }}
                          />
                          <PhotoInfo>
                            <TimeRemaining>
                              {calculateTimeRemaining(marker.timestamp)}
                            </TimeRemaining>
                            <InteractionCounts>
                              <Count type="like">
                                👍 {marker.likes}
                              </Count>
                              <Count type="dislike">
                                👎 {marker.dislikes}
                              </Count>
                            </InteractionCounts>
                          </PhotoInfo>
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
      <AddButton onClick={startCamera}>+</AddButton>
      <CameraOverlay isVisible={isCameraOpen}>
        <CameraPreview 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          onLoadedMetadata={() => console.log('Video metadata loaded')}
          onCanPlay={() => console.log('Video can play')}
        />
        <CameraControls>
          <CameraButton 
            onClick={() => {
              console.log('Close button clicked');
              stopCamera();
            }}
          >
            ✕
          </CameraButton>
          <CameraButton 
            onClick={() => {
              console.log('Capture button clicked');
              capturePhoto();
            }}
            disabled={isCapturing}
          >
            📸
            <LoadingOverlay isVisible={isCapturing} />
          </CameraButton>
        </CameraControls>
      </CameraOverlay>
    </AppContainer>
  );
}

export default App;
