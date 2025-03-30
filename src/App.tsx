import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { MapContainerProps, TileLayerProps } from 'react-leaflet';
import styled from '@emotion/styled';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { database, PhotoMarker } from './supabase';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LIFETIME_HOURS = 24;

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

  &:active {
    transform: scale(0.95);
  }
`;

const StyledPopup = styled(Popup)`
  .leaflet-popup-content-wrapper {
    padding: 0;
    overflow: hidden;
    border-radius: 8px;
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
    z-index: 1;
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
  padding: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const notificationTimeout = useRef<number | undefined>(undefined);

  // Load markers from database and set up real-time subscription
  useEffect(() => {
    const loadMarkers = async () => {
      try {
        const data = await database.getMarkers();
        console.log('Initial markers loaded:', data);
        setMarkers(data || []);
      } catch (error) {
        console.error('Error loading markers:', error);
        setMarkers([]);
      }
    };

    loadMarkers();

    // Set up real-time subscription
    const subscription = database.subscribeToMarkers((payload) => {
      console.log('Received real-time update:', payload);
      
      if (payload.eventType === 'INSERT') {
        setMarkers(prev => {
          console.log('Adding new marker to state:', payload.new);
          return [...prev, payload.new];
        });
      } else if (payload.eventType === 'UPDATE') {
        setMarkers(prev => prev.map(marker => 
          marker.id === payload.new.id ? payload.new : marker
        ));
      } else if (payload.eventType === 'DELETE') {
        setMarkers(prev => prev.filter(marker => marker.id !== payload.old.id));
      }
    });

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up subscription');
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Get user location with Singapore as fallback
  useEffect(() => {
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
      }
    );
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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setIsCameraOpen(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const handleInitialsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 5).toUpperCase();
    setUserInitials(value);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) {
      console.error('Video reference not found');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      console.error('Could not get canvas context');
      return;
    }

    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const photoUrl = canvas.toDataURL('image/jpeg');
    console.log('Photo captured, getting location...');

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const newPosition: [number, number] = [position.coords.latitude, position.coords.longitude];
      console.log('Got position for new marker:', newPosition);
      
      const newMarker = {
        position: newPosition,
        photo_url: photoUrl,
        timestamp: Date.now(),
        likes: 0,
        dislikes: 0,
        created_by: userInitials || 'Anonymous',
        last_interaction: Date.now()
      };
      
      console.log('Saving new marker:', newMarker);
      const savedMarker = await database.addMarker(newMarker);
      console.log('Marker saved successfully:', savedMarker);
      
      stopCamera();
      showNotification('Photo added successfully!');
    } catch (error) {
      console.error('Error adding marker:', error);
      showNotification('Error adding photo');
    }
  };

  const handleLike = async (markerId: string) => {
    try {
      const marker = markers.find(m => m.id === markerId);
      if (!marker) return;

      const newTimestamp = marker.timestamp - (24 * 60 * 60 * 1000);
      await database.updateMarker(markerId, {
        likes: marker.likes + 1,
        timestamp: newTimestamp,
        last_interaction: Date.now()
      });
      
      setUserLikes(prev => prev + 1);
      showNotification('Photo liked! Time extended by 24 hours');
    } catch (error) {
      console.error('Error liking marker:', error);
      showNotification('Error liking photo');
    }
  };

  const handleDislike = async (markerId: string) => {
    if (userLikes <= userDislikes) {
      showNotification('You must like a photo before disliking');
      return;
    }

    try {
      const marker = markers.find(m => m.id === markerId);
      if (!marker) return;

      const newTimestamp = marker.timestamp + (24 * 60 * 60 * 1000);
      await database.updateMarker(markerId, {
        dislikes: marker.dislikes + 1,
        timestamp: newTimestamp,
        last_interaction: Date.now()
      });
      
      setUserDislikes(prev => prev + 1);
      showNotification('Photo disliked. Time reduced by 24 hours');
    } catch (error) {
      console.error('Error disliking marker:', error);
      showNotification('Error disliking photo');
    }
  };

  const calculateTimeRemaining = (timestamp: number): string => {
    const now = Date.now();
    const age = (now - timestamp) / (1000 * 60 * 60);
    const remaining = LIFETIME_HOURS - age;
    
    if (remaining <= 0) return 'Expired';
    
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
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  };

  const createCustomIcon = (initials: string) => {
    const divIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          position: relative;
          width: 25px;
          height: 41px;
          background-image: url('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        ">
          <div style="
            position: absolute;
            top: -25px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
            pointer-events: none;
          ">${initials}</div>
        </div>
      `,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [0, -41]
    });
    return divIcon;
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
          {markers.map((marker) => (
            <Marker 
              key={marker.id} 
              position={marker.position}
              icon={createCustomIcon(marker.created_by)}
            >
              <StyledPopup>
                <img 
                  src={marker.photo_url} 
                  alt="Captured photo" 
                  style={{ width: '100%', height: '200px', objectFit: 'cover' }}
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
                <InteractionButtons>
                  <InteractionButton onClick={() => handleLike(marker.id)}>
                    👍
                  </InteractionButton>
                  <InteractionButton 
                    onClick={() => handleDislike(marker.id)}
                    disabled={userLikes <= userDislikes}
                  >
                    👎
                  </InteractionButton>
                </InteractionButtons>
              </StyledPopup>
            </Marker>
          ))}
        </MapContainer>
      </MapWrapper>
      <AddButton onClick={startCamera}>+</AddButton>
      <CameraOverlay isVisible={isCameraOpen}>
        <CameraPreview 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
        />
        <CameraControls>
          <CameraButton onClick={stopCamera}>✕</CameraButton>
          <CameraButton onClick={capturePhoto}>📸</CameraButton>
        </CameraControls>
      </CameraOverlay>
    </AppContainer>
  );
}

export default App;
