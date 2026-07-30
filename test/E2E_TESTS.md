# End-to-end tests

These Playwright tests cover the full export pipeline running inside a real
Chromium browser with the extension loaded. They exist to validate fixes for two
bugs that unit tests alone could not reproduce in a browser context.

## Background

Both bugs cause the export to silently fail. When `perform` throws an unhandled
exception, `ui.exportResult` is never updated and either retains its previous
value (returning a stale export) or stays `null` (producing a file containing
only the word `null`).

**[Issue #69](https://github.com/simplesamlphp/SAML-tracer/issues/69):** A request
that was blocked, cancelled, or interrupted before a response arrived causes
`getResponse()` to return `undefined`. Passing `undefined` to `JSON.stringify`
returns the JS value `undefined` rather than a string, so `JSON.parse` throws
`SyntaxError: "undefined" is not valid JSON`.

**[Issue #106](https://github.com/simplesamlphp/SAML-tracer/issues/106):** In a
clear-and-retrace scenario, a request can arrive whose `entry.parsed` was never
set (due to a race between the `onBeforeSendHeaders` and `onHeadersReceived`
webRequest events). The export filter maps `req.parsed`, producing `undefined`
in the request list, which then crashes `createFromJSON`.

## Test approach

The extension opens its tracer window as a popup via `browser.windows.create()`.
Rather than trying to click the toolbar icon (which Playwright can't easily
reach), the tests navigate directly to `chrome-extension://<id>/src/TraceWindow.html`,
giving Playwright a regular page it can fully control.

The #69 test injects a fake entry directly into `window.tracer.httpRequests` to
simulate the exact condition (`getResponse: () => undefined`) rather than trying
to trigger it through browser network behaviour, which is intercepted before the
extension's `webRequest` listeners fire.

## Running the tests

```
npm run test:e2e
```

Chrome extensions require a display. On a headless CI host, wrap the command
with `xvfb-run`:

```
xvfb-run npm run test:e2e
```

## Results

All four tests pass with both fixes applied. Each bug test was also verified to
fail correctly against the unfixed code:

- The #69 test fails when `enrichWithResponse` in `SAMLTraceIO.js` does not guard
  against `undefined` — the export comes back `null`.
- The #106 test fails when `.filter(Boolean)` is absent from `exportDialog.js` —
  the timestamp comparison detects that a stale export was served instead of a
  fresh one.
