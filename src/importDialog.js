window.top.addEventListener("load", e => {
  ui.initialHeight = window.innerHeight;
  ui.initialWidth = window.innerWidth;
  ui.bindButtons();
  ui.maybeResizeOwnDialog();
}, true);

ui = {
  initialHeight: null,
  initialWidth: null,

  bindButtons: () => {
    // bind import button
    document.getElementById("button-import").addEventListener("click", e => {
      let errorBox = document.querySelector(".errorBox");
      const logMessage = message => {
        errorBox.style.display = "block";
        errorBox.innerText = message;
        ui.maybeResizeOwnDialog();
      };

      let io = new SAMLTraceIO();
      let fileInput = document.getElementById("fileInput");
      io.importRequests(fileInput.files[0], window.parent.tracer, logMessage);
    }, true);

    // bind file input control
    document.getElementById("fileInput").onchange = e => {
      let errorBox = document.querySelector(".errorBox");
      errorBox.style.display = "none";
      ui.maybeResizeOwnDialog();
    }
  },

  maybeResizeOwnDialog: () => {
    // changes to the file input control or error messages can lead to the necessity of resizing the dialog
    let ownDialog = window.parent.document.getElementById("importDialogContent");
    let fileInput = document.getElementById("fileInput");
    ownDialog.height = (document.body.clientHeight > ui.initialHeight) ? document.body.clientHeight : ui.initialHeight;
    ownDialog.width = (fileInput.clientWidth > ui.initialWidth) ? fileInput.clientWidth : ui.initialWidth;
  }
};
