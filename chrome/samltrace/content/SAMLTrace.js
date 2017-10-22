// export SAMLTrace namespace to make ao. Request definitions available
var EXPORTED_SYMBOLS = ["SAMLTrace"];

// Import import/export feature
//Components.utils.import("chrome://samltrace/content/SAMLTraceIO.js");



if ("undefined" == typeof(SAMLTrace)) {
  var SAMLTrace = {};
};

SAMLTrace.b64deflate = function (data) {
  // Remove any whitespace in the base64-encoded data -- Shibboleth may insert
  // line feeds in the data.
  data = data.replace(/\s/g, '');

  if (data.length % 4 != 0) {
    dump('Warning: base64-encoded data is not a multiple of 4 bytes long.\n');
    return null;
  }

  if (data.length < 4) {
    dump('Warning: Too short base64-encoded data.\n');
    return null;
  }

  var dataLength = data.length / 4 * 3;
  if (data[data.length - 1] == '=') {
    dataLength -= 1;
  }
  if (data[data.length - 2] == '=') {
    dataLength -= 1;
  }

  var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
  var channel = ios.newChannel('data:application/octet-stream;base64,' + data, null, null);

  var stream = channel.open();

  /* Sanity check: we want the channel to have the full base64-decoded data available at once. */
  if (stream.available() < dataLength) {
    dump('The base64-decoder channel does not have the full decoded data available.\n');
    return null;
  }

  var listener = {
    'reader' : Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(Components.interfaces.nsIBinaryInputStream),
    'buffer' : [],

    'onStartRequest' : function(aRequest, aContext) { },
    'onStopRequest' : function(aRequest, aContext, aStatusCode) { },
    'onDataAvailable' : function(aRequest, aContext, aInputStream, aOffset, aCount) {
      this.reader.setInputStream(aInputStream);
      var bytes = this.reader.readBytes(aCount);
      this.buffer += bytes
    },
  };

  var deflate = Components.classes["@mozilla.org/streamconv;1?from=deflate&to=uncompressed"].createInstance(Components.interfaces.nsIStreamConverter);
  deflate.asyncConvertData("deflate", "uncompressed", listener, null);

  try {
    deflate.onStartRequest(null, null);
    deflate.onDataAvailable(null, null, stream, 0, dataLength);
    deflate.onStopRequest(null, null, 0);
  } catch (error) {
    dump('Failed to deflate data: ' + error + '\n');
    stream.close();
    return null;
  }

  stream.close();

  return listener.buffer;
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

  function xmlEntities(string) {
    string = string.replace('&', '&amp;', 'g');
    string = string.replace('"', '&quot;', 'g');
    string = string.replace("'", '&apos;', 'g');
    string = string.replace('<', '&lt;', 'g');
    string = string.replace('>', '&gt;', 'g');
    return string;
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
      ret += ' ' + a.nodeName + '="' + xmlEntities(a.value) + '"';
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
      return ret + xmlEntities(element.textContent) + '</' + element.nodeName + '>\n';
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


SAMLTrace.Request = function(httpChannel, getResponse) {
  this.method = httpChannel.req.method;
  this.url = httpChannel.req.url;
  this.requestId = httpChannel.req.requestId;
  this.getResponse = getResponse;

  this.loadRequestHeaders(httpChannel);

  this.loadGET();
  this.loadPOSTData(httpChannel);
  this.parsePOST();

  this.loadSAML();
};
SAMLTrace.Request.prototype = {
  'getRequestHeader' : function(name) {
    for (var i = 0; i < this.requestHeaders.length; i++) {
      var h = this.requestHeaders[i];
      if (h[0].toLowerCase() == name.toLowerCase()) {
        return h[1];
      }
    }
    return null;
  },
  'getParameter' : function(name) {
    for (var i = 0; i < this.get.length; i++) {
      var p = this.get[i];
      if (p[0] == name) {
        return p[1];
      }
    }
    return null;
  },
  'postParameter' : function(name) {
    for (var i = 0; i < this.post.length; i++) {
      var p = this.post[i];
      if (p[0] == name) {
        return p[1];
      }
    }
    return null;
  },
  'loadRequestHeaders' : function(httpChannel) {
    /*var headers = [];
    var visitor = {
      'visitHeader' : function(header, value) {headers
        headers.push([header, value]);
      },
    };
    httpChannel.visitRequestHeaders(visitor);
    this.requestHeaders = headers;*/
    this.requestHeaders = httpChannel.headers;
  },
  'loadResponse' : function(httpChannel) {
    // this.responseStatus = httpChannel.responseStatus;
    // this.responseStatusText = httpChannel.responseStatusText;

    this.response = this.getResponse();
    this.responseStatus = this.response.statusCode;
    this.responseStatusText = this.response.statusLine;

    // var headers = [];
    // var visitor = {
    //   'visitHeader' : function(header, value) {
    //     headers.push([header, value]);
    //   },
    // };
    // httpChannel.visitResponseHeaders(visitor);
    // this.responseHeaders = headers;
    this.responseHeaders = this.response.responseHeaders;
  },
  'loadGET' : function() {
    var r = new RegExp('[&;\?]');
    var elements = this.url.split(r);

    this.get = [];

    for (var i = 1; i < elements.length; i++) {
      var e = elements[i];
      var p = e.indexOf('=');
      var name, value;
      if (p == -1) {
        name = e;
        value = '';
      } else {
        name = e.substr(0, p);
        value = e.substr(p + 1);
      }

      name = name.replace('+', ' ');
      name = decodeURIComponent(name);
      value = value.replace('+', ' ');
      value = decodeURIComponent(value);
      this.get.push([name, value]);
    }
  },
  'loadPOSTData' : function(httpChannel) {
    this.postData = '';

    if (this.method != 'POST') {
      return;
    }

    return;
    var uploadChannel;
    try {
      uploadChannel = httpChannel.QueryInterface(Components.interfaces.nsIUploadChannel);
    } catch (e) {
      dump('Could not get upload channel for httpChannel: ' + e + '\n');
      return;
    }

    var stream = uploadChannel.uploadStream;
    if (stream == null) {
      dump('No upload stream set for httpChannel.\n');
      return;
    }

    var seekable;
    try {
      seekable = stream.QueryInterface(Components.interfaces.nsISeekableStream);
    } catch (e) {
      dump('Upload stream not seekable: ' + e + '\n');
    }

    var startOffset = seekable.tell();

    var reader = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
    reader.init(stream);

    var data = '';
    for (;;) {
      var chunk = reader.read(512);
      if (chunk.length == 0) {
        /* EOF */
        break;
      }
      data += chunk;
      if (data.length > 131072) {
        dump('Warning: POST data too long. Only saving part of it.');
        data += '[...]';
        break;
      }
    }

    seekable.seek(seekable.NS_SEEK_SET, startOffset);

    this.postData = data;

    if (this.getRequestHeader('Content-Type') != null) {
      /* Assuming headers not present in POST data. */
      return;
    }

    /* This is most likely post data combined with request headers. */

    var re = new RegExp('^([\\w-]*):\\s*([^\\r\\n]*)\\r?\\n([\\s\\S]*)$');

    var newHeaders = [];
    var match;
    while ( (match = re.exec(data)) != null) {
      var name = match[1];
      var value = match[2];
      newHeaders.push([name, value]);
      data = match[3];
    }

    re = new RegExp('^\\r?\\n([\\s\\S]*)$');
    match = re.exec(data);
    if (match == null) {
      /* Not an empty line after headers - assume that there weren't any headers. */
      return;
    }

    for (var i = 0; i < newHeaders.length; i++) {
      this.requestHeaders.push(newHeaders[i]);
    }

    this.postData = match[1];
  },
  'parsePOST' : function() {
    this.post = [];

    if (this.postData == '') {
      return;
    }

    var elements = this.postData.split('&');
    for (var i = 0; i < elements.length; i++) {
      var e = elements[i];
      var p = e.indexOf('=');
      var name, value;
      if (p == -1) {
        name = e;
        value = '';
      } else {
        name = e.substr(0, p);
        value = e.substr(p + 1);
      }

      name = name.replace('+', ' ');
      name = decodeURIComponent(name);
      value = value.replace('+', ' ');
      value = decodeURIComponent(value);
      this.post.push([name, value]);
    }
  },
  'loadSAML' : function() {
    var msg = this.getParameter('SAMLRequest');
    if (msg == null) {
      msg = this.getParameter('SAMLResponse');
    }
    if (msg != null) {
      this.saml = SAMLTrace.b64deflate(msg);
      return;
    }

    if (msg == null) {
      msg = this.getParameter('SAMLart');
    }
    if (msg != null) {
      this.samlart = msg;
      return;
    }

    msg = this.postParameter('SAMLRequest');
    if (msg == null) {
      msg = this.postParameter('SAMLResponse');
    }
    if (msg != null) {
      msg = msg.replace(/\s/g, '');
      this.saml = atob(msg);
      return;
    }

    if (msg == null) {
      msg = this.postParameter('SAMLart');
    }
    if (msg != null) {
      this.samlart = msg;
      return;
    }

    this.saml = null;
  }
};

/** if encoded==true, the variable s is first JSON.parse()'d **/
SAMLTrace.Request.createFromJSON = function(s, encoded) {
  var jd;
  if (encoded) {
    jd=JSON.parse(s);
  } else {
    jd=s;
  }

  var o = Object.create(SAMLTrace.Request.prototype);
  for (var n in jd) {
    o[n] = jd[n];
  }

  return o;
}



SAMLTrace.RequestMonitor = function(traceWindow) {
  this.traceWindow = traceWindow;
  // this.obsService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService);
  // this.obsService.addObserver(this, 'http-on-modify-request', false);
  // this.obsService.addObserver(this, 'http-on-examine-response', false);
  this.activeRequests = [];
};
SAMLTrace.RequestMonitor.prototype = {
  'close' : function() {
    this.obsService.removeObserver(this, 'http-on-modify-request');
    this.obsService.removeObserver(this, 'http-on-examine-response');
    this.activeRequests = [];
  },
  'observe' : function(subject, topic, data) {
    if (topic == 'http-on-modify-request') {
      var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
      var request = new SAMLTrace.Request(httpChannel);
      this.activeRequests.push({'channel' : httpChannel, 'request' : request});
    } else if (topic == 'http-on-examine-response') {
      var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
      for (var i = 0; i < this.activeRequests.length; i++) {
        var r = this.activeRequests[i];
        if (r.channel == httpChannel) {
          r.request.loadResponse(httpChannel);
          this.traceWindow.addRequest(r.request);
          this.activeRequests.splice(i, 1);
        }
      }
    }
  },
};

SAMLTrace.RequestItem = function(request) {
  this.request = request;

  this.availableTabs = ['http'];
  if (this.request.get.length != 0 || this.request.post.length != 0) {
    this.availableTabs.push('Parameters');
  }
  if (this.request.saml != null || this.request.samlart != null) {
    this.availableTabs.push('SAML');
  }
};
SAMLTrace.RequestItem.prototype = {

  'showHTTP' : function(target) {
    target.innerText = "";
    var doc = target.ownerDocument;

    // function addHeaderLine(h) {
    //   var name = doc.createElement('b');
    //   name.textContent = h[0];
    //   target.appendChild(name);
    //   target.appendChild(doc.createTextNode(': ' + h[1] + '\n'));
    // }

    function addHeaderLine(h) {
      var name = doc.createElement('b');
      name.textContent = h.name;
      target.appendChild(name);
      target.appendChild(doc.createTextNode(': ' + h.value + '\n'));
    }

    var reqLine = doc.createElement('b');
    reqLine.textContent = this.request.method + ' ' + this.request.url + ' HTTP/1.1\n';
    target.appendChild(reqLine);
    this.request.requestHeaders.forEach(addHeaderLine);
    target.appendChild(doc.createTextNode('\n'));

    this.request.loadResponse(null);
    var respLine = doc.createElement('b');
    respLine.textContent = this.request.responseStatusText + "\n";
    target.appendChild(respLine);
    this.request.responseHeaders.forEach(addHeaderLine);
  },

  'showParameters' : function(target) {
    var doc = target.ownerDocument;

    function addParameters(name, parameters) {
      if (parameters.length == 0) {
        return;
      }
      var h = doc.createElement('b');
      h.textContent = name + '\n';
      target.appendChild(h);
      for (var i = 0; i < parameters.length; i++) {
        var p = parameters[i];
        var nameElement = doc.createElement('b');
        nameElement.textContent = p[0];
        target.appendChild(nameElement);
        target.appendChild(doc.createTextNode(': ' + p[1] + '\n'));
      }
    }

    addParameters('GET', this.request.get);
    addParameters('POST', this.request.post);
  },

  'showSAML' : function(target) {
    var doc = target.ownerDocument;
    if (this.request.saml) {
      var samlFormatted = SAMLTrace.prettifyXML(this.request.saml);
    } else {
      var samlFormatted = SAMLTrace.prettifyArtifact(this.request.samlart);
    }
    target.appendChild(doc.createTextNode(samlFormatted));
  },

  'showContent' : function(target, type) {
    switch (type) {
    case 'http':
      this.showHTTP(target);
      break;
    case 'Parameters':
      this.showParameters(target);
      break;
    case 'SAML':
      this.showSAML(target);
      break;
    }
  },

  'addListItem' : function(target, showContentElement) {
    //var methodLabel = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'label');
    var methodLabel = document.createElement("label");
    methodLabel.setAttribute('class', 'request-method');
    methodLabel.setAttribute('value', this.request.method);
    methodLabel.innerText = this.request.method;

    //var urlLabel = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'label');
    var urlLabel = document.createElement("label");
    urlLabel.setAttribute('flex', '1');
    urlLabel.setAttribute('crop', 'end');
    urlLabel.setAttribute('class', 'request-url');
    urlLabel.setAttribute('value', this.request.url);
    urlLabel.innerText = this.request.url;
    //urlLabel.onclick = function() { console.log(this.request.url); };

    //var hbox = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'hbox');
    var hbox = document.createElement("div");
    hbox.setAttribute('flex', '1');
    hbox.setAttribute('id', 'request-' + this.request.requestId);
    hbox.setAttribute('class', 'list-row');
    hbox.appendChild(methodLabel);
    hbox.appendChild(urlLabel);

    if (this.request.saml || this.request.samlart) {
          //var samlLogo = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'image');
          var samlLogo = document.createElement("label");
          //samlLogo.setAttribute('src', 'chrome://samltrace/content/saml.png');
          samlLogo.innerText = "SAML";
          hbox.appendChild(samlLogo);
    }

    //var element = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'richlistitem');
    var element = hbox;

    // layout update: apply style to item based on responseStatus
    var r=this.request.responseStatus;
    var s;
    if (r<200) s='info';
    else if (r<300) s='ok';
    else if (r<400) s='redirect';
    else if (r<500) s='clerror';
    else if (r<600) s='srerror';
    else s='other';
    //element.setAttribute('class', 'request-'+s);

    //element.appendChild(hbox);
    element.requestItem = this;
    // element.onclick = function () {
    //   this.showContent(showContentElement, "http");
    // };

    var requestItemReference = this;
    element.addEventListener('click', function(e) {
      //console.log(this.requestItem.request.url);
      requestItemReference.showContent(showContentElement, "http");
    }, false);

    target.appendChild(element);
  },

};

SAMLTrace.TraceWindow = function() {
  this.httpRequests = [];
  this.requests = [];
  this.autoScroll = true;
  this.filterResources = true;

  // document.getElementById('button-autoscroll').setAttribute('checked', this.autoScroll);
  // document.getElementById('button-filter').setAttribute('checked', this.filterResources);

  window.tracer = this;
  this.requestMonitor = new SAMLTrace.RequestMonitor(this);

  this.updateStatusBar();

  this.requestInfoEmpty = document.getElementById('request-info-norequest');
  this.requestInfoTabbox = null;

  this.showRequest(null);
};

SAMLTrace.TraceWindow.prototype = {
  'close' : function() {
    this.requestMonitor.close();
  },

  'isRequestVisible' : function(request) {
    if (!this.filterResources) {
      return true;
    }
    if (request.responseStatus != 200 && request.responseStatus != 304) {
      return true; // Always show "special" responses.
    }

    var type = null;
    for (var i = 0; i < request.responseHeaders.length; i++) {
      var h = request.responseHeaders[i];
      if (h[0].toLowerCase() == 'content-type') {
        type = h[1];
      }
    }
    if (type == null) {
      return true;
    }

    type = type.toLowerCase();
    var i = type.indexOf(';');
    if (i != -1) {
      type = type.substr(0, i);
    }

    type = type.trim();

    switch (type) {
    case 'application/ecmascript':
    case 'application/javascript':
    case 'application/ocsp-response':
    case 'application/vnd.google.safebrowsing-chunk':
    case 'application/vnd.google.safebrowsing-update':
    case 'application/x-javascript':
    case 'application/x-shockwave-flash':
    case 'image/gif':
    case 'image/jpg':
    case 'image/jpeg':
    case 'image/png':
    case 'image/vnd.microsoft.icon':
    case 'image/x-icon':
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

    var list = document.getElementById('request-list');
    var showContentElement = document.getElementById('txt');
    item.addListItem(list, showContentElement);

    /*var requestItem = document.createElement("div");
    requestItem.setAttribute("class", "list-row");
    requestItem.innerText = item.request.url;
    list.appendChild(requestItem);*/

    if (this.autoScroll) {
      //list.ensureElementIsVisible(list.lastChild);
      //list.scrollTop = list.scrollHeight;
      list.scrollTop = list.scrollHeight;
    }
  },

  'resetList' : function() {
    var listbox = document.getElementById('request-list');
    while (listbox.firstChild) {
      listbox.removeChild(listbox.firstChild);
    }
    // var items = listbox.getElementsByTagNameNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'richlistitem');
    // for (var i = items.length - 1; i >= 0; i--) {
    //   listbox.removeChild(items[i]);
    // }

    // for (var i = 0; i < this.requests.length; i++) {
    //   var request = this.requests[i];
    //   if (this.isRequestVisible(request)) {
    //     this.addRequestItem(request, null);
    //   }
    // }

    this.updateStatusBar();
  },

  'clearRequests' : function() {
    this.requests = [];
    this.httpRequests = [];
    this.resetList();
    this.showRequest(null);
  },

  'setAutoscroll' : function(autoScroll) {
    this.autoScroll = autoScroll;
  },

  'setFilterResources' : function(filterResources) {
    this.filterResources = filterResources;
    this.resetList();
  },

  'updateStatusBar' : function() {
    // var strbundle = document.getElementById('strings');
    //var status = strbundle.getFormattedString('samltrace.status.received_count', [ this.requests.length ]);
    var status = "Received " + this.httpRequests.length + " requests.";

    var statusItem = document.getElementById('statuspanel');
    //statusItem.setAttribute('label', status);
    statusItem.innerText = status;
  },

  'saveHttpRequest' : function(request) { // body
    var entry = {
      id: request.requestId,
      req: request
    };
    this.tracer.httpRequests.push(entry);
  },

  'addRequest' : function(request) { //headers
    var entry = this.tracer.httpRequests.find(req => req.id === request.requestId);
    entry.headers = request.requestHeaders;

    if (this.tracer.isRequestVisible(request)) {
      this.tracer.addRequestItem(entry, () => entry.res);
    }
    this.tracer.updateStatusBar();
  },

  'addResponse' : function(response) {
    var index = this.tracer.httpRequests.findIndex(req => req.id === response.requestId);
    this.tracer.httpRequests[index].res = response;

    var r = response.statusCode;
    var s;
    if (r<200) s='info';
    else if (r<300) s='ok';
    else if (r<400) s='redirect';
    else if (r<500) s='clerror';
    else if (r<600) s='srerror';
    else s='other';
    var requestDiv = document.getElementById("request-" + response.requestId);
    var existingAttributes = requestDiv.getAttribute("class");
    requestDiv.setAttribute("class", existingAttributes + " request-" + s);
  },

  'showRequest' : function(requestItem) {
    if (requestItem === null) {
      document.getElementById("txt").innerText = "";
    }
    return;

    this.requestItem = requestItem;

    if (this.requestInfoTabbox != null) {
      this.requestInfoTabbox.parentNode.removeChild(this.requestInfoTabbox);
      this.requestInfoTabbox = null;
    }

    if (requestItem == null) {
      this.requestInfoEmpty.setAttribute('hidden', false);
      return;
    }
    this.requestInfoEmpty.setAttribute('hidden', true);

    this.requestInfoTabbox = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'tabbox');
    this.requestInfoTabbox.setAttribute('flex', 1);
    var requestInfoTabs = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'tabs');
    this.requestInfoTabbox.appendChild(requestInfoTabs);
    var requestInfoTabpanels = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'tabpanels');
    requestInfoTabpanels.setAttribute('flex', 1);
    this.requestInfoTabbox.appendChild(requestInfoTabpanels);

    for (var i = 0; i < requestItem.availableTabs.length; i++) {
      var name = requestItem.availableTabs[i];
      this.addRequestTab(requestInfoTabs, requestInfoTabpanels, name);
    }

    document.getElementById('request-info-panel').appendChild(this.requestInfoTabbox);
  },

  'addRequestTab' : function(requestInfoTabs, requestInfoTabpanels, name) {
    var iframe = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'iframe');
    iframe.setAttribute('flex', 1);
    iframe.setAttribute('src', 'chrome://samltrace/content/request.html#' + name);

    var tab = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'tab');
    tab.setAttribute('label', name);

    var tabpanel = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'tabpanel');
    tabpanel.setAttribute('flex', 1);
    tabpanel.appendChild(iframe);

    if (!requestInfoTabs.hasChildNodes()) {
      /* The first tab. Mark it as selected. */
      tab.setAttribute('selected', true);
    }

    requestInfoTabs.appendChild(tab);
    requestInfoTabpanels.appendChild(tabpanel);
  },

  'showRequestContent' : function(element, type) {
    if (this.requestItem == null) {
      /* No request selected. */
      return;
    }
    this.requestItem.showContent(element, type);
  },

};

