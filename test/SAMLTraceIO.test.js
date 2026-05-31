const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadScript(relativePath) {
  const code = fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
  vm.runInNewContext(code, global);
}

loadScript('src/filters.js');
loadScript('src/SAMLTraceIO.js');

const SAMLTraceIO = global.SAMLTraceIO;

function makeRequest(overrides = {}) {
  return {
    url: 'https://idp.example.com/saml/sso',
    method: 'POST',
    post: [],
    requestHeaders: [{ name: 'Content-Type', value: 'application/x-www-form-urlencoded' }],
    getResponse: () => ({
      statusCode: 200,
      statusLine: 'HTTP/1.1 200 OK',
      responseHeaders: [{ name: 'Content-Type', value: 'text/html' }]
    }),
    ...overrides
  };
}

function makeEntry(overrides = {}) {
  return {
    isVisible: () => true,
    parsed: makeRequest(),
    ...overrides
  };
}

// Mirrors the logic in exportDialog.js that produces the request list passed to perform()
function filterRequests(httpRequests, hideResources = false, showProtocolOnly = false) {
  return httpRequests
    ?.filter(req => req.isVisible && req.isVisible(hideResources, showProtocolOnly))
    .map(req => req.parsed)
    .filter(Boolean);
}

describe('SAMLTraceIO.ExportFilter.perform', () => {
  let ef;

  beforeEach(() => {
    ef = new SAMLTraceIO.ExportFilter('1'); // profile 1 = no filtering
  });

  test('exports a normal request with response data', () => {
    const result = ef.perform([makeRequest()]);
    expect(result).toHaveLength(1);
    expect(result[0].responseStatus).toBe(200);
    expect(result[0].responseStatusText).toBe('HTTP/1.1 200 OK');
  });

  test('does not throw when getResponse() returns undefined (issue #69)', () => {
    const req = makeRequest({ getResponse: () => undefined });
    expect(() => ef.perform([req])).not.toThrow();
  });

  test('includes request in export when getResponse() returns undefined', () => {
    const req = makeRequest({ getResponse: () => undefined });
    const result = ef.perform([req]);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://idp.example.com/saml/sso');
    expect(result[0].responseStatus).toBeUndefined();
  });

  test('does not throw when getResponse() returns null', () => {
    const req = makeRequest({ getResponse: () => null });
    expect(() => ef.perform([req])).not.toThrow();
  });

  test('exports all requests when some have no response', () => {
    const reqs = [
      makeRequest(),
      makeRequest({ getResponse: () => undefined }),
      makeRequest({ getResponse: () => null }),
    ];
    const result = ef.perform(reqs);
    expect(result).toHaveLength(3);
    expect(result[0].responseStatus).toBe(200);
    expect(result[1].responseStatus).toBeUndefined();
    expect(result[2].responseStatus).toBeUndefined();
  });
});

describe('exportDialog request filtering', () => {
  test('returns all visible entries with parsed requests', () => {
    const entries = [makeEntry(), makeEntry()];
    expect(filterRequests(entries)).toHaveLength(2);
  });

  test('excludes entries where parsed is undefined (issue #106)', () => {
    const entries = [
      makeEntry(),
      makeEntry({ parsed: undefined }),
      makeEntry(),
    ];
    const result = filterRequests(entries);
    expect(result).toHaveLength(2);
  });

  test('returns empty array when all visible entries have undefined parsed', () => {
    expect(filterRequests([makeEntry({ parsed: undefined })])).toHaveLength(0);
  });
});
