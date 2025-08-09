import { useState, useEffect } from 'react';
import styled from '@emotion/styled';

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
  z-index: 1000;
  transition: all 0.3s ease-out;
  opacity: 1;

  &.accepted {
    opacity: 0;
    pointer-events: none;
    backdrop-filter: blur(0);
    -webkit-backdrop-filter: blur(0);
  }
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
  transform: translateY(0);
  transition: transform 0.3s ease-out;

  &.accepted {
    transform: translateY(-20px);
  }
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

const Title = styled.h2`
  color: #333;
  margin: 1rem 2rem;
  font-size: 1.3rem;
`;

const TermsText = styled.div`
  font-size: 0.8rem;
  line-height: 1.4;
  color: #444;
  padding: 0 2rem;
  overflow-y: auto;
  max-height: calc(80vh - 200px);
  
  h3 {
    font-size: 1rem;
    margin: 1rem 0 0.5rem 0;
  }
  
  p {
    margin: 0.5rem 0;
  }
  
  ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem 2rem;
  background: white;
  border-top: 1px solid #eee;
  position: sticky;
  bottom: 0;
`;

const Button = styled.button`
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  
  &.accept {
    background-color: #4CAF50;
    color: white;
    
    &:hover {
      background-color: #45a049;
      transform: translateY(-1px);
    }
  }
  
  &.decline {
    background-color: #f44336;
    color: white;
    
    &:hover {
      background-color: #da190b;
      transform: translateY(-1px);
    }
  }
`;

const Link = styled.a`
  color: #007AFF;
  text-decoration: underline;
  cursor: pointer;
`;

const DocOverlay = styled(ModalOverlay)`
  z-index: 1100;
  background: rgba(255, 255, 255, 0.5);
`;

const DocContent = styled(ModalContent)`
  max-width: 640px;
`;

const CloseDocButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  border: none;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

interface TermsAndConditionsProps {
  onAccept: () => void;
}

