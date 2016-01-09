'use strict';
var _ = require('./util');
var PubSub = require('./pubsub');
/**
 * task init
 * @param id unique id of this task
 * @param options
 *          interval(optional): execute time interval
 *          callback(function,optional): callback of each response
 *          callbacks(array of function,optional): callbacks of each response
 *          batchParams(optional): params when executed in task queue
 *          init(function,optional): init task function
 *          run(function,optional): execute in each interval
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
    PubSub.publish('task_created_'+id,id);
}
var proto = Task.prototype;

/**
 * run the task with init request,which maybe different from other request
 * @param options
 */
proto.init = function (options) {
   var self = this,func;
   if(self.isRunning) return;
   _.extend(self.options,options);

   if(self.options.init){
       if(!_.isFunction(self.options.init)){
           throw new Error('Run function invalid');
       }
       func = self.options.init();
       if(_.isPromise(func)) {
           func.then(function () {
               self.isRunning = true;
               self.start();
           });
           return;
       }
       PubSub.publish('task_inited_'+id,id);
   }
   self.start();
};

proto.restart = function (options) {
    var self = this;
    if(self.isRunning) return;
    _.extend(self.options,options);
    self.start();
};

proto.start = function () {
    var self = this,
        func;
    self.isRunning = true;
    if(!_.isFunction(self.options.run)){
        throw new Error('Run function invalid');
    }
    func = self.options.run();
    if(_.isPromise(func)){
        func.then(function(res){
            self._processResponse(res);
        });
    }else{
        self._processResponse();
    }
};

proto._processResponse = function(res){
    var self = this,shouldContinue = true;
    clearTimeout(self.timer);
    if(_.isEmpty(self.callbacks)){//no callbacks,try publish
        PubSub.publish(self.id,res);
    }else{
        _.each(self.callbacks,function(callback){
            if(_.isFunction(callback) && !callback(res)){
                shouldContinue =  false;
            }
        });
    }
    if(!shouldContinue){
        self.isRunning = false;
        return false;
    }
    self.timer = setTimeout(function () {
        self.start();
    }, self.options.interval || self.interval);
};

proto.kill = function (options) {
    var self = this,id = options.id;
    if(!self.isRunning) return;
    _.extend(self.options,options);

    if(_.isFunction(self.options.kill)){ //if kill function provided
        self.options.kill(options)
    }

    self.isRunning = false;
    clearTimeout(this.timer);
    PubSub.publish('task_killed_'+id,id);
};

proto.pause = function (options) {
    var self = this;
    if(!self.isRunning) return;
    _.extend(self.options,options);

    if(!_.isFunction(self.options.pause)){
        self.options.pause()
    }

    self.isRunning = false;
    clearTimeout(this.timer);
    PubSub.publish('task_paused_'+id,id);
};

proto.processBatchResponse = function(res){
    var self = this,result = true;

    if(!_.isEmpty(self.callbacks)){//no callbacks,try publish
        _.each(self.callbacks, function (callback) {
            if (_.isFunction(callback) && !callback(res)) {
                self.isRunning = false;
                result = false;
            }
        });
    }
    return result;
};

proto.addCallback = function(callback){
    if(!_.isFunction(callback)){
        throw new Error('Callback should be a function');
    }
    this.callbacks.push(callback);
};

module.exports =  Task;
