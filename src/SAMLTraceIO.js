/**
 * Some functionality to support the import/export
 * for SAML-tracer
 * Added to SAML-tracer by M. Dobrinic
 * 2011-dec
 **/

// export SAMLTrace namespace to make ao. Request definitions available
var EXPORTED_SYMBOLS = ["SAMLTraceIO"];

// Put functionality in out own namespace
if ("undefined" == typeof(SAMLTraceIO)) {
  var SAMLTraceIO = {};
};

SAMLTraceIO = function() {
};

SAMLTraceIO.prototype = {
  /**
   * Main feature: Exports and optionally filters traced requests.
   **/
  'exportRequests': function(reqs, cookieProfile) {
    // Perform request filtering based on user input from dialog:
    var ef = new SAMLTraceIO.ExportFilter(cookieProfile);
    var filteredreqs = ef.perform(reqs);

    // Package results
    var result = {
      requests: filteredreqs,
      timestamp: new Date().toISOString()
    };
    return result;
  },

  'serialize': function(exportResult) {
    let indentSpaces = 2;
    return JSON.stringify(exportResult, null, indentSpaces);
  },

  'getOutputFile': function(exportResult) {
    const timeStamp = exportResult && exportResult.timestamp ? exportResult.timestamp.replaceAll(":", "_") : "no-timestamp";
    return `SAML-tracer-export-${timeStamp}.json`;
  },

  /**
   * Imports requests and restores them in the TraceWindow.
   **/
  'importRequests': function(selectedFile, tracer, onSuccess, onError) {
    const parseRequests = rawResult => {
      try {
        let exportedSession = JSON.parse(rawResult);
        let successfullyRestored = this.restoreFromImport(exportedSession.requests, tracer, onError);
        if (successfullyRestored) {
          onSuccess();
        }
      } catch (error) {
        console.log("An error occurred while trying to parse and import requests: " + error);
        if (error instanceof SyntaxError) {
          onError("The selected file doesn't seem to contain importable traces!");
        } else if (error instanceof TypeError) {
          onError("The selected file seems to be invalid or corrupted!");
        } else {
          onError("Error while importing: " + error);
        }
      }
    };

    let reader = new FileReader();
    reader.onload = e => {
      parseRequests(e.target.result);
    }
    reader.readAsText(selectedFile);
  },

  'restoreFromImport' : function(importedRequests, tracer, onError) {
    if (!importedRequests || importedRequests.length === 0) {
      onError("There aren't any requests to import...");
      return false;
    }

    // Since the release of v1.0.0 every request's got a "requestId". If it ain't present, it's a legacy import.
    let isLegacyImport = !importedRequests[0].hasOwnProperty("requestId");
    console.log(`The imported requests are in ${isLegacyImport ? "legacy" : "current"}-style.`);

    const getHeaders = importedHeaders => {
      if (isLegacyImport) {
        return importedHeaders.map(h => { return { name: h[0], value: h[1] } });
      } else {
        return importedHeaders;
      }
    };
    
    const getRequestId = importedRequest => {
      return isLegacyImport ? importedRequest.id : importedRequest.requestId;
    };

    const createRestoreableModel = importedRequest => {
      let pseudoRequest = {
        req: {
          method: importedRequest.method,
          url: importedRequest.url,
          requestId: getRequestId(importedRequest),
          requestBody: {
            post: importedRequest.post
          }
        },
        requestId: getRequestId(importedRequest),
        url: importedRequest.url,
        headers: getHeaders(importedRequest.requestHeaders),
        saml: importedRequest.saml,
        getResponse: () => {
          let pseudoResponse = {
            requestId: getRequestId(importedRequest),
            url: importedRequest.url,
            statusCode: importedRequest.responseStatus,
            statusLine: importedRequest.responseStatusText,
            responseHeaders: getHeaders(importedRequest.responseHeaders)
          };
          return pseudoResponse;
        }
      };
      return pseudoRequest;
    };

    let restoreableRequests = importedRequests.map(ir => createRestoreableModel(ir));
    restoreableRequests.forEach(rr => {
      tracer.saveNewRequest(rr);
      tracer.addRequestItem(rr, rr.getResponse);
      tracer.attachResponseToRequest(rr.getResponse());
    });

    return true;
  }
};


/**
 * ExportFilter applies filtering of SAMLTrace.Request instances
 * based on provided profile
 **/
SAMLTraceIO.ExportFilter = function(cookieProfile) {
  this.exportFilters = [];
  this.loadPreferences(cookieProfile);
};

SAMLTraceIO.ExportFilter.prototype = {
  'loadPreferences' : function(cookieProfile) {
    this.exportFilters = [];

    switch (cookieProfile) {
      case '1' :	// No cookiefiltering or filtering whatsoever
        break;

      case '2' :	// Apply hash filters
        this.exportFilters.push(
          SAMLTraceIO_filters.hashValueFilter('post', '*'),                          // hash *all* the post elements
          SAMLTraceIO_filters.overwriteKeyValue('postData'),                         // overwrite the postData-variable
          SAMLTraceIO_filters.hashCookieValueFilter('requestHeaders', 'Cookie'),     // hash cookie values in request
          SAMLTraceIO_filters.hashCookieValueFilter('responseHeaders', 'Set-Cookie') // ..as well as in response
        );
        break;

      case '3' :	// Apply obfuscate/overwrite filters
        this.exportFilters.push(
          SAMLTraceIO_filters.obfuscateValueFilter('post', '*'),                          // obfuscate *all* the post elements
          SAMLTraceIO_filters.overwriteKeyValue('postData'),                              // overwrite the postData-variable
          SAMLTraceIO_filters.obfuscateCookieValueFilter('requestHeaders', 'Cookie'),     // obfuscate cookie values in request
          SAMLTraceIO_filters.obfuscateCookieValueFilter('responseHeaders', 'Set-Cookie') // ..as well as in response
        );
        break;
    }
  },
  
  'perform' : function(reqs) {
    let the_filters = this.exportFilters; // move from instance to local scope
    
    const createFromJSON = function(obj) {
      let stringified = JSON.stringify(obj);
      return JSON.parse(stringified);
    };

    const enrichWithResponse = (req, res) => {
      let responseCopy = createFromJSON(res);
      req.responseStatus = responseCopy.statusCode;
      req.responseStatusText = responseCopy.statusLine;
      req.responseHeaders = responseCopy.responseHeaders;
    };

    let reqscopy = reqs.map(req => {
      let newRequest = createFromJSON(req);
      enrichWithResponse(newRequest, req.getResponse());

      the_filters.forEach(filter => filter(newRequest));
      return newRequest;
    });
    
    return reqscopy;
  }
};