export const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ onAccept }) => {
  const [hasAccepted, setHasAccepted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showTermsDoc, setShowTermsDoc] = useState(false);
  const [showPrivacyDoc, setShowPrivacyDoc] = useState(false);

  useEffect(() => {
    // Check if user has already accepted terms
    const accepted = localStorage.getItem('termsAccepted');
    if (accepted === 'true') {
      setHasAccepted(true);
      onAccept();
    }
  }, [onAccept]);

  const handleAccept = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      localStorage.setItem('termsAccepted', 'true');
      setHasAccepted(true);
      onAccept();
    }, 300); // Match this with the CSS transition duration
  };

  if (hasAccepted) {
    return null;
  }

  return (
    <>
    <ModalOverlay className={isTransitioning ? 'accepted' : ''}>
      <ModalContent className={isTransitioning ? 'accepted' : ''}>
        <HeaderBanner>
          Welcome to Fading Photos
        </HeaderBanner>
        <Title>Terms and Conditions</Title>
        <TermsText>
          <p>
            By clicking <strong>Accept</strong>, you acknowledge that you have read, understood, and agree to be bound by our{' '}
            <Link href="#" onClick={(e) => { e.preventDefault(); setShowTermsDoc(true); }}>Terms and Conditions</Link>{' '}and{' '}
            <Link href="#" onClick={(e) => { e.preventDefault(); setShowPrivacyDoc(true); }}>Privacy Policy</Link>, including the Zone‑based photo lifecycle (infinite life at ≤7 photos per Zone; competition and potential deletion at 8+). If you do not agree, do not use the Service.
          </p>
        </TermsText>
        
        <ButtonContainer>
          <div />
          <Button className="accept" onClick={handleAccept}>Accept</Button>
        </ButtonContainer>
      </ModalContent>
    </ModalOverlay>
      {showTermsDoc && (
        <DocOverlay onClick={() => setShowTermsDoc(false)}>
          <DocContent onClick={(e) => e.stopPropagation()}>
            <HeaderBanner>Terms and Conditions</HeaderBanner>
            <CloseDocButton onClick={() => setShowTermsDoc(false)}>✕</CloseDocButton>
            <TermsText>
              <h3>1. User Content and Privacy</h3>
              <p>1.1. You retain ownership of any photos you upload, but grant us a license to store, display, and process your content for the purpose of providing the service.</p>
              <p>1.2. Photo lifecycle and Zones</p>
              <ul>
                <li>Each photo belongs to a local competition “Zone” defined by its H3 index at resolution 7.</li>
                <li>When a Zone has seven (7) or fewer photos, all photos in that Zone have infinite life (no scheduled deletion). Likes and dislikes still accumulate and are displayed, and the life label shows “∞”.</li>
                <li>When a Zone reaches eight (8) or more photos, all photos in that Zone enter a 7‑day competition at the same time:
                  <ul>
                    <li>All like/dislike counters reset to zero for those photos.</li>
                    <li>All photos receive the same baseline life: seven (7) days from the moment the Zone enters competition.</li>
                    <li>During competition, each “like” adds 7 days and each “dislike” subtracts 7 days from remaining life.</li>
                    <li>Photos that expire are permanently deleted and do not revive.</li>
                  </ul>
                </li>
                <li>If, due to photo deletion, a Zone returns to seven (7) or fewer photos, the remaining photos in that Zone revert to infinite life. Their like/dislike counters are not reset on this transition.</li>
                <li>If the Zone later reaches eight (8) or more photos again, likes/dislikes reset again for all photos in the Zone and the 7‑day baseline restarts equally.</li>
              </ul>

              <h3>2. User Responsibilities</h3>
              <p>2.1. You agree not to upload content that is illegal or violates others’ rights.</p>

              <h3>3. Location Services</h3>
              <p>3.1. The service uses your location to place photos on the map. You can choose to use a default location instead.</p>
              <p>3.2. Location data includes latitude/longitude and a derived H3 index at resolution 7 and is stored only as long as your photo remains on the service.</p>

              <h3>4. Service Limitations</h3>
              <p>4.1. We reserve the right to remove any content that violates these terms.</p>
              <p>4.2. The service is provided "as is" without warranties of any kind.</p>

              <h3>5. Privacy</h3>
              <p>5.1. We collect minimal personal information necessary to provide the service.</p>
              <p>5.2. Retention and deletion: When a Zone has seven (7) or fewer photos, photos in that Zone are not scheduled for deletion (infinite life). When a Zone has eight (8) or more photos, photos are subject to expiry. When a photo’s remaining life reaches zero, we permanently delete the photo and its associated files (including thumbnails). Deleted photos do not revive if the Zone later returns to seven (7) or fewer.</p>

              <h3>6. Changes to Terms</h3>
              <p>6.1. We may modify these terms at any time. Continued use of the service constitutes acceptance of modified terms.</p>
            </TermsText>
          </DocContent>
        </DocOverlay>
      )}

      {showPrivacyDoc && (
        <DocOverlay onClick={() => setShowPrivacyDoc(false)}>
          <DocContent onClick={(e) => e.stopPropagation()}>
            <HeaderBanner>Privacy Policy</HeaderBanner>
            <CloseDocButton onClick={() => setShowPrivacyDoc(false)}>✕</CloseDocButton>
            <TermsText>
              <h3>Data We Collect</h3>
              <ul>
                <li>Photo content and thumbnails you upload</li>
                <li>Geolocation (latitude/longitude) and a derived H3 res‑7 Zone identifier</li>
                <li>Engagement: likes, dislikes, views, comments (including commenter initials)</li>
                <li>Timestamps and lifecycle metadata (e.g., created_at, expires_at)</li>
              </ul>

              <h3>How We Use Your Data</h3>
              <ul>
                <li>Display photos on the map and operate the Zone‑based lifecycle (infinite vs. competition)</li>
                <li>Calculate and show engagement (likes, dislikes, views, comments)</li>
                <li>Enforce the competition rule: when a Zone reaches eight (8) or more photos, reset like/dislike counters and apply an equal 7‑day baseline to all photos in that Zone</li>
              </ul>

              <h3>Retention and Deletion</h3>
              <ul>
                <li>Infinite life: when a Zone has seven (7) or fewer photos, photos in that Zone are not scheduled for deletion (life is “∞”).</li>
                <li>Competition: when a Zone has eight (8) or more photos, photos are subject to expiry. When a photo’s remaining life reaches zero, we permanently delete the photo and its associated files (including thumbnails). Deleted photos do not revive.</li>
                <li>Associated content: comments tied to a deleted photo are removed; aggregate counters may reset when a Zone enters competition.</li>
                <li>Backups and logs: limited operational copies may persist briefly before automated removal.</li>
              </ul>
            </TermsText>
          </DocContent>
        </DocOverlay>
      )}
    </>
  );
}; 