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

interface TermsAndConditionsProps {
  onAccept: () => void;
}

export const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ onAccept }) => {
  const [hasAccepted, setHasAccepted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

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

  const handleDecline = () => {
    window.location.href = 'https://www.google.com';
  };

  if (hasAccepted) {
    return null;
  }

  return (
    <ModalOverlay className={isTransitioning ? 'accepted' : ''}>
      <ModalContent className={isTransitioning ? 'accepted' : ''}>
        <HeaderBanner>
          Welcome to Fading Photos
        </HeaderBanner>
        <Title>Terms and Conditions</Title>
        <TermsText>
          <p>By accessing and using this website, you agree to be bound by the following terms and conditions:</p>
          
          <h3>1. User Content and Privacy</h3>
          <p>1.1. You retain ownership of any photos you upload, but grant us a license to store, display, and process your content for the purpose of providing the service.</p>
          <p>1.2. Photos are initially set to be automatically removed after 7 days. For each "like" a photo receives, its lifespan will be extended by an additional 7 days. Conversely, each "dislike" will reduce its lifespan by 7 days. When a photo's lifespan expires (reaches zero or less), it will be permanently deleted from our database.</p>
          <p>1.3. We do not claim ownership of your photos, but you must have the right to share them.</p>
          
          <h3>2. User Responsibilities</h3>
          <p>2.1. You agree not to upload content that:</p>
          <ul>
            <li>Is illegal, harmful, threatening, abusive, harassing, defamatory, or invasive of privacy</li>
            <li>Infringes on intellectual property rights</li>
            <li>Contains personal information of others without consent</li>
            <li>Is spam or commercial content</li>
          </ul>
          
          <h3>3. Location Services</h3>
          <p>3.1. The service uses your location to place photos on the map. You can choose to use a default location instead.</p>
          <p>3.2. Location data is stored only as long as your photo remains on the service.</p>
          
          <h3>4. Service Limitations</h3>
          <p>4.1. We reserve the right to remove any content that violates these terms.</p>
          <p>4.2. The service is provided "as is" without warranties of any kind.</p>
          
          <h3>5. Privacy</h3>
          <p>5.1. We collect minimal personal information necessary to provide the service.</p>
          <p>5.2. Once a photo's lifespan ends, the photo and all related data will be automatically deleted.</p>
          
          <h3>6. Changes to Terms</h3>
          <p>6.1. We may modify these terms at any time. Continued use of the service constitutes acceptance of modified terms.</p>
        </TermsText>
        
        <ButtonContainer>
          {/* <Button className="decline" onClick={handleDecline}>
            Decline
          </Button> */}
          <Button className="accept" onClick={handleAccept}>
            Accept
          </Button>
        </ButtonContainer>
      </ModalContent>
    </ModalOverlay>
  );
}; 