define(['underscore', 'ide/scripts/task'], function (_, Task) {
    /**
     * init a task manager
     * @param conf
     *            process(function:required when executing batch tasks)
     * @constructor
     */
    function TaskManager(conf) {
        this.tasks = {};//single task queue id:task
        this.queue = {};//queue tasks queue id:task
        this.conf = _.extend({interval: 10000}, conf);
    }

    var proto = TaskManager.prototype;

    /**
     * set config
     * @param conf
     */
    proto.setConfig = function (conf) {
        if (conf) _.extend(this.conf, conf);
    };

    /**
     * init queue task
     * @param options
     *         id (required) : id of the task,should be unique!
     *         init (function,optional):  init task
     *         afterInit(function,optional): callback of init
     *         callback(function,required): callback of each response result
     */
    proto.createBatchTask = function (options) {
        var self = this, task, id = options.id;

        if (typeof options !== 'object') {
            throw new Error('Expected the options to be an object.');
        }
        if (_.isEmpty(id)) {
            throw new Error('Expected the options with id attributes.');
        }
        if ((task = self.queue[id])) {//task already exists
            task.addCallback(options.callback);
        } else {
            self._initBatchTask(options);//newly defined task,call init function
        }
    };

    /**
     * kill queue task
     * @param options
     *         id (required) : id of the task
     *         type(required): type of the task,
     *         kill(optional): kill function
     */
    proto.killBatchTask = function (options) {
        var self = this, id = options.id,func;

        if (typeof options !== 'object') {
            throw new Error('Expected the options to be an object.');
        }
        if (_.isEmpty(id)) {
            throw new Error('Expected the options with id attributes.');
        }
        if (self.queue[id]) {
            if(options.kill && _.isFunction(options.kill) && (func = options.kill())){
                 if(isPromise(func)){
                     func.then(function(){
                         self.removeBatchTask(id);
                     });
                 }
            }else{
                self.removeBatchTask(id);
            }
        }
    };

    /**
     * process task in the queue
     */
    proto.processBatchTask = function () {
        var self = this, params = [];
        if (_.isEmpty(self.queue)) { //no queue task in queue
            clearTimeout(self.timer);
            return;
        }

        if(!self.conf.process || !_.isFunction(self.conf.process)){
            throw new Error('Process function not provided!');
        }
        _.each(self.queue, function (task) { //organize params
            if (task.isInited) {
                params.push(task.batchParams);
            }
        });
        if (params.length === 0) {
            clearTimeout(self.timer);
            return;
        }

        self.conf.process(params).then(function (res) {
            self._dispatchResult(res);
            self.timer = setTimeout(function () {
                self.processBatchTask();
            }, self.conf.interval);
        });

    };

    /**
     * remove task from queue
     * @param id
     */
    proto.removeBatchTask = function (id) {
        delete this.queue[id];
        if (_.isEmpty(this.queue)) {
            clearTimeout(this.timer);
        }
    };

    /**
     * add a task to queue
     * @param id
     * @returns {*}
     */
    proto.getBatchTask = function (id) {
        return this.queue[id];
    }

    /**
     * dispatch result to each task
     * @param res
     * @private
     */
    proto._dispatchResult = function (res) {
        var self = this, task;
        if (_.isEmpty(res) || res.rCode !== 0 || _.isEmpty(res.data)) return;
        _.each(res.data, function (result) {
            if (!_.isEmpty(result)) {
                task = self.getBatchTask(result.id);
                if (task && !task.processBatchResponse(result)) {
                    console.log('task id:'+task.id+" removed from queue");
                    self.removeBatchTask(task.id);//delete task if reponse something wrong or work done
                }
            }
        });
    };

    /**
     * init a task request
     * @param options
     *         init(optional): init query task
     *         afterInit(optional): call back of init
     */
    proto._initBatchTask = function (options) {
        var self = this, task, func;

        if (self.queue[options.id]) return;

        task = new Task(options.id,options);
        options.init && (_.isFunction(options.init)) && (func = options.init());

        if (!_.isEmpty(func) && isPromise(func)) {
            func.then(function (res) {
                if (options.afterInit && _.isFunction(options.afterInit) && !options.afterInit(res)) {
                    return;
                }
                task.isInited = true;
                self._addBatchTask(options.id, task);
            });
        } else {//TODO init ���ش�����Ϣ���
            if (options.afterInit && _.isFunction(options.afterInit) && !options.afterInit()) {
                return;
            }
            task.isInited = true;
            self._addBatchTask(options.id, task);
        }
    };

    proto._addBatchTask = function (id, task) {
        var self = this;
        console.log("task id:"+task.id+" added to queue!");
        if (_.isEmpty(self.queue)) { //if this is the first task inited start queue timer
            self.queue[id] = task;
            self.processBatchTask();
        } else {
            self.queue[id] = task;
        }
    };

    /**
     * init single task
     * @param options
     *         run(required): task mission
     *         kill(optional): kill mission
     *         complete(optional): response of task mission
     * @returns {Task|*}
     */
    proto.createTask = function (options) {
        if (typeof options !== 'object') {
            throw new Error('Expected the options to be an object.');
        }
        if (_.isEmpty(options.id)) {
            throw new Error('Expected the options with id attributes.');
        }
        this.tasks[options.id] = new Task(options.id, options);
        return this.tasks[options.id];
    };

    /**
     * init a task list
     * @param options
     *         id (required) : id of the task
     *         type(required): type of the task
     *         run(required): task mission
     *         kill(optional): kill mission
     *         complete(optional): response of task mission
     */
    proto.createTaskList = function (options) {
        var self = this, task, taskList;
        if (typeof options !== 'object') {
            throw new Error('Expected the options to be an object.');
        }
        if (_.isEmpty(options.id) || !(options.id instanceof Array) || options.id.length === 0) {
            throw new Error('Expected the options with id array attributes.');
        }
        taskList = {};
        _.each(options.id, function (id) {
            task = new Task(id, options);
            self.tasks[id] = task;
            taskList[id] = task;
        });
        return taskList;
    };

    /**
     * run one task
     */
    proto.runTask = function (options) {
        return this._operateTask(options, 'run');
    };

    /**
     * run task list
     */
    proto.runTaskList = function (options) {
        return this._operateTaskList(options, 'run');
    };

    /**
     * continue task
     */
    proto.continueTask = function (options) {
        if (_.isEmpty(options.id)) {
            throw new Error('Expected the options with id and type attributes.');
        }
        if (!this.getTask(options.id)) {
            this.createTask(options);
        }
        return this._operateTask(options, 'continue');
    };

    /**
     * pause a task
     */
    proto.pauseTask = function (options) {
        return this._operateTask(options, 'pause')
    };

    /**
     * pause task list
     */
    proto.pauseTaskList = function (options) {
        return this._operateTaskList(options, 'pause');
    };

    /**
     * kill a task
     */
    proto.killTask = function (options) {
        var id = self._operateTask(options, 'kill');
        this.removeTask(id);
    };

    /**
     * kill task list
     */
    proto.killTaskList = function (options) {
        var self = this;
        var taskList = self._operateTaskList(options, 'kill');
        _.each(taskList, function (id) {
            self.removeTask(id);
        });
        return taskList;
    };

    proto.getTask = function (id) {
        return this.tasks[id];
    };

    proto.removeTask = function (id) {
        var task;
        if (!(task = this.tasks[id])) {
            return;
        }
        task.isRunning && task.kill();
        delete this.tasks[id];
    };

    /**
     * operate a task
     * @param options
     * @param action
     * @returns id of task
     */
    proto._operateTask = function (options, action) {
        var id = options.id, task,
            self = this;

        if (_.isEmpty(id)) {
            throw new Error('Expected id');
        }
        if (action && !_.isFunction(self.getTask(id)[action])) {
            throw new Error('Task id:' + id + " has no function :" + action);
        }
        task = self.getTask(id);
        task && task[action](options);
        return id;
    };

    /**
     * operate on a list of tasks
     * @param options
     *          id(optional): if passed array of id,execute action on the specific tasks
     *                        if not provided, execute action on all tasks
     * @param action
     * @returns {Array}
     */
    proto._operateTaskList = function (options, action) {
        var self = this, ids = options.id, task, taskIdList = [];

        if (!_.isEmpty(ids)) {
            if (!(ids instanceof Array) || ids.length === 0) {
                throw new Error('Expected array of ids');
            }
            _.each(ids, function (id) {
                task = self.tasks[id];
                if (task) {
                    if (action && !_.isFunction(task[action])) {
                        throw new Error('Task id:' + id + " has no function :" + action);
                    }
                    task[action](options);
                    taskIdList.push(id);
                }
            });
        } else { //execute action on all tasks
            _.each(self.tasks, function (task, id) {
                if (task) {
                    task[action](options);
                    taskIdList.push(id);
                }
            });
        }
        return taskIdList;
    };
    
    function isPromise(obj) {
        return 'function' == typeof obj.then;
    }

    return TaskManager;
});
