// frontend/src/components/ConsentBanner.tsx

import React, { useState, useEffect, useCallback } from 'react';
import './ConsentBanner.css';

interface ConsentBannerProps {
  onAccept?: () => void;
  onDecline?: () => void;
}

export const ConsentBanner: React.FC<ConsentBannerProps> = ({ onAccept, onDecline }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const getLocalStorage = useCallback((key: string) => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }
    return null;
  }, []);

  const setLocalStorage = useCallback((key: string, value: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  }, []);

  useEffect(() => {
    // Check if user has already given consent
    const consentGiven = getLocalStorage('aegis_consent_given');
    if (!consentGiven) {
      setIsVisible(true);
    }
  }, [getLocalStorage]);

  const handleAccept = useCallback(() => {
    setLocalStorage('aegis_consent_given', 'true');
    setLocalStorage('aegis_consent_date', new Date().toISOString());
    setIsVisible(false);
    onAccept?.();
  }, [setLocalStorage, onAccept]);

  const handleDecline = useCallback(() => {
    setLocalStorage('aegis_consent_given', 'false');
    setIsVisible(false);
    onDecline?.();
  }, [setLocalStorage, onDecline]);

  if (!isVisible) return null;

  return (
    <div className="consent-banner-overlay">
      <div className="consent-banner">
        <div className="consent-banner-content">
          <div className="consent-banner-header">
            <h3>🔐 Your Privacy Matters</h3>
            <p>We use zero-knowledge proofs to protect your data</p>
          </div>

          <div className="consent-banner-body">
            <p>
              Aegis-Link uses advanced cryptography to verify your identity without storing 
              or sharing your personal information. We collect minimal data necessary for 
              service functionality.
            </p>

            {showDetails && (
              <div className="consent-details">
                <h4>What we collect:</h4>
                <ul>
                  <li>✓ Account credentials (encrypted)</li>
                  <li>✓ Verification history (anonymized)</li>
                  <li>✓ Usage statistics (aggregated)</li>
                </ul>

                <h4>What we DON'T collect:</h4>
                <ul>
                  <li>✕ Your actual credential data</li>
                  <li>✕ Personal documents</li>
                  <li>✕ Tracking cookies</li>
                  <li>✕ Third-party analytics</li>
                </ul>

                <h4>Your rights:</h4>
                <ul>
                  <li>→ Access your data anytime</li>
                  <li>→ Revoke consent instantly</li>
                  <li>→ Export your records</li>
                  <li>→ Delete your account</li>
                </ul>
              </div>
            )}

            <button 
              className="consent-details-toggle"
              onClick={() => setShowDetails(!showDetails)}
              aria-expanded={showDetails}
              aria-label={showDetails ? "Show less details" : "Show more details"}
            >
              {showDetails ? '▼ Show Less' : '▶ Learn More'}
            </button>
          </div>

          <div className="consent-banner-actions">
            <button 
              className="consent-btn consent-btn-decline"
              onClick={handleDecline}
            >
              Decline
            </button>
            <button 
              className="consent-btn consent-btn-accept"
              onClick={handleAccept}
            >
              ✓ Accept & Continue
            </button>
          </div>

          <p className="consent-banner-footer">
            By accepting, you agree to our{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
          </p>
        </div>
      </div>
    </div>
  );
};

// ConsentBanner.css (separate file - create this)
