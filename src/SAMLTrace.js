// export SAMLTrace namespace to make ao. Request definitions available
var EXPORTED_SYMBOLS = ["SAMLTrace"];

if ("undefined" == typeof(SAMLTrace)) {
  var SAMLTrace = {};
};

SAMLTrace.b64inflate = function (data) {
  // Remove any whitespace in the base64-encoded data -- Shibboleth may insert line feeds in the data.
  data = data.replace(/\s/g, '');

  if (data.length % 4 != 0) {
    dump('Warning: base64-encoded data is not a multiple of 4 bytes long.\n');
    return null;
  }

  if (data.length < 4) {
    dump('Warning: Too short base64-encoded data.\n');
    return null;
  }

  const decoded = atob(data);
  const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
  const inflated = pako.inflateRaw(bytes);
  return String.fromCharCode.apply(String, inflated);
};

SAMLTrace.b64DecodeUnicode = function(str) {
  // Taken from: https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding
  // Going backwards: from bytestream, to percent-encoding, to original string.
  return decodeURIComponent(atob(str).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
};

SAMLTrace.bin2hex = function(s) {
  var i; var l; var n; var o = '';
  for (i = 0, l = s.length; i < l; i++) {
    n = s.charCodeAt(i).toString(16)
    o += n.length < 2 ? '0' + n : n
  }
  return o
};

SAMLTrace.prettifyXML = function(xmlstring) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(xmlstring, 'text/xml');

  function isEmptyElement(element) {
    var whitespace = new RegExp('^\\s*$');
    for (var child = element.firstChild; child != null; child = child.nextSibling) {
      if (child instanceof Text && whitespace.test(child.data)) {
        continue;
      }
      return false;
    }
    return true;
  }

  function isTextElement(element) {
    for (var child = element.firstChild; child != null; child = child.nextSibling) {
      if (child instanceof Text) {
        continue;
      }
      return false;
    }
    return true;
  }

  function prettifyElement(element, indentation) {
    var ret = indentation + '<' + element.nodeName;

    var attrIndent = indentation;
    while (attrIndent.length < ret.length) {
      attrIndent += ' ';
    }

    var attrs = element.attributes;

    for (var i = 0; i < attrs.length; i++) {
      var a = attrs.item(i);
      if (i > 0) {
        ret += '\n' + attrIndent;
      }
      ret += ' ' + a.nodeName + '="' + a.value + '"';
    }

    if (isEmptyElement(element)) {
      if (attrs.length > 1) {
        return ret + '\n' + attrIndent + ' />\n';
      } else if (attrs.length == 1) {
        return ret + ' />\n';
      } else {
        return ret + '/>\n';
      }
    }

    if (attrs.length > 1) {
      ret += '\n' + attrIndent + ' >';
    } else {
      ret += '>';
    }

    if (isTextElement(element)) {
      return ret + element.textContent + '</' + element.nodeName + '>\n';
    }

    ret += '\n';

    for (var child = element.firstElementChild; child != null; child = child.nextElementSibling) {
      ret += prettifyElement(child, indentation + '    ');
    }

    return ret + indentation + '</' + element.nodeName + '>\n';
  }

  return prettifyElement(doc.documentElement, '');
};

SAMLTrace.prettifyArtifact = function(artstring) {
    var artifact = window.atob(artstring);
    return 'Endpoint Index: ' + SAMLTrace.bin2hex(artifact.substr(2,2)) + '\n' +
      'Source ID: ' + SAMLTrace.bin2hex(artifact.substr(4,20));
};

SAMLTrace.UniqueRequestId = function(webRequestId, method, url) {
  this.webRequestId = webRequestId;
  this.method = method;
  this.url = url;
};
SAMLTrace.UniqueRequestId.prototype = {
  'create' : function(onCreated) {
    Hash.calculate(this.url).then(digest => onCreated("request-" + this.webRequestId + "-" + this.method + "-" + digest));
  }
};

