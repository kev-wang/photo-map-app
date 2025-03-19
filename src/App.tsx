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
}

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        console.error('Error getting location:', error);
      }
    );
  }, []);

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
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const photoUrl = canvas.toDataURL('image/jpeg');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newMarker: PhotoMarker = {
          id: Date.now().toString(),
          position: [position.coords.latitude, position.coords.longitude],
          photoUrl,
        };
        setMarkers(prev => [...prev, newMarker]);
        stopCamera();
      },
      (error) => {
        console.error('Error getting location:', error);
        stopCamera();
      }
    );
  };

  const mapProps: MapContainerProps = {
    center: userLocation,
    zoom: 13,
    style: { height: '100%', width: '100%' },
    scrollWheelZoom: true
  };

  const tileProps: TileLayerProps = {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  };

  return (
    <AppContainer>
      <MapWrapper>
        <MapContainer {...mapProps}>
          <TileLayer {...tileProps} />
          {markers.map((marker) => (
            <Marker key={marker.id} position={marker.position}>
              <StyledPopup>
                <img 
                  src={marker.photoUrl} 
                  alt="Captured photo" 
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
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
