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
    if (req == null || req[collection] == null) return;
    for (var i in req[collection]) {
      if (key == req[collection][i][0] || key == '*') {
        var s = req[collection][i][1];
        if (s) {
          new_val_func(i, req[collection][i][1], (index, newval) => {
            req[collection][index][1] = newval;
          });
        } else {  // only key was set without data (can happen with 'post'..)
          new_val_func(i, req[collection][i][0], (index, newval) => {
            req[collection][index][0] = newval;
          });
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
 * hash of a key-value
 */
SAMLTraceIO_filters.hashValueFilter = function(collection, key) {
  return SAMLTraceIO_filters.genValueFilter(collection, key, function(index, oldval, onHashCalculated) {
    var h = SAMLTraceIO_filters.hashString(oldval);
    h.then(newval => {
      onHashCalculated(index, '{hash:'+newval+'}');
    });
  });
};

/**
 * genValueFilter-wrapper that delivers a function that replaces a key with a
 * obfuscated value for a key-value
 */
SAMLTraceIO_filters.obfuscateValueFilter = function(collection, key) {
  return SAMLTraceIO_filters.genValueFilter(collection, key, function(index, oldval, onObfuscated) {
    var h = SAMLTraceIO_filters.getObfValueFor(oldval);
    var newval = '{obf:'+h+'}';
    onObfuscated(index, newval);
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
* will return a function that can be called with a SAMLTrace.Request instance
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
SAMLTraceIO_filters.genMultiValueFilter = function(collection, key, separator, new_val_func)
{
  return function(req) {
    if (req == null || req[collection] == null) {
      return;
    }

    const elems = req[collection].filter(item => item.name.toUpperCase() === key.toUpperCase());
    if (elems == null || elems.length === 0) {
      return;
    }

    for (let index = 0; index < elems.length; index++) {
      let elem = elems[index];
      let originalKeyValuePairs = elem.value.split(separator);
      let processedKeyValuePairs = [];
  
      for (let i = 0; i < originalKeyValuePairs.length; i++) {
        let subkey, subvalue;
        if (originalKeyValuePairs[i].indexOf('=') >= 0) {
          subkey = originalKeyValuePairs[i].split('=')[0];
          subvalue = originalKeyValuePairs[i].split('=')[1];
        } else {
          subkey = originalKeyValuePairs[i];
          subvalue = null; // no value for boolean/flag-attributes
        }
  
        new_val_func(subkey, subvalue, (processedSubkey, newval) => {
          // create syntactically correct entry:
          if (subvalue !== null) {
            processedKeyValuePairs.push([processedSubkey, newval].join('='));
          } else {
            processedKeyValuePairs.push(processedSubkey);
          }
  
          // update element's value on the last iteration
          if (i === originalKeyValuePairs.length - 1) {
            elem.value = processedKeyValuePairs.join(separator);
          }
        });
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
  return SAMLTraceIO_filters.genMultiValueFilter(collection, key, ';', function(key, oldval, onOverwritten) {
    onOverwritten(key, newvalue);
  });
}

/**
 * genMultiValueFilter-wrapper that delivers a function that replaces the
 * sub_values of a key with the sha1-hash value
 */
SAMLTraceIO_filters.hashCookieValueFilter = function(collection, key) {
  return SAMLTraceIO_filters.genMultiValueFilter(collection, key, ';', function(key, oldval, onHashCalculated) {
    var h = SAMLTraceIO_filters.hashString(oldval);
    h.then(newval => {
      onHashCalculated(key, '{hash:'+newval+'}');
    });
  });
}

/**
 * genMultiValueFilter-wrapper that delivers a function that replaces the
 * sub_values of a key with a obfuscated sub_value for a sub_key=sub_value
 */
SAMLTraceIO_filters.obfuscateCookieValueFilter = function(collection, key) {
  return SAMLTraceIO_filters.genMultiValueFilter(collection, key, ';', function(key, oldval, onObfuscated) {
    var h = SAMLTraceIO_filters.getObfValueFor(oldval);
    var newval = '{obf:'+h+'}';
    onObfuscated(key, newval);
  });
}


/**
 * Deliver a function that overwrites a main key with a fixed value
 */
SAMLTraceIO_filters.overwriteKeyValue = function(key, newvalue) {
  newvalue = newvalue || '{overwritten}';
  return function(req) {
    if (req == null || req[key] == null || req[key] === '') return;
    req[key] = newvalue;
  };
}




/**
 * Calculate hash over provided string value (str).
 */
SAMLTraceIO_filters.hashString = function(str) {
  return Hash.calculate(str);
}


// == helper functions for static replacement calculation ==
SAMLTraceIO_filters.obfs = [];
SAMLTraceIO_filters.getObfValueFor = function(oldvalue) {
  var i =- 1;
  if (SAMLTraceIO_filters.obfs) {
    i = SAMLTraceIO_filters.obfs.indexOf(oldvalue);
    if (i === -1) {
      i = SAMLTraceIO_filters.obfs.length;
      SAMLTraceIO_filters.obfs.push(oldvalue);
    }
  }
  return 'alternative_' + i;
}