SAMLTrace.Request = function(request, getResponse) {
  this.method = request.req.method;
  this.url = request.req.url;
  this.requestId = request.req.requestId;
  this.getResponse = getResponse;

  this.loadRequestHeaders(request);
  this.loadGET();
  this.loadPOST(request);
  this.parsePOST();
  this.parseProtocol();
  this.parseSAML();
};
SAMLTrace.Request.prototype = {
  'loadRequestHeaders' : function(request) {
    this.requestHeaders = request.headers;
  },
  'loadResponse' : function() {
    let response = this.getResponse();
    this.responseStatus = response ? response.statusCode : "";
    this.responseStatusText = response ? response.statusLine : "";
    this.responseHeaders = response ? response.responseHeaders: [];
  },
  'loadGET' : function() {
    if (this.method !== 'GET') {
      return;
    }

    this.get = [];
    // URLSearchParams handles splitting and decoding: https://url.spec.whatwg.org/#concept-urlencoded-parser
    for (const [name, value] of new URL(this.url).searchParams.entries()) {
      this.get.push([name, value]);
    }
  },
  'loadPOST' : function(request) {
    if (this.method !== 'POST') {
      return;
    }

    const isTracedParsedRequest = req => req.requestBody && req.requestBody.formData;
    const isTracedRawRequest = req => req.requestBody && req.requestBody.raw;
    const isImportedRequest = req => req.requestBody && req.requestBody.post && request.req.requestBody.post.length;

    const isFormUrlEncoded = request => {
      let contentTypeHeader = request.headers.find(header => header.name.toLowerCase() === "content-type");
      return contentTypeHeader && contentTypeHeader.value.toLowerCase() === "application/x-www-form-urlencoded";
    };

    const rawRequestToString = rawByteArray => {
      let postString = "";
      rawByteArray.forEach(element => {
        let chunk = String.fromCharCode.apply(null, new Uint8Array(element.bytes));
        postString += chunk;
      });
      return postString;
    };

    const postStringToFormDataObject = parsedPostString => {
      let parameters = parsedPostString.split('&');
      let formData = {};
      parameters.forEach(parameter => {
        let splittedParameter = parameter.split('=');
        let name = splittedParameter[0];
        // In theory the formData's values should remain urlencoded. But since the webRequest-API's 
        // formData-object supplies these values decoded, we try to mime the same behaviour here.
        let value = decodeURIComponent((splittedParameter[1] || '').replace(/\+/g, '%20'));
        formData[name] = [ value ];
      });
      return formData;
    };

    if (isTracedParsedRequest(request.req)) {
      // if it's an actively traced request, we have to look up its formData and parse it later on.
      this.postData = request.req.requestBody.formData;
    } else if (isTracedRawRequest(request.req) && isFormUrlEncoded(request)) {
      // Chrome parses a request only up to a size of 4096 bytes as formData. If the POST exceeds 
      // this size, its raw bytes have to be parsed manually.
      let postString = rawRequestToString(request.req.requestBody.raw);
      this.postData = postStringToFormDataObject(postString);
    } else if (isImportedRequest(request.req)) {
      // if the request comes from an import, the parsed post-array and probably a token are already present.
      this.post = request.req.requestBody.post;
      this.saml = request.saml;
    }
  },
  'parsePOST' : function() {
    if (this.postData == null || this.postData === '') {
      return;
    }

    this.post = [];
    var keys = Object.keys(this.postData);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var propertyValues = this.postData[key];

      for (var j = 0; j < propertyValues.length; j++) {
        this.post.push([key, propertyValues[j]]);
      }
    }
  },
  'parseProtocol' : function() {
    const isParameterInCollection = (parameter, collection) => {
      return collection.findIndex(item => item[0] === parameter) !== -1;
    };

    const isAnyParameterInCollection = (parameters, collection) => {
      if (!collection) {
        return false;
      }
      return parameters.some(parameter => isParameterInCollection(parameter, collection));
    };

    const isSamlProtocol = () => {
      const parameters = ["SAMLRequest", "SAMLResponse", "SAMLart"];
      let isInGet = isAnyParameterInCollection(parameters, this.get);
      let isInPost = isAnyParameterInCollection(parameters, this.post);
      return isInGet || isInPost;
    };
    
    const isWsFederation = () => {
      // all probably relevant WS-Federation parameters -> ["wa", "wreply", "wres", "wctx", "wp", "wct", "wfed", "wencoding", "wtrealm", "wfresh", "wauth", "wreq", "whr", "wreqptr", "wresult", "wresultptr", "wattr", "wattrptr", "wpseudo", "wpseudoptr"];
      // the most common ones should suffice:
      const parameters = ["wa", "wreply", "wctx", "wtrealm", "whr", "wresult"];
      let isInGet = isAnyParameterInCollection(parameters, this.get);
      let isInPost = isAnyParameterInCollection(parameters, this.post);
      return isInGet || isInPost;
    };

    if (isSamlProtocol()) {
      this.protocol = "SAML-P";
    } else if (isWsFederation()) {
      this.protocol = "WS-Fed";
    }
  },
  'parseSAML' : function() {
    if ((this.saml && this.saml !== "") || (this.samlart && this.samlart !== "")) {
      // do nothing if the token of an imported request is already present
      return;
    }

    const returnValueAsIs = msg => msg;
    const returnValueB64Inflated = msg => !msg ? null : SAMLTrace.b64inflate(msg);
    const returnValueWithRemovedWhitespaceAndAtoB = msg => !msg ? null : SAMLTrace.b64DecodeUnicode(msg.replace(/\s/g, ''));

    let queries = [];
    if (this.protocol === "SAML-P") {
      queries = [
        { name: 'SAMLRequest', collection: this.get, action: returnValueB64Inflated, to: result => this.saml = result},
        { name: 'SAMLResponse', collection: this.get, action: returnValueB64Inflated, to: result => this.saml = result },
        { name: 'SAMLart', collection: this.get, action: returnValueAsIs, to: result => this.samlart = result },
        { name: 'SAMLRequest', collection: this.post, action: returnValueWithRemovedWhitespaceAndAtoB, to: result => this.saml = result },
        { name: 'SAMLResponse', collection: this.post, action: returnValueWithRemovedWhitespaceAndAtoB, to: result => this.saml = result },
        { name: 'SAMLart', collection: this.post, action: returnValueAsIs, to: result => this.samlart = result }
      ];
    } else if (this.protocol === "WS-Fed") {
      queries = [
        { name: 'wresult', collection: this.get, action: returnValueAsIs, to: result => this.saml = result },
        { name: 'wresult', collection: this.post, action: returnValueAsIs, to: result => this.saml = result }
      ];
    }

    const findParameter = (name, collection) => {
      let parameter = collection ? collection.find(item => item[0] === name) : null;
      return parameter ? parameter[1] : null;
    };

    return queries.some(query => {
      let parameter = findParameter(query.name, query.collection);
      let value = query.action(parameter);
      query.to(value);
      return value !== null;
    });
  }
};

