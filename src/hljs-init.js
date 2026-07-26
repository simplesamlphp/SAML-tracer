// Registers the highlight.js grammars SAML-tracer uses and exposes hljs as a global,
// so the classic (non-module) scripts on this page can keep calling hljs.highlightElement().
//
// The imported files are unmodified artifacts from the @highlightjs/cdn-assets package,
// copied verbatim during the release build -- see .github/workflows/build-release.yml.
// Only this wrapper is first-party code.
import hljs from '../lib/core.min.js';
import xml from '../lib/xml.min.js';
import http from '../lib/http.min.js';
import properties from '../lib/properties.min.js';

hljs.registerLanguage('xml', xml);
hljs.registerLanguage('http', http);
hljs.registerLanguage('properties', properties);

window.hljs = hljs;
