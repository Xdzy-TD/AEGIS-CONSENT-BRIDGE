const request = require('supertest');
const { expect } = require('chai');

// Mock your app setup
// const app = require('../server');

describe('Consent Management API Tests', () => {
  let authToken;
  let userId;
  let consentId;

  // ============================================
  // SETUP & TEARDOWN
  // ============================================

  before(async () => {
    // Register and login test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@consent.com',
        password: 'test123'
      });
    
    authToken = registerResponse.body.token;
    userId = registerResponse.body.user.id;
  });

  after(async () => {
    // Clean up test data
    // Delete test user and associated consents
  });

  // ============================================
  // CONSENT CREATION TESTS
  // ============================================

  describe('POST /api/consents', () => {
    it('should create a new consent with valid data', async () => {
      const consentData = {
        requester: 'Test Service',
        requester_type: 'service_provider',
        purpose: 'Testing consent creation',
        data_scope: {
          data_types: ['personal_info', 'contact_details'],
          sensitivity: 'medium'
        },
        recipients: ['Test Recipient'],
        retention_period: '90 days',
        lawful_basis: 'consent'
      };

      const response = await request(app)
        .post('/api/consents')
        .set('Authorization', `Bearer ${authToken}`)
        .send(consentData)
        .expect(201);

      expect(response.body).to.have.property('consent');
      expect(response.body).to.have.property('receipt');
      expect(response.body.consent.requester).to.equal('Test Service');
      expect(response.body.consent.status).to.equal('active');
      
      consentId = response.body.consent.consent_id;
    });

    it('should fail without required fields', async () => {
      const response = await request(app)
        .post('/api/consents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          requester: 'Test Service'
          // Missing other required fields
        })
        .expect(400);

      expect(response.body).to.have.property('error');
    });

    it('should fail without authentication', async () => {
      await request(app)
        .post('/api/consents')
        .send({
          requester: 'Test Service',
          purpose: 'Test',
          data_scope: {},
          recipients: [],
          retention_period: '90 days',
          lawful_basis: 'consent'
        })
        .expect(401);
    });

    it('should generate Kantara-compliant receipt', async () => {
      const consentData = {
        requester: 'Receipt Test Service',
        requester_type: 'service_provider',
        purpose: 'Testing receipt generation',
        data_scope: {
          data_types: ['income_verification'],
          sensitivity: 'high'
        },
        recipients: ['Test Org'],
        retention_period: '180 days',
        lawful_basis: 'consent'
      };

      const response = await request(app)
        .post('/api/consents')
        .set('Authorization', `Bearer ${authToken}`)
        .send(consentData)
        .expect(201);

      const receipt = response.body.receipt.receipt_data;
      
      // Validate Kantara format
      expect(receipt).to.have.property('version');
      expect(receipt).to.have.property('jurisdiction');
      expect(receipt).to.have.property('consentTimestamp');
      expect(receipt).to.have.property('piiController');
      expect(receipt).to.have.property('services');
      expect(receipt.version).to.equal('1.1.0');
    });
  });

  // ============================================
  // CONSENT RETRIEVAL TESTS
  // ============================================

  describe('GET /api/consents', () => {
    it('should retrieve all consents for user', async () => {
      const response = await request(app)
        .get('/api/consents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('consents');
      expect(response.body.consents).to.be.an('array');
      expect(response.body.consents.length).to.be.greaterThan(0);
    });

    it('should filter consents by status', async () => {
      const response = await request(app)
        .get('/api/consents?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.consents.forEach(consent => {
        expect(consent.status).to.equal('active');
      });
    });

    it('should filter active consents only', async () => {
      const response = await request(app)
        .get('/api/consents?active_only=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.consents.forEach(consent => {
        expect(consent.status).to.equal('active');
      });
    });
  });

  describe('GET /api/consents/:id', () => {
    it('should retrieve specific consent', async () => {
      const response = await request(app)
        .get(`/api/consents/${consentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.consent.consent_id).to.equal(consentId);
    });

    it('should return 404 for non-existent consent', async () => {
      await request(app)
        .get('/api/consents/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  // ============================================
  // CONSENT REVOCATION TESTS
  // ============================================

  describe('PATCH /api/consents/:id/revoke', () => {
    let revokeConsentId;

    before(async () => {
      // Create a consent to revoke
      const response = await request(app)
        .post('/api/consents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          requester: 'Revoke Test Service',
          requester_type: 'service_provider',
          purpose: 'Testing revocation',
          data_scope: { data_types: ['test'] },
          recipients: ['Test'],
          retention_period: '30 days',
          lawful_basis: 'consent'
        });
      
      revokeConsentId = response.body.consent.consent_id;
    });

    it('should successfully revoke active consent', async () => {
      const response = await request(app)
        .patch(`/api/consents/${revokeConsentId}/revoke`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Testing revocation functionality'
        })
        .expect(200);

      expect(response.body.consent.status).to.equal('revoked');
      expect(response.body.consent.revocation_reason).to.equal('Testing revocation functionality');
      expect(response.body.consent.revoked_at).to.not.be.null;
    });

    it('should fail to revoke already revoked consent', async () => {
      await request(app)
        .patch(`/api/consents/${revokeConsentId}/revoke`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Trying to revoke again'
        })
        .expect(400);
    });

    it('should require reason for revocation', async () => {
      await request(app)
        .patch(`/api/consents/${consentId}/revoke`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should create audit log entry on revocation', async () => {
      // Create new consent
      const createResponse = await request(app)
        .post('/api/consents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          requester: 'Audit Test Service',
          requester_type: 'service_provider',
          purpose: 'Testing audit trail',
          data_scope: { data_types: ['test'] },
          recipients: ['Test'],
          retention_period: '30 days',
          lawful_basis: 'consent'
        });
      
      const testConsentId = createResponse.body.consent.consent_id;

      // Revoke it
      await request(app)
        .patch(`/api/consents/${testConsentId}/revoke`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Audit test' });

      // Check audit trail
      const historyResponse = await request(app)
        .get(`/api/consents/${testConsentId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const revokeEvent = historyResponse.body.audit_trail.find(
        e => e.event_type === 'consent_revoked'
      );
      
      expect(revokeEvent).to.exist;
      expect(revokeEvent.event_description).to.include('revoked');
    });
  });

  // ============================================
  // CONSENT UPDATE & VERSIONING TESTS
  // ============================================

  describe('PATCH /api/consents/:id', () => {
    let versionTestConsentId;

    before(async () => {
      const response = await request(app)
        .post('/api/consents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          requester: 'Version Test Service',
          requester_type: 'service_provider',
          purpose: 'Original purpose',
          data_scope: { data_types: ['test'] },
          recipients: ['Test'],
          retention_period: '90 days',
          lawful_basis: 'consent'
        });
      
      versionTestConsentId = response.body.consent.consent_id;
    });

    it('should update consent and increment version', async () => {
      const response = await request(app)
        .patch(`/api/consents/${versionTestConsentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          purpose: 'Updated purpose',
          retention_period: '180 days'
        })
        .expect(200);

      expect(response.body.consent.version).to.equal(2);
      expect(response.body.consent.purpose).to.equal('Updated purpose');
      expect(response.body.consent.retention_period).to.equal('180 days');
      expect(response.body.previous_version).to.equal(1);
    });

    it('should create version record on update', async () => {
      const historyResponse = await request(app)
        .get(`/api/consents/${versionTestConsentId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.versions.length).to.be.greaterThan(0);
      expect(historyResponse.body.versions[0].version_number).to.equal(2);
    });
  });

  // ============================================
  // CONSENT HISTORY & AUDIT TESTS
  // ============================================

  describe('GET /api/consents/:id/history', () => {
    it('should retrieve full consent history', async () => {
      const response = await request(app)
        .get(`/api/consents/${consentId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('versions');
      expect(response.body).to.have.property('audit_trail');
      expect(response.body.versions).to.be.an('array');
      expect(response.body.audit_trail).to.be.an('array');
    });

    it('should include cryptographic hashes in audit trail', async () => {
      const response = await request(app)
        .get(`/api/consents/${consentId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.audit_trail.forEach(entry => {
        expect(entry).to.have.property('current_audit_hash');
        expect(entry.current_audit_hash).to.be.a('string');
        expect(entry.current_audit_hash.length).to.equal(64); // SHA-256 hex
      });
    });

    it('should maintain audit chain integrity', async () => {
      const response = await request(app)
        .get(`/api/consents/${consentId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const trail = response.body.audit_trail.sort(
        (a, b) => new Date(a.event_timestamp) - new Date(b.event_timestamp)
      );

      // Verify each entry links to previous
      for (let i = 1; i < trail.length; i++) {
        expect(trail[i].previous_audit_hash).to.equal(
          trail[i - 1].current_audit_hash
        );
      }
    });
  });

  // ============================================
  // CONSENT RECEIPT TESTS
  // ============================================

  describe('GET /api/consents/:id/receipt', () => {
    it('should retrieve consent receipt', async () => {
      const response = await request(app)
        .get(`/api/consents/${consentId}/receipt`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('receipt');
      expect(response.body.receipt).to.have.property('receipt_data');
      expect(response.body.receipt).to.have.property('receipt_hash');
    });

    it('should track receipt downloads', async () => {
      const initialResponse = await request(app)
        .get(`/api/consents/${consentId}/receipt`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const initialCount = initialResponse.body.receipt.download_count;

      await request(app)
        .get(`/api/consents/${consentId}/receipt`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const updatedResponse = await request(app)
        .get(`/api/consents/${consentId}/receipt`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedResponse.body.receipt.download_count).to.be.greaterThan(initialCount);
    });
  });

  describe('GET /api/consents/:id/receipt/download', () => {
    it('should download receipt in JSON format', async () => {
      const response = await request(app)
        .get(`/api/consents/${consentId}/receipt/download?format=json`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).to.include('application/json');
      expect(response.headers['content-disposition']).to.include('attachment');
    });
  });

  // ============================================
  // BULK OPERATIONS TESTS
  // ============================================

  describe('POST /api/consents/bulk-revoke', () => {
    let bulkConsentIds = [];

    before(async () => {
      // Create multiple consents for bulk operations
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/consents')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            requester: `Bulk Test Service ${i}`,
            requester_type: 'service_provider',
            purpose: 'Bulk test',
            data_scope: { data_types: ['test'] },
            recipients: ['Test'],
            retention_period: '30 days',
            lawful_basis: 'consent'
          });
        
        bulkConsentIds.push(response.body.consent.consent_id);
      }
    });

    it('should revoke multiple consents', async () => {
      const response = await request(app)
        .post('/api/consents/bulk-revoke')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consent_ids: bulkConsentIds,
          reason: 'Bulk revocation test'
        })
        .expect(200);

      expect(response.body.revoked_consents).to.have.lengthOf(3);
    });

    it('should require consent_ids array', async () => {
      await request(app)
        .post('/api/consents/bulk-revoke')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Test'
        })
        .expect(400);
    });
  });

  // ============================================
  // STATISTICS TESTS
  // ============================================

  describe('GET /api/consents/stats/summary', () => {
    it('should return consent statistics', async () => {
      const response = await request(app)
        .get('/api/consents/stats/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('statistics');
      expect(response.body.statistics).to.have.property('total_consents');
      expect(response.body.statistics).to.have.property('active_consents');
      expect(response.body.statistics).to.have.property('revoked_consents');
      expect(response.body.statistics).to.have.property('unique_requesters');
    });
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe('Consent Management Integration Tests', () => {
  it('should handle complete consent lifecycle', async () => {
    // 1. Create consent
    const createResponse = await request(app)
      .post('/api/consents')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        requester: 'Lifecycle Test',
        requester_type: 'service_provider',
        purpose: 'Full lifecycle test',
        data_scope: { data_types: ['personal_info'] },
        recipients: ['Test Org'],
        retention_period: '90 days',
        lawful_basis: 'consent'
      })
      .expect(201);

    const lifecycleConsentId = createResponse.body.consent.consent_id;
    expect(createResponse.body).to.have.property('receipt');

    // 2. Update consent
    const updateResponse = await request(app)
      .patch(`/api/consents/${lifecycleConsentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ purpose: 'Updated lifecycle test' })
      .expect(200);

    expect(updateResponse.body.consent.version).to.equal(2);

    // 3. Check history
    const historyResponse = await request(app)
      .get(`/api/consents/${lifecycleConsentId}/history`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(historyResponse.body.versions.length).to.be.greaterThan(0);
    expect(historyResponse.body.audit_trail.length).to.be.greaterThan(0);

    // 4. Download receipt
    await request(app)
      .get(`/api/consents/${lifecycleConsentId}/receipt/download?format=json`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // 5. Revoke consent
    const revokeResponse = await request(app)
      .patch(`/api/consents/${lifecycleConsentId}/revoke`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ reason: 'Lifecycle test complete' })
      .expect(200);

    expect(revokeResponse.body.consent.status).to.equal('revoked');

    // 6. Verify final state
    const finalResponse = await request(app)
      .get(`/api/consents/${lifecycleConsentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(finalResponse.body.consent.status).to.equal('revoked');
    expect(finalResponse.body.consent.revocation_reason).to.equal('Lifecycle test complete');
  });
});

module.exports = {
  // Export test suites for CI/CD
};