SAMLTrace.RequestItem = function(request) {
  this.request = request;

  this.availableTabs = ['HTTP'];
  if ((this.request.get && this.request.get.length !== 0) || (this.request.post && this.request.post.length !== 0)) {
    this.availableTabs.push('Parameters');
  }
  if (this.request.saml != null || this.request.samlart != null) {
    this.availableTabs.push('SAML');
    this.availableTabs.push('Summary');
  }
};
SAMLTrace.RequestItem.prototype = {

  'showHTTP' : function(target) {
    function formatHeaderLine(h) {
      return h.name + ': ' + h.value + '\n';
    }

    let reqText = this.request.method + ' ' + this.request.url + ' HTTP/1.1\n';
    this.request.requestHeaders.forEach(h => reqText += formatHeaderLine(h));
    reqText += '\n';

    const reqDiv = target.ownerDocument.createElement('div');
    reqDiv.classList.add('highlightable');
    reqDiv.textContent = reqText;
    target.appendChild(reqDiv);

    this.request.loadResponse();
    let resText = this.request.responseStatusText + '\n';
    this.request.responseHeaders.forEach(h => resText += formatHeaderLine(h));

    const resDiv = target.ownerDocument.createElement('div');
    resDiv.classList.add('highlightable');
    resDiv.textContent = resText;
    target.appendChild(resDiv);
  },

  'showParameters' : function(target) {
    function addParameters(name, parameters) {
      if (!parameters || parameters.length === 0) {
        return;
      }

      const method = target.ownerDocument.createElement('b');
      method.textContent = name + '\n';
      target.appendChild(method);

      const paramsDiv = target.ownerDocument.createElement('div');
      paramsDiv.classList.add('highlightable');
      parameters.forEach(p => paramsDiv.textContent += p[0] + ': ' + p[1] + '\n');
      target.appendChild(paramsDiv);
    }

    addParameters('GET', this.request.get);
    addParameters('POST', this.request.post);
  },

  'showSAML' : function(target) {
    if (this.request.saml) {
      var samlFormatted = SAMLTrace.prettifyXML(this.request.saml);
    } else {
      var samlFormatted = SAMLTrace.prettifyArtifact(this.request.samlart);
    }
    
    const samlDiv = target.ownerDocument.createElement('div');
    samlDiv.classList.add('highlightable');
    samlDiv.textContent = samlFormatted;
    target.appendChild(samlDiv);
  },

  'showSummary' : function(target) {
    const table = document.createElement("table");

    /* Helper functions for summary table */
    function appendHeader(text) {
      const th = document.createElement("th");
      th.innerText = text;
      th.colSpan = 2;

      const tr = document.createElement("tr");
      tr.appendChild(th);

      table.appendChild(tr);
    }
  
    function appendRow(key, value, isElement) {
      if (value) {
        const tdKey = document.createElement("td");
        tdKey.innerText = key;
        tdKey.classList.add("hljs-attribute");

        const tdValue = document.createElement("td");
        if (isElement) {
          tdValue.appendChild(value);
        } else {
          tdValue.innerText = value;
        }

        const tr = document.createElement("tr");
        tr.appendChild(tdKey);
        tr.appendChild(tdValue);

        table.appendChild(tr);
      }
    }
  
    function appendAttributes(attributeName, attributes) {
      for (let attr of attributes) {
        for (let value of attr.children) {
          appendRow(attr.getAttribute(attributeName), value.textContent.trim());
        }
      }
    }
  
    function tryGetByQuerySelector(element, selector) {
      return element.querySelector(selector)?.textContent ?? '';
    }

    var parser  = new DOMParser();
    var xmldoc  = parser.parseFromString(this.request.saml, "text/xml");

    /* Check for AuthnRequest */
    var AuthnRequest = xmldoc.getElementsByTagNameNS('*','AuthnRequest');
    if (AuthnRequest.length>0) { // We found AuthnRequest!
      appendHeader('AuthnRequest');
      for (let ArAtt of AuthnRequest[0].attributes) {
        if (!ArAtt.name.startsWith('xmlns')) {
          appendRow(ArAtt.name, ArAtt.value);
        }
      }
      appendRow('Issuer', tryGetByQuerySelector(AuthnRequest[0], 'Issuer'));
    }
  
    /* Check for SAML:2.0:protocol:Response' */
    var SamlResponse = xmldoc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:protocol','Response');
    if (SamlResponse.length>0) { // We found SamlResponse!
      appendHeader('SAML2.0 Response');
      appendRow('Destination', SamlResponse[0].getAttribute('Destination'));
      appendRow('ID', SamlResponse[0].getAttribute('ID'));
      appendRow('Version', SamlResponse[0].getAttribute('Version'));
      appendRow('IssueInstant', SamlResponse[0].getAttribute('IssueInstant'));
      appendRow('Issuer', tryGetByQuerySelector(SamlResponse[0], 'Issuer'));
    }
  
    /* Check for RequestSecurityTokenResponse */
    var SecTokResponse = xmldoc.getElementsByTagNameNS('http://docs.oasis-open.org/ws-sx/ws-trust/200512','RequestSecurityTokenResponse'); // WS-Fed + SAML1.1
    if (SecTokResponse.length === 0) {
      SecTokResponse = xmldoc.getElementsByTagNameNS('http://schemas.xmlsoap.org/ws/2005/02/trust','RequestSecurityTokenResponse'); // WS-Fed + SAML2.0
    }
    if (SecTokResponse.length>0) { // We found RequestSecurityTokenResponse!
      appendHeader('RequestSecurityTokenResponse');
      appendRow('TokenType', tryGetByQuerySelector(SecTokResponse[0], 'TokenType'));
      appendRow('AppliesTo', tryGetByQuerySelector(SecTokResponse[0], 'AppliesTo'));
      appendRow('Lifetime - Created', tryGetByQuerySelector(SecTokResponse[0], 'Lifetime > Created'));
      appendRow('Lifetime - Expires', tryGetByQuerySelector(SecTokResponse[0], 'Lifetime > Expires'));
    }
  
    /* Check for SAML:2.0:Assertion */
    var SamlAssertion = xmldoc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion','Assertion');
    if (SamlAssertion.length>0) {
      appendHeader('SAML 2.0 Assertion');
      appendRow('ID', SamlAssertion[0].getAttribute('ID'));
      appendRow('Version', SamlAssertion[0].getAttribute('Version'));
      appendRow('IssueInstant', SamlAssertion[0].getAttribute('IssueInstant'));
      appendRow('Subject', tryGetByQuerySelector(SamlAssertion[0], 'Subject > NameID'));
  
      /* Check for AttributeStatement */
      var AttributeStatement = xmldoc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion','AttributeStatement');
      if (AttributeStatement.length>0) {
        appendHeader('SAML 2.0 AttributeStatement');
        appendAttributes('Name', AttributeStatement[0].children);
      }
    }
  
    /* Check for SAML:1.0:Assertion */
    var Saml1Assertion = xmldoc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:1.0:assertion','Assertion');
    if (Saml1Assertion.length>0) {
      appendHeader('SAML 1.0 Assertion');
      appendRow('AssertionID', Saml1Assertion[0].getAttribute('AssertionID'));
      appendRow('MajorVersion', Saml1Assertion[0].getAttribute('MajorVersion'));
      appendRow('MinorVersion', Saml1Assertion[0].getAttribute('MinorVersion'));
      appendRow('IssueInstant', Saml1Assertion[0].getAttribute('IssueInstant'));
      appendRow('Issuer', Saml1Assertion[0].getAttribute('Issuer'));
      appendRow('Audience', tryGetByQuerySelector(Saml1Assertion[0], 'Conditions > AudienceRestrictionCondition > Audience'));
      appendRow('Subject', tryGetByQuerySelector(Saml1Assertion[0], 'Subject > NameIdentifier'));
  
      //Attributes
      var AttributeStatement = xmldoc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:1.0:assertion','AttributeStatement');
      if (AttributeStatement.length>0) {
        appendHeader('SAML 1.0 AttributeStatement');
        appendRow('Subject', tryGetByQuerySelector(AttributeStatement[0], 'NameIdentifier'));
        appendAttributes('AttributeName', AttributeStatement[0].querySelectorAll("Attribute"));
      }
    }
  
    /* Check for X509 Certificates (SAML1+2) */
    var AttachedCertificates = xmldoc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#','X509Certificate');
    if (AttachedCertificates.length>0) {
      appendHeader('Embedded certificates');
      for (let i=0;i<AttachedCertificates.length;i++) {
        const cert = document.createElement("a");
        cert.innerText = "Download";
        cert.href = `data:application/x-x509-ca-cert;base64;charset=utf8,${AttachedCertificates[i].textContent.trim()}`;
        cert.download = `saml${i}.cer`;
        appendRow(`Certificate ${i}`, cert, true);
      }
    }

    const samlSummary = document.createElement("div");
    samlSummary.id = "summary";
    samlSummary.appendChild(table);

    target.appendChild(samlSummary);
  },

  'showContent' : function(target, type) {
    target.innerText = "";
    switch (type) {
    case 'HTTP':
      this.showHTTP(target);
      break;
    case 'Parameters':
      this.showParameters(target);
      break;
    case 'SAML':
      this.showSAML(target);
      break;
    case 'Summary':
      this.showSummary(target);
      break;
    }
  },

  'addListItem' : function(target, showContentElement) {
    var methodLabel = document.createElement("label");
    methodLabel.setAttribute('class', 'request-method');
    methodLabel.setAttribute('value', this.request.method);
    methodLabel.innerText = this.request.method;

    var urlLabel = document.createElement("label");
    urlLabel.setAttribute('flex', '1');
    urlLabel.setAttribute('crop', 'end');
    urlLabel.setAttribute('class', 'request-url');
    urlLabel.setAttribute('value', this.request.url);
    urlLabel.innerText = this.request.url;

    var hbox = document.createElement("div");
    hbox.setAttribute('flex', '1');
    var uniqueRequestId = new SAMLTrace.UniqueRequestId(this.request.requestId, this.request.method, this.request.url);
    uniqueRequestId.create(id => hbox.setAttribute('id', id));
    hbox.setAttribute('class', 'list-row');
    hbox.appendChild(methodLabel);
    hbox.appendChild(urlLabel);

    if (this.request.protocol) {
      const appendLogoDiv = (target, logoName) => {
        let logo = document.createElement("div");
        logo.classList.add(logoName);
        target.appendChild(logo);
      };

      // add the protocol-logo (SAML or WS-Federation)
      let logoName = this.request.protocol === "SAML-P" ? "saml-logo" : "ws-fed-logo";
      appendLogoDiv(hbox, logoName);

      // if the protocol is WS-Federation and a SAML-token is present, then an additional SAML-logo should be appended
      if (this.request.protocol === "WS-Fed" && (this.request.saml || this.request.samlart)) {
        appendLogoDiv(hbox, "saml-logo");
      }
    }

    hbox.requestItem = this;
    target.appendChild(hbox);
    return hbox;
  },
};

