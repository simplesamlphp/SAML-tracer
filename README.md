SAML Tracer
===========

SAML Tracer is a Firefox extension that aims to make debugging of
SAML communication between websites easier. It is a request logger that
in addition to showing normal requests, also highlights and decodes
SAML messages that are transmitted.


Using SAML Tracer
-----------------

SAML Tracer is activated by selecting SAML Tracer in the Tools menu.
(If the menu bar is deativated, it must be activated to access SAML
Tracer.)

Once it is activated, you will get a window that shows all requests,
and the data included in them. It also shows response headers.
Messages including SAML data are highlighted with a SAML logo at the
right side of the request list.

Selecting a request gives you up to three tabs:

* http: A quick overview over the request, with request and response
  headers.
* Parameters: GET and POST parameters included in the request.
* SAML: Decoded SAML message found in the request.


Developing SAML Tracer
----------------------

To make changes to SAML Tracer, you should start by cloning the Git
repository from:

  https://github.com/UNINETT/SAML-tracer/

After modifying the source code, you need to commit your changes to
your local Git repository. You can then run `build.sh` from the
root of the repository.

`build.sh` will create `samltracer.xpi` from the latest commit in
your repository. This `xpi`-file can then be loaded into Firefox
by running `firefox samltracer.xpi` (or opening the file in Firefox).


License
-------

SAML Tracer is released under the 2-clause BSD license. See the
`LICENSE`-file for more information.
