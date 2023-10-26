'use strict';

import * as poly from "@babel/polyfill/dist/polyfill";
import hljs from  "highlight.js/lib/core";
import http from "highlight.js/lib/languages/http";
import xml from "highlight.js/lib/languages/xml";

ready(function () {
    hljs.registerLanguage('http', http);
    hljs.registerLanguage('xml', xml);
});
