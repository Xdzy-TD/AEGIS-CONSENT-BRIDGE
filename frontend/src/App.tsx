import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { ConsentManagement } from './components/ConsentManagement';
import { ConsentBanner } from './components/ConsentBanner';

interface Credential {
  id: string;
  type: string;
  issuer: string;
  issuedDate: string;
  privateData: any;
  schema: string;
}

interface Request {
  id?: string;
  serviceName: string;
  purpose: string;
  dataRequested: string[];
  retentionPeriod: string;
  requiredProof: { type: string; threshold: number };
  logo: string;
  color?: string;
}

interface AIAnalysis {
  trustScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  concerns: string[];
  recommendations: string[];
  verdict: string;
}

interface Notification {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error';
  timestamp: string;
}

interface UserIdentity {
  did: string;
  created: number;
  publicKey: string;
}

interface Stats {
  totalVerifications: number;
  successRate: number;
  averageTrustScore: number;
  dataPrivacySaved: string;
  verificationsThisMonth: number;
  averageTime: string;
  qrScansToday: number;
}

interface PrivacyMetrics {
  dataProtected: number;
  proofGenTime: number;
  encryptionLevel: string;
}

type ViewType = 'home' | 'wallet' | 'demo' | 'verification' | 'success' | 'how-it-works' | 'qr-scanner' | 'dashboard' | 'consent';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [userIdentity, setUserIdentity] = useState<UserIdentity | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [activeRequest, setActiveRequest] = useState<Request | null>(null);
  const [proofGenerating, setProofGenerating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalVerifications: 287,
    successRate: 94.2,
    averageTrustScore: 76,
    dataPrivacySaved: "4.2 GB",
    verificationsThisMonth: 45,
    averageTime: "2.3s",
    qrScansToday: 12
  });
  const [privacyMetrics] = useState<PrivacyMetrics>({
    dataProtected: 100,
    proofGenTime: 2300,
    encryptionLevel: "256-bit AES"
  });
  const [activityLog] = useState([
    { action: 'ZK Proof generated for scholarship verification', time: '2 hours ago', status: 'success' },
    { action: 'AI Sentinel flagged suspicious data request', time: '5 hours ago', status: 'warning' },
    { action: 'New credential issued: Education Certificate', time: '1 day ago', status: 'info' },
    { action: 'Healthcare verification completed', time: '2 days ago', status: 'success' },
    { action: 'Income credential updated', time: '3 days ago', status: 'info' }
  ]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initializeApp();
    
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        totalVerifications: prev.totalVerifications + Math.floor(Math.random() * 3),
        successRate: Math.min(100, prev.successRate + (Math.random() * 0.5)),
        qrScansToday: Math.random() > 0.7 ? prev.qrScansToday + 1 : prev.qrScansToday
      }));
    }, 5000);

    return () => {
      clearInterval(interval);
      stopCamera();
    };
  }, []);

  const initializeApp = () => {
    const demoIdentity: UserIdentity = {
      did: 'did:polygonid:polygon:mumbai:2qH7XAwYQzCp9VfhpNgeLtK2iCehDDrfMWUCEw5bZf',
      created: Date.now(),
      publicKey: '0x' + Math.random().toString(16).substr(2, 40)
    };
    setUserIdentity(demoIdentity);

    setCredentials([
      {
        id: 'cred_income_001',
        type: 'Income Credential',
        issuer: 'Government of India',
        issuedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        privateData: { income: 45000 },
        schema: 'ipfs://QmXnnyufdzAWL5CqZ2RnSNgPbvCc1ALT73sNonhTkx'
      },
      {
        id: 'cred_age_002',
        type: 'Age Credential',
        issuer: 'Government of India',
        issuedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        privateData: { age: 24, dob: '1999-03-15' },
        schema: 'ipfs://QmYnnyufdzAWL5CqZ2RnSNgPbvCc1ALT73sNonhTkx'
      },
      {
        id: 'cred_edu_003',
        type: 'Education Credential',
        issuer: 'Ministry of Education',
        issuedDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        privateData: { degree: 'Bachelor of Technology', gpa: 8.5 },
        schema: 'ipfs://QmZnnyufdzAWL5CqZ2RnSNgPbvCc1ALT73sNonhTkx'
      }
    ]);
  };

  const addNotification = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const notification: Notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setNotifications(prev => {
      const updated = [notification, ...prev];
      return updated.slice(0, 5);
    });

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  const generateZKProof = () => {
    setProofGenerating(true);
    addNotification('Generating zero-knowledge proof...', 'info');

    setTimeout(() => {
      const incomeCred = credentials.find(c => c.type === 'Income Credential');
      const isValid = incomeCred && incomeCred.privateData.income < (activeRequest?.requiredProof.threshold || 0);
      
      setProofGenerating(false);
      
      if (isValid) {
        addNotification('Proof verified! Eligibility confirmed.', 'success');
        setCurrentView('success');
      } else {
        addNotification('Verification failed. You do not meet the criteria.', 'error');
      }
    }, 2000);
  };

  const analyzeConsent = (request: Request) => {
    addNotification('AI Sentinel analyzing request...', 'info');
    setTimeout(() => {
      setAiAnalysis({
        trustScore: 72,
        riskLevel: 'medium',
        concerns: ['Request retention period is 90 days', 'Income data could be inferred from range'],
        recommendations: ['Review retention policy', 'Consider using encrypted storage'],
        verdict: 'review'
      });
    }, 1500);
  };

  const scanRequest = (request: Request) => {
    setActiveRequest(request);
    setCurrentView('verification');
    setAiAnalysis(null);
    analyzeConsent(request);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.style.display = 'block';
        await videoRef.current.play();
        setCameraActive(true);
        addNotification('📷 Camera started - position QR code in frame', 'info');
        scanQRCode();
      }
    } catch (err) {
      addNotification('❌ Camera permission denied', 'error');
      console.error('Error accessing camera:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.style.display = 'none';
      setCameraActive(false);
      addNotification('⏹️ Camera stopped', 'info');
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    scanIntervalRef.current = setInterval(() => {
      if (!cameraActive || !video.videoWidth) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (Math.random() > 0.95) {
        const mockQRData = JSON.stringify({
          service: 'Demo Verification Service',
          purpose: 'Test verification',
          data: ['Age', 'Income Range']
        });
        setQrData(mockQRData);
        addNotification('✓ QR code detected!', 'success');
        stopCamera();
      }
    }, 500);
  };

  const processScannedQR = () => {
    try {
      if (!qrData) return;
      const requestData = JSON.parse(qrData);
      const newRequest: Request = {
        serviceName: requestData.service || 'Verification Service',
        purpose: requestData.purpose || 'Identity verification',
        dataRequested: requestData.data || ['Verification'],
        retentionPeriod: '90 days',
        requiredProof: { type: 'income', threshold: 50000 },
        logo: '📋'
      };
      setActiveRequest(newRequest);
      setCurrentView('verification');
      setAiAnalysis(null);
      analyzeConsent(newRequest);
      addNotification('✓ Request processed - AI analysis started', 'success');
    } catch (e) {
      addNotification('⚠️ Invalid QR format - please try again', 'error');
    }
  };

  const mockRequests: Request[] = [
    {
      id: 'req_001',
      serviceName: 'National Scholarship Portal',
      purpose: 'Verify eligibility for merit scholarship',
      dataRequested: ['Income Below 50000', 'Age Verification'],
      retentionPeriod: '90 days',
      requiredProof: { type: 'income', threshold: 50000 },
      logo: '🎓',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'req_002',
      serviceName: 'Healthcare Subsidy Program',
      purpose: 'Determine subsidy eligibility',
      dataRequested: ['Income Range', 'Age Group', 'Location Data'],
      retentionPeriod: '180 days',
      requiredProof: { type: 'income', threshold: 40000 },
      logo: '🏥',
      color: 'from-green-500 to-emerald-500'
    }
  ];

  return (
    <div className="app">
      {currentView === 'home' && <HomeView setCurrentView={setCurrentView} />}
      {currentView === 'wallet' && <WalletView 
        userIdentity={userIdentity}
        credentials={credentials}
        setCurrentView={setCurrentView}
      />}
      {currentView === 'demo' && <DemoView 
        mockRequests={mockRequests}
        scanRequest={scanRequest}
        setCurrentView={setCurrentView}
      />}
      {currentView === 'verification' && <VerificationView 
        activeRequest={activeRequest}
        aiAnalysis={aiAnalysis}
        proofGenerating={proofGenerating}
        generateZKProof={generateZKProof}
        setCurrentView={setCurrentView}
      />}
      {currentView === 'success' && <SuccessView setCurrentView={setCurrentView} />}
      {currentView === 'how-it-works' && <HowItWorksView setCurrentView={setCurrentView} />}
      {currentView === 'qr-scanner' && <QRScannerView 
        qrData={qrData}
        privacyMetrics={privacyMetrics}
        stats={stats}
        startCamera={startCamera}
        stopCamera={stopCamera}
        processScannedQR={processScannedQR}
        setCurrentView={setCurrentView}
        videoRef={videoRef}
        canvasRef={canvasRef}
      />}
      {currentView === 'dashboard' && <DashboardView 
        stats={stats}
        activityLog={activityLog}
        privacyMetrics={privacyMetrics}
        setCurrentView={setCurrentView}
      />}
      {currentView === 'consent' && <ConsentManagement />}
      <ConsentBanner />
      <Notifications notifications={notifications} />
    </div>
  );
};