SAMLTrace.TraceWindow.init = function() {
  var traceWindow = new SAMLTrace.TraceWindow();
  
  browser.webRequest.onBeforeRequest.addListener(
    traceWindow.saveHttpRequest,
    {urls: ["<all_urls>"]},
    ["requestBody"]
  );

  browser.webRequest.onBeforeSendHeaders.addListener(
    traceWindow.addRequest,
    {urls: ["<all_urls>"]},
    ["blocking", "requestHeaders"]
  );

  browser.webRequest.onHeadersReceived.addListener(
    traceWindow.addResponse,
    {urls: ["<all_urls>"]},
    ["blocking", "responseHeaders"]
  );
};

SAMLTrace.TraceWindow.close = function() {
  window.tracer.close();
};

SAMLTrace.TraceWindow.selectRequest = function() {
  var lb = document.getElementById('request-list');
  var requestElement = lb.getSelectedItem(0);

  if (requestElement == null) {
    window.tracer.showRequest(null);
  } else {
    window.tracer.showRequest(requestElement.requestItem);
  }
};

SAMLTrace.TraceWindow.showRequestContent = function() {
  var type = window.location.hash.substr(1);
  var txt = document.getElementById('txt');

  if (!window.parent.tracer) {
    /* Not loaded yet. */
    return;
  }

  window.parent.tracer.showRequestContent(txt, type);
};


// SAMLTrace.TraceWindow.exportRequests = function() {
//   var lb = document.getElementById('request-list');
//   if (!lb || lb.itemCount == 0) {
//     var strbundle = document.getElementById('strings');
//     //alert(strbundle.getString('samltrace.alert.nothing_to_export'));
//     return;
//   }

//   // Establish user context for export
//   var reqs = window.parent.tracer.requests;
//   window.openDialog('chrome://samltrace/content/exportDialog.xul',
//                     'global:samltrace:exportDialog', 'modal', reqs);

// }


// SAMLTrace.TraceWindow.importRequests = function() {
// 	SAMLTraceIO.importRequests(window, function(newreq) {
// 		window.parent.tracer.addRequest(newreq);
// 	});
// } // SAMLTrace.TraceWindow.importRequests()