SAMLTrace.TraceWindow = function() {
  window.tracer = this;
  this.httpRequests = [];
  this.requests = [];
  this.pauseTracing = false;
  this.autoScroll = true;
  this.filterResources = true;
  this.colorizeRequests = true;
};

SAMLTrace.TraceWindow.prototype = {
  'isRequestVisible' : function(request) {
    var contentTypeHeader = request.responseHeaders.filter(header => header.name.toLowerCase() === 'content-type');
    if (contentTypeHeader === null || contentTypeHeader.length === 0) {
      return true;
    }
    var type = contentTypeHeader[0].value;

    var i = type.indexOf(';');
    if (i != -1) {
      type = type.substr(0, i);
    }
    type = type.toLowerCase().trim();

    switch (type) {
    case 'application/ecmascript':
    case 'application/javascript':
    case 'application/ocsp-response':
    case 'application/vnd.google.safebrowsing-chunk':
    case 'application/vnd.google.safebrowsing-update':
    case 'application/x-javascript':
    case 'application/x-shockwave-flash':
    case 'application/font-sfnt':
    case 'application/font-woff':
    case 'application/font-woff2':
    case 'application/x-font-ttf':
    case 'application/x-font-woff':
    case 'image/gif':
    case 'image/jpg':
    case 'image/jpeg':
    case 'image/png':
    case 'image/vnd.microsoft.icon':
    case 'image/x-icon':
    case 'image/svg+xml':
    case 'text/css':
    case 'text/ecmascript':
    case 'text/javascript':
    case 'text/x-content-security-policy':
      return false;
    default:
      return true;
    }
  },

  'addRequestItem' : function(request, getResponse) {
    var samlTracerRequest = new SAMLTrace.Request(request, getResponse);
    var item = new SAMLTrace.RequestItem(samlTracerRequest, showContentElement);
    this.requests.push(samlTracerRequest);

    var requestList = document.getElementById('request-list');
    var showContentElement = document.getElementById('request-info-content');
    var requestItemListElement = item.addListItem(requestList, showContentElement);

    requestItemListElement.addEventListener('click', e => {
      this.selectItemInList(requestItemListElement, requestList);
      this.showRequest(requestItemListElement.requestItem);
    }, false);

    if (this.autoScroll) {
      requestList.scrollTop = requestList.scrollHeight;
    }
  },

  'resetList' : function() {
    var listbox = document.getElementById('request-list');
    while (listbox.firstChild) {
      listbox.removeChild(listbox.firstChild);
    }

    this.updateStatusBar();
  },

  'clearRequests' : function() {
    this.requests = [];
    this.httpRequests = [];
    this.resetList();
    this.showRequest(null);
  },

  'setPauseTracing' : function(pauseTracing) {
    this.pauseTracing = pauseTracing;
  },

  'setAutoscroll' : function(autoScroll) {
    this.autoScroll = autoScroll;
  },

  'setFilterResources' : function(filterResources) {
    this.filterResources = filterResources;
    this.updateStatusBar();
  },

  'setColorizeRequests' : function(colorizeRequests) {
    this.colorizeRequests = colorizeRequests;
  },

  'updateStatusBar' : function() {
    var hiddenElementsString = "";
    if (this.filterResources) {
      hiddenElementsString = ` (${this.httpRequests.filter(req => typeof req.isVisible !== "undefined" && !req.isVisible).length} hidden)`;
    }
    var status = `${this.httpRequests.length} requests received ${hiddenElementsString}`;
    var statusItem = document.getElementById('statuspanel');
    statusItem.innerText = status;
  },

  'reviseRedirectedRequestMethod' : function(request, id) {
    const isRedirected = requestId => {
      let parentRequest = this.httpRequests.find(r => r.req.requestId === requestId);
      return parentRequest && parentRequest.res && (parentRequest.res.statusCode === 302 || parentRequest.res.statusCode === 303);
    };

    // There are two cases which require SAML-tracer to manually revise the captured HTTP method of a traced request:
    //
    // * Case 1 (HTTP StatusCode 302): The webRequest-API seems to keep the HTTP verb which was used by the parent request. This
    //   is correct in resepct to RFC 2616 but differs from a typical browser behaviour which will usually change the POST to a GET.
    //   So do we here... See: https://github.com/SimpleSAMLphp/SAML-tracer/pull/23#issuecomment-345540591
    //
    // * Case 2 (HTTP StatusCode 303): RFC 2616 says a 303 should be followed by using a GET. Unfortunately Firefox's webRequest-
    //   API-implementation acts differently in this case. It follows such redirects by using a POST. Chrome's webRequest-API-
    //   implementation acts correct and uses a GET. Hence for Firefox clients the method will be revised here.
    if (request.method === 'POST' && isRedirected(request.requestId)) {
      request.method = 'GET';
      id = id.replace('POST', 'GET');
    }
    return { id: id, request: request };
  },

  'saveNewRequest' : function(request) { // onBeforeRequest
    if (request.requestId.startsWith("fakeRequest-")) {
      // Skip tracing fake requests that are issued by firefox for e.g. thumbnails of websites from about:blank
      return;
    }

    let tracer = SAMLTrace.TraceWindow.instance();
    if (tracer.pauseTracing) {
      // Skip tracing new requests
      return;
    }

    var uniqueRequestId = new SAMLTrace.UniqueRequestId(request.requestId, request.method, request.url);
    uniqueRequestId.create(id => {
      // Maybe revise the HTTP method on redirected requests
      let alterationResult = tracer.reviseRedirectedRequestMethod(request, id);
      let entry = { id: alterationResult.id, req: alterationResult.request };
      tracer.httpRequests.push(entry);
    });
  },

  'attachHeadersToRequest' : function(request) { // onBeforeSendHeaders
    let uniqueRequestId = new SAMLTrace.UniqueRequestId(request.requestId, request.method, request.url);
    uniqueRequestId.create(id => {
      let tracer = SAMLTrace.TraceWindow.instance();

      // Maybe revise the HTTP method on redirected requests
      let alterationResult = tracer.reviseRedirectedRequestMethod(request, id);
      id = alterationResult.id;

      let entry = tracer.httpRequests.find(req => req.id === id);
      if (!entry) {
        // Skip further execution if no precedingly issued request can be found. This may occur, if tracing
        // new requests is paused. Requests that were issued before pausing will be found and handled.
        return;
      }

      entry.headers = request.requestHeaders;
      tracer.addRequestItem(entry, () => entry.res);
      tracer.updateStatusBar();
    });
  },

  'attachResponseToRequest' : function(response) { // onHeadersReceived
    let uniqueRequestId = new SAMLTrace.UniqueRequestId(response.requestId, response.method, response.url);
    uniqueRequestId.create(id => {
      let tracer = SAMLTrace.TraceWindow.instance();

      // Maybe revise the HTTP method on redirected requests
      let alterationResult = tracer.reviseRedirectedRequestMethod(response, id);
      id = alterationResult.id;

      let entry = tracer.httpRequests.find(req => req.id === id);
      if (!entry) {
        // Skip further execution if no precedingly issued request can be found. This may occur, if tracing
        // new requests is paused. Requests that were issued before pausing will be found and handled.
        return;
      }

      entry.res = response;

      // layout update: apply style to item based on responseStatus
      let status = 'other';
      if (response.statusCode < 200) status = 'info';
      else if (response.statusCode < 300) status = 'ok';
      else if (response.statusCode < 400) status = 'redirect';
      else if (response.statusCode < 500) status = 'clerror';
      else if (response.statusCode < 600) status = 'srerror';

      var removeClassByPrefix = function removeClassByPrefix(element, prefix) {
        var regex = new RegExp('\\b' + prefix + '(.*)?\\b', 'g');
        element.className = element.className.replace(regex, '');
        return element;
      };

      var requestDiv = document.getElementById(id);
      if (requestDiv !== null) {
        removeClassByPrefix(requestDiv, "request-");
        requestDiv.classList.add("request-" + status);

        var isVisible = tracer.isRequestVisible(response);
        if (!isVisible) {
          requestDiv.classList.add("isResource");
          
          if (!tracer.filterResources) {
            requestDiv.classList.add("displayAnyway");
          }
        }

        if (!tracer.colorizeRequests) {
          requestDiv.classList.add("monochrome");
        }
        
        entry.isVisible = isVisible;
        tracer.updateStatusBar();
      }
      
      if (response.statusCode === 302) {
        let location = response.responseHeaders.find(header => header.name.toLowerCase() === "location");
        console.log(`Redirecting request '${id}' to new location '${location.value}'...`);
        return {
          redirectUrl: location.value
        };
      }
    });
  },
  
  'selectTab' : function(name, containingElement) {
    var tab = containingElement.querySelector(`[href*=\\#${name}]`);
    this.selectItemInList(tab, containingElement);
  },

  'selectItemInList' : function(itemToBeSelected, containingElement) {
    // un-select previously selected items
    var previouslySelectedItems = containingElement.querySelectorAll(".selected");
    previouslySelectedItems.forEach(item => item.classList.remove("selected"));

    // select new item
    itemToBeSelected.classList.add("selected");
  },

  'showRequest' : function(requestItem) {
    var requestInfoTabbox = document.getElementById('request-info-tabbox');
    requestInfoTabbox.innerText = "";
    var requestInfoContent = document.getElementById('request-info-content');
    if (requestItem === null) {
      requestInfoContent.innerText = "";
      return;
    }
    this.requestItem = requestItem;

    for (var i = 0; i < requestItem.availableTabs.length; i++) {
      var name = requestItem.availableTabs[i];
      this.addRequestTab(name, requestInfoTabbox, requestInfoContent);
    }

    var lastSelectedTab = this.selectedTab;
    if (requestItem.availableTabs.find(tab => tab === this.selectedTab) === undefined) {
      lastSelectedTab = 'HTTP';
      this.selectedTab = lastSelectedTab;
    }
    this.selectTab(lastSelectedTab, requestInfoTabbox);
    this.showRequestContent(requestInfoContent, lastSelectedTab);
  },

  'addRequestTab' : function(name, requestInfoTabbox, requestInfoContent) {
    var tab = document.createElement('a');
    tab.setAttribute('class', 'tab');
    tab.setAttribute('href', '#' + name);
    tab.innerText = name;
    tab.addEventListener('click', e => {
      var tabName = e.target.hash.substr(1);
      this.selectTab(tabName, e.target.parentElement);
      this.showRequestContent(requestInfoContent, tabName);
      this.selectedTab = tabName;
    }, false);

    if (this.selectedTab === undefined) {
      tab.classList.add('selected');
      this.selectedTab = tab.href.split('#')[1];
    } 

    requestInfoTabbox.appendChild(tab);
  },

  'showRequestContent' : function(element, type) {
    if (this.requestItem == null) {
      /* No request selected. */
      return;
    }
    this.requestItem.showContent(element, type);
  }
};

SAMLTrace.TraceWindow.init = function() {
  var browser = browser || chrome;
  let traceWindow = new SAMLTrace.TraceWindow();

  browser.webRequest.onBeforeRequest.addListener(
    traceWindow.saveNewRequest,
    {urls: ["<all_urls>"]},
    ["requestBody"]
  );

  browser.webRequest.onBeforeSendHeaders.addListener(
    traceWindow.attachHeadersToRequest,
    {urls: ["<all_urls>"]},
    ['requestHeaders', browser.webRequest.OnBeforeSendHeadersOptions.EXTRA_HEADERS].filter(Boolean)
  );

  browser.webRequest.onHeadersReceived.addListener(
    traceWindow.attachResponseToRequest,
    {urls: ["<all_urls>"]},
    ['responseHeaders', browser.webRequest.OnHeadersReceivedOptions.EXTRA_HEADERS].filter(Boolean)
  );
};

SAMLTrace.TraceWindow.instance = function() {
  return (this instanceof SAMLTrace.TraceWindow) ? this : window.tracer;
};
