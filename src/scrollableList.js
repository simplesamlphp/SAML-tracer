/**
 * Handles keyboard events to select an appropriate request row
 **/

if ("undefined" === typeof(ScrollableList)) {
  var ScrollableList = new function() {

    const isElementToBeSkipped = elem => {
      const visibleInDom = elem.checkVisibility();
      return !visibleInDom;
    };

    const getSibling = (cur, siblingFunc) => {
      while (cur !== null && isElementToBeSkipped(cur)) {
        cur = siblingFunc(cur);
      }
      return cur;
    };

    const getVisibleSiblingOnOtherPage = (cur, siblingFunc, e) => {
      const getNthVisibleSibling = (cur, n) => {
        let index = 0;
        let lastRelevant = cur;
        let sibling = null;
        do {
          sibling = siblingFunc(cur);
          if (sibling) {
            if (!isElementToBeSkipped(sibling)) {
              index++;
              lastRelevant = sibling;
            }
            cur = sibling;
          }
        } while (sibling && index < n);

        return lastRelevant;
      };

      let fullRowsPerScreen = Math.floor(this.list.clientHeight / cur.offsetHeight);
      let fullRowsExceptOwnRow = fullRowsPerScreen - 1;
      let firstVisibleSibling = getNthVisibleSibling(cur, fullRowsExceptOwnRow);
      bringItemIntoVisibleArea(firstVisibleSibling, e);
      return firstVisibleSibling;
    };

    const bringItemIntoVisibleArea = (newElem, e) => {
      if (!newElem) {
        return;
      }

      const isTopVisible = elem => {
        return elem.offsetTop >= this.list.offsetTop + this.list.scrollTop;
      };

      const isBottomVisible = elem => {
        return this.list.offsetTop + this.list.clientHeight + this.list.scrollTop >= elem.offsetTop + elem.offsetHeight;
      };

      // prevent the default scroll event
      e.preventDefault();

      // and take care of the new items' visibility on our own
      if (!isTopVisible(newElem)) {
        this.list.scrollTop = newElem.offsetTop - this.list.offsetTop - newElem.offsetHeight + this.list.scrollTop % newElem.offsetHeight;
      } else if (!isBottomVisible(newElem)) {
        this.list.scrollTop = newElem.offsetTop - this.list.clientHeight;
      }
    };

    this.selectRowOnKeyboardEvent = (e, list, onNewElementSelected) => {
      this.list = list;
      let newElement = null;
      let selectedElement = this.list.querySelector(".selected");
      if (!selectedElement) {
        selectedElement = this.list.firstChild;
      }

      if (e.key === "ArrowUp") {
        newElement = getSibling(selectedElement.previousSibling, elem => elem.previousSibling);
        bringItemIntoVisibleArea(newElement, e);
      } else if (e.key === "ArrowDown") {
        newElement = getSibling(selectedElement.nextSibling, elem => elem.nextSibling);
        bringItemIntoVisibleArea(newElement, e);
      } else if (e.key === "PageUp") {
        newElement = getVisibleSiblingOnOtherPage(selectedElement, elem => elem.previousSibling, e);
      } else if (e.key === "PageDown") {
        newElement = getVisibleSiblingOnOtherPage(selectedElement, elem => elem.nextSibling, e);
      } else if (e.key === "Home") {
        newElement = getSibling(this.list.firstChild, elem => elem.nextSibling);
      } else if (e.key === "End") {
        newElement = getSibling(this.list.lastChild, elem => elem.previousSibling);
      }

      if (newElement) {
        onNewElementSelected(newElement);
      }
    };
  };
};
