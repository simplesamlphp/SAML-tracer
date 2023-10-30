'use strict';

import hljs from  "highlight.js/lib/core";
import http from "highlight.js/lib/languages/http";
import properties from "highlight.js/lib/languages/properties";
import xml from "highlight.js/lib/languages/xml";

ready(function () {
    hljs.registerLanguage('http', http);
    hljs.registerLanguage('properties', properties);
    hljs.registerLanguage('xml', xml);
});
