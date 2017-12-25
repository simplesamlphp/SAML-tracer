window.top.addEventListener("load", e => {
  ui.bindButtons();
}, true);

ui = {
  bindButtons: () => {
    document.getElementById("button-export").addEventListener("click", e => {
    }, true);
  },
  maybeDisableExportButton: () => {
    let button = document.getElementById("button-export");
    if (window.parent.tracer.requests.length === 0) {
      button.classList.add("inactive");
    } else {
      button.classList.remove("inactive");
      console.log("reactivated button");
    }
  }
};