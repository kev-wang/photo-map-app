import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { MapContainerProps, TileLayerProps } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { latLngToCell } from 'h3-js';
import { database, PhotoMarker as BasePhotoMarker, testSupabaseConnection, supabase, Comment } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { TermsAndConditions } from './TermsAndConditions';
import ReactGA from 'react-ga4';
import { FaPencilAlt, FaQuestionCircle } from 'react-icons/fa';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Initialize Google Analytics with the provided Measurement ID
ReactGA.initialize(import.meta.env.VITE_GA_MEASUREMENT_ID || '', {
  gaOptions: {
    cookieDomain: 'auto',
    cookieFlags: 'SameSite=None;Secure'
  }
});

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Note: countdown is computed from expires_at now

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
  &:active {
    transform: translateX(-50%) scale(0.95);
  }
`;

const InitialsRow = styled.div`
  position: absolute;
  bottom: 100px;
  left: calc(50% + 40px);
  display: flex;
  align-items: center;
  z-index: 1000;
  gap: 8px;
  height: 60px;
  margin-top: 8px;
`;

const AsText = styled.span`
  margin-left: 4px;
  font-size: 12px;
  font-weight: bold;
  color: #007AFF;
  white-space: nowrap;
`;

// Add thumbnail_url and views to PhotoMarker type for correct typing
type PhotoMarker = BasePhotoMarker & { thumbnail_url?: string; views?: number; expires_at?: string | null; h3_res7?: string | null };

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

// Add styled component for the help button
const HelpButton = styled.button`
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 2001;
  background: none;
  border: none;
  color: #007AFF;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

// Modal overlay and content reuse from TermsAndConditions
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
`;
const ModalContent = styled.div`
  background: white;
  padding: 0;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  position: relative;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
`;
const HeaderBanner = styled.div`
  background-color: #007AFF;
  color: white;
  padding: 1rem;
  text-align: center;
  font-size: 2rem;
  font-weight: 700;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
`;
const RulesText = styled.div`
  font-size: 0.95rem;
  line-height: 1.5;
  color: #444;
  padding: 0 2rem 1rem 2rem;
  overflow-y: auto;
  max-height: calc(80vh - 200px);
  ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
`;
const CloseButton = styled.button`
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  background-color: #007AFF;
  color: white;
  margin: 1rem 2rem 1.5rem auto;
  transition: background 0.2s;
  &:hover {
    background-color: #005bb5;
  }
`;

// Add this styled component for the date overlay
const DateOverlay = styled.div`
  position: absolute;
  bottom: 2px;
  left: 2px;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  z-index: 2;
  pointer-events: none;
`;

// Add this after the existing styled components
// const ClusterBadge = styled.div`
//   position: absolute;
//   top: -8px;
//   right: -8px;
//   background-color: #007AFF;
//   color: white;
//   font-size: 12px;
//   font-weight: 500;
//   width: 20px;
//   height: 20px;
//   border-radius: 50%;
//   display: flex;
//   align-items: center;
//   justify-content: center;
// `;

const MessageBubbleButton = styled.button`
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1001;
  color: white;
  font-size: 16px;
  padding: 0;
  line-height: 1;
`;

const CommentCount = styled.span`
  position: absolute;
  right: -8px;
  top: -8px;
  background: #007AFF;
  color: white;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 10px;
  border: 2px solid white;
  z-index: 1002;
`;

const CommentCard = styled(ModalContent)`
  display: flex;
  flex-direction: column;
  height: 80vh;
  max-height: 800px;
  border-radius: 16px !important;
  overflow: hidden;
`;

const CommentImageSection = styled.div<{ isCollapsed?: boolean }>`
  height: ${props => props.isCollapsed ? '100%' : '33%'};
  position: relative;
  background: black;
  overflow: hidden;
  transition: height 0.3s ease-in-out;
`;

const CommentImage = styled.img<{ isCollapsed?: boolean }>`
  width: 100%;
  height: 100%;
  object-fit: ${props => props.isCollapsed ? 'cover' : 'cover'};
  transition: object-fit 0.3s ease-in-out;
`;

