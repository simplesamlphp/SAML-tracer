const fs = require('fs');
const path = require('path');
const { deflateRawSync } = require('zlib');

// Load the extension source in this test's own global scope rather than a fresh
// vm context. b64inflate() relies on web globals (atob, Blob, Response,
// DecompressionStream) that Jest's node environment provides directly — but under
// Jest on Node >= 26, a context created via vm.runInNewContext(code, global) no
// longer sees them, so the vm-based loader used elsewhere fails here. dump() only
// exists in the extension's browser context, so we inject a no-op.
function loadSAMLTrace() {
  const code = fs.readFileSync(path.resolve(__dirname, '..', 'src/SAMLTrace.js'), 'utf8');
  const factory = new Function('dump', `${code}\nreturn SAMLTrace;`);
  return factory(() => {});
}

const SAMLTrace = loadSAMLTrace();

/** Encodes a string the way an IdP encodes an HTTP-Redirect binding payload. */
function redirectBindingEncode(xml) {
  return deflateRawSync(Buffer.from(xml, 'utf8')).toString('base64');
}

describe('SAMLTrace.b64inflate', () => {
  const xml = '<samlp:AuthnRequest ID="_abc" Version="2.0"/>';

  it('inflates a base64-encoded, raw-deflated SAML message', async () => {
    const inflated = await SAMLTrace.b64inflate(redirectBindingEncode(xml));
    expect(inflated).toBe(xml);
  });

  it('tolerates line breaks inserted into the base64 data', async () => {
    // Shibboleth wraps the encoded data across multiple lines.
    const wrapped = redirectBindingEncode(xml).replace(/(.{8})/g, '$1\n');
    const inflated = await SAMLTrace.b64inflate(wrapped);
    expect(inflated).toBe(xml);
  });

  it('preserves raw byte semantics for non-ASCII payloads', async () => {
    // pako.inflateRaw() + String.fromCharCode produced a latin1 byte-string, not decoded
    // UTF-8. Downstream parsing depends on that, so the replacement must match it.
    const unicodeXml = '<saml:Issuer>https://sp.example.org/ünïcode</saml:Issuer>';
    const inflated = await SAMLTrace.b64inflate(redirectBindingEncode(unicodeXml));
    expect(inflated).toBe(Buffer.from(unicodeXml, 'utf8').toString('latin1'));
  });

  it('returns null when the data is not a multiple of 4 bytes', async () => {
    await expect(SAMLTrace.b64inflate('abcde')).resolves.toBeNull();
  });

  it('returns null when the data is too short', async () => {
    await expect(SAMLTrace.b64inflate('ab')).resolves.toBeNull();
  });
});
