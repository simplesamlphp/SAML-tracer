window.addEventListener("load", function(e) {
  // initially setup the ui
  ui.resizeElements();
  ui.resizeDialogs();
  ui.bindButtons();
  ui.initContentSplitter();

  // attach resize event
  this.addEventListener("resize", function() {
      ui.resizeElements();
  }, true);

  // initialize trace listener
  SAMLTrace.TraceWindow.init();
}, true);

ui = {
  resizeElements: function() {
    let reservedHeight = 
        document.getElementById("header").clientHeight +
        document.getElementById("dragger").clientHeight +
        document.getElementById("request-info-tabbox").clientHeight +
        document.getElementById("statuspanel").clientHeight;

    let elementTop = document.getElementById("request-list");
    let elementBottom = document.getElementById("request-info-content");
    let controlHeightSum = elementTop.clientHeight + elementBottom.clientHeight;
    
    let remainingHeight = window.innerHeight - reservedHeight;
    let ratioTop = (elementTop.clientHeight / controlHeightSum) * remainingHeight;
    let ratioBottom = (elementBottom.clientHeight / controlHeightSum) * remainingHeight;
    
    elementTop.style.height = ratioTop + "px";
    elementBottom.style.height = ratioBottom + "px";
  },
  bindButtons: function() {
    const toggleButtonState = button => {
      let isActive = button.classList.contains("active");
      isActive ? button.classList.remove("active") : button.classList.add("active");
      return !isActive;
    };

    document.getElementById("button-clear").addEventListener("click", function() {
      window.tracer.clearRequests();
    }, true);
    document.getElementById("button-autoscroll").addEventListener("click", function(e) {
      let newState = toggleButtonState(e.target);
      window.tracer.setAutoscroll(newState);
    }, true);
    document.getElementById("button-filter").addEventListener("click", function(e) {
      let newState = toggleButtonState(e.target);
      window.tracer.setFilterResources(newState);
      let hidableRows = document.getElementsByClassName("list-row isRessource");
      if (newState) {
        Array.from(hidableRows).forEach(row => row.classList.remove("displayAnyway"));
      } else {
        Array.from(hidableRows).forEach(row => row.classList.add("displayAnyway"));
      }
    }, true);
    document.getElementById("button-export-list").addEventListener("click", function() {
      let exportDialog = document.getElementById("exportDialog");
      exportDialog.style.visibility = "visible";
      let isFlteringActive = document.getElementById("button-filter").classList.contains("active");
      let exportDialogContent = document.getElementById("exportDialogContent");
      exportDialogContent.contentWindow.ui.setupContent(window.tracer.requests, window.tracer.httpRequests, isFlteringActive);
    }, true);
    document.getElementById("button-import-list").addEventListener("click", function() {
      let importDialog = document.getElementById("importDialog");
      importDialog.style.visibility = "visible";
    }, true);

    let modalCloseButtons = document.querySelectorAll(".modal-close");
    modalCloseButtons.forEach(button => {
      button.addEventListener("click", function() {
        document.querySelectorAll(".modal").forEach(dialog => dialog.style.visibility = "hidden");
    }, true)});
  },
  initContentSplitter: function() {
    let controlTop = document.getElementById("request-list");
    let controlBottom = document.getElementById("request-info-content");
    let dragger = document.getElementById("dragger");
    Splitter.setup(controlTop, controlBottom, dragger);
  },
  resizeDialogs: function() {
    let iframes = document.querySelectorAll("iframe");
    iframes.forEach(iframe => {
      iframe.width  = iframe.contentWindow.document.body.scrollWidth;
      iframe.height = iframe.contentWindow.document.body.scrollHeight;
    });
  }
}