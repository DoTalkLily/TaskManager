
var _ = {};

var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
    'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];
var ObjProto = Object.prototype;
var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
var nativeIsArray = Array.isArray;
var toString = ObjProto.toString,
    nativeKeys = Object.keys,
    hasOwnProperty = ObjProto.hasOwnProperty;

var collectNonEnumProps = function(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
        prop = nonEnumerableProps[nonEnumIdx];
        if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
            keys.push(prop);
        }
    }
};

var createAssigner = function(keysFunc, defaults) {
    return function(obj) {
        var length = arguments.length;
        if (defaults) obj = Object(obj);
        if (length < 2 || obj == null) return obj;
        for (var index = 1; index < length; index++) {
            var source = arguments[index],
                keys = keysFunc(source),
                l = keys.length;
            for (var i = 0; i < l; i++) {
                var key = keys[i];
                if (!defaults || obj[key] === void 0) obj[key] = source[key];
            }
        }
        return obj;
    };
};


// Internal function that returns an efficient (for current engines) version
// of the passed-in callback, to be repeatedly applied in other Underscore
// functions.
var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
        case 1: return function(value) {
            return func.call(context, value);
        };
        // The 2-parameter case has been omitted only because no current consumers
        // made use of it.
        case 3: return function(value, index, collection) {
            return func.call(context, value, index, collection);
        };
        case 4: return function(accumulator, value, index, collection) {
            return func.call(context, accumulator, value, index, collection);
        };
    }
    return function() {
        return func.apply(context, arguments);
    };
};

// Generator function to create the indexOf and lastIndexOf functions
var createIndexFinder = function(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
        var i = 0, length = getLength(array);
        if (typeof idx == 'number') {
            if (dir > 0) {
                i = idx >= 0 ? idx : Math.max(idx + length, i);
            } else {
                length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
            }
        } else if (sortedIndex && idx && length) {
            idx = sortedIndex(array, item);
            return array[idx] === item ? idx : -1;
        }
        if (item !== item) {
            idx = predicateFind(slice.call(array, i, length), _.isNaN);
            return idx >= 0 ? idx + i : -1;
        }
        for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
            if (array[idx] === item) return idx;
        }
        return -1;
    };
};

// An internal function to generate callbacks that can be applied to each
// element in a collection, returning the desired result — either `identity`,
// an arbitrary callback, a property matcher, or a property accessor.
var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
};

// Generator function to create the findIndex and findLastIndex functions
var createPredicateIndexFinder = function(dir) {
    return function(array, predicate, context) {
        predicate = cb(predicate, context);
        var length = getLength(array);
        var index = dir > 0 ? 0 : length - 1;
        for (; index >= 0 && index < length; index += dir) {
            if (predicate(array[index], index, array)) return index;
        }
        return -1;
    };
};

var getLength = property('length');

function isArrayLike(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
}

function property(key) {
    return function(obj) {
        return obj == null ? void 0 : obj[key];
    };
}

// The cornerstone, an `each` implementation, aka `forEach`.
// Handles raw objects in addition to array-likes. Treats all
// sparse array-likes as if they were dense.
_.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
        for (i = 0, length = obj.length; i < length; i++) {
            iteratee(obj[i], i, obj);
        }
    } else {
        var keys = _.keys(obj);
        for (i = 0, length = keys.length; i < length; i++) {
            iteratee(obj[keys[i]], keys[i], obj);
        }
    }
    return obj;
};

// Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
_.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error', 'Symbol'], function(name) {
    _['is' + name] = function(obj) {
        return toString.call(obj) === '[object ' + name + ']';
    };
});

// Is a given variable an object?
_.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
};

// Returns whether an object has a given set of `key:value` pairs.
_.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
        var key = keys[i];
        if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
};

// Is the given value `NaN`?
_.isNaN = function(obj) {
    return _.isNumber(obj) && isNaN(obj);
};

// Keep the identity function around for default iteratees.
_.identity = function(value) {
    return value;
};
// Returns a predicate for checking whether an object has a given set of
// `key:value` pairs.
_.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
        return _.isMatch(obj, attrs);
    };
};

_.property = function(key) {
    return function(obj) {
        return obj == null ? void 0 : obj[key];
    };
};

_.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
};

_.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
};

// Assigns a given object with all the own properties in the passed-in object(s)
// (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
_.extendOwn = _.assign = createAssigner(_.keys);

_.isFunction = function(obj) {
    return typeof obj == 'function' || false;
};

_.isArray = nativeIsArray || function(obj) {
        return toString.call(obj) === '[object Array]';
};

// Retrieve the names of an object's own properties.
// Delegates to **ECMAScript 5**'s native `Object.keys`
_.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
};

_.extend = createAssigner(_.allKeys);

_.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
};


// Retrieve the values of an object's properties.
_.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
        values[i] = obj[keys[i]];
    }
    return values;
};


_.findIndex = createPredicateIndexFinder(1);
_.findLastIndex = createPredicateIndexFinder(-1);

_.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);

_.isPromise = function(obj) {
    return 'function' == typeof obj.then;
}
// Determine if the array or object contains a given item (using `===`).
// Aliased as `includes` and `include`.
_.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
};

//window.util = _;
module.exports = _;