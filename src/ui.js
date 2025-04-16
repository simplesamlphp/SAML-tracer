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

  toggleListRowVisibility() {
    const hideResources = document.getElementById("button-hide-resources").classList.contains("active");
    const showProtocolRequestsOnly = document.getElementById("button-show-protocol-only").classList.contains("active");

    Array.from(document.getElementsByClassName("list-row")).forEach(row => {
      if (hideResources) {
        row.classList.remove("show-resource");
      } else {
        row.classList.add("show-resource");
      }
      
      if (showProtocolRequestsOnly && !row.classList.contains("is-protocol")) {
        row.classList.add("non-protocol");
      } else {
        row.classList.remove("non-protocol");
      }
    });
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
    document.getElementById("button-hide-resources").addEventListener("click", e => {
      const newState = ui.toggleButtonState(e.target);
      window.tracer.setHideResources(newState);
      ui.toggleListRowVisibility();
    }, true);
    document.getElementById("button-show-protocol-only").addEventListener("click", e => {
      const newState = ui.toggleButtonState(e.target);
      window.tracer.setShowProtocolOnly(newState);
      ui.toggleListRowVisibility();
    }, true);
    document.getElementById("button-colorize").addEventListener("click", e => {
      let newState = ui.toggleButtonState(e.target);
      window.tracer.setColorizeRequests(newState);
      let allRequests = document.getElementsByClassName("list-row");
      if (newState) {
        Array.from(allRequests).forEach(row => row.classList.remove("monochrome"));
      } else {
        Array.from(allRequests).forEach(row => row.classList.add("monochrome"));
      }
    }, true);
    document.getElementById("button-export-list").addEventListener("click", () => {
      let exportDialog = document.getElementById("exportDialog");
      exportDialog.style.visibility = "visible";
      let exportDialogContent = document.getElementById("exportDialogContent");
      exportDialogContent.contentWindow.ui.setupContent(window.tracer.httpRequests, window.tracer.hideResources, window.tracer.showProtocolRequestsOnly);
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

    const selectRowOnKeyboardEvent = e => {
      // select another request, when ArrowUp, ArrowDown, PageUp, PageDown, Home or End are pressed
      let requestList = document.getElementById("request-list");
      ScrollableList.selectRowOnKeyboardEvent(e, requestList, newElement => {
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
    document.addEventListener("keydown", selectRowOnKeyboardEvent);
    document.addEventListener("keydown", togglePauseTracing);
  },

  bindScrollRequestList: function() {
    let requestList = document.getElementById("request-list");
    let autoScrollButton = document.getElementById("button-autoscroll");

    requestList.addEventListener("scroll", e => {
      let wasScrolledUp = requestList.scrollTop < requestList.scrollHeight - requestList.clientHeight;
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
      const tabName = tab ? tab.href.split('#')[1] : 'n/a';
      return {
        'HTTP': 'HTTP',
        'Parameters': 'Properties',
        'SAML': 'XML'
      }[tabName];
    };

    const removeSyntaxHighlightingClasses = block => {
      const syntaxHighlightingClasses = [ "highlightable", "HTTP", "XML" ];
      syntaxHighlightingClasses.forEach(c => block.classList.remove(c));
    };

    let highlightables = document.querySelectorAll("#request-info-content .highlightable");
    if (highlightables && highlightables.length > 0) {
      let selectedTab = document.querySelector(".tab.selected");
      let syntaxHighlightingClass = getSyntaxHighlightingClass(selectedTab);
      
      highlightables.forEach(highlightable => {
        removeSyntaxHighlightingClasses(highlightable);
        highlightable.classList.add(syntaxHighlightingClass);
        hljs.highlightElement(highlightable);
      });
    }
  },
  
  enableSyntaxHighlighting: function() {
    let tabBox = document.querySelector("#request-info-tabbox");
    tabBox.addEventListener("click", ui.highlightContent);

    let requestList = document.querySelector("#request-list");
    requestList.addEventListener("click", ui.highlightContent);
  }
}
