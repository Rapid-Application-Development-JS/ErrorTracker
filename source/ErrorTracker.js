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
    function ErrorTracker(){
        var self = this;
        var IGNORLOG = "_#_ignog_log_#_";
        var currentEventStack =[];
        var customEventStack =[];
        this.version = "1.0.0";

        this.SENDERS = {
            window: "window",
            console: "console",
            xhr: "xhr",
            tracker: "tracker"
        };


        this.EVENTS = {
            maxEventStackLength: 50,
            console: "console",
            xhr: "xhr",
            timer: "timer",
            listener: "custom EventListener",
            DOM: "DOM",
            DOMEventTypes: {
                _any:["load", "drop", "paste", "play", "pageshow", "hashchange"],
                button:["click", "dblclick", 'hold', 'fling','longtap','tap','doubletap'],
                input:["blur"],
                textarea:["blur"],
                form:["submit", "reset"]
            },
            EventListenerEliminations: ["scroll", "wheel", "drag", "mousemove", "mouseover", "mouseout", "mouseleave", "mouseenter",
                "touchmove", "mousewheel", "input", "keydown", "keypress", "keyup" ]
        };

        this.eventStack = {
            main : currentEventStack
        };

        this.createNewEventBlock = function(blockName){
            blockName = blockName||"block "+(Object.keys(this.eventStack).length+1);
            currentEventStack = [];
            this.eventStack[blockName] =currentEventStack;
        };

        this.clearLog = function(){
            currentEventStack = [];
            customEventStack = [];
            self.eventStack = {
                main : currentEventStack
            };
        };

        this.addCustomEvent = function(event){
            event = event||{};
            event.type = event.type||"custom event";
            event.eventId = event.eventId||customEventStack.length+1;
            customEventStack.push( this.scheduleEvent("user", event));
        }

        this.printLog = function(){
            console.info(JSON.stringify(self.eventStack, null, 4), IGNORLOG);
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
            error.eventsStack = self.eventStack;
            if(window.performance && window.performance.memory){
                error.memoryInfo = window.performance.memory;
            }
            error.enviroment = this.environmentInfo();
            //{
            //    userAgentVersion : window.navigator.appVersion,
            //    userAgent : window.navigator.userAgent,
            //    browserName : window.navigator.appName
            //};
            this.onError(this.serializeError(error));
            this.clearLog();
        };

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
                    error.message = error.message || self.serialize(errMsg);
                    error.file = error.file || self.serialize(url);
                    error.line = error.line || (parseInt(line, 10) || null);
                    error.column = error.column || (parseInt(column, 10) || null);
                    self.addError(self.SENDERS.window, error);
                } catch (e) {
                    self.fault(e);
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
                            try {
                                if((arguments.length>1)||(arguments[1]===IGNORLOG)){
                                    arguments.length = 1;
                                    original.apply(this, arguments);
                                    return;
                                }
                                original.apply(this, arguments);
                                if (level === "error") {
                                    self.addError(self.SENDERS.console, new Error(arguments[0]));
                                } else  {
                                    self.scheduleEvent(self.EVENTS.console, {level:level, args:self.serialize(arguments)});
                                }
                            } catch (e){
                                self.fault(e);
                            }
                        }
                    })(level);
                }
            }
        };

        this.wrapNetwork = function(){
            var origSend = XMLHttpRequest.prototype.send,
                origOpen = XMLHttpRequest.prototype.open;

            function finalize(xhr) {
                if (xhr.errorTrackingInfo) {
                    xhr.errorTrackingInfo.statusCode = xhr.status == 1223 ? 204 : xhr.status;
                    xhr.errorTrackingInfo.statusText = xhr.status == 1223 ? "No Content" : xhr.statusText;
                    self.scheduleEvent(self.EVENTS.xhr, xhr.errorTrackingInfo);
                }
            }

            function checkFault(xhr) {
                if (xhr.errorTrackingInfo && xhr.status >= 400 && xhr.status != 1223) {
                    self.addError(self.SENDERS.xhr, {status: xhr.status, statusText: xhr.statusText, method: xhr.errorTrackingInfo.method, url: xhr.errorTrackingInfo.url});
                }
            }

            function completionListener(xhr){
                if (window.ProgressEvent) {
                    if (xhr.addEventListener) {
                        xhr.addEventListener("readystatechange", function() {
                            if (xhr.readyState === 4) {
                                finalize(xhr);
                            }
                        }, true);
                    }
                }
                if (xhr.addEventListener) {
                    xhr.addEventListener("load", function() {
                        finalize(xhr);
                        checkFault(xhr);
                    }, true);
                } else {
                    setTimeout(function() {
                        try {
                            var origOnLoad = xhr.onload,
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
                        } catch (e) {
                            self.fault(e);
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
                        this.errorTrackingInfo.sendTime = self.isoNow();
                        completionListener(this);
                    } catch (e) {
                        self.fault(e);
                    }
                }
                return origSend.apply(this, arguments);
            };
        };

        this.wrapTimers = function(){
            function wrap(func){
                var original = window[func];
                window[func] = function(){
                    try{

                        self.scheduleEvent(self.EVENTS.timer, {
                            type: func,
                            params: self.serialize(Array.prototype.slice.call(arguments, 1))
                        });
                    } catch (e){
                        self.fault(e);
                    }
                    original.apply(this, arguments);
                };

            }
            wrap("setTimeout");
            wrap("setInterval");
        };

        this.wrapDOMEvents = function(){
            var i, eventName, keys = Object.keys(this.EVENTS.DOMEventTypes), allEvents = [];

            for(i = 0; i < keys.length; i++){
                allEvents = allEvents.concat(this.EVENTS.DOMEventTypes[keys[i]]);
            }
            allEvents = this.arrayUnique(allEvents);

            for(i = allEvents.length - 1; i >= 0; i--) {
                eventName = allEvents[i];
                (function(eventName) {
                    document.addEventListener(eventName, function (event) {
                        var element, availableEvents;
                        try {
                            element = self.elementForEvent(event);
                            if(element) {
                                availableEvents = self.EVENTS.DOMEventTypes[element.tagName.toLowerCase()];
                                if(availableEvents) {
                                    availableEvents = availableEvents.concat(self.EVENTS.DOMEventTypes._any);
                                    if (availableEvents && self.arrayContains(availableEvents, event.type)) {
                                        self.scheduleEvent(self.EVENTS.DOM, {
                                            target: self.serializeElement(element),
                                            type: event.type
                                        });
                                    }
                                }
                            }
                        } catch (e){
                            self.fault(e);
                        }
                    }, true);
                })(eventName)
            }
        };

        this.wrapCustomEventListeners = function(){
            function wrap(object, funcName){
                var original = object[funcName];
                object[funcName] = function(){
                    var listener;
                    try {
                        if(arguments.length > 0 && !self.arrayContains(self.EVENTS.EventListenerEliminations, arguments[0])){
                            listener = arguments[1];
                            if (typeof listener === "function") {
                                arguments[1] = function (event) {
                                    listener.apply(this, arguments);
                                    self.scheduleEvent(self.EVENTS.listener, {
                                        target: self.serializeElement(self.elementForEvent(event)),
                                        type: event.type
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        self.fault(e);
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
                        return "email";
                    }
                    if (/^(\d{4}[\/\-](0?[1-9]|1[012])[\/\-]0?[1-9]|[12][0-9]|3[01])$/.test(data)) {
                        return "date";
                    }
                    if (/^\s*$/.test(data)) {
                        return "whitespace";
                    }
                    if (/^\d*$/.test(data)) {
                        return "numeric";
                    }
                    if (/^[a-zA-Z]*$/.test(data)) {
                        return "alpha";
                    }
                    if (/^[a-zA-Z0-9]*$/.test(data)) {
                        return "alphanumeric";
                    }
                    return "characters";
                } else {
                    return self.serialize(data);
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

            config.userAgent = navigator.userAgent;
            config.viewportHeight = document.documentElement.clientHeight;
            config.viewportWidth = document.documentElement.clientWidth;
            return config;
        };

        this.sessionID = this.createGUID();
        this.wrapGlobalErrors();
     //   this.wrapTimers();
        this.wrapConsole();
        this.wrapNetwork();
        this.wrapDOMEvents();
        this.wrapCustomEventListeners();
        this.wrapTimers();
        this.clearLog();
    }
    return ErrorTracker;
}));
