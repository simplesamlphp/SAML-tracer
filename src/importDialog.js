window.top.addEventListener("load", e => {
  ui.bindButtons();
}, true);

ui = {
  bindButtons: () => {
    // bind import button
    document.getElementById("button-import").addEventListener("click", e => {
      let selectedFile = document.getElementById("fileInput").files[0];
      let io = new SAMLTraceIO();
      io.importRequests(selectedFile, window.parent.tracer);
    }, true);
  }
};
