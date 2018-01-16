window.top.addEventListener("load", e => {
  ui.initialHeight = window.innerHeight;
  ui.initialWidth = window.innerWidth;
  ui.bindButtons();
}, true);

ui = {
  initialHeight: null,
  initialWidth: null,

  bindButtons: () => {
    // bind import button
    document.getElementById("button-import").addEventListener("click", e => {
      const onError = message => {
        // display error message
        ui.showErrorBox(message);
        ui.maybeResizeOwnDialog();
        // deactivate import button
        ui.setImportButtonActive(false);
      };

      let io = new SAMLTraceIO();
      let fileInput = document.getElementById("fileInput");
      io.importRequests(fileInput.files[0], window.parent.tracer, window.parent.ui.hideDialogs, onError);
    }, true);

    // bind file input control
    document.getElementById("fileInput").onchange = e => {
      ui.hideErrorBox();
      ui.maybeResizeOwnDialog();
      ui.setImportButtonActive(true);
    };
  },

  setupContent: () => {
    document.getElementById("fileInput").value = "";
    ui.hideErrorBox();
    ui.maybeResizeOwnDialog();
    ui.setImportButtonActive(false);
  },

  maybeResizeOwnDialog: () => {
    // changes to the file input control or error messages can lead to the necessity of resizing the dialog
    let ownDialog = window.parent.document.getElementById("importDialogContent");
    let fileInput = document.getElementById("fileInput");
    ownDialog.height = (document.body.clientHeight > ui.initialHeight) ? document.body.clientHeight : ui.initialHeight;
    ownDialog.width = (fileInput.clientWidth > ui.initialWidth) ? fileInput.clientWidth : ui.initialWidth;
  },

  setImportButtonActive: active => {
    let button = document.getElementById("button-import");
    if (active) {
      button.classList.remove("inactive");
    } else {
      button.classList.add("inactive");
    }
  },

  showErrorBox: message => {
    let errorBox = document.querySelector(".errorBox");
    errorBox.style.display = "block";
    errorBox.innerText = message;
  },

  hideErrorBox: () => {
    let errorBox = document.querySelector(".errorBox");
    errorBox.style.display = "none";
  }
};
