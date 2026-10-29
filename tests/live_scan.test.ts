import { test, describe } from 'node:test';
import assert from 'node:assert';
import { scanSite } from '../src/crawler.js';

describe('Live Scan Integration Test', () => {
  test('Scans public iana.org successfully with full readiness structure', async () => {
    const result = await scanSite('iana.org', { fetchSubpages: false });

    assert.strictEqual(result.readable, true);
    if (result.readable) {
      assert.strictEqual(result.domain, 'iana.org');
      assert.ok(typeof result.score === 'number');
      assert.ok(result.score >= 0 && result.score <= 100);
      assert.ok(['Strong readiness', 'Good foundation with gaps', 'Needs improvement', 'Significant issues'].includes(result.band));
      assert.ok(result.categories.crawlability.earned >= 0);
      assert.ok(result.categories.clarity.earned >= 0);
      assert.ok(result.categories.qa_content.earned >= 0);
      assert.ok(result.categories.structured_data.earned >= 0);
      assert.ok(Array.isArray(result.topFixes));
    }
  });
});
