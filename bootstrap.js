// This bootstrap.js file is based upon the template available here:
// https://developer.mozilla.org/en-US/Add-ons/Firefox_for_Android/Initialization_and_Cleanup#template_code
// The onOpenWindow event handler was slightly modified to be compatible with standard Firefox.

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

Cu.import('resource://gre/modules/Services.jsm');

var strings = Services.strings.createBundle('chrome://samltrace/locale/samltrace.properties');

var tracerWindow = null;
function showTracerWindow() {
  if (tracerWindow != null) {
    // Window already opened -- just give it focus.
    tracerWindow.focus();
    return;
  }

  tracerWindow = Services.ww.openWindow(null, "chrome://samltrace/content/TraceWindow.xul", "global:samltrace", "chrome,centerscreen", null);
  tracerWindow.addEventListener('close', function() {
    tracerWindow = null;
  });
}


function loadIntoWindow(window) {
  if (!window)
    return;

  // Add an entry to the tools menu.
  let menuToolsPopup = window.document.getElementById('menu_ToolsPopup');
  if (menuToolsPopup) {
    let mi = window.document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'menuitem');
    mi.setAttribute('label', strings.GetStringFromName('samltrace.open.label'));
    mi.setAttribute('id', 'samltrace-menu-open');
    mi.addEventListener('command', showTracerWindow);
    menuToolsPopup.appendChild(mi);
  }

  // Add it to the web developer menu.
  let menuWebDevPopup = window.document.getElementById('appmenu_webDeveloper_popup');
  if (menuWebDevPopup) {
    let mi = window.document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'menuitem');
    mi.setAttribute('label', strings.GetStringFromName('samltrace.open.label'));
    mi.setAttribute('id', 'samltrace-appmenu-open');
    mi.addEventListener('command', showTracerWindow);
    let errConsole = window.document.getElementById("appmenu_errorConsole");
    if (errConsole && errConsole.parentNode == menuWebDevPopup) {
      /* Insert it before the error console, if it is in the menu. */
      menuWebDevPopup.insertBefore(mi, errConsole);
    } else {
      /* No error console -- just append it to the end. */
      menuWebDevPopup.appendChild(mi);
    }
  }
}

function unloadFromWindow(window) {
  if (!window)
    return;

  // Clean up menu entries.
  let toolsOpen = window.document.getElementById('samltrace-menu-open');
  if (toolsOpen) {
    toolsOpen.parentNode.removeChild(toolsOpen);
  }
  let appMenuOpen = window.document.getElementById('samltrace-appmenu-open');
  if (appMenuOpen) {
    appMenuOpen.parentNode.removeChild(appMenuOpen);
  }
}

var windowListener = {
  onOpenWindow: function(aWindow) {
    // Wait for the window to finish loading
    let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
    domWindow.addEventListener("load", function onLoad() {
      domWindow.removeEventListener("load", onLoad, false);
      loadIntoWindow(domWindow);
    }, false);
  },

  onCloseWindow: function(aWindow) {},
  onWindowTitleChange: function(aWindow, aTitle) {}
};

function startup(aData, aReason) {
  // Load into any existing windows
  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    loadIntoWindow(domWindow);
  }

  // Load into any new windows
  Services.wm.addListener(windowListener);
}

function shutdown(aData, aReason) {
  // When the application is shutting down we normally don't have to clean
  // up any UI changes made
  if (aReason == APP_SHUTDOWN) {
    return;
  }

  // Close the SAML tracer window if it is open.
  if (tracerWindow != null) {
    tracerWindow.close();
    tracerWindow = null;
  }

  // Stop listening for new windows
  Services.wm.removeListener(windowListener);

  // Unload from any existing windows
  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    unloadFromWindow(domWindow);
  }
}

function install(aData, aReason) {}
function uninstall(aData, aReason) {}