const CommentSection = styled.div<{ isCollapsed?: boolean }>`
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  overflow-y: auto;
  transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out, max-height 0.3s ease-in-out, padding 0.3s ease-in-out, flex 0.3s ease-in-out;
  border-top: 1px solid #eee;

  ${props => props.isCollapsed && css`
    opacity: 0;
    visibility: hidden;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    flex: 0;
    border-top: none;
  `}
`;

const CommentItem = styled.div`
  padding: 12px;
  border-bottom: 1px solid #eee;
`;

const CommentHeader = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 8px;
  margin-left: 2px;
`;

const CommentUserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 14px;
`;

const CommentContent = styled.div`
  font-size: 14px;
  line-height: 1.4;
  margin: 8px 0 8px 10px;
`;

const CommentInputFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CharacterCount = styled.span`
  color: #666;
  font-size: 12px;
`;

const CommentButtons = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 5px;
`;

const CommentButton = styled.button<{ primary?: boolean }>`
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background: ${props => props.primary ? '#007AFF' : 'white'};
  color: ${props => props.primary ? 'white' : '#666'};
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background: ${props => props.primary ? '#005bb5' : '#f5f5f5'};
  }
`;

// Add a styled close button matching the popup style
const CommentCloseButton = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  border: none;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1002;
  cursor: pointer;
  padding: 0;
`;

const CommentTimestamp = styled.span`
  font-size: 12px;
  font-family: inherit;
  color: #888;
  font-weight: 500;
  background: none;
  box-shadow: none;
  padding: 0;
  border-radius: 0;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
`;

const CenteredCommentInputContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 16px 0;
`;

const CenteredCommentInput = styled.textarea`
  width: 80%;
  max-width: 340px;
  min-width: 220px;
  height: 80px;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0 5px 0;
  resize: none;
  font-family: inherit;
  font-size: 14px;
  box-sizing: border-box;
`;

const CollapseTrigger = styled.div`
  text-align: center;
  padding: 4px 0;
  cursor: pointer;
  font-size: 30px;
  color: black;
  line-height: 1;
  background-color: white;
  border-bottom: 1px solid #eee;
  user-select: none;
`;

const ExpandTrigger = styled.div`
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 30px;
  color: white;
  background: rgba(0, 0, 0, 0.6);
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  z-index: 1003;
  line-height: 1;
  user-select: none;
`;

const NoCommentsPlaceholder = styled.div`
  text-align: center;
  color: #888;
  font-style: italic;
  padding: 20px;
  font-size: 14px;
