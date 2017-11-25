// This bootstrap.js file now acts as a background.js file in terms of a Web Extension. See here:
// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Anatomy_of_a_WebExtension#Specifying_background_scripts
// The onOpenWindow event handler was slightly modified to be compatible with standard Firefox.

browser.browserAction.onClicked.addListener((tab) => showTracerWindow());

var tracerWindow = null;

function showTracerWindow() {
  if (tracerWindow != null) {
    // Window already opened -- just give it focus.
    browser.windows.update(tracerWindow.id, { focused: true }, null);
    return;
  }

  // If it wasn't yet opened or it was already closed -- create a new instance.
  var url = browser.extension.getURL("/chrome/samltrace/content/TraceWindow.html");
  var creating = browser.windows.create({
    url: url,
    type: "panel",
    height: 600,
    width: 800
  });
  creating.then(onCreated, onError);
}

function onCreated(windowInfo) {
  console.log(`Created window: ${windowInfo.id}`);

  // memorize the extension window, so that we can give it focus, if it's already opened.
  tracerWindow = windowInfo;
  browser.windows.onRemoved.addListener(onCloseExtensionWindow);
}

function onError(error) {
  console.log(`Error: ${error}`);
}

function onCloseExtensionWindow(windowId) {
  console.log(`Window ${windowId} is closed. Setting "traceWindow" to null.`)
  tracerWindow = null
}
