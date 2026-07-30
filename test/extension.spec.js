const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { deflateRawSync } = require('zlib');

const EXTENSION_PATH = path.resolve(__dirname, '..');

async function launchWithExtension() {
  // headless: false is required — Chrome extensions do not fully work in headless mode.
  // In CI, run the suite under xvfb-run to provide a virtual display.
  return chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });
}

async function getExtensionId(context) {
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return new URL(sw.url()).hostname;
}

async function openTracerPage(context, extensionId) {
  // Navigate directly to TraceWindow.html rather than clicking the toolbar icon.
  // This avoids dealing with the popup window lifecycle and gives Playwright a
  // regular page it can fully control.
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/TraceWindow.html`);
  return page;
}

async function doExport(tracerPage) {
  await tracerPage.click('#button-export-list');
  await tracerPage.waitForSelector('#exportDialog', { state: 'visible' });

  const frame = tracerPage.frameLocator('#exportDialogContent');
  const downloadPromise = tracerPage.waitForEvent('download');
  // force:true bypasses the bottomRow overlay that Playwright's hit-testing flags
  await frame.locator('#button-export').click({ force: true });
  const download = await downloadPromise;

  const downloadPath = await download.path();
  const content = fs.readFileSync(downloadPath, 'utf8');
  return JSON.parse(content);
}

test.describe('SAML Tracer export', () => {
  let context;
  let tracerPage;
  let extensionId;

  test.beforeAll(async () => {
    context = await launchWithExtension();
    extensionId = await getExtensionId(context);
    tracerPage = await openTracerPage(context, extensionId);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    await tracerPage.click('#button-clear');
  });

  test('happy path — normal requests export successfully', async () => {
    const testPage = await context.newPage();
    await testPage.goto('https://example.com');
    await tracerPage.waitForSelector('#request-list .list-row', { timeout: 10000 });

    const result = await doExport(tracerPage);
    expect(result).not.toBeNull();
    expect(result.requests.length).toBeGreaterThan(0);

    await testPage.close();
  });

  test('HTTP-Redirect binding — a deflated SAMLRequest is inflated and captured', async () => {
    // Covers the inflate path itself: an HTTP-Redirect binding carries the AuthnRequest
    // raw-deflated and base64-encoded in the query string, which parseSAML() must inflate.
    const xml = '<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" '
      + 'ID="_e2e_redirect_binding" Version="2.0">'
      + '<saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">'
      + 'https://sp.example.org/e2e</saml:Issuer></samlp:AuthnRequest>';
    const encoded = deflateRawSync(Buffer.from(xml, 'utf8')).toString('base64');

    const testPage = await context.newPage();
    await testPage.goto(`https://example.com/sso?SAMLRequest=${encodeURIComponent(encoded)}`);
    await tracerPage.waitForSelector('#request-list .list-row', { timeout: 10000 });

    const result = await doExport(tracerPage);
    const entry = result.requests.find(r => r.url.includes('SAMLRequest='));
    expect(entry).toBeDefined();
    expect(entry.protocol).toBe('SAML-P');
    expect(entry.saml).toContain('AuthnRequest');
    expect(entry.saml).toContain('https://sp.example.org/e2e');

    await testPage.close();
  });

  test('issue #69 — request with no response does not break export', async () => {
    // Navigate first so we have at least one real captured request
    const testPage = await context.newPage();
    await testPage.goto('https://example.com');
    await tracerPage.waitForSelector('#request-list .list-row', { timeout: 10000 });

    // Inject a fake entry simulating a request where getResponse() returns
    // undefined — the exact condition that caused the null export in #69
    await tracerPage.evaluate(() => {
      window.tracer.httpRequests.push({
        id: 'fake-no-response',
        isVisible: () => true,
        parsed: {
          method: 'GET',
          url: 'https://example.com/blocked-resource',
          requestId: 'fake-no-response',
          post: [],
          requestHeaders: [],
          saml: null,
          getResponse: () => undefined,
        }
      });
    });

    const result = await doExport(tracerPage);
    expect(result).not.toBeNull();
    expect(result.timestamp).toBeDefined();
    // The fake entry should be present but without response fields
    const fakeEntry = result.requests.find(r => r.url === 'https://example.com/blocked-resource');
    expect(fakeEntry).toBeDefined();
    expect(fakeEntry.responseStatus).toBeUndefined();

    await testPage.close();
  });

  test('issue #106 — entry with no parsed value does not break export', async () => {
    // Navigate first so we have at least one real captured request
    const testPage = await context.newPage();
    await testPage.goto('https://example.com');
    await tracerPage.waitForSelector('#request-list .list-row', { timeout: 10000 });

    // Inject a fake entry simulating the #106 condition: isVisible is set
    // (meaning attachResponseToRequest fired) but parsed is undefined (meaning
    // addRequestItem was never called due to a race around the pause state).
    // Without the .filter(Boolean) fix this produces undefined in the request
    // list passed to perform(), crashing createFromJSON and leaving the export stale.
    await tracerPage.evaluate(() => {
      window.tracer.httpRequests.push({
        id: 'fake-no-parsed',
        isVisible: () => true,
        // parsed intentionally absent
      });
    });

    // Record the time just before exporting so we can detect a stale result.
    // Without the fix, perform() throws and ui.exportResult is never updated,
    // so the download silently serves the previous test's cached export.
    const beforeExport = new Date().toISOString();
    const result = await doExport(tracerPage);
    expect(result).not.toBeNull();
    // A stale export has an older timestamp — this assertion fails without the fix
    expect(result.timestamp >= beforeExport).toBe(true);
    // The incomplete entry should be silently dropped; real requests still present
    expect(result.requests.length).toBeGreaterThan(0);

    await testPage.close();
  });

  test('issue #106 — clear and retrace produces a fresh export', async () => {
    // The bug: after clearing and capturing a new trace, the export would sometimes
    // return the previous cached result rather than the new one. This happens when
    // an entry in httpRequests has isVisible set but no parsed value, causing
    // createFromJSON to throw and leaving ui.exportResult stale.
    // This test verifies that two consecutive export-clear-export cycles produce
    // distinct, non-empty results.

    // First trace
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await tracerPage.waitForSelector('#request-list .list-row', { timeout: 10000 });
    const result1 = await doExport(tracerPage);
    expect(result1.timestamp).toBeDefined();

    // Clear and second trace
    await tracerPage.click('#button-clear');
    const page2 = await context.newPage();
    await page2.goto('https://example.org');
    await tracerPage.waitForSelector('#request-list .list-row', { timeout: 10000 });
    const result2 = await doExport(tracerPage);

    expect(result2.timestamp).not.toBe(result1.timestamp);
    expect(result2.requests.length).toBeGreaterThan(0);

    await page1.close();
    await page2.close();
  });
});
