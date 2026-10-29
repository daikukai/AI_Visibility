import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { validateBusinessEmail } from '../src/emailValidator.js';
import {
  saveLeadRecord,
  getLeadRecord,
  setScanCache,
  getScanCache,
  clearMemoryStores,
  LeadRecord
} from '../src/storage.js';
import { sendLeadAlert } from '../src/notifier.js';

describe('Phase 3: Lead Capture & Storage Unit Tests', () => {
  beforeEach(() => {
    clearMemoryStores();
  });

  describe('Business Email Validation', () => {
    test('Accepts legitimate corporate business email addresses', async () => {
      const r1 = await validateBusinessEmail('kai@telzasales.com', { checkMx: false });
      assert.strictEqual(r1.valid, true);
      assert.strictEqual(r1.normalizedEmail, 'kai@telzasales.com');
      assert.strictEqual(r1.domain, 'telzasales.com');

      const r2 = await validateBusinessEmail('engineering-lead@stripe.com', { checkMx: false });
      assert.strictEqual(r2.valid, true);
    });

    test('Rejects personal and free webmail domains', async () => {
      const gmail = await validateBusinessEmail('john.doe@gmail.com', { checkMx: false });
      assert.strictEqual(gmail.valid, false);
      assert.match(gmail.reason || '', /personal webmail/i);

      const yahoo = await validateBusinessEmail('contact@yahoo.com', { checkMx: false });
      assert.strictEqual(yahoo.valid, false);

      const outlook = await validateBusinessEmail('corp@outlook.com', { checkMx: false });
      assert.strictEqual(outlook.valid, false);

      const proton = await validateBusinessEmail('founder@proton.me', { checkMx: false });
      assert.strictEqual(proton.valid, false);
    });

    test('Rejects disposable and burner email domains', async () => {
      const mailinator = await validateBusinessEmail('burner@mailinator.com', { checkMx: false });
      assert.strictEqual(mailinator.valid, false);
      assert.match(mailinator.reason || '', /disposable/i);

      const guerrilla = await validateBusinessEmail('temp@guerrillamail.com', { checkMx: false });
      assert.strictEqual(guerrilla.valid, false);
    });

    test('Rejects malformed email syntax', async () => {
      const invalid1 = await validateBusinessEmail('notanemail', { checkMx: false });
      assert.strictEqual(invalid1.valid, false);

      const invalid2 = await validateBusinessEmail('@domain.com', { checkMx: false });
      assert.strictEqual(invalid2.valid, false);

      const invalid3 = await validateBusinessEmail('test@', { checkMx: false });
      assert.strictEqual(invalid3.valid, false);
    });
  });

  describe('Storage & Netlify Blobs Record Life Cycle', () => {
    test('Stores and retrieves a full LeadRecord with status: new', async () => {
      const leadId = `lead_${Date.now()}_test1`;
      const lead: LeadRecord = {
        id: leadId,
        created_at: new Date().toISOString(),
        email: 'founder@acmeanalytics.com',
        domain: 'acmeanalytics.com',
        url: 'https://acmeanalytics.com',
        score: 72,
        unreadable_reason: null,
        what_they_sell: 'Enterprise predictive analytics engine',
        consent_at: new Date().toISOString(),
        status: 'new',
        report_sent_at: null,
        notes: null
      };

      await saveLeadRecord(lead);

      const retrieved = await getLeadRecord(leadId);
      assert.ok(retrieved, 'Lead record should be retrieved');
      assert.strictEqual(retrieved?.id, leadId);
      assert.strictEqual(retrieved?.email, 'founder@acmeanalytics.com');
      assert.strictEqual(retrieved?.domain, 'acmeanalytics.com');
      assert.strictEqual(retrieved?.score, 72);
      assert.strictEqual(retrieved?.status, 'new');
      assert.strictEqual(retrieved?.what_they_sell, 'Enterprise predictive analytics engine');
    });

    test('Handles unreadable lead record storage and reason', async () => {
      const leadId = `lead_${Date.now()}_test2`;
      const lead: LeadRecord = {
        id: leadId,
        created_at: new Date().toISOString(),
        email: 'cto@securedomain.io',
        domain: 'securedomain.io',
        url: 'https://securedomain.io',
        score: null,
        unreadable_reason: 'Bot challenge detected (Cloudflare verification page)',
        what_they_sell: 'Cloud firewalls',
        consent_at: new Date().toISOString(),
        status: 'new'
      };

      await saveLeadRecord(lead);

      const retrieved = await getLeadRecord(leadId);
      assert.ok(retrieved);
      assert.strictEqual(retrieved?.score, null);
      assert.strictEqual(retrieved?.unreadable_reason, 'Bot challenge detected (Cloudflare verification page)');
    });
  });

  describe('24-Hour Scan Cache Store', () => {
    test('Saves and reads fresh scan cache', async () => {
      const domain = 'cachedsample.com';
      const mockResult = { score: 88, band: 'Strong readiness', domain };

      await setScanCache(domain, mockResult);

      const cached = await getScanCache(domain);
      assert.ok(cached);
      assert.strictEqual(cached.score, 88);
      assert.strictEqual(cached.band, 'Strong readiness');
    });

    test('Returns null for missing cache key', async () => {
      const cached = await getScanCache('nonexistent-domain-404.com');
      assert.strictEqual(cached, null);
    });
  });

  describe('Lead Alert Notification Dispatch', () => {
    test('Dispatches lead notification alert without throwing', async () => {
      const lead: LeadRecord = {
        id: 'lead_alert_test',
        created_at: new Date().toISOString(),
        email: 'vp-sales@logisticsflow.com',
        domain: 'logisticsflow.com',
        url: 'https://logisticsflow.com',
        score: 64,
        what_they_sell: 'Freight tracking ERP',
        consent_at: new Date().toISOString(),
        status: 'new'
      };

      const result = await sendLeadAlert(lead);
      assert.strictEqual(result.sent, true);
      assert.ok(['resend', 'mock'].includes(result.provider));
    });
  });
});
