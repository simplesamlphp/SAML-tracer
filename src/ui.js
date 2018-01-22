window.addEventListener("load", function(e) {
  // initially setup the ui
  ui.resizeElements();
  ui.resizeDialogs();
  ui.bindButtons();
  ui.bindKey();
  ui.initContentSplitter();
  ui.enableSyntaxHighlighting();

  // attach resize event
  this.addEventListener("resize", ui.resizeElements);

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
      let importDialogContent = document.getElementById("importDialogContent");
      importDialogContent.contentWindow.ui.setupContent();
    }, true);

    let modalCloseButtons = document.querySelectorAll(".modal-close");
    modalCloseButtons.forEach(button => button.addEventListener("click", ui.hideDialogs, true));
  },

  bindKey: function() {
    const closeDialogs = e => {
      if (e.keyCode === 27) {
        ui.hideDialogs();
      }
    };

    // close dialogs when ESC is pressed
    document.addEventListener("keydown", closeDialogs, true);
    let iframes = document.querySelectorAll("iframe");
    iframes.forEach(iframe => iframe.contentWindow.document.addEventListener("keydown", closeDialogs));
  },

  hideDialogs: () => {
    document.querySelectorAll(".modal").forEach(dialog => dialog.style.visibility = "hidden");
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
    tabBox.addEventListener("click", highlightContent);

    let requestList = document.querySelector("#request-list");
    requestList.addEventListener("click", highlightContent);
  }
}