window.addEventListener("load", function(e) {
  // initially setup the ui
  ui.resizeElements();
  ui.resizeDialogs();
  ui.bindButtons();
  ui.bindKeys();
  ui.bindScrollRequestList();
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

  toggleButtonState: function(button) {
    let isActive = button.classList.contains("active");
    let newState = !isActive;
    ui.setButtonState(button, newState)
    return newState;
  },

  setButtonState: function(button, newState) {
    newState ? button.classList.add("active") : button.classList.remove("active");
  },

  bindButtons: function() {
    document.getElementById("button-clear").addEventListener("click", () => {
      window.tracer.clearRequests();
    }, true);
    document.getElementById("button-pause").addEventListener("click", e => {
      let newState = ui.toggleButtonState(e.target);
      window.tracer.setPauseTracing(newState);
    }, true);
    document.getElementById("button-autoscroll").addEventListener("click", e => {
      let newState = ui.toggleButtonState(e.target);
      window.tracer.setAutoscroll(newState);
      if (newState === true) {
        let requestList = document.getElementById("request-list");
        requestList.scrollTop = requestList.scrollTopMax;
      }
    }, true);
    document.getElementById("button-filter").addEventListener("click", e => {
      let newState = ui.toggleButtonState(e.target);
      window.tracer.setFilterResources(newState);
      let hidableRows = document.getElementsByClassName("list-row isRessource");
      if (newState) {
        Array.from(hidableRows).forEach(row => row.classList.remove("displayAnyway"));
      } else {
        Array.from(hidableRows).forEach(row => row.classList.add("displayAnyway"));
      }
    }, true);
    document.getElementById("button-export-list").addEventListener("click", () => {
      let exportDialog = document.getElementById("exportDialog");
      exportDialog.style.visibility = "visible";
      let isFlteringActive = document.getElementById("button-filter").classList.contains("active");
      let exportDialogContent = document.getElementById("exportDialogContent");
      exportDialogContent.contentWindow.ui.setupContent(window.tracer.requests, window.tracer.httpRequests, isFlteringActive);
    }, true);
    document.getElementById("button-import-list").addEventListener("click", () => {
      let importDialog = document.getElementById("importDialog");
      importDialog.style.visibility = "visible";
      let importDialogContent = document.getElementById("importDialogContent");
      importDialogContent.contentWindow.ui.setupContent();
    }, true);

    let modalCloseButtons = document.querySelectorAll(".modal-close");
    modalCloseButtons.forEach(button => button.addEventListener("click", ui.hideDialogs, true));
  },
  
  bindKeys: function() {
    const closeDialogs = e => {
      // close dialogs when ESC is pressed
      if (e.key === "Escape") {
        ui.hideDialogs();
      }
    };
    
    const selectRequestInfoContent = e => {
      // override CTRL+A to just select the request info content
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        let element = document.getElementById("request-info-content");
        let range = document.createRange();
        range.selectNode(element);
        window.getSelection().addRange(range);
        e.preventDefault();
      }
    };

    const selectRowOnKeybeardEvent = e => {
      // select another request, when ArrowUp, ArrowDown, PageUp, PageDown, Home or End are pressed
      let requestList = document.getElementById("request-list");
      ScrollableList.selectRowOnKeybeardEvent(e, requestList, newElement => {
        window.tracer.selectItemInList(newElement, requestList);
        window.tracer.showRequest(newElement.requestItem);
        ui.highlightContent();
      });
    };
    
    const togglePauseTracing = e => {
      // pauses or resumes request tracing when the pause key is pressed
      if (e.key === "Pause") {
        let button = document.getElementById("button-pause");
        let newState = ui.toggleButtonState(button);
        window.tracer.setPauseTracing(newState);
      }
    };

    let iframes = document.querySelectorAll("iframe");
    iframes.forEach(iframe => iframe.contentWindow.document.addEventListener("keydown", closeDialogs));
    document.addEventListener("keydown", closeDialogs);
    document.addEventListener("keydown", selectRequestInfoContent);
    document.addEventListener("keydown", selectRowOnKeybeardEvent);
    document.addEventListener("keydown", togglePauseTracing);
  },

  bindScrollRequestList: function() {
    let requestList = document.getElementById("request-list");
    let autoScrollButton = document.getElementById("button-autoscroll");

    requestList.addEventListener("scroll", e => {
      let wasScrolledUp = requestList.scrollTop < requestList.scrollTopMax;
      let activateAutoscroll = !wasScrolledUp;

      ui.setButtonState(autoScrollButton, activateAutoscroll);
      window.tracer.setAutoscroll(activateAutoscroll);
    });
  },

  initContentSplitter: function() {
    let controlTop = document.getElementById("request-list");
    let controlBottom = document.getElementById("request-info-content");
    let dragger = document.getElementById("dragger");
    Splitter.setup(controlTop, controlBottom, dragger);
  },

  hideDialogs: () => {
    document.querySelectorAll(".modal").forEach(dialog => dialog.style.visibility = "hidden");
  },
  
  resizeDialogs: function() {
    let iframes = document.querySelectorAll("iframe");
    iframes.forEach(iframe => {
      iframe.width  = iframe.contentWindow.document.body.scrollWidth;
      iframe.height = iframe.contentWindow.document.body.scrollHeight;
    });
  },
  
  highlightContent: () => {
    const getSyntaxHighlightingClass = tab => {
      let tabName = tab ? tab.href.split('#')[1] : "n/a";
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

    let content = document.querySelector("#request-info-content");
    removeSyntaxHighlightingClasses(content);

    let selectedTab = document.querySelector(".tab.selected");
    let syntaxHighlightingClass = getSyntaxHighlightingClass(selectedTab);
    content.classList.add(syntaxHighlightingClass);
    hljs.highlightBlock(content);
  },
  
  enableSyntaxHighlighting: function() {
    let tabBox = document.querySelector("#request-info-tabbox");
    tabBox.addEventListener("click", ui.highlightContent);

    let requestList = document.querySelector("#request-list");
    requestList.addEventListener("click", ui.highlightContent);
  }
}