Splitter = {
    setup: function(controlTop, controlBottom, dragger) {
        Splitter.controlTop = controlTop;
        Splitter.controlBottom = controlBottom;
        dragger.onmousedown = Splitter.mousedown;
    },
    mousedown: function(e) {
        Splitter.lastPosition = e.clientY;
        document.onmousemove = Splitter.move;
        document.onmouseup = Splitter.stop;
    },
    move: function(e) {
        let vMovement = e.clientY - Splitter.lastPosition;
        let controlTopNewHeight = Splitter.controlTop.clientHeight + vMovement;
        let controlBottomNewHeight = Splitter.controlBottom.clientHeight - vMovement;

        let position = e.clientY;
        if (controlTopNewHeight < 0) {
            controlBottomNewHeight += controlTopNewHeight;
            controlTopNewHeight = 0;
            topManipulated = true;
        }
        if (controlBottomNewHeight < 0) {
            controlTopNewHeight += controlBottomNewHeight;
            controlBottomNewHeight = 0;
            bottomManipulated = true;
        }

        const getPaddingHeight = element => {
            let style = window.getComputedStyle(element);
            return parseInt(style.paddingTop) + parseInt(style.paddingBottom);
        };

        Splitter.controlTop.style.height = (controlTopNewHeight - getPaddingHeight(Splitter.controlTop)) + "px";
        Splitter.controlBottom.style.height = (controlBottomNewHeight - getPaddingHeight(Splitter.controlBottom)) + "px";
        Splitter.lastPosition = e.clientY;
    },
    stop: function() {
        document.onmousemove = null;
        document.onmouseup = null;
    }
};