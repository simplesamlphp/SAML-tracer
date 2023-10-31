'use strict';

var hljs;

import {highlight as hljs} from  "highlight.js/lib/core";
import http from "highlight.js/lib/languages/http";
import properties from "highlight.js/lib/languages/properties";
import xml from "highlight.js/lib/languages/xml";

hljs.registerLanguage('http', http);
hljs.registerLanguage('properties', properties);
hljs.registerLanguage('xml', xml);