const HomeView: React.FC<{ setCurrentView: (view: ViewType) => void }> = ({ setCurrentView }) => (
  <div className="home-view">
    <div className="animated-blobs">
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
    </div>

    <div className="content-wrapper">
      <nav className="nav-bar">
        <div className="logo-section">
          <div className="logo-icon">
            <svg className="shield-icon" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
          </div>
          <div>
            <h1 className="logo-title">Aegis-Link</h1>
            <p className="logo-subtitle">Zero-Knowledge Consent Bridge</p>
          </div>
        </div>
        <div className="nav-buttons">
          <button onClick={() => setCurrentView('consent')} className="btn-consent">
            🔐 Consents
          </button>
          <button onClick={() => setCurrentView('qr-scanner')} className="btn-secondary">
            📱 Scan QR
          </button>
          <button onClick={() => setCurrentView('wallet')} className="btn-primary">
            Open Wallet
          </button>
        </div>
      </nav>

      <div className="hero-section">
        <div className="badge">🚀 Live Demo - Real-Time ZK Proofs</div>
        <h2 className="hero-title">
          Don't Share Data.<br/>
          <span className="gradient-text">Share Truth.</span>
        </h2>
        <p className="hero-subtitle">
          Prove your eligibility without revealing personal information. 
          Zero-Knowledge Proofs + AI Privacy Guardian = Total Control.
        </p>
        <div className="cta-buttons">
          <button onClick={() => setCurrentView('demo')} className="btn-cta-primary">
            Try Live Demo
          </button>
          <button onClick={() => setCurrentView('how-it-works')} className="btn-cta-secondary">
            How It Works
          </button>
        </div>
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">🔐</div>
          <h3 className="feature-title">Zero-Knowledge Proofs</h3>
          <p className="feature-text">Prove eligibility without revealing actual data</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🧠</div>
          <h3 className="feature-title">AI Consent Sentinel</h3>
          <p className="feature-text">Real-time privacy policy analysis and warnings</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🛡️</div>
          <h3 className="feature-title">Decentralized Identity</h3>
          <p className="feature-text">You own your data. No central honeypots.</p>
        </div>
      </div>

      <div className="solution-grid">
        <div className="solution-step">
          <div className="step-header">
            <div className="step-number">1</div>
            <div className="step-icon">👥</div>
          </div>
          <h3>Government Issues</h3>
          <p>Trusted issuers cryptographically sign your credentials</p>
        </div>
        <div className="solution-step">
          <div className="step-header">
            <div className="step-number">2</div>
            <div className="step-icon">🔒</div>
          </div>
          <h3>You Store Locally</h3>
          <p>Credentials stay in your device, never uploaded</p>
        </div>
        <div className="solution-step">
          <div className="step-header">
            <div className="step-number">3</div>
            <div className="step-icon">⚡</div>
          </div>
          <h3>Generate Proof</h3>
          <p>Create mathematical proof without revealing data</p>
        </div>
      </div>

      <div className="applications-section">
        <h2 className="section-heading">Real-World Applications</h2>
        <div className="applications-grid">
          <div className="application-card">
            <div className="app-icon">🎓</div>
            <h3>Scholarships</h3>
            <p>Prove income eligibility without revealing exact salary</p>
          </div>
          <div className="application-card">
            <div className="app-icon">🏥</div>
            <h3>Healthcare</h3>
            <p>Verify insurance coverage without exposing medical history</p>
          </div>
          <div className="application-card">
            <div className="app-icon">🗳️</div>
            <h3>Voting</h3>
            <p>Prove eligibility while maintaining ballot secrecy</p>
          </div>
          <div className="application-card">
            <div className="app-icon">🏦</div>
            <h3>Banking</h3>
            <p>Verify credit worthiness without sharing full financial history</p>
          </div>
          <div className="application-card">
            <div className="app-icon">🎫</div>
            <h3>Age Verification</h3>
            <p>Prove age for services without revealing date of birth</p>
          </div>
          <div className="application-card">
            <div className="app-icon">🏢</div>
            <h3>Employment</h3>
            <p>Verify qualifications without disclosing sensitive credentials</p>
          </div>
        </div>
      </div>

      <div className="cta-section">
        <button onClick={() => setCurrentView('demo')} className="btn-cta-large">
          Try the Live Demo
        </button>
      </div>
    </div>
  </div>
);

