window.top.addEventListener("load", e => {
  ui.bindButtons();
}, true);

ui = {
  requests: null,
  exportResult: null,

  bindButtons: () => {
    // bind radio huttons
    let radioButtons = document.querySelectorAll('input[type="radio"]');
    Array.from(radioButtons).map(rb => rb.onchange = e => ui.createExportResult());

    // bind export button
    document.getElementById("button-export").addEventListener("click", e => {
      let io = new SAMLTraceIO();
      let encodedExportResult = encodeURIComponent(io.serialize(ui.exportResult));
      e.target.href = "data:application/json;charset=utf-8," + encodedExportResult;
      e.target.download = io.getOutputFile(ui.exportResult);

      // hide dialog after export
      window.parent.ui.hideDialogs();
    }, true);
  },

  setupContent: (requests, httpRequests, isFlteringActive) => {
    // remember the currently captured (and filtered) requests
    if (requests) {
      let filteredRequests = requests.filter(req => {
        let match = httpRequests.find(hr => hr.req.requestId === req.requestId);
        if (match && (match.isVisible || !isFlteringActive)) {
          return req;
        }
      });
      ui.requests = filteredRequests;
    }

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
