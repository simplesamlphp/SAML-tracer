SAML-tracer
===========

SAML-tracer is a Firefox extension that aims to make debugging of
SAML- and WS-Federation-communication between websites easier. 
It is a request logger that in addition to showing normal requests, 
also highlights and decodes SAML messages that are transmitted.


Using SAML-tracer
-----------------

SAML-tracer is activated by clicking its icon in the browser toolbar.
It can be alternatively started by pressing <kbd>ALT</kbd> +
<kbd>SHIFT</kbd> + <kbd>S</kbd> on the keyboard.

Once it is activated, you will get a window that shows all requests,
and the data included in them. It also shows response headers.
Messages including SAML data are highlighted with a SAML logo at the
right side of the request list. Those containing WS-Federation data
are highlighted with a WS-Fed logo respectively.

Selecting a request gives you up to three tabs:

* HTTP: A quick overview over the request, with request and response
  headers.
* Parameters: GET and POST parameters included in the request.
* SAML: Decoded SAML message found in the request.


Developing SAML-tracer
----------------------

To make changes to SAML-tracer, you should start by cloning the Git
repository from:

  https://github.com/SimpleSAMLphp/SAML-tracer/

You can now modify and extend SAML-tracer. To test your changes, you 
can debug the extension as described here:

  https://developer.mozilla.org/Add-ons/WebExtensions/Debugging

After modifying the source code, you need to commit your changes to
your local Git repository.


License
-------

SAML-tracer is released under the 2-clause BSD license. See the
[LICENSE](LICENSE)-file for more information.


Attribution
-----------

SAML-tracer makes use of open source libraries.
See [here](attribution.md) for more details.