`;

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
  const [showRules, setShowRules] = useState(false);
  const [showCommentCard, setShowCommentCard] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [popupCommentCount, setPopupCommentCount] = useState<number>(0);
  const [isCommentSectionCollapsed, setIsCommentSectionCollapsed] = useState(false);

  // Track app load (pageview)
  useEffect(() => {
    ReactGA.send({ hitType: 'pageview', page: window.location.pathname + window.location.search });
  }, []);

  // Function to load markers
  const loadMarkers = async () => {
    try {
      const data = await database.getMarkers();
      if (data) {
        setMarkers(data);
      } else {
        setMarkers([]);
      }
    } catch (error) {
      console.error('Error loading markers');
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
    let isFirstLocation = true;

    const getLocation = () => {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const newLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
            setUserLocation(newLocation);
            
            if (isFirstLocation && mapRef.current) {
              mapRef.current.setView(newLocation, mapRef.current.getZoom() || 13);
              isFirstLocation = false;
            }
          },
          () => {
            console.error('Error getting location');
            setUserLocation([1.3521, 103.8198]);
          },
          {
            enableHighAccuracy: false,
            maximumAge: 60000,
            timeout: 10000
          }
        );
      } else {
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
      const h3Index = latLngToCell(newPosition[0], newPosition[1], 7);
      const newMarker = {
        position: newPosition,
        photo_url: photoUrl,
        thumbnail_url: thumbnailUrl,
        timestamp: Date.now(),
        likes: 0,
        dislikes: 0,
        created_by: userInitials || 'Anonymous',
        last_interaction: Date.now(),
        h3_res7: h3Index,
        expires_at: null
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
      // If finite, we will extend life by 7 days; if infinite, just record the like
      const isInfinite = !marker.expires_at;
      showNotification(isInfinite ? 'Like recorded' : 'Photo liked! Time extended by 168 hours');

      const newExpiresAt = isInfinite
        ? null
        : new Date((new Date(marker.expires_at!).getTime()) + (168 * 60 * 60 * 1000)).toISOString();

      await database.updateMarker(markerId, {
        likes: marker.likes + 1,
        expires_at: newExpiresAt,
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
      const isInfinite = !marker.expires_at;
      showNotification(isInfinite ? 'Dislike recorded' : 'Photo disliked. Time reduced by 168 hours');

      const newExpiresAt = isInfinite
        ? null
        : new Date((new Date(marker.expires_at!).getTime()) - (168 * 60 * 60 * 1000)).toISOString();

      await database.updateMarker(markerId, {
        dislikes: marker.dislikes + 1,
        expires_at: newExpiresAt,
        last_interaction: Date.now()
      });
    } catch (error) {
      console.error('Error disliking marker:', error);
      showNotification('Error disliking photo');
      loadMarkers(); // Reload on error
    }
  };

  // Function to check if a marker is expired
  const isMarkerExpired = (marker: PhotoMarker): boolean => {
    if (!marker.expires_at) return false;
    return Date.now() > new Date(marker.expires_at).getTime();
  };

  const calculateTimeRemaining = (marker: PhotoMarker): string => {
    if (!marker.expires_at) return '∞';
    const now = Date.now();
    const diffMs = new Date(marker.expires_at).getTime() - now;
    const remainingHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
    const days = Math.floor(remainingHours / 24);
    const hours = remainingHours % 24;
    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
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

  const createCustomIcon = (initials: string, thumbnailUrl: string, timeRemainingHours?: number) => {
    const currentZoom = mapRef.current?.getZoom() ?? 0;
    // Determine if we should show the fade soon label
    const showFadeSoon = typeof timeRemainingHours === 'number' && timeRemainingHours <= 3 && currentZoom >= 15;
    const showCreatorLabel = currentZoom >= 15;
    return L.divIcon({
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
          ${showFadeSoon ? `<div style="
            position: absolute;
            top: -32px;
            left: 50%;
            transform: translateX(-50%);
            color: #ff9800;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            z-index: 1001;
            pointer-events: none;
            background: rgba(255, 255, 255, 0.4);
            padding: 2px 6px;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            display: block;">
            &lt;3 hrs till I fade
          </div>` : ''}
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
            background: rgba(255, 255, 255, 0.4);
            padding: 2px 6px;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            display: ${showCreatorLabel ? 'block' : 'none'};
          ">${initials}</div>
        </div>
      `,
      iconSize: [40, 56],
      iconAnchor: [20, 56],
      popupAnchor: [0, -56]
    });
  };

  // Add zoom change handler
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.on('zoomend', () => {
        // Force marker icons to update when zoom changes
        markers.forEach(marker => {
          if (markerRefs.current[marker.id]) {
            const hoursRemaining = marker.expires_at
              ? (new Date(marker.expires_at).getTime() - Date.now()) / (1000 * 60 * 60)
              : undefined;
            markerRefs.current[marker.id].setIcon(
              createCustomIcon(marker.created_by, marker.thumbnail_url || '', hoursRemaining)
            );
          }
        });
      });
    }
  }, [markers]);

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
    ReactGA.event({ category: 'Photo', action: 'Open Popup', label: markerId });
    
    // Fetch comment count for this marker
    try {
      const { count, error } = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('photo_id', markerId);
      if (!error && typeof count === 'number') {
        setPopupCommentCount(count);
      } else {
        setPopupCommentCount(0);
      }
    } catch (e) {
      setPopupCommentCount(0);
    }

    if (!loadedPhotoUrls[markerId]) {
      try {
        const photoUrl = await database.getPhotoUrl(markerId);
        setLoadedPhotoUrls(prev => ({
          ...prev,
          [markerId]: photoUrl
        }));
      } catch (error) {
        console.error('Error loading photo');
        showNotification('Error loading photo');
      }
    }

    try {
      const newViews = await database.incrementViews(markerId);
      setMarkers(prev => prev.map(m => m.id === markerId ? { ...m, views: newViews } : m));
    } catch (error) {
      console.error('Error updating views');
    }
    
    setOpenPopupId(markerId);
  };
  const handleMarkerPopupClose = (markerId: string) => {
    ReactGA.event({ category: 'Marker', action: 'Popup Close', label: markerId });
  };

  useEffect(() => {
    if (openPopupId && markerRefs.current[openPopupId]) {
      markerRefs.current[openPopupId].openPopup();
    }
  }, [openPopupId]);

  // Add this function before the App component
  const createClusterCustomIcon = (cluster: any) => {
    const markers = cluster.getAllChildMarkers();
    const count = markers.length;
    
    // Find marker with longest life (∞ wins)
    const now = Date.now();
    const markerWithLongestLife = markers.reduce((longest: any, current: any) => {
      const longestData = longest.options.photoMarker as PhotoMarker;
      const currentData = current.options.photoMarker as PhotoMarker;
      const longestLife = longestData.expires_at ? (new Date(longestData.expires_at).getTime() - now) / (1000 * 60 * 60) : Infinity;
      const currentLife = currentData.expires_at ? (new Date(currentData.expires_at).getTime() - now) / (1000 * 60 * 60) : Infinity;
      return currentLife > longestLife ? current : longest;
    }, markers[0]);
    const markerData = markerWithLongestLife.options.photoMarker;

    return L.divIcon({
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
              src="${markerData.thumbnail_url}" 
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
            top: -8px;
            right: -8px;
            background-color: #007AFF;
            color: white;
            font-size: 12px;
            font-weight: 500;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            z-index: 1001;
          ">${count}</div>
        </div>
      `,
      className: 'custom-cluster-icon',
      iconSize: L.point(40, 56),
      iconAnchor: L.point(20, 56)
    });
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return '<1m ago';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
    return `${Math.floor(seconds / 31536000)}y ago`;
  };

  const canPostComment = (photoId: string, userInitials: string) => {
    const key = `${photoId}_${userInitials}`;
    const lastCommentTime = localStorage.getItem(key);
    
    if (!lastCommentTime) return true;
    
    const timeSinceLastComment = Date.now() - parseInt(lastCommentTime);
    return timeSinceLastComment >= 30000; // 30 seconds
  };

  const updateRateLimit = (photoId: string, userInitials: string) => {
    const key = `${photoId}_${userInitials}`;
    localStorage.setItem(key, Date.now().toString());
  };

  const handleOpenCommentCard = async (photoId: string, startCollapsed: boolean = false, activateInput: boolean = false) => {
    setSelectedPhotoId(photoId);
    setShowCommentCard(true);
    setIsCommentSectionCollapsed(startCollapsed);
    if (activateInput) {
      setShowCommentInput(true);
    }
    try {
      const photoComments = await database.getComments(photoId);
      setComments(photoComments);
    } catch (error) {
      console.error('Error loading comments:', error);
      showNotification('Error loading comments');
    }
  };

  const handleCloseCommentCard = () => {
    setShowCommentCard(false);
    setSelectedPhotoId(null);
    setComments([]);
    setNewComment('');
    setShowCommentInput(false);
    setIsCommentSectionCollapsed(false);
  };

  const handlePostComment = async () => {
    if (!selectedPhotoId || !newComment.trim()) return;
    if (!canPostComment(selectedPhotoId, userInitials)) {
      showNotification('Please wait 30 seconds before posting another comment');
      return;
    }
    setIsPostingComment(true);
    try {
      const comment = await database.addComment({
        photo_id: selectedPhotoId,
        user_initials: userInitials,
        content: newComment.trim()
      });
      setComments(prev => [comment, ...prev]);
      setNewComment('');
      setShowCommentInput(false);
      updateRateLimit(selectedPhotoId, userInitials);
      showNotification('Comment posted successfully');
    } catch (error) {
      console.error('Error posting comment:', error);
      showNotification('Error posting comment');
    } finally {
      setIsPostingComment(false);
    }
  };

  return (
    <AppContainer>
      <HelpButton onClick={() => setShowRules(true)} title="Show Rules">
        <FaQuestionCircle />
      </HelpButton>
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
            <MarkerClusterGroup
              iconCreateFunction={createClusterCustomIcon}
              maxClusterRadius={50}
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
              zoomToBoundsOnClick={true}
            >
              {markers
                .filter(marker => !isMarkerExpired(marker))
                .map((marker) => {
                  const hoursRemaining = marker.expires_at
                    ? (new Date(marker.expires_at).getTime() - Date.now()) / (1000 * 60 * 60)
                    : undefined;
                  return (
                    <Marker 
                      key={marker.id} 
                      position={marker.position}
                      icon={createCustomIcon(marker.created_by, marker.thumbnail_url || '', hoursRemaining)}
                      ref={(ref: L.Marker | null) => {
                        if (ref) {
                          markerRefs.current[marker.id] = ref;
                          // Attach the full marker data to the Leaflet marker instance for cluster access
                          (ref as any).options.photoMarker = marker;
                        }
                      }}
                      eventHandlers={{
                        click: () => {
                          Object.keys(markerRefs.current).forEach((id) => {
                            if (id !== marker.id && markerRefs.current[id]) {
                              markerRefs.current[id].closePopup();
                            }
                          });
                          handleMarkerPopupOpen(marker.id);
                        }
                      }}
                    >
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
                            handleMarkerPopupClose(marker.id);
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
                            handleOpenCommentCard(marker.id, true, false);
                          }}
                        >
                          <PhotoInfo style={{ position: 'static', borderRadius: '8px 8px 0 0', marginBottom: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span role="img" aria-label="hourglass">⏳</span>
                            <TimeRemaining>{calculateTimeRemaining(marker)}</TimeRemaining>
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
                          <div 
                            style={{ position: 'relative', cursor: 'pointer' }} 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCommentCard(marker.id, true, false);
                            }}
                          >
                            {loadedPhotoUrls[marker.id] ? (
                              <>
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
                                <DateOverlay>
                                  {marker.created_at ? `${new Date(marker.created_at).getFullYear()} ${new Date(marker.created_at).toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${String(new Date(marker.created_at).getDate()).padStart(2, '0')}` : ''}
                                </DateOverlay>
                                <MessageBubbleButton onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenCommentCard(marker.id, false, true);
                                }}>
                                  <span role="img" aria-label="comment" style={{ fontSize: '16px' }}>💬</span>
                                  {openPopupId === marker.id && popupCommentCount > 0 && (
                                    <CommentCount>{popupCommentCount}</CommentCount>
                                  )}
                                </MessageBubbleButton>
                              </>
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
                    </Marker>
                  );
                })}
            </MarkerClusterGroup>
        </MapContainer>
      </MapWrapper>
        <CenteredAddButton onClick={startCamera}>+</CenteredAddButton>
        <InitialsRow>
          <AsText>post as</AsText>
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
      {showRules && (
        <ModalOverlay>
          <ModalContent>
            <HeaderBanner>Rules</HeaderBanner>
            <RulesText>
              <ul>
                <li>Every photo posted have 7 days of life ⏳ by default, when life runs out photo will fade from the map</li>
                <li>Every "like" 👍 will extend photo's life by 7 days, every "dislike" 👎 will reduce photo's life by 7 days</li>
                <li>You must "like" a photo in order to "dislike" another photo</li>
              </ul>
            </RulesText>
            <CloseButton onClick={() => setShowRules(false)}>Close</CloseButton>
          </ModalContent>
        </ModalOverlay>
      )}
      {showCommentCard && selectedPhotoId && (
        <ModalOverlay>
          <CommentCard>
            <CommentImageSection isCollapsed={isCommentSectionCollapsed}>
              <CommentCloseButton onClick={handleCloseCommentCard}>✕</CommentCloseButton>
              <CommentImage
                src={loadedPhotoUrls[selectedPhotoId]}
                alt="Photo"
                isCollapsed={isCommentSectionCollapsed}
              />
              <DateOverlay>
                {markers.find(m => m.id === selectedPhotoId)?.created_at
                  ? `${new Date(markers.find(m => m.id === selectedPhotoId)!.created_at!).getFullYear()} ${new Date(markers.find(m => m.id === selectedPhotoId)!.created_at!).toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${String(new Date(markers.find(m => m.id === selectedPhotoId)!.created_at!).getDate()).padStart(2, '0')}`
                  : ''}
              </DateOverlay>
              <MessageBubbleButton onClick={(e) => {
                e.stopPropagation();
                handleOpenCommentCard(selectedPhotoId, false, true);
              }}>
                <span role="img" aria-label="comment" style={{ fontSize: '16px' }}>💬</span>
                {comments.length > 0 && (
                  <CommentCount>{comments.length}</CommentCount>
                )}
              </MessageBubbleButton>
            </CommentImageSection>

            {!isCommentSectionCollapsed && (
              <CollapseTrigger onClick={() => setIsCommentSectionCollapsed(true)}>
                ︾
              </CollapseTrigger>
            )}
            
            <CommentSection isCollapsed={isCommentSectionCollapsed}>
              {comments.length === 0 && !isCommentSectionCollapsed && !showCommentInput ? (
                <NoCommentsPlaceholder>
                  Looks like no one's commented yet. Click the speech bubble to leave the first comment!
                </NoCommentsPlaceholder>
              ) : (
                comments.map(comment => (
                  <CommentItem key={comment.id}>
                    <CommentHeader>
                      <CommentUserInfo>
                        <CreatedByLabel>{comment.user_initials}</CreatedByLabel>
                        <span>•</span>
                        <CommentTimestamp>{formatTimeAgo(new Date(comment.created_at).getTime())}</CommentTimestamp>
                      </CommentUserInfo>
                    </CommentHeader>
                    <CommentContent>{comment.content}</CommentContent>
                  </CommentItem>
                ))
              )}
            </CommentSection>

            {showCommentInput && !isCommentSectionCollapsed && (
              <CenteredCommentInputContainer>
                <CenteredCommentInput
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value.slice(0, 700))}
                  placeholder="Post a comment"
                  maxLength={700}
                  autoFocus
                />
                <CommentInputFooter style={{ width: '80%', maxWidth: 340, minWidth: 220 }}>
                  <CharacterCount>
                    {newComment.length}/700
                  </CharacterCount>
                  <CommentButtons>
                    <CommentButton 
                      onClick={() => { setNewComment(''); setShowCommentInput(false); }}
                      disabled={isPostingComment}
                    >
                      Cancel
                    </CommentButton>
                    <CommentButton 
                      onClick={handlePostComment}
                      disabled={!newComment.trim() || isPostingComment}
                      primary={!!newComment.trim()}
                    >
                      Post
                    </CommentButton>
                  </CommentButtons>
                </CommentInputFooter>
              </CenteredCommentInputContainer>
            )}

            {isCommentSectionCollapsed && (
              <ExpandTrigger onClick={() => setIsCommentSectionCollapsed(false)}>
                ︽
              </ExpandTrigger>
            )}
          </CommentCard>
        </ModalOverlay>
      )}
    </AppContainer>
  );
}

export default App;
