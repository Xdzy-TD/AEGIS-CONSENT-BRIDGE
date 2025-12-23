import React, { useState, useEffect, useCallback, useRef } from 'react';
import './ConsentManagement.css';

// Types
interface DataScope {
  data_types: string[];
  sensitivity?: string;
}

interface Consent {
  consent_id: string;
  requester: string;
  purpose: string;
  data_scope: DataScope;
  recipients: string[];
  retention_period: string;
  lawful_basis: string;
  status: 'active' | 'revoked' | 'expired' | 'superseded';
  version: number;
  created_at: string;
  end_timestamp?: string;
  revoked_at?: string;
  revocation_reason?: string;
}

interface ConsentHistoryData {
  versions: Array<{
    version_number: number;
    created_at: string;
    change_type: string;
    change_reason?: string;
    current_hash?: string;
  }>;
  audit_trail: Array<{
    event_type: string;
    event_timestamp: string;
    event_description: string;
    metadata?: Record<string, any>;
    current_audit_hash?: string;
  }>;
}

interface FormData {
  requester: string;
  requester_type: 'service_provider' | 'government_service' | 'healthcare_provider' | 'financial_institution' | 'educational_institution' | 'third_party';
  purpose: string;
  data_types: string[];
  recipients: string;
  retention_period: string;
  lawful_basis: string;
  end_timestamp: string;
}

// ============================================
// Main Consent Management Component
// ============================================

export const ConsentManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'history'>('list');
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedConsent, setSelectedConsent] = useState<Consent | null>(null);

  const fetchConsents = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/consents', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setConsents(data.consents || []);
    } catch (error) {
      console.error('Failed to fetch consents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  return (
    <div className="consent-management" role="main">
      <div className="consent-header">
        <h1>🔐 Consent Management</h1>
        <p>Manage your data sharing permissions</p>
      </div>

      <div className="consent-tabs" role="tablist">
        <button 
          className={activeTab === 'list' ? 'active' : ''}
          onClick={() => setActiveTab('list')}
          role="tab"
          aria-selected={activeTab === 'list'}
        >
          My Consents
        </button>
        <button 
          className={activeTab === 'create' ? 'active' : ''}
          onClick={() => setActiveTab('create')}
          role="tab"
          aria-selected={activeTab === 'create'}
        >
          Grant Consent
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
          role="tab"
          aria-selected={activeTab === 'history'}
        >
          History & Audit
        </button>
      </div>

      <div className="consent-content">
        {activeTab === 'list' && (
          <ConsentList 
            consents={consents} 
            onRefresh={fetchConsents}
            onSelectConsent={setSelectedConsent}
            loading={loading}
          />
        )}
        {activeTab === 'create' && (
          <ConsentForm onSuccess={fetchConsents} />
        )}
        {activeTab === 'history' && selectedConsent && (
          <ConsentHistoryComponent consent={selectedConsent} />
        )}
      </div>
    </div>
  );
};

// ============================================
// Consent List Component
// ============================================

interface ConsentListProps {
  consents: Consent[];
  onRefresh: () => void;
  onSelectConsent: (consent: Consent) => void;
  loading: boolean;
}

