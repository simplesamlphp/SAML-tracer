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

        Splitter.controlTop.style.height = controlTopNewHeight + "px";
        Splitter.controlBottom.style.height = controlBottomNewHeight + "px";
        Splitter.lastPosition = e.clientY;
    },    
    stop: function() {
        document.onmousemove = null;
        document.onmouseup = null;
    }
};