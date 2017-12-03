window.addEventListener("load", function(e) {
  // initially setup the ui
  ui.resizeElements();
  ui.bindButtons();
  ui.initContentSplitter();
  ui.enableSyntaxHighlighting();

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

    const getPaddingHeight = element => {
      let style = window.getComputedStyle(element);
      return parseInt(style.paddingTop) + parseInt(style.paddingBottom);
    };
    
    elementTop.style.height = (ratioTop - getPaddingHeight(elementTop)) + "px";
    elementBottom.style.height = (ratioBottom - getPaddingHeight(elementBottom)) + "px";
    var foo = 1;
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
  },
  initContentSplitter: function() {
    let controlTop = document.getElementById("request-list");
    let controlBottom = document.getElementById("request-info-content");
    let dragger = document.getElementById("dragger");
    Splitter.setup(controlTop, controlBottom, dragger);
  },
  enableSyntaxHighlighting: function() {
    const getSyntaxHighlightingClass = tab => {
      let tabName = tab.href.split('#')[1];
      if (tabName === "HTTP" || tabName === "Parameters") {
        return "HTTP";
      } else {
        return "XML";
      }
    };

    const removeSyntaxHighlightingClasses = block => {
      const syntaxHighlightingClasses = [ "HTTP", "XML" ];
      syntaxHighlightingClasses.forEach(c => block.classList.remove(c));
    };

    const highlightContent = () => {
      let content = document.querySelector("#request-info-content");
      removeSyntaxHighlightingClasses(content);

      let selectedTab = document.querySelector(".tab.selected");
      let syntaxHighlightingClass = getSyntaxHighlightingClass(selectedTab);
      content.classList.add(syntaxHighlightingClass);
      hljs.highlightBlock(content);
    }
    
    let tabBox = document.querySelector("#request-info-tabbox");
    tabBox.addEventListener("click", highlightContent, false);
        
    let requestList = document.querySelector("#request-list");
    requestList.addEventListener("click", highlightContent, false);
  }
}