# ErrorTracker
Error tracker stores the chain of events occurring in the application such as user interface events, sending a request to the server, launch timer, etc. It also provides information about the environment. Such as browser and operating system version, connected libraries and scripts, the network status (if this is supported by api used browser). With Error Tracker you can break the chain of events for a few blocks, added custom events, write to the console or clear chain of errors. Also Error Tracker suport pointer and gesture events.

###How it work
Init `Error Tracker` with service api url and tracker will start work when your application throw error `Error Tracker` will send event chain with error description and environment info to your service.
```
{
    "file": "http://localhost:63342/error-tracker/example/index.js",
    "line": 40,
    "column": 25,
    "sender": "window",
    "timestamp": "2015-05-27T10:22:00.315Z",
    "sessionID": "671d6f3e-dd02-a176-e181-57d95348911b",
    "eventsStack": {
        "main": [
            {
                "target": {
                    "tag": "button",
                    "attributes": {
                        "id": "launchButton",
                        "class": "topcoat-button"
                    },
                    "value": "",
                    "text": "Generate Error"
                },
                "type": "tap",
                "eventSender": "custom EventListener",
                "time": "2015-05-27T10:22:00.297Z"
            },
            {
                "method": "GET",
                "url": "index.html",
                "sendTime": "2015-05-27T10:22:00.311Z",
                "statusCode": 200,
                "statusText": "OK",
                "eventSender": "xhr",
                "time": "2015-05-27T10:22:00.314Z"
            }
        ]
    },
    "memoryInfo": {
        "jsHeapSizeLimit": 793000000,
        "usedJSHeapSize": 27600000,
        "totalJSHeapSize": 42100000
    },
    "enviroment": {
        "jQuery": "2.1.3",
        "errorTracker": "1.0.0",
        "pointer": "1.0.0",
        "gesture": "1.0.0",
        "userAgent": "Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.152 Safari/537.36",
        "viewportHeight": 1785,
        "viewportWidth": 326
    },
    "_stack": "ReferenceError: foo is not defined\n    at Object.$.ajax.success (http://localhost:63342/error-tracker/example/index.js:40:25)\n    at n.Callbacks.j (https://code.jquery.com/jquery-2.1.3.min.js:2:26911)\n    at Object.n.Callbacks.k.fireWith [as resolveWith] (https://code.jquery.com/jquery-2.1.3.min.js:2:27724)\n    at x (https://code.jquery.com/jquery-2.1.3.min.js:4:11084)\n    at XMLHttpRequest.n.ajaxTransport.k.cors.a.crossDomain.send.b (https://code.jquery.com/jquery-2.1.3.min.js:4:14577)"
}
```
### initialization
```Javascript
var errorTracker = new ErrorTracker({
    url:"http://your_web_service",
    allowConsoleLogEvent: false,
    allowTimerLogEvent: false,
    onError: function(serializedError){
        console.log(serializedError);
    }
});
```
**url** - Put here url address of web service which will be used for sending error logs. If you don't set this field logs will not sended.

**allowConsoleLogEvent** - if set true include in to chain events about calle console functions such as `log`, `info`, `dir` etc. As default sets true.

**allowTimerLogEvent** - if set true include in to chain events about calle setTimeout setInterval functions. As default sets true.

**onError** - callback function which calls when error will throw. As default sets empty function. You can set or override this function anytime just set new function to field onError.
```Javascript
errorTracker.onError = function(serializedError){
    console.log(serializedError);
}
```

###Methods
####addCustomEvent
```Javascript
errorTracker.addCustomEvent({message: "My Event"});
```
Add custom event to chain
```
        {
            "message": "My Event",
            "type": "custom event",
            "eventId": 1,
            "eventSender": "user",
            "time": "2015-05-27T09:42:44.778Z"
        }
```
####createNewEventBlock
Create new event block in chain. Error Tracker as default create block main and will putting their all events. If you call method without name argument tracker generate name for new block.
```Javascript
errorTracker.createNewEventBlock('Login Screen');
errorTracker.addCustomEvent({message: "login via facebook"});
errorTracker.createNewEventBlock('Main Screen');
errorTracker.addCustomEvent({message: "load 20 items"});
```
```
{
    "main": [
        {
            "message": "start",
            "type": "custom event",
            "eventId": 1,
            "eventSender": "user",
            "time": "2015-05-27T09:51:26.161Z"
        }
    ],
    "Login Screen": [
        {
            "message": "login via facebook",
            "type": "custom event",
            "eventId": 2,
            "eventSender": "user",
            "time": "2015-05-27T09:51:26.161Z"
        }
    ],
    "Main Screen": [
        {
            "message": "load 20 items",
            "type": "custom event",
            "eventId": 3,
            "eventSender": "user",
            "time": "2015-05-27T09:51:26.161Z"
        }
    ]
}
```
####errorTracker
```Javascript
errorTracker.clearLog();
```
Clear events chain
####printLog
```Javascript
errorTracker.printLog();
```
Write to console events chain
