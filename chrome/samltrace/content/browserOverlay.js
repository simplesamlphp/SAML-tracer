/**
 * SAMLTrace namespace.
 */
if ("undefined" == typeof(SAMLTrace)) {
  var SAMLTrace = {};
};

/**
 * Shows the SAML tracer window.
 */
SAMLTrace.showTraceWindow = function() {
  toOpenWindowByType('global:samltrace', 'chrome://samltrace/content/TraceWindow.xul');
};
