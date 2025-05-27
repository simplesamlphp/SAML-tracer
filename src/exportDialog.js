window.top.addEventListener("load", e => {
  ui.bindButtons();
}, true);

ui = {
  requests: null,
  exportResult: null,

  bindButtons: () => {
    // bind radio buttons
    let radioButtons = document.querySelectorAll('input[type="radio"]');
    Array.from(radioButtons).map(rb => rb.onchange = e => ui.createExportResult());

    // bind export button
    document.getElementById("button-export").addEventListener("click", e => {
      const io = new SAMLTraceIO();const filename = io.getOutputFile(ui.exportResult);
      const jsonString = io.serialize(ui.exportResult);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Use the downloads API
      var browser = browser || chrome;
      const downloading = browser.downloads.download({url, filename});

      downloading.then(
        downloadId => console.log(`Download ${downloadId} has started.`),
        error => {
          console.log(`Revoking Object URL because download failed: ${error}`);
          URL.revokeObjectURL(url);
        }
      );

      // Clean up the object URL
      const downloadChanged = delta => {
        if (delta.state && delta.state.current === "complete") {
          console.log(`Download ${delta.id} (${filename}) has completed. Object URL will be revoked.`);
          URL.revokeObjectURL(url);
          browser.downloads.onChanged.removeListener(downloadChanged);
        }
      };
      browser.downloads.onChanged.addListener(downloadChanged);

      // hide dialog after export
      window.parent.ui.hideDialogs();
    }, true);
  },

  setupContent: (httpRequests, hideResources, showProtocolRequestsOnly) => {
    // remember the currently captured (and filtered) requests
    filteredRequests = httpRequests?.filter(req => req.isVisible && req.isVisible(hideResources, showProtocolRequestsOnly)).map(req => req.parsed);
    ui.requests = filteredRequests;

    const displayExportableRequestCount = () => {
      let requestCount = document.getElementById("request-count");
      requestCount.innerText = ui.requests.length;
    };

    const resetFilterOptions = () => {
      let defaultFilterOption = document.querySelector('input[type="radio"][value="2"]');
      defaultFilterOption.checked = true;
    };

    const maybeDisableExportButton = () => {
      let button = document.getElementById("button-export");
      if (ui.requests.length === 0) {
        button.classList.add("inactive");
      } else {
        button.classList.remove("inactive");
      }
    };

    displayExportableRequestCount();
    resetFilterOptions();
    maybeDisableExportButton();
    ui.createExportResult();
  },

  createExportResult: () => {
    let io = new SAMLTraceIO();
    let cookieProfile = document.querySelector('input[type="radio"]:checked').value;
    ui.exportResult = io.exportRequests(ui.requests, cookieProfile);
  }
};
