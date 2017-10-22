window.addEventListener("load", function(e) {
  // initially setup the ui
  ui.resizeElements();
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
          document.getElementById("statuspanel").clientHeight;

      let elementTop = document.getElementById("request-list");
      let elementBottom = document.getElementById("txt");
      let controlHeightSum = elementTop.clientHeight + elementBottom.clientHeight;
      
      let remainingHeight = window.innerHeight - reservedHeight;
      let ratioTop = (elementTop.clientHeight / controlHeightSum) * remainingHeight;
      let ratioBottom = (elementBottom.clientHeight / controlHeightSum) * remainingHeight;
      
      elementTop.style.height = ratioTop + "px";
      elementBottom.style.height = ratioBottom + "px";
  },
  bindButtons: function() {
      document.getElementById("button-clear").addEventListener("click", function() {
          window.tracer.clearRequests();
      }, true);
  },
  initContentSplitter: function() {
      let controlTop = document.getElementById("request-list");
      let controlBottom = document.getElementById("txt");
      let dragger = document.getElementById("dragger");
      Splitter.setup(controlTop, controlBottom, dragger);
  }
}