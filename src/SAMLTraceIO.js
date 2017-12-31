/**
 * Some functionality to support the import/export
 * for SAMLTracer
 * Added to SAMLTracer by M. Dobrinic
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
  'getInputFile': function(w) {
    var nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Components.classes["@mozilla.org/filepicker;1"].
      createInstance(nsIFilePicker);

    fp.init(w, "Select RequestDump file - exported requests",
            nsIFilePicker.modeOpen);

    var res = fp.show();
    if (res != nsIFilePicker.returnOK) return null;

    return fp.file;
  },

// Main feature
  'exportRequests': function(reqs, cookieProfile) {
    // Perform request filtering based on user input from dialog:
    var ef = new SAMLTraceIO.ExportFilter(cookieProfile);
    var filteredreqs = ef.perform(reqs);

    // Package results
    var result = {};
    result['requests'] = filteredreqs;
    result['timestamp'] = new Date().toISOString();
    return result;
  },

  'serialize': function(exportResult) {
    let indentSpaces = 2;
    return JSON.stringify(exportResult, null, indentSpaces);
  },

  'getOutputFile': function(exportResult) {
    let timeStamp = exportResult && exportResult["timestamp"] ? exportResult["timestamp"] : "no-timestamp";
    return `SAML-Tracer-export-${timeStamp}.json`;
  },

  /**
   * Import requests, and execute given function 'nrf' on every
   *   imported request, with SAMLTrace.Request instance as argument
   * @param w is the parent window of the UI-dialog; must be non-null
   *   for getInputFile to work
   **/
  'importRequests': function(w, nrf) {
    var f = SAMLTraceIO.getInputFile(w);
    if (f == null) return; // No input file selected

    // Bulk read contents; provide content-type to facilitate reading;
    // Perform a-sync reading to not lockup UI
    var channel = NetUtil.newChannel(f);
    channel.contentType = "application/json";

    NetUtil.asyncFetch(channel, function(inputStream, status) {
        if (!Components.isSuccessCode(status)) {
          SAMLTraceIO.log('Error occurred when reading file: '+status);
          return;
        }

        var data = NetUtil.readInputStreamToString(inputStream,
                                                  inputStream.available());
        var j = JSON.parse(data);

        // Append the requests to the list
        for (var i in j['requests']) {
          var o = j['requests'][i];
          var ni = SAMLTrace.Request.createFromJSON(o, false);
          nrf(ni);
        }
      }); // NetUtil.asyncFetch()
  }, // SAMLTrace.TraceWindow.importRequests()

  'log': function(msg) {
    var aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].
      getService(Components.interfaces.nsIConsoleService);

    aConsoleService.logStringMessage('SAMLTraceIO.log: '+msg);
  }
}

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
					SAMLTraceIO_filters.hashValueFilter(
							'post', '*'),		// hash *all* the post elements
					SAMLTraceIO_filters.overwriteKeyValue(
							'postData'),	// overwrite the postData-variable
					SAMLTraceIO_filters.hashCookieValueFilter(
							'requestHeaders', 'Cookie'),	// hash cookie values in request
					SAMLTraceIO_filters.hashCookieValueFilter(
							'responseHeaders', 'Set-Cookie')	// ..as well as in response
				);
				break;

			case '3' :	// Apply obfuscate/overwrite filters
				this.exportFilters.push(
					SAMLTraceIO_filters.obfuscateValueFilter(
							'post', '*'),		// obfuscate *all* the post elements
					SAMLTraceIO_filters.overwriteKeyValue(
							'postData'),	// overwrite the postData-variable
					SAMLTraceIO_filters.obfuscateCookieValueFilter(
							'requestHeaders', 'Cookie'),	// obfuscate cookie values in request
					SAMLTraceIO_filters.obfuscateCookieValueFilter(
							'responseHeaders', 'Set-Cookie')	// ..as well as in response
				);
				break;
		} // switch
	},
  'perform' : function(reqs) {
    var the_filters = this.exportFilters;	// move from instance to local scope
    
    var createFromJSON = function(s, encoded) {
      if (encoded) {
        return JSON.parse(s);
      } else {
        return s;
      }
    };

    var reqscopy = reqs.map(function(req) {
      var newRequest = createFromJSON(JSON.stringify(req), true);
      the_filters.forEach(function(filter) {
        filter(newRequest);
      });
      return newRequest; // add filtered request to result
    });
    return reqscopy;
  }
}