const QRScannerView: React.FC<{
  qrData: string | null;
  privacyMetrics: PrivacyMetrics;
  stats: Stats;
  startCamera: () => void;
  stopCamera: () => void;
  processScannedQR: () => void;
  setCurrentView: (view: ViewType) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}> = ({ qrData, privacyMetrics, stats, startCamera, stopCamera, processScannedQR, setCurrentView, videoRef, canvasRef }) => (
  <div className="qr-scanner-view">
    <button onClick={() => { stopCamera(); setCurrentView('home'); }} className="back-button">
      <span>←</span> Back
    </button>
    <div className="scanner-header">
      <h1>QR Code Scanner</h1>
      <p>Scan verification request QR codes with your camera</p>
    </div>
    <div className="scanner-panel">
      <div className="camera-container">
        <canvas ref={canvasRef} className="qr-canvas"></canvas>
        <video ref={videoRef} className="qr-video" playsInline></video>
      </div>
      <div className="camera-controls">
        <button onClick={startCamera} className="btn-camera-start">
          📷 Start Camera
        </button>
        <button onClick={stopCamera} className="btn-camera-stop">
          ⏹️ Stop Camera
        </button>
      </div>
      {qrData && (
        <>
          <div className="qr-data-display">
            <h3>📊 Scanned QR Data:</h3>
            <p className="qr-data-text">{qrData}</p>
          </div>
          <button onClick={processScannedQR} className="btn-process-qr">
            ✓ Process Request
          </button>
        </>
      )}
      {!qrData && (
        <div className="scanner-hint">
          <p>Point your camera at a QR code to scan</p>
        </div>
      )}
    </div>
    <div className="metrics-grid">
      <div className="metric-card">
        <p className="metric-label">Data Protected</p>
        <p className="metric-value metric-green">{privacyMetrics.dataProtected}%</p>
      </div>
      <div className="metric-card">
        <p className="metric-label">QR Scans Today</p>
        <p className="metric-value metric-purple">{stats.qrScansToday}</p>
      </div>
      <div className="metric-card">
        <p className="metric-label">Encryption</p>
        <p className="metric-value metric-cyan">{privacyMetrics.encryptionLevel}</p>
      </div>
    </div>
  </div>
);

