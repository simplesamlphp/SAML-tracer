window.top.addEventListener("load", e => {
  ui.bindButtons();
}, true);

ui = {
  requests: null,
  exportResult: null,

  bindButtons: () => {
    // bind radio huttons
    let radioButtons = document.querySelectorAll('input[type="radio"]');
    Array.from(radioButtons).map(rb => rb.onchange = e => {
      ui.setupContent();
    });

    // bind export button
    document.getElementById("button-export").addEventListener("click", e => {
      let io = new SAMLTraceIO();
      let encodedExportResult = encodeURIComponent(io.serialize(ui.exportResult));
      e.target.href = "data:application/json;charset=utf-8," + encodedExportResult;
      e.target.download = io.getOutputFile(ui.exportResult);
    }, true);
  },

  setupContent: requests => {
    // remember the currently captured requests
    if (requests) {
      ui.requests = requests.slice();
    }

    let displayExportableRequestCount = () => {
      let requestCount = document.getElementById("request-count");
      requestCount.innerText = ui.requests.length;
    };

    let maybeDisableExportButton = () => {
      let button = document.getElementById("button-export");
      if (ui.requests.length === 0) {
        button.classList.add("inactive");
      } else {
        button.classList.remove("inactive");
      }
    };

    let createExportResult = () => {
      let io = new SAMLTraceIO();
      let cookieProfile = document.querySelector('input[type="radio"]:checked').value;
      ui.exportResult = io.exportRequests(ui.requests, cookieProfile);
    };

    displayExportableRequestCount();
    maybeDisableExportButton();
    createExportResult();
  }
};
