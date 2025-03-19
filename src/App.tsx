import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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
  bottom: 20px;
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

function App() {
  const [markers, setMarkers] = useState<PhotoMarker[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number]>([35.6762, 139.6503]);

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

  const handleAddPhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      // Create a canvas element to capture the photo
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Wait for video to be ready
      video.addEventListener('loadeddata', () => {
        const context = canvas.getContext('2d')!;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to data URL
        const photoUrl = canvas.toDataURL('image/jpeg');
        
        // Stop the camera stream
        stream.getTracks().forEach(track => track.stop());

        // Get current location and add new marker
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newMarker: PhotoMarker = {
              id: Date.now().toString(),
              position: [position.coords.latitude, position.coords.longitude],
              photoUrl,
            };
            setMarkers(prev => [...prev, newMarker]);
          },
          (error) => {
            console.error('Error getting location:', error);
          }
        );
      });
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  return (
    <AppContainer>
      <MapWrapper>
        <MapContainer
          center={userLocation}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {markers.map((marker) => (
            <Marker key={marker.id} position={marker.position}>
              <Popup>
                <img 
                  src={marker.photoUrl} 
                  alt="Captured photo" 
                  style={{ width: '200px', height: 'auto' }}
                />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </MapWrapper>
      <AddButton onClick={handleAddPhoto}>+</AddButton>
    </AppContainer>
  );
}

export default App;
