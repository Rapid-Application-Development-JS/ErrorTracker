var errorTracker = new ErrorTracker({
    url:"http://127.0.0.1",
    allowConsoleLogEvent: true,
    allowTimerLogEvent: false,
    onError: function(serializedError){
        console.log(serializedError);
    }
});
errorTracker.onError = function(serializedError){
    console.log(serializedError);
};


var blockText = document.getElementById("blockText"),
    main = document.getElementById("main"),
    eventMessage = document.getElementById("eventMessage");
var pointer = new PointerTracker(main),
    gesture = new GestureTracker(main);
//   gesture._pointerDown(null);
main.addEventListener(gesture.GESTURE_EVENTS.tap,
    function (event){
        switch (event.target.id){
            case 'customEventButton':
                errorTracker.addCustomEvent({message: eventMessage.value});
                eventMessage.value ="";
                break;
            case 'addBlockButton':
                errorTracker.createNewEventBlock(blockText.value);
                blockText.value = "";
                break;
            case 'clearLogButton':
                errorTracker.clearLog();
                break;
            case 'printButton':
                console.log("YES");
                errorTracker.printLog();
                break;
            case 'launchButton':
            setTimeout(function(){
                $.ajax({url: "index.html", success: function(){
                    foo(); //call nonexistent function to raise exception
                }});
            });
             break;
        }
    }
);
//main.addEventListener("click" , function(event){
//    if(event.target.id === "launchButton") {
//        foo();
//    }
//});
