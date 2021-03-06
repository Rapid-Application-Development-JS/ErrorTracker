var errorTracker = new ErrorTracker({
    url: "https://httpbin.org/post",
    allowConsoleLogEvent: true,
    allowTimerLogEvent: false,
    onError: function(serializedError){
        console.log(serializedError);
    }
});

var blockText = document.getElementById("blockText"),
    main = document.getElementById("main"),
    eventMessage = document.getElementById("eventMessage");
var pointer = new PointerTracker(main),
    gesture = new GestureTracker(main);
main.addEventListener(gesture.GESTURE_EVENTS.tap,
    function (event) {
        switch (event.target.id) {
            case 'customEventButton':
                errorTracker.addCustomEvent({message: eventMessage.value});
                eventMessage.value = "";
                break;
            case 'addBlockButton':
                errorTracker.createNewEventBlock(blockText.value);
                blockText.value = "";
                break;
            case 'clearLogButton':
                errorTracker.clearLog();
                break;
            case 'printButton':
                errorTracker.printLog();
                break;
            case 'launchButton':
                setTimeout(function () {
                    $.ajax({
                        url: 'index.html',
                        success: function () {
                            foo(); //call nonexistent function to raise exception
                        }
                    });
                });
                break;
        }
    }
);
