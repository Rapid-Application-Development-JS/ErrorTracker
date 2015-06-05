(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define(function () {
            return (root.ErrorTracker = factory());
        });
    } else if (typeof module === "object" && module.exports) {
        module.exports = (root.ErrorTracker = factory());
    } else {
        root.ErrorTracker = factory();
    }
}(this, function () {
    function ErrorTracker(options){
        var scope = this;
        var IGNORLOG = "_#_ignog_log_#_";
        var currentEventStack =[];
        var customEventStack =[];
        var _DOMEventListener;
        this.version = "1.0.0";

        var _options = mix({
            allowConsoleLogEvent: true,
            allowTimerLogEvent:true,
            url:undefined,
            onError: function(serializedError){}
        }, options);

        this.SENDERS = {
            window: "window",
            console: "console",
            xhr: "xhr",
            tracker: "tracker"
        };

        function mix(obj, mixin) {
            var attr;
            for (attr in mixin) {
                if (mixin.hasOwnProperty(attr)) {
                    obj[attr] = mixin[attr];
                }
            }
            return obj;
        }

        this.EVENTS = {
            maxEventStackLength: 50,
            console: "console",
            xhr: "xhr",
            timer: "timer",
            listener: "custom EventListener",
            DOM: "DOM",
            DOMEventTypes: {
                _any:["load", "drop", "paste", "play", "pageshow", "hashchange", 'pointerup', 'pointerdown', 'pointercancel', 'touchstart', 'touchend', 'touchcancel'],
                button:["click", "dblclick"],
                input:["blur"],
                textarea:["blur"],
                form:["submit", "reset"]
            },
            EventListenerEliminations: ["scroll", "wheel", "drag", "mousemove", "mouseover", "mouseout", "mouseleave", "mouseenter",
                "touchmove", "mousewheel", "input", "keydown", "keypress", "keyup", 'hold', 'fling','longtap','tap','doubletap' ]
        };

        this.eventStack = {
            main : currentEventStack
        };

        this.setOnErrorCallback = function(callback){
            _options.onError = callback;
        };

        this.isAllowConsoleLogEvent = function(){
            return _options.allowConsoleLogEvent;
        };

        this.setAllowConsoleLogEvent = function(isAllow){
            _options.allowConsoleLogEvent = isAllow;
        };

        this.isAllowTimerLogEvent = function(){
            return _options.allowTimerLogEvent;
        };

        this.setAllowTimerLogEvent = function(isAllow){
            _options.allowTimerLogEvent = isAllow;
        };
        /**
         *Array with custom events which tracker will be ignored
         * @returns {Array}
         */
        this.getIgnoredCustomEventsArray = function(){
            return scope.EVENTS.EventListenerEliminations;
        };
        /**
         * Set custom events array, this events will not add to event chain
         * @param ignoredCustomEventsArray - Array with custom events which tracker will be ignored
         */
        this.setIgnoredCustomEventsArray = function(ignoredCustomEventsArray){
            scope.EVENTS.EventListenerEliminations = ignoredCustomEventsArray;
        };

        /***
         * Return object with DOM events arrays, which will be added to event chain.
         * Read only
         */
        this.getDOMEvents = function(){
            var _DOMEvents={};
            var keys = Object.keys(scope.EVENTS.DOMEventTypes);
            for(var i = 0; i < keys.length; i++){
                _DOMEvents[keys[i]] = scope.EVENTS.DOMEventTypes[keys[i]].slice();
            }
            return _DOMEvents;
        };
        /**
         * Remove old events and set new events from DOMEvents object
         * @param DOMEvents object with events arrays
         */
        this.applyDOMEvents=function(DOMEvents){
            _RemoveDOMEventListener();
            scope.EVENTS.DOMEventTypes = {};
            var keys = Object.keys(DOMEvents);
            for(var i = 0; i < keys.length; i++){
                try {
                    scope.EVENTS.DOMEventTypes[keys[i]] = DOMEvents[keys[i]].slice();
                }catch (e)
                {
                    scope.fault(e);
                }
            }
            wrapDOMEvents();
        };

        _DOMEventListener = function (event) {
            var element, availableEvents;
            try {
                element = scope.elementForEvent(event);
                if(element) {
                    availableEvents = scope.EVENTS.DOMEventTypes[element.tagName.toLowerCase()];
                    if(availableEvents) {
                        availableEvents = availableEvents.concat(scope.EVENTS.DOMEventTypes._any);
                        if (availableEvents && scope.arrayContains(availableEvents, event.type)) {
                            scope.scheduleEvent(scope.EVENTS.DOM, {
                                target: scope.serializeElement(element),
                                type: event.type
                            });
                        }
                    }
                }
            } catch (e){
                scope.fault(e);
            }
        }.bind(scope);

        this.createNewEventBlock = function(blockName){
            blockName = blockName||"block "+(Object.keys(this.eventStack).length+1);
            currentEventStack = [];
            this.eventStack[blockName] =currentEventStack;
        };

        this.clearLog = function(){
            currentEventStack = [];
            customEventStack = [];
            scope.eventStack = {
                main : currentEventStack
            };
        };

        this.addCustomEvent = function(event){
            event = event||{};
            event.type = event.type||"custom event";
            event.eventId = event.eventId||customEventStack.length+1;
            customEventStack.push( this.scheduleEvent("user", event));
        };

        this.printLog = function(){
            if(_options.allowConsoleLogEvent) {
                console.info(JSON.stringify(scope.eventStack, null, 4), IGNORLOG);
            }else{
                console.info(JSON.stringify(scope.eventStack, null, 4));
            }
        };

        this.fault = function(error){
            try {
                this.addError(this.SENDERS.tracker, error);
            } catch (e){}
        };

        this.addError = function(sender, error){
            error.sender = sender;
            error.timestamp = this.isoNow();
            error.sessionID = this.sessionID;
            error.eventsStack = scope.eventStack;
            if(window.performance && window.performance.memory){
                error.memoryInfo = window.performance.memory;
            }
            error.enviroment = this.environmentInfo();

            setTimeout(function() {
                if(error.url!==_options.url){
                    var jsonError = scope.serializeError(error);
                    if(_options.onError) {
                        _options.onError(jsonError);
                    }
                    sendErrorPost(jsonError);
                }
            },500);
        };

        function sendErrorPost(jsonError){
            var XHR = ("onload" in new XMLHttpRequest()) ? XMLHttpRequest : XDomainRequest;
            var xhr = new XHR();
            xhr.open('POST', _options.url, true);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xhr.onload = function() {
                if(xhr.status === 200) {
                    console.info('Error log has sended to service', IGNORLOG);
                    scope.clearLog();
                }else{
                    console.error('Error: cant send log to service', IGNORLOG);
                }
            }
            xhr.send(jsonError);
        }
        this.scheduleEvent = function(eventSender, info){
            info.eventSender = eventSender;
            info.time = this.isoNow();
            currentEventStack.push(info);
            if(currentEventStack.length > this.EVENTS.maxEventStackLength){
                currentEventStack.shift();
            }
            return info;
        };

        this.wrapGlobalErrors = function(){
            window.onerror = function(errMsg, url, line, column, error){
                try {
                    error = error || {};
                    error.message = error.message || scope.serialize(errMsg);
                    error.file = error.file || scope.serialize(url);
                    error.line = error.line || (parseInt(line, 10) || null);
                    error.column = error.column || (parseInt(column, 10) || null);
                    scope.addError(scope.SENDERS.window, error);
                } catch (e) {
                    scope.fault(e);
                }
            };
        };

        this.wrapConsole = function(){
            var i, level, logLevels = ["log", "debug", "info", "warn", "error"];
            for(i = logLevels.length - 1; i >= 0; i--){
                level = logLevels[i];
                if(this.hasMethod(console, level)) {
                    (function(level){
                        var original = console[level];

                        console[level] = function (txt) {
                            if(_options.allowConsoleLogEvent) {
                                try {
                                    if ((arguments.length > 1) || (arguments[1] === IGNORLOG)) {
                                        arguments.length = 1;
                                        original.apply(this, arguments);
                                        return;
                                    }
                                    original.apply(this, arguments);
                                    if (level === "error") {
                                        scope.addError(scope.SENDERS.console, new Error(arguments[0]));
                                    } else {
                                        scope.scheduleEvent(scope.EVENTS.console, {
                                            level: level,
                                            args: scope.serialize(arguments)
                                        });
                                    }
                                } catch (e) {
                                    scope.fault(e);
                                }
                            }else{
                                original.apply(this, arguments);
                            }
                        }

                    })(level);
                }
            }
        };

        this.wrapNetwork = function(){
            var origSend = XMLHttpRequest.prototype.send,
                origError = XMLHttpRequest.prototype.error,
                origOpen = XMLHttpRequest.prototype.open;
            function finalize(xhr) {
                if (xhr.errorTrackingInfo) {
                    xhr.errorTrackingInfo.statusCode = xhr.status == 1223 ? 204 : xhr.status;
                    xhr.errorTrackingInfo.statusText = xhr.status == 1223 ? "No Content" : xhr.statusText;
                    scope.scheduleEvent(scope.EVENTS.xhr, xhr.errorTrackingInfo);
                }
            }

            function checkFault(xhr) {
                var errorText;
                if (xhr.status === 0) {
                    errorText = 'Not connect. Verify Network.';
                } else if (xhr.status == 404) {
                    errorText = 'Requested page not found. [404]';
                } else if (xhr.status == 500) {
                    errorText = 'Internal Server Error [500].';
                } else {
                    errorText = 'Uncaught Error.\n' + xhr.responseText;
                }

                scope.addError(scope.SENDERS.xhr, {
                    status: xhr.status,
                    statusText: xhr.statusText || errorText,
                    errorInfo: xhr.errorTrackingInfo
                });
            }

            function completionListener(xhr){
                if (window.ProgressEvent) {
                    if (xhr.addEventListener) {
                        xhr.addEventListener("readystatechange", function() {
                            if (xhr.readyState === 4) {
                                finalize(xhr);
                            }
                            //checkFault(xhr);
                        }, true);
                    }
                }
                if (xhr.addEventListener) {
                    xhr.addEventListener("load", function() {
                        finalize(xhr);
 //                       checkFault(xhr);
                    }, true);
                    xhr.addEventListener("error", function(event) {
                        finalize(xhr);
                        checkFault(xhr);
                    }, true);
                    xhr.addEventListener("abort", function(event) {
                        finalize(xhr);
                        checkFault(xhr);
                    }, true);
                } else {
                    setTimeout(function() {
                        try {
                            var origOnLoad = xhr.onload,
                                origOnAbort = xhr.onabort,
                                origOnError = xhr.onerror;


                            xhr.onload = function() {
                                finalize(xhr);
                                checkFault(xhr);
                                if (typeof origOnLoad === "function") {
                                    origOnLoad.apply(xhr, arguments);
                                }
                            };

                            xhr.onerror = function() {
                                finalize(xhr);
                                checkFault(xhr);
                                if ("function" === typeof origOnError) {
                                    origOnError.apply(xhr, arguments);
                                }
                            };
                            xhr.onabort  = function() {
                                finalize(xhr);
                                checkFault(xhr);
                                if ("function" === typeof origOnAbort) {
                                    origOnAbort.apply(xhr, arguments);
                                }
                            };
                        } catch (e) {
                            scope.fault(e);
                        }
                    }, 0);
                }
            }

            XMLHttpRequest.prototype.open = function(method, url) {
                if (url.indexOf("localhost:0") < 0) {
                    this.errorTrackingInfo = {
                        method : method,
                        url : url
                    };
                }
                return origOpen.apply(this, arguments);
            };

            XMLHttpRequest.prototype.send = function() {
                if(this.errorTrackingInfo) {
                    try {
                        this.errorTrackingInfo.sendTime = scope.isoNow();
                        completionListener(this);
                    } catch (e) {
                        scope.fault(e);
                    }
                }
                return origSend.apply(this, arguments);
            };
        };

        this.wrapTimers = function(){
            function wrap(func){
                var original = window[func];
                window[func] = function logTimerEvent(){
                    if(_options.allowTimerLogEvent) {
                        try {
                            scope.scheduleEvent(scope.EVENTS.timer, {
                                type: func,
                                params: scope.serialize(Array.prototype.slice.call(arguments, 1))
                            });
                        } catch (e) {
                            scope.fault(e);
                        }
                    }
                    original.apply(this, arguments);
                };

            }
            wrap("setTimeout");
            wrap("setInterval");
        };

        function wrapDOMEvents () {
            var i, eventName, keys = Object.keys(scope.EVENTS.DOMEventTypes), allEvents = [];

            for (i = 0; i < keys.length; i++) {
                allEvents = allEvents.concat(scope.EVENTS.DOMEventTypes[keys[i]]);
            }
            allEvents = scope.arrayUnique(allEvents);
            for (i = allEvents.length - 1; i >= 0; i--) {
                eventName = allEvents[i];
                document.addEventListener(eventName, _DOMEventListener, true);
            }
        };

        function _RemoveDOMEventListener(){
            var i, eventName, keys = Object.keys(scope.EVENTS.DOMEventTypes), allEvents = [];

            for(i = 0; i < keys.length; i++){
                allEvents = allEvents.concat(scope.EVENTS.DOMEventTypes[keys[i]]);
            }
            allEvents = scope.arrayUnique(allEvents);
            for(i = allEvents.length - 1; i >= 0; i--) {
                eventName = allEvents[i];
                document.removeEventListener(eventName, _DOMEventListener, true);
            }
        };

        this.removeListener = function(){
            _RemoveDOMEventListener();
        };



        this.wrapCustomEventListeners = function(){
            function wrap(object, funcName){
                var original = object[funcName];
                object[funcName] = function(){
                    var listener;
                    try {
                        if(arguments.length > 0 && !scope.arrayContains(scope.EVENTS.EventListenerEliminations, arguments[0])){
                            listener = arguments[1];
                            if (typeof listener === "function") {
                                arguments[1] = function (event) {
                                    listener.apply(this, arguments);
                                    scope.scheduleEvent(scope.EVENTS.listener, {
                                        target: scope.serializeElement(scope.elementForEvent(event)),
                                        type: event.type
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        scope.fault(e);
                    }
                    original.apply(this, arguments);
                };
            }

            wrap(Element.prototype, "addEventListener");
        };

        this.elementForEvent = function(event){
            return event.target || document.elementFromPoint(event.clientX, event.clientY);
        };

        this.serializeError = function(error){
            var stack = error.stack || error.stacktrace;
            if(stack){
                error._stack = stack;
            }
            return JSON.stringify(error, null, 4);
        };

        this.serialize = function(obj) {
            var result = "";
            if (typeof obj === "undefined") {
                return "undefined";
            }
            try {
                result = String(obj);
                if(result === "[object Object]" || result === "[object Arguments]"){
                    result = JSON.stringify(obj);
                }
            } catch (e) {}
            return result;
        };

        this.serializeElement = function(element){
            var result;

            function getElementAttributes(el) {
                var i, attrs = {};
                for (i = 0; i < el.attributes.length; i++) {
                    if (el.attributes[i].name.toLowerCase() !== "value") {
                        attrs[el.attributes[i].name] = el.attributes[i].value;
                    }
                }
                return attrs;
            }

            function serializeValue(data) {
                if(typeof data === "string") {
                    if (data == "") {
                        return "";
                    }
                    if (/^[a-z0-9!#$%&'*+=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(data)) {
                        return "{type: email, length: "+data.length+"}";
                    }
                    if (/^(\d{4}[\/\-](0?[1-9]|1[012])[\/\-]0?[1-9]|[12][0-9]|3[01])$/.test(data)) {
                        return "{type: date, length: "+data.length+"}";
                    }
                    if (/^\s*$/.test(data)) {
                        return "{type: whitespace, length: "+data.length+"}";
                    }
                    if (/^\d*$/.test(data)) {
                        return  "{type: numeric, length: "+data.length+"}";
                    }
                    if (/^[a-zA-Z]*$/.test(data)) {
                        return "{type: alpha, length: "+data.length+"}";
                    }
                    if (/^[a-zA-Z0-9]*$/.test(data)) {
                        return "{type: alphanumeric, length: "+data.length+"}";
                    }
                    return "{type: characters, length: "+data.length+"}";
                } else {
                    return scope.serialize(data);
                }
            }

            function getSelectValue(element){
                var i;
                if (element.multiple) {
                    for (i = 0; i < element.options.length; i++) {
                        if (element.options[i].selected) {
                            return element.options[i].value;
                        }
                    }
                } else {
                    if (element.selectedIndex >= 0) {
                        if (element.options[element.selectedIndex]) {
                            return element.options[element.selectedIndex].value;
                        }
                    }
                }
                return null
            }

            if(element){
                result = {
                    tag: element.tagName.toLowerCase(),
                    attributes: getElementAttributes(element)
                };
                if(result.tag === "select"){
                    result.value = getSelectValue(element);
                } else if(element.hasOwnProperty('value')){
                    result.value = serializeValue(element.value);
                }
                if(result.tag !== "input" && result.tag !== "textarea") {
                    if (element.textContent) {
                        result.text = element.textContent;
                    } else if (element.innerText) {
                        result.text = element.innerText;
                    }
                }
                return result;
            }
            return null;
        };

        this.createGUID = function() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
            }
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        };

        this.isoNow = function(){
            function getISO(date){
                function pad(number) {
                    if (number < 10) {
                        return '0' + number;
                    }
                    return number;
                }

                return date.getUTCFullYear() +
                    '-' + pad(date.getUTCMonth() + 1) +
                    '-' + pad(date.getUTCDate()) +
                    'T' + pad(date.getUTCHours()) +
                    ':' + pad(date.getUTCMinutes()) +
                    ':' + pad(date.getUTCSeconds()) +
                    '.' + (date.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) +
                    'Z';
            }

            var date = new Date;
            return date.toISOString ? date.toISOString() : getISO(date);
        };

        this.hasMethod = function(obj, method) {
            try {
                return typeof obj[method] === "function" && !!obj[method];
            } catch (e) {
                return false;
            }
        };

        this.arrayUnique = function(array) {
            var a = array.concat();
            for(var i=0; i<a.length; ++i) {
                for(var j=i+1; j<a.length; ++j) {
                    if(a[i] === a[j])
                        a.splice(j--, 1);
                }
            }
            return a;
        };

        this.arrayContains = function(array, obj){
            var i = array.length;
            while (i--) {
                if (array[i] === obj) {
                    return true;
                }
            }
            return false;
        };

        this.environmentInfo = function(){
            var i, config = {};

            if (window.jQuery) {
                if (jQuery.fn && jQuery.fn.jquery) {
                    config.jQuery = jQuery.fn.jquery;
                }
                if (jQuery.ui && jQuery.ui.version) {
                    config.jQueryUI = jQuery.ui.version;
                }
            }
            if (window.angular && angular.version && angular.version.full) {
                config.angular = angular.version.full;
            }
            for (i in window) {
                if ("webkitStorageInfo" !== i && "webkitIndexedDB" !== i) {
                    try {
                        if (window[i]) {
                            var value = window[i].version || window[i].Version || window[i].VERSION;
                            if (typeof value === "string" || typeof value === "number") {
                                config[i] = value;
                            }
                        }
                    } catch (e) {}
                }
            }
            config.scripts =[];
            for(var i = 0; i!=document.scripts.length; i++) {
                config.scripts[i] = document.scripts[i].outerHTML;
            }
            var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection||{ type:" Network Information API not Supported"};
            config.connectionType = connection.type;
            config.connectionStatus = navigator.onLine;
            config.userAgent = navigator.userAgent;
            config.viewportHeight = document.documentElement.clientHeight;
            config.viewportWidth = document.documentElement.clientWidth;
            return config;
        };

        this.sessionID = this.createGUID();
        this.wrapGlobalErrors();
        this.wrapConsole();
        this.wrapNetwork();
        wrapDOMEvents();
        this.wrapCustomEventListeners();
        this.wrapTimers();
        this.clearLog();
    }
    return ErrorTracker;
}));