const DashboardView: React.FC<{
  stats: Stats;
  activityLog: any[];
  privacyMetrics: PrivacyMetrics;
  setCurrentView: (view: ViewType) => void;
}> = ({ stats, activityLog, privacyMetrics, setCurrentView }) => (
  <div className="dashboard-view">
    <div className="dashboard-header">
      <div>
        <h1>Verification Dashboard</h1>
        <p>Real-time privacy & security analytics</p>
      </div>
      <button onClick={() => setCurrentView('home')} className="btn-home">
        ← Home
      </button>
    </div>
    <div className="dashboard-metrics">
      <div className="metric-box metric-purple">
        <p className="metric-label">Total Verifications</p>
        <p className="metric-number">{stats.totalVerifications}</p>
        <p className="metric-change">↑ 12 this month</p>
      </div>
      <div className="metric-box metric-cyan">
        <p className="metric-label">Success Rate</p>
        <p className="metric-number metric-cyan-text">{stats.successRate}%</p>
        <div className="progress-bar">
          <div className="progress-fill" style={{width: `${stats.successRate}%`}}></div>
        </div>
      </div>
      <div className="metric-box metric-green">
        <p className="metric-label">Data Protected</p>
        <p className="metric-number metric-green-text">{stats.dataPrivacySaved}</p>
        <p className="metric-change">✓ Zero data leaked</p>
      </div>
      <div className="metric-box metric-blue">
        <p className="metric-label">Avg Trust Score</p>
        <p className="metric-number metric-blue-text">{stats.averageTrustScore}</p>
        <p className="metric-change">/ 100</p>
      </div>
    </div>
    <div className="dashboard-panels">
      <div className="activity-panel">
        <h2>📋 Recent Activity</h2>
        <div className="activity-list">
          {activityLog.slice(0, 5).map((log, idx) => (
            <div key={idx} className="activity-item">
              <div className="activity-number">{idx + 1}</div>
              <div className="activity-content">
                <p className="activity-action">{log.action}</p>
                <p className="activity-time">{log.time}</p>
              </div>
              <span className="activity-status">
                {log.status === 'success' ? '✓' : log.status === 'warning' ? '⚠️' : 'ℹ️'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="privacy-panel">
        <h2>🔒 Privacy Metrics</h2>
        <div className="privacy-content">
          <div className="privacy-item">
            <div className="privacy-item-header">
              <span>Data Protection Level</span>
              <span className="privacy-value-green">{privacyMetrics.dataProtected}%</span>
            </div>
            <div className="privacy-progress-bar">
              <div className="privacy-progress-fill" style={{width: '100%'}}></div>
            </div>
          </div>
          <div className="privacy-item">
            <p className="privacy-label">Proof Generation Time</p>
            <p className="privacy-time">{privacyMetrics.proofGenTime}ms</p>
            <p className="privacy-hint">Average ZK proof generation</p>
          </div>
          <div className="privacy-item">
            <p className="privacy-label">Encryption Standard</p>
            <p className="privacy-encryption">{privacyMetrics.encryptionLevel}</p>
            <p className="privacy-hint">Military-grade encryption</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const WalletView: React.FC<{
  userIdentity: UserIdentity | null;
  credentials: Credential[];
  setCurrentView: (view: ViewType) => void;
}> = ({ userIdentity, credentials, setCurrentView }) => (
  <div className="wallet-view">
    <div className="view-header">
      <button onClick={() => setCurrentView('home')} className="back-button">
        <span>←</span> Back
      </button>
      <h1>Aegis Wallet</h1>
      <div className="spacer"></div>
    </div>
    <div className="identity-card">
      <div className="identity-header">
        <div>
          <p className="identity-label">Decentralized Identity</p>
          <p className="identity-did">{userIdentity?.did}</p>
        </div>
        <span className="identity-shield">🛡️</span>
      </div>
      <div className="identity-footer">
        <div>
          <p className="identity-title">Active Wallet</p>
          <p className="identity-date">Created {userIdentity && new Date(userIdentity.created).toLocaleDateString()}</p>
        </div>
        <div className="verified-badge">
          ✓ Verified
        </div>
      </div>
    </div>
    <div className="credentials-section">
      <h2 className="section-title">
        📄 Your Credentials ({credentials.length})
      </h2>
      <div className="credentials-grid">
        {credentials.map(cred => (
          <div key={cred.id} className="credential-card">
            <div className="credential-header">
              <div>
                <h3 className="credential-type">{cred.type}</h3>
                <p className="credential-issuer">Issued by {cred.issuer}</p>
              </div>
              <span className="credential-verified">✓</span>
            </div>
            <div className="credential-details">
              <div className="credential-row">
                <span>Issue Date:</span>
                <span>{new Date(cred.issuedDate).toLocaleDateString()}</span>
              </div>
              <div className="credential-row">
                <span>Schema:</span>
                <span className="credential-schema">{cred.schema.slice(0, 20)}...</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    <button onClick={() => setCurrentView('demo')} className="btn-full-width">
      🔍 Scan Verification Request
    </button>
  </div>
);

const DemoView: React.FC<{
  mockRequests: Request[];
  scanRequest: (request: Request) => void;
  setCurrentView: (view: ViewType) => void;
}> = ({ mockRequests, scanRequest, setCurrentView }) => (
  <div className="demo-view">
    <button onClick={() => setCurrentView('home')} className="back-button">
      <span>←</span> Back to Home
    </button>
    <div className="demo-header">
      <h1>Verification Portal</h1>
      <p>Select a service to initiate zero-knowledge verification</p>
    </div>
    <div className="requests-grid">
      {mockRequests.map(request => (
        <div key={request.id} className="request-card">
          <div className="request-content">
            <div className={`request-logo gradient-${request.color}`}>
              {request.logo}
            </div>
            <h3 className="request-title">{request.serviceName}</h3>
            <p className="request-purpose">{request.purpose}</p>
          </div>
          <div className="request-details">
            <div className="request-detail-item">
              <span className="detail-icon">🔑</span>
              <div>
                <p className="detail-label">Data Required:</p>
                <p className="detail-value">{request.dataRequested.join(', ')}</p>
              </div>
            </div>
            <div className="request-detail-item">
              <span className="detail-icon">⚠️</span>
              <div>
                <p className="detail-label">Retention Period:</p>
                <p className="detail-value">{request.retentionPeriod}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => scanRequest(request)} 
            className={`btn-request gradient-${request.color}`}
          >
            📱 Generate ZK Verification
          </button>
        </div>
      ))}
    </div>
  </div>
);

const VerificationView: React.FC<{
  activeRequest: Request | null;
  aiAnalysis: AIAnalysis | null;
  proofGenerating: boolean;
  generateZKProof: () => void;
  setCurrentView: (view: ViewType) => void;
}> = ({ activeRequest, aiAnalysis, proofGenerating, generateZKProof, setCurrentView }) => (
  <div className="verification-view">
    <button onClick={() => setCurrentView('demo')} className="back-button">
      <span>←</span> Cancel Verification
    </button>
    <div className="verification-grid">
      <div className="request-details-panel">
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-logo">{activeRequest?.logo}</div>
            <div>
              <h2 className="panel-title">{activeRequest?.serviceName}</h2>
              <p className="panel-subtitle">{activeRequest?.purpose}</p>
            </div>
          </div>
          <div className="panel-sections">
            <div className="panel-section">
              <h3 className="section-label">PROOF REQUIREMENT</h3>
              <div className="proof-box">
                <p className="proof-text">Income &lt; ₹{activeRequest?.requiredProof.threshold.toLocaleString()}</p>
                <p className="proof-hint">Zero-knowledge range proof required</p>
              </div>
            </div>
            <div className="panel-section">
              <h3 className="section-label">DATA HANDLING</h3>
              <ul className="data-list">
                {activeRequest?.dataRequested.map((data, idx) => (
                  <li key={idx} className="data-item">
                    <div className="data-bullet"></div>
                    {data}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div className="analysis-panel">
        {aiAnalysis ? (
          <>
            <div className="panel-card">
              <div className="analysis-header">
                <div className="analysis-title-group">
                  <span className="analysis-icon">🧠</span>
                  <h3>AI Sentinel Analysis</h3>
                </div>
                <div className={`risk-badge risk-${aiAnalysis.riskLevel}`}>
                  {aiAnalysis.riskLevel.toUpperCase()}
                </div>
              </div>
              <div className="trust-score">
                <div className="trust-score-header">
                  <span>Trust Score</span>
                  <span className="trust-score-value">{aiAnalysis.trustScore}/100</span>
                </div>
                <div className="trust-score-bar">
                  <div className="trust-score-fill" style={{width: `${aiAnalysis.trustScore}%`}}></div>
                </div>
              </div>
              {aiAnalysis.concerns.length > 0 && (
                <div className="analysis-section">
                  <h4 className="analysis-section-title">
                    ⚠️ CONCERNS DETECTED
                  </h4>
                  <ul className="analysis-list">
                    {aiAnalysis.concerns.map((concern, idx) => (
                      <li key={idx} className="analysis-item">{concern}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="analysis-section">
                <h4 className="analysis-section-title">
                  ✓ RECOMMENDATIONS
                </h4>
                <ul className="analysis-list">
                  {aiAnalysis.recommendations.map((rec, idx) => (
                    <li key={idx} className="analysis-item">{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
            <button 
              onClick={generateZKProof} 
              disabled={proofGenerating}
              className="btn-generate-proof"
            >
              {proofGenerating ? (
                <>
                  <div className="spinner"></div>
                  Generating ZK Proof...
                </>
              ) : (
                '⚡ Generate Zero-Knowledge Proof'
              )}
            </button>
          </>
        ) : (
          <div className="loading-panel">
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <p>AI Sentinel analyzing request...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);

const SuccessView: React.FC<{ setCurrentView: (view: ViewType) => void }> = ({ setCurrentView }) => (
  <div className="success-view">
    <div className="success-card">
      <div className="success-icon">
        <span>✓</span>
      </div>
      <h1 className="success-title">Verification Successful!</h1>
      <p className="success-subtitle">
        Your eligibility has been verified using zero-knowledge cryptography.
      </p>
      <div className="success-info">
        <h3>What Just Happened?</h3>
        <ul className="success-list">
          <li>
            <span className="success-list-icon">🛡️</span>
            <span>Your income credential was cryptographically proven to be below ₹50,000</span>
          </li>
          <li>
            <span className="success-list-icon">🔒</span>
            <span>Zero actual data was transmitted - only the mathematical proof</span>
          </li>
          <li>
            <span className="success-list-icon">✓</span>
            <span>The verifier now knows you're eligible without knowing your exact income</span>
          </li>
        </ul>
      </div>
      <div className="success-actions">
        <button onClick={() => setCurrentView('home')} className="btn-secondary-action">
          Back to Home
        </button>
        <button onClick={() => setCurrentView('demo')} className="btn-primary-action">
          Try Another Verification
        </button>
      </div>
    </div>
  </div>
);

const HowItWorksView: React.FC<{ setCurrentView: (view: ViewType) => void }> = ({ setCurrentView }) => (
  <div className="how-it-works-view">
    <button onClick={() => setCurrentView('home')} className="back-button">
      <span>←</span> Back to Home
    </button>
    <h1 className="page-title">How Aegis-Link Works</h1>
    <p className="page-subtitle">
      A revolutionary approach to digital identity verification using zero-knowledge cryptography
    </p>
    <div className="sections-container">
      <div className="problem-section">
        <h2 className="section-heading">⚠️ The Data Copy Paradox</h2>
        <div className="problem-grid">
          <div>
            <h3 className="subsection-title">Current System Problems:</h3>
            <ul className="problem-list">
              <li><span>✕</span><span>You upload entire documents to prove simple facts</span></li>
              <li><span>✕</span><span>Service providers store unnecessary personal data</span></li>
              <li><span>✕</span><span>Data breaches expose millions of records</span></li>
              <li><span>✕</span><span>Users have no control after sharing</span></li>
            </ul>
          </div>
          <div className="problem-example">
            <p className="example-quote">"To prove I'm over 18, I upload my driver's license..."</p>
            <div className="example-box">
              <p><strong>What they needed:</strong> Age verification</p>
              <p><strong>What they got:</strong> Full name, address, license number, photo, expiry date...</p>
            </div>
          </div>
        </div>
      </div>
      <div className="solution-section">
        <h2 className="section-heading">🛡️ The Aegis-Link Solution</h2>
        <div className="solution-content">
          <h3 className="subsection-title">How Zero-Knowledge Proofs Work:</h3>
          <div className="solution-steps">
            <div className="solution-detail-step">
              <div className="step-icon-large">🔐</div>
              <h4>1. Credential Issuance</h4>
              <p>Trusted authorities (government, universities) issue cryptographically signed credentials directly to your device. These credentials contain your private data but are never uploaded anywhere.</p>
            </div>
            <div className="solution-detail-step">
              <div className="step-icon-large">🔒</div>
              <h4>2. Local Storage</h4>
              <p>All credentials are stored locally on your device. You maintain complete control - no central database, no honeypot for hackers.</p>
            </div>
            <div className="solution-detail-step">
              <div className="step-icon-large">⚡</div>
              <h4>3. Proof Generation</h4>
              <p>When verification is needed, your device generates a mathematical proof that validates the claim (e.g., "income &lt; ₹50,000") without revealing the actual value.</p>
            </div>
            <div className="solution-detail-step">
              <div className="step-icon-large">✓</div>
              <h4>4. Verification</h4>
              <p>The verifier receives only the proof - not your data. They can confirm you meet the criteria without ever knowing your actual income, age, or other details.</p>
            </div>
          </div>
          <div className="benefits-grid">
            <div className="benefit-item">
              <span className="benefit-icon">🛡️</span>
              <div>
                <h4>Privacy First</h4>
                <p>Share proofs, not personal data</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🔒</span>
              <div>
                <h4>Cryptographically Secure</h4>
                <p>Impossible to forge or tamper with</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">⚡</span>
              <div>
                <h4>Instant Verification</h4>
                <p>Proof generation in milliseconds</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🎯</span>
              <div>
                <h4>Selective Disclosure</h4>
                <p>Prove only what's necessary</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className="cta-section">
      <button onClick={() => setCurrentView('demo')} className="btn-cta-large">
        Try the Live Demo
      </button>
    </div>
  </div>
);

const Notifications: React.FC<{ notifications: Notification[] }> = ({ notifications }) => (
  <div className="notifications-container">
    {notifications.map(notification => (
      <div key={notification.id} className={`notification notification-${notification.type}`}>
        {notification.message}
      </div>
    ))}
  </div>
);

export default App;