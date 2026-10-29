import { test, describe } from 'node:test';
import assert from 'node:assert';
import { isPublicIp, validateUrlForSSRF } from '../src/ssrf.js';

describe('SSRF Protection Unit Tests', () => {
  test('isPublicIp identifies valid public IPv4 addresses', () => {
    assert.strictEqual(isPublicIp('8.8.8.8'), true);
    assert.strictEqual(isPublicIp('1.1.1.1'), true);
    assert.strictEqual(isPublicIp('93.184.216.34'), true);
  });

  test('isPublicIp blocks loopback, private, and link-local ranges', () => {
    // Loopback
    assert.strictEqual(isPublicIp('127.0.0.1'), false);
    assert.strictEqual(isPublicIp('127.0.0.2'), false);

    // Private networks
    assert.strictEqual(isPublicIp('10.0.0.1'), false);
    assert.strictEqual(isPublicIp('10.255.255.255'), false);
    assert.strictEqual(isPublicIp('172.16.0.1'), false);
    assert.strictEqual(isPublicIp('172.31.255.255'), false);
    assert.strictEqual(isPublicIp('192.168.0.1'), false);
    assert.strictEqual(isPublicIp('192.168.1.254'), false);

    // Link-local & cloud metadata
    assert.strictEqual(isPublicIp('169.254.169.254'), false);
    assert.strictEqual(isPublicIp('169.254.1.1'), false);

    // Broadcast & unspecified
    assert.strictEqual(isPublicIp('0.0.0.0'), false);
    assert.strictEqual(isPublicIp('255.255.255.255'), false);

    // Documentation / test ranges
    assert.strictEqual(isPublicIp('192.0.2.1'), false);
    assert.strictEqual(isPublicIp('198.51.100.1'), false);
    assert.strictEqual(isPublicIp('203.0.113.1'), false);
  });

  test('isPublicIp blocks IPv6 loopback, local, and mapped addresses', () => {
    assert.strictEqual(isPublicIp('::1'), false);
    assert.strictEqual(isPublicIp('::'), false);
    assert.strictEqual(isPublicIp('fe80::1'), false);
    assert.strictEqual(isPublicIp('fc00::1'), false);
    assert.strictEqual(isPublicIp('::ffff:127.0.0.1'), false);
    assert.strictEqual(isPublicIp('::ffff:169.254.169.254'), false);
  });

  test('validateUrlForSSRF rejects non-http/https protocols', async () => {
    const fileRes = await validateUrlForSSRF('file:///etc/passwd');
    assert.strictEqual(fileRes.valid, false);

    const ftpRes = await validateUrlForSSRF('ftp://example.com');
    assert.strictEqual(ftpRes.valid, false);

    const gopherRes = await validateUrlForSSRF('gopher://example.com');
    assert.strictEqual(gopherRes.valid, false);
  });

  test('validateUrlForSSRF rejects non-standard ports', async () => {
    const portRes = await validateUrlForSSRF('https://example.com:8080');
    assert.strictEqual(portRes.valid, false);
    assert.match(portRes.reason || '', /standard web ports/i);

    const sshRes = await validateUrlForSSRF('http://example.com:22');
    assert.strictEqual(sshRes.valid, false);
  });

  test('validateUrlForSSRF rejects localhost and internal hostnames', async () => {
    const lh1 = await validateUrlForSSRF('http://localhost');
    assert.strictEqual(lh1.valid, false);

    const lh2 = await validateUrlForSSRF('http://test.local');
    assert.strictEqual(lh2.valid, false);

    const lh3 = await validateUrlForSSRF('http://app.internal');
    assert.strictEqual(lh3.valid, false);
  });

  test('validateUrlForSSRF rejects direct private IP targets', async () => {
    const priv1 = await validateUrlForSSRF('http://127.0.0.1');
    assert.strictEqual(priv1.valid, false);

    const meta = await validateUrlForSSRF('http://169.254.169.254/latest/meta-data');
    assert.strictEqual(meta.valid, false);

    const priv2 = await validateUrlForSSRF('http://192.168.1.1');
    assert.strictEqual(priv2.valid, false);
  });

  test('validateUrlForSSRF accepts valid public website', async () => {
    const validRes = await validateUrlForSSRF('https://example.com');
    assert.strictEqual(validRes.valid, true);
    assert.ok(validRes.resolvedIp);
  });
});
