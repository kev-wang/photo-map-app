import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { MapContainerProps, TileLayerProps } from 'react-leaflet';
import styled from '@emotion/styled';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface PhotoMarker {
  id: string;
  position: [number, number];
  photoUrl: string;
  timestamp: number;
}

const STORAGE_KEY = 'photo-map-markers';

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

function App() {
  const [markers, setMarkers] = useState<PhotoMarker[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number]>([35.6762, 139.6503]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [notification, setNotification] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const notificationTimeout = useRef<number | undefined>(undefined);

  // Load markers from local storage
  useEffect(() => {
    const savedMarkers = localStorage.getItem(STORAGE_KEY);
    if (savedMarkers) {
      try {
        const parsed = JSON.parse(savedMarkers);
        console.log('Loaded markers from storage:', parsed);
        setMarkers(parsed);
      } catch (error) {
        console.error('Error loading markers:', error);
      }
    }
  }, []);

  // Save markers to local storage whenever they change
  useEffect(() => {
    if (markers.length > 0) {
      console.log('Saving markers to storage:', markers);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(markers));
    }
  }, [markers]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
        console.log('Setting user location:', newLocation);
        setUserLocation(newLocation);
      },
      (error) => {
        console.error('Error getting location:', error);
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

  const capturePhoto = () => {
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

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newPosition: [number, number] = [position.coords.latitude, position.coords.longitude];
        console.log('Got position for new marker:', newPosition);
        
        const newMarker: PhotoMarker = {
          id: Date.now().toString(),
          position: newPosition,
          photoUrl,
          timestamp: Date.now()
        };
        
        setMarkers(prev => {
          const updatedMarkers = [...prev, newMarker];
          console.log('Updated markers:', updatedMarkers);
          return updatedMarkers;
        });

        showNotification('Photo added to map! 📍');

        // Close camera first
        stopCamera();

        // Pan to the new marker location
        if (mapRef.current) {
          setTimeout(() => {
            mapRef.current?.flyTo(newPosition, 15);
          }, 500);
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        showNotification('Error getting location 😕');
        stopCamera();
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
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

  return (
    <AppContainer>
      <Notification isVisible={!!notification}>
        {notification}
      </Notification>
      <MapWrapper>
        <MapContainer {...mapProps}>
          <TileLayer {...tileProps} />
          {markers.map((marker) => {
            console.log('Rendering marker:', marker);
            return (
              <Marker 
                key={marker.id} 
                position={marker.position}
              >
                <StyledPopup>
                  <img 
                    src={marker.photoUrl} 
                    alt="Captured photo" 
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                  <div style={{ padding: '8px', fontSize: '12px', color: '#666' }}>
                    {new Date(marker.timestamp).toLocaleString()}
                  </div>
                </StyledPopup>
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
