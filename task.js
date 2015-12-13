define(['underscore'], function (_) {
    /**
     * task init
     * @param id unique id of this task
     * @param options
     *          interval(optional): execute time interval
     *          callback(function,optional): callback of each response
     *          callbacks(array of function,optional): callbacks of each response
     *          batchParams(optional): params when executed in task queue
     *          run(function,optional): init task function
     *          timer(function,optional): execute in each interval
     *          pause(function,optional): pause function
     *          kill(function,optional): kill function
     * @constructor
     */
    function Task(id,options) {
        this.isInited = false;
        this.isRunning = false;
        this.id = id;
        this.interval = options.interval || 10000;
        this.callbacks = options.callbacks|| [];
        this.batchParams = options.batchParams;
        this.options = options;
        (options.callback) && (this.callbacks.push(options.callback));
    }
    var proto = Task.prototype;

    /**
     * run the task with init request,which maybe different from other request
     * @param options
     */
    proto.run = function (options) {
       var self = this,func;
       if(self.isRunning) return;
       _.extend(self.options,options);

       if(self.options.run){
           if(!_.isFunction(self.options.run)){
               throw new Error('Run function invalid');
           }
           func = self.options.run();
           if(isPromise(func)) {
               func.then(function (res) {
                   self.isRunning = true;
                   self.callTimer();
               });
               return;
           }
       }
       self.callTimer();
    };

    proto.continue = function (options) {
        var self = this;
        if(self.isRunning) return;
        _.extend(self.options,options);
        self.callTimer();
    };

    proto.callTimer = function () {
        var self = this,
            func = self.options.timer();

        if(isPromise(func)){
            func.then(function(res){
                self._processResponse(res);
            });
        }else{
            self._processResponse();
        }
    };

    proto._processResponse = function(res){
        var self = this;
        clearTimeout(self.timer);
        _.each(self.callbacks,function(callback){
            if(_.isFunction(callback) && !callback(res)){
                self.isRunning = false;
                return false;
            }
        });
        self.timer = setTimeout(function () {
            self.callTimer();
        }, self.options.interval || self.interval);
    }

    proto.kill = function (options) {
        var self = this;
        if(!self.isRunning) return;
        _.extend(self.options,options);

        if(!_.isFunction(self.options.kill)){
            throw new Error('Kill function not defined.');
        }

        if(isPromise(self.options.kill)){
            self.options.kill().then(function(res){
                self.isRunning = false;
                clearTimeout(this.timer);
            })
        }else{
            self.options.kill();
            self.isRunning = false;
            clearTimeout(this.timer);
        }
    };

    proto.pause = function (options) {
        var self = this;
        if(!self.isRunning) return;
        _.extend(self.options,options);

        if(!_.isFunction(self.options.pause)){
            throw new Error('Pause function not defined.');
        }

        if(isPromise(self.options.pause)){
            self.options.pause().then(function(res){
                self.isRunning = false;
                clearTimeout(this.timer);
            })
        }else{
            self.options.pause();
            self.isRunning = false;
            clearTimeout(this.timer);
        }
    };

    proto.processBatchResponse = function(res){
        var self = this,result = true;

        _.each(self.callbacks,function(callback){
            if(_.isFunction(callback) && !callback(res)){
                self.isRunning = false;
                result = false;
            }
        });
        return result;
    };

    proto.addCallback = function(callback){
        if(!_.isFunction(callback)){
            throw new Error('Callback should be a function');
        }
        this.callbacks.push(callback);
    }

    /**
     * Check if `obj` is a promise.
     *
     * @param {Object} obj
     * @return {Boolean}
     * @api private
     */
    function isPromise(obj) {
        return 'function' == typeof obj.then;
    }

    return Task;
});