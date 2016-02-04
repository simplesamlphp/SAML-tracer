/**
 * Filter implementations for import/export SAMLTraces
 **/

// export filters namespace
var EXPORTED_SYMBOLS = ["SAMLTraceIO_filters"];

// declare namespace
if ("undefined" == typeof(SAMLTraceIO_filters)) {
  var SAMLTraceIO_filters = {};
};


/**
* genValueFilter provides a generic key=value filter, where the
* new value is calculated from the old value by a function that has to be
* passed to the function
* collection (string) the collection where the key lives
* key (string) the name of the key, or '*' for every key
* new_val_func (string) a function that takes one parameter that
*   is set to the original value, and returns the value to set the key to
*
* returns a function that expects a SAMLTrace.Request instance, which will
*   be filtered using the provided spec
*/
SAMLTraceIO_filters.genValueFilter = function(collection, key, new_val_func) {
	return function(req) {
		if (req==null || req[collection]==null) return;
		for (var i in req[collection]) {
			if (key == req[collection][i][0] || key == '*') {
        var s = req[collection][i][1];
        if (s) {
          var h = new_val_func(req[collection][i][1]);
				req[collection][i][1] = h;
        } else {  // only key was set without data (can happen with 'post'..)
          var h = new_val_func(req[collection][i][0]);
				req[collection][i][0] = h;
        }
			}
		}
	};
}

/**
 * genValueFilter-wrapper that delivers a function that replaces a key with a
 * fixed value, provided in newvalue
 */
SAMLTraceIO_filters.overwriteValueFilter = function(collection, key, newvalue) {
	newvalue = newvalue || '{overwritten}';
  return SAMLTraceIO_filters.genValueFilter(collection, key, function(oldval) {
    return newvalue;
  });
}

/**
 * genValueFilter-wrapper that delivers a function that replaces a key with the
 * sha1-hash of a key-value
 */
SAMLTraceIO_filters.hashValueFilter = function(collection, key) {
  return SAMLTraceIO_filters.genValueFilter(collection, key, function(oldval) {
    var h = SAMLTraceIO_filters.hashString(oldval);
    return '{hash:'+h+'}';
  });
};


/**
 * genValueFilter-wrapper that delivers a function that replaces a key with a
 * obfuscated value for a key-value
 */
SAMLTraceIO_filters.obfuscateValueFilter = function(collection, key) {
  return SAMLTraceIO_filters.genValueFilter(collection, key, function(oldval) {
    var h = SAMLTraceIO_filters.getObfValueFor(oldval);
    return '{obf:'+h+'}';
  });
}


/**
* genMultiValueFilter provides a generic
*    "key sub_key1=sub_value1;sub_key2=sub_value2;.." filter, where each
* new sub_value is calculated from the old sub_value by a function that has to be
* passed to the function
*
* i.e.
*   myfilter = SAMLTraceIO_filters.overwriteCookieValueFilter(
*     'requestHeaders', 'Cookie', '{overwritten}');
* will return a function that can called with a SAMLTrace.Request instance
* as argument, and will filter based on provided parameters,
* i.e.
*   filtered_request = myfilter(unfiltered_request);
*
* collection (string) the collection where the key lives
* key (string) the name of the key
* new_val_func (string) a function that takes one parameter that
*   is set to the original value, and returns the value to set the key to
*
* returns a function that expects a SAMLTrace.Request instance, which will
*   be filtered using the provided spec
*/
SAMLTraceIO_filters.genMultiValueFilter = function(collection,
    key, separator, new_val_func)
{
	return function(req) {
		if (req==null || req[collection]==null) return;

		for (var i in req[collection]) {
			if (key == req[collection][i][0]) {
				// perform split, and overwrite the values
				var v=req[collection][i][1];
				var ac=v.split(separator);
				var fc=[];

				for (var c in ac) {
					var kk,kv;
					if (ac[c].indexOf('=')>=0) {
						kk=ac[c].split('=')[0];
						kv=ac[c].split('=')[1];
					} else {
						kk='';// no key
						kv=ac[c];
					}
					var h = new_val_func(kv);

					// create syntactically correct entry:
					fc.push( [kk,h].join('=') );
				}

				req[collection][i][1] = fc.join(separator);
			}
		}
	};
}


/**
 * genMultiValueFilter-wrapper that delivers a function that replaces the
 * sub_values of a key with a fixed value
 */
SAMLTraceIO_filters.overwriteCookieValueFilter = function(collection, key, newvalue) {
	newvalue = newvalue || '{overwritten}';
  return SAMLTraceIO_filters.genMultiValueFilter(collection, key, ';', function(oldval) {
      return newvalue;
  });
}

/**
 * genMultiValueFilter-wrapper that delivers a function that replaces the
 * sub_values of a key with the sha1-hash value
 */
SAMLTraceIO_filters.hashCookieValueFilter = function(collection, key) {
  return SAMLTraceIO_filters.genMultiValueFilter(collection, key, ';', function(oldval) {
    var h = SAMLTraceIO_filters.hashString(oldval);
    return '{hash:'+h+'}';
  });
}

/**
 * genMultiValueFilter-wrapper that delivers a function that replaces the
 * sub_values of a key with a obfuscated sub_value for a sub_key=sub_value
 */
SAMLTraceIO_filters.obfuscateCookieValueFilter = function(collection, key) {
  return SAMLTraceIO_filters.genMultiValueFilter(collection, key, ';', function(oldval) {
    var h = SAMLTraceIO_filters.getObfValueFor(oldval);
    return '{obf:'+h+'}';
  });
}


/**
 * Deliver a function that overwrites a main key with a fixed value
 */
SAMLTraceIO_filters.overwriteKeyValue = function(key, newvalue) {
	newvalue = newvalue || '{overwritten}';

	return function(req) {
		if (req==null || req[key]==null || req[key]==='') return;
		req[key] = newvalue;;
	};
}



// == helper functions for hash calculation ==
SAMLTraceIO_filters.toHashString = function(charCode) {
  return ("0" + charCode.toString(16)).slice(-2);
}

/**
 * calculate hash over provided string value (sval);
 * hash is calculated over utf8-encoded byte-stream of the string
 * alg = number, see: https://developer.mozilla.org/en/nsICryptoHash#Hash_algorithms
 */
SAMLTraceIO_filters.hashString = function(sval, alg) {
  var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
      createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  var result = {};
  // data is an array of bytes
  var data = converter.convertToByteArray(sval, result);

  // now do the hash thing
  var ch = Components.classes["@mozilla.org/security/hash;1"]
                   .createInstance(Components.interfaces.nsICryptoHash);

  alg = alg || ch.SHA1;  // default: sha1
  ch.init(alg);
  ch.update(data, data.length);
  var hash = ch.finish(false)

  var s = "";
  for (i in hash) {
    s += SAMLTraceIO_filters.toHashString(hash.charCodeAt(i));
  }

  return s;
}


// == helper functions for static replacement calculation ==
SAMLTraceIO_filters.obfs = [];
SAMLTraceIO_filters.getObfValueFor = function(oldvalue) {
  var i=-1;
  if (SAMLTraceIO_filters.obfs) {
    i = SAMLTraceIO_filters.obfs.indexOf(oldvalue);
    if (i===-1) {
      i=SAMLTraceIO_filters.obfs.length;
      SAMLTraceIO_filters.obfs.push(oldvalue);
    }
  }
  return 'alternative_'+i;
}