const ConsentList: React.FC<ConsentListProps> = ({ 
  consents, 
  onRefresh, 
  onSelectConsent,
  loading 
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [consentToRevoke, setConsentToRevoke] = useState<Consent | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  const filteredConsents = consents.filter(c => 
    filterStatus === 'all' || c.status === filterStatus
  );

  const handleRevoke = useCallback(async () => {
    if (!consentToRevoke || !revokeReason.trim()) {
      alert('Please provide a reason for revocation');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/consents/${consentToRevoke.consent_id}/revoke`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: revokeReason }),
      });

      if (response.ok) {
        alert('Consent revoked successfully');
        setShowRevokeModal(false);
        setConsentToRevoke(null);
        setRevokeReason('');
        onRefresh();
      } else {
        const errorData = await response.json();
        alert(`Failed to revoke consent: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Revoke error:', error);
      alert('Error revoking consent');
    }
  }, [consentToRevoke, revokeReason, onRefresh]);

  const downloadReceipt = useCallback(async (consentId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/consents/${consentId}/receipt/download?format=json`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consent-receipt-${consentId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download receipt');
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowRevokeModal(false);
    }
  }, []);

  return (
    <div className="consent-list">
      <div className="list-header">
        <div className="filter-controls">
          <label htmlFor="status-filter">Filter by status:</label>
          <select 
            id="status-filter"
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter consents by status"
          >
            <option value="all">All Consents</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <button 
          onClick={onRefresh} 
          className="btn-refresh"
          disabled={loading}
          aria-label="Refresh consent list"
        >
          {loading ? '🔄 Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {filteredConsents.length === 0 ? (
        <div className="empty-state" role="status">
          <p>📋 No consents found</p>
          <p className="empty-hint">Grant consent to services to see them here</p>
        </div>
      ) : (
        <div className="consent-grid" role="list">
          {filteredConsents.map((consent) => (
            <article key={consent.consent_id} className={`consent-card status-${consent.status}`} role="listitem">
              <div className="consent-card-header">
                <div className="consent-requester">
                  <h3>{consent.requester}</h3>
                  <span className={`status-badge status-${consent.status}`} aria-label={`Status: ${consent.status}`}>
                    {consent.status}
                  </span>
                </div>
                <div className="consent-version" aria-label={`Version ${consent.version}`}>v{consent.version}</div>
              </div>

              <div className="consent-card-body">
                <div className="consent-detail">
                  <span className="detail-label">Purpose:</span>
                  <p className="detail-value">{consent.purpose}</p>
                </div>

                <div className="consent-detail">
                  <span className="detail-label">Data Scope:</span>
                  <div className="data-tags" role="list">
                    {consent.data_scope?.data_types?.map((type, idx) => (
                      <span key={idx} className="data-tag" role="listitem">{type.replace(/_/g, ' ')}</span>
                    )) || <span className="data-tag">None</span>}
                  </div>
                </div>

                <div className="consent-detail">
                  <span className="detail-label">Recipients:</span>
                  <p className="detail-value">{consent.recipients.join(', ') || 'None'}</p>
                </div>

                <div className="consent-meta">
                  <div className="meta-item">
                    <span>📅 Created:</span>
                    <time dateTime={consent.created_at}>{new Date(consent.created_at).toLocaleDateString()}</time>
                  </div>
                  <div className="meta-item">
                    <span>⏰ Retention:</span>
                    <span>{consent.retention_period}</span>
                  </div>
                  <div className="meta-item">
                    <span>⚖️ Basis:</span>
                    <span>{consent.lawful_basis.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                {consent.end_timestamp && (
                  <div className="consent-expiry">
                    Expires: <time dateTime={consent.end_timestamp}>{new Date(consent.end_timestamp).toLocaleDateString()}</time>
                  </div>
                )}

                {consent.revoked_at && (
                  <div className="consent-revoked-info">
                    <p><strong>Revoked:</strong> {new Date(consent.revoked_at).toLocaleDateString()}</p>
                    <p><strong>Reason:</strong> {consent.revocation_reason}</p>
                  </div>
                )}
              </div>

              <div className="consent-card-actions">
                <button 
                  onClick={() => onSelectConsent(consent)}
                  className="btn-action btn-view"
                  aria-label={`View history for ${consent.requester}`}
                >
                  📜 View History
                </button>
                <button 
                  onClick={() => downloadReceipt(consent.consent_id)}
                  className="btn-action btn-download"
                  aria-label={`Download receipt for ${consent.requester}`}
                >
                  ⬇️ Receipt
                </button>
                {consent.status === 'active' && (
                  <button 
                    onClick={() => {
                      setConsentToRevoke(consent);
                      setShowRevokeModal(true);
                    }}
                    className="btn-action btn-revoke"
                    aria-label={`Revoke consent for ${consent.requester}`}
                  >
                    🚫 Revoke
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {showRevokeModal && consentToRevoke && (
        <div 
          className="modal-overlay" 
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-title"
          aria-describedby="revoke-description"
          onKeyDown={handleKeyDown}
          ref={modalRef}
        >
          <div className="modal-content">
            <h2 id="revoke-title">⚠️ Revoke Consent</h2>
            <p id="revoke-description">You are about to revoke consent for:</p>
            <p className="modal-highlight">{consentToRevoke.requester}</p>
            
            <div className="modal-warning">
              <p><strong>Important:</strong></p>
              <ul>
                <li>This action cannot be undone</li>
                <li>The service may stop functioning without this consent</li>
                <li>Data may be deleted according to retention policy</li>
              </ul>
            </div>

            <div className="form-group">
              <label htmlFor="revoke-reason">Reason for revocation: *</label>
              <textarea
                id="revoke-reason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Please explain why you're revoking this consent..."
                rows={4}
                required
                aria-describedby="revoke-reason-help"
              />
              <div id="revoke-reason-help" className="sr-only">Required field</div>
            </div>

            <div className="modal-actions">
              <button 
                onClick={() => setShowRevokeModal(false)} 
                className="btn-cancel"
                autoFocus
              >
                Cancel
              </button>
              <button 
                onClick={handleRevoke} 
                className="btn-confirm-revoke"
                disabled={!revokeReason.trim()}
              >
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Consent Form Component
// ============================================

interface ConsentFormProps {
  onSuccess: () => void;
}

const ConsentForm: React.FC<ConsentFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<FormData>({
    requester: '',
    requester_type: 'service_provider',
    purpose: '',
    data_types: [],
    recipients: '',
    retention_period: '90 days',
    lawful_basis: 'consent',
    end_timestamp: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dataTypeOptions: string[] = [
    'personal_info', 'contact_details', 'financial_data', 'health_records',
    'location_data', 'biometric_data', 'educational_records', 'employment_history',
    'income_verification', 'age_verification'
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.requester.trim()) newErrors.requester = 'Service name is required';
    if (!formData.purpose.trim()) newErrors.purpose = 'Purpose is required';
    if (formData.data_types.length === 0) newErrors.data_types = 'At least one data type must be selected';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/consents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          requester: formData.requester,
          requester_type: formData.requester_type,
          purpose: formData.purpose,
          data_scope: {
            data_types: formData.data_types,
            sensitivity: 'medium',
          },
          recipients: formData.recipients.split(',').map(r => r.trim()).filter(Boolean),
          retention_period: formData.retention_period,
          lawful_basis: formData.lawful_basis,
          end_timestamp: formData.end_timestamp || undefined,
        }),
      });

      if (response.ok) {
        alert('Consent granted successfully!');
        onSuccess();
        setFormData({
          requester: '',
          requester_type: 'service_provider',
          purpose: '',
          data_types: [],
          recipients: '',
          retention_period: '90 days',
          lawful_basis: 'consent',
          end_timestamp: '',
        });
      } else {
        const errorData = await response.json();
        alert(`Failed to create consent: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('Error creating consent');
    } finally {
      setLoading(false);
    }
  };

  const toggleDataType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      data_types: prev.data_types.includes(type)
        ? prev.data_types.filter(t => t !== type)
        : [...prev.data_types, type],
    }));
  };

  const updateFormField = useCallback((field: keyof FormData) => 
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData(prev => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }));
      }
    }, [errors]);

  return (
    <div className="consent-form">
      <div className="form-header">
        <h2>Grant New Consent</h2>
        <p>Carefully review what data you're sharing and why</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-section">
          <h3>Service Information</h3>
          
          <div className="form-group">
            <label htmlFor="requester">Service/Requester Name *</label>
            <input
              id="requester"
              type="text"
              value={formData.requester}
              onChange={updateFormField('requester')}
              placeholder="e.g., National Scholarship Portal"
              aria-invalid={!!errors.requester}
              aria-describedby={errors.requester ? "requester-error" : undefined}
              required
            />
            {errors.requester && (
              <span id="requester-error" className="error-message" role="alert">
                {errors.requester}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="requester-type">Requester Type *</label>
            <select
              id="requester-type"
              value={formData.requester_type}
              onChange={updateFormField('requester_type')}
            >
              <option value="service_provider">Service Provider</option>
              <option value="government_service">Government Service</option>
              <option value="healthcare_provider">Healthcare Provider</option>
              <option value="financial_institution">Financial Institution</option>
              <option value="educational_institution">Educational Institution</option>
              <option value="third_party">Third Party</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="purpose">Purpose of Data Usage *</label>
            <textarea
              id="purpose"
              value={formData.purpose}
              onChange={updateFormField('purpose')}
              placeholder="Explain why you need this data..."
              rows={3}
              aria-invalid={!!errors.purpose}
              aria-describedby={errors.purpose ? "purpose-error" : undefined}
              required
            />
            {errors.purpose && (
              <span id="purpose-error" className="error-message" role="alert">
                {errors.purpose}
              </span>
            )}
          </div>
        </div>

        <div className="form-section">
          <h3>Data Types *</h3>
          <div className="checkbox-group" role="group" aria-labelledby="data-types-label">
            <div id="data-types-label" className="sr-only">Select data types you consent to share</div>
            {dataTypeOptions.map(type => (
              <label key={type} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.data_types.includes(type)}
                  onChange={() => toggleDataType(type)}
                />
                {type.replace(/_/g, ' ')}
              </label>
            ))}
          </div>
          {errors.data_types && (
            <span className="error-message" role="alert">{errors.data_types}</span>
          )}
        </div>

        <div className="form-section">
          <h3>Additional Details</h3>
          
          <div className="form-group">
            <label htmlFor="recipients">Recipients (comma-separated)</label>
            <input
              id="recipients"
              type="text"
              value={formData.recipients}
              onChange={updateFormField('recipients')}
              placeholder="e.g., scholarships@nsp.gov.in, admin@university.edu"
            />
          </div>

          <div className="form-group">
            <label htmlFor="retention">Retention Period *</label>
            <select
              id="retention"
              value={formData.retention_period}
              onChange={updateFormField('retention_period')}
            >
              <option value="30 days">30 days</option>
              <option value="90 days">90 days</option>
              <option value="6 months">6 months</option>
              <option value="1 year">1 year</option>
              <option value="indefinite">Indefinite</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="lawful-basis">Lawful Basis *</label>
            <select
              id="lawful-basis"
              value={formData.lawful_basis}
              onChange={updateFormField('lawful_basis')}
            >
              <option value="consent">User Consent</option>
              <option value="legal_obligation">Legal Obligation</option>
              <option value="vital_interests">Vital Interests</option>
              <option value="public_task">Public Task</option>
              <option value="legitimate_interests">Legitimate Interests</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="end-timestamp">Expiry Date (Optional)</label>
            <input
              id="end-timestamp"
              type="date"
              value={formData.end_timestamp}
              onChange={updateFormField('end_timestamp')}
            />
          </div>
        </div>

        <div className="consent-confirmation">
          <div className="confirmation-box">
            <h4>⚠️ Before You Proceed</h4>
            <ul role="list">
              <li>I understand what data I'm sharing and why</li>
              <li>I can revoke this consent at any time</li>
              <li>I will receive a consent receipt for my records</li>
              <li>My consent is recorded with cryptographic proof</li>
            </ul>
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            disabled={loading || Object.keys(errors).length > 0}
            className="btn-submit"
          >
            {loading ? 'Processing...' : '✓ Grant Consent'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================
// Consent History Component (Fixed)
// ============================================

interface ConsentHistoryComponentProps {
  consent: Consent | null;
}

const ConsentHistoryComponent: React.FC<ConsentHistoryComponentProps> = ({ consent }) => {
  const [historyData, setHistoryData] = useState<ConsentHistoryData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!consent) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/consents/${consent.consent_id}/history`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setHistoryData(data);
        }
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [consent]);

  if (!consent) {
    return (
      <div className="empty-state">
        <p>Select a consent to view its history</p>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading history...</div>;
  }

  return (
    <div className="consent-history">
      <div className="history-header">
        <h2>History & Audit Trail</h2>
        <p>Consent ID: {consent.consent_id}</p>
      </div>

      {historyData && (
        <>
          <div className="history-section">
            <h3>Version History</h3>
            <div className="timeline" role="list">
              {historyData.versions.map((version, idx) => (
                <div key={idx} className="timeline-item" role="listitem">
                  <div className="timeline-marker">v{version.version_number}</div>
                  <div className="timeline-content">
                    <p><strong>{version.change_type}</strong></p>
                    <p className="timeline-date">{new Date(version.created_at).toLocaleDateString()}</p>
                    {version.change_reason && <p>{version.change_reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="history-section">
            <h3>Audit Trail</h3>
            <div className="audit-log" role="list">
              {historyData.audit_trail.map((event, idx) => (
                <div key={idx} className="audit-entry" role="listitem">
                  <div className="audit-event">
                    <strong>{event.event_type}</strong>
                    <span className="audit-time">
                      {new Date(event.event_timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p>{event.event_description}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ConsentManagement;
