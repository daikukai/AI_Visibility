import { getStore } from '@netlify/blobs';
// In-memory fallback map for local tests or non-Netlify environments
const memoryLeads = new Map();
const memoryCache = new Map();
function isNetlifyBlobsAvailable() {
    // Checks if Netlify Blobs environment variables or edge context are present
    return Boolean(process.env.NETLIFY_BLOBS_CONTEXT || process.env.BLOBS_ACCESS_TOKEN || process.env.NETLIFY);
}
/**
 * Saves a new lead record into the 'leads' store.
 */
export async function saveLeadRecord(lead) {
    if (isNetlifyBlobsAvailable()) {
        try {
            const store = getStore('leads');
            await store.setJSON(lead.id, lead);
            return;
        }
        catch (err) {
            console.warn('[Storage] Netlify Blobs write failed, falling back to local memory:', err);
        }
    }
    // Fallback to memory
    memoryLeads.set(lead.id, lead);
}
/**
 * Retrieves a lead record by ID.
 */
export async function getLeadRecord(leadId) {
    if (isNetlifyBlobsAvailable()) {
        try {
            const store = getStore('leads');
            const data = await store.get(leadId, { type: 'json' });
            return data;
        }
        catch {
            // Fall through to memory
        }
    }
    return memoryLeads.get(leadId) || null;
}
/**
 * Reads a cached scan result from the 'scan_cache' store.
 * Returns null if missing or older than 24 hours.
 */
export async function getScanCache(normalizedDomain) {
    const key = normalizedDomain.toLowerCase();
    let record = null;
    if (isNetlifyBlobsAvailable()) {
        try {
            const store = getStore('scan_cache');
            record = (await store.get(key, { type: 'json' }));
        }
        catch {
            record = null;
        }
    }
    else {
        record = memoryCache.get(key) || null;
    }
    if (!record || !record.scanned_at) {
        return null;
    }
    // 24-hour expiration check (86,400,000 ms)
    const scannedTime = new Date(record.scanned_at).getTime();
    const now = Date.now();
    const maxAgeMs = 24 * 60 * 60 * 1000;
    if (now - scannedTime > maxAgeMs) {
        return null; // Expired
    }
    return record.result;
}
/**
 * Writes a scan result to the 'scan_cache' store with a 24-hour timestamp.
 */
export async function setScanCache(normalizedDomain, result) {
    const key = normalizedDomain.toLowerCase();
    const record = {
        domain: key,
        result,
        scanned_at: new Date().toISOString()
    };
    if (isNetlifyBlobsAvailable()) {
        try {
            const store = getStore('scan_cache');
            await store.setJSON(key, record);
            return;
        }
        catch (err) {
            console.warn('[Storage] Netlify Blobs cache write failed:', err);
        }
    }
    memoryCache.set(key, record);
}
/**
 * Clears in-memory test stores (used by test suites)
 */
export function clearMemoryStores() {
    memoryLeads.clear;
    memoryCache.clear();
}
