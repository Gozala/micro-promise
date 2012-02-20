/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true devel: true
         forin: true latedef: false supernew: true */
/*global define: true */

!(typeof(define) !== "function" ? function($) { $(typeof(require) !== 'function' ? (function() { throw Error('require unsupported'); }) : require, typeof(exports) === 'undefined' ? this : exports, typeof(module) === 'undefined' ? {} : module); } : define)(function(require, exports, module) {

"use strict";

// Internal utility helper.
var concat = Array.prototype.concat
var call = Function.call

function resolution(value) {
  /**
  Returns non-standard compliant (`then` does not returns a promise) promise
  that resolves to a given `value`. Used just internally only.
  **/
  return { then: function then(resolve) { resolve(value) } }
}

function rejection(reason) {
  /**
  Returns non-standard compliant promise (`then` does not returns a promise)
  that rejects with a given `reason`. This is used internally only.
  **/
  return { then: function then(resolve, reject) { reject(reason) } }
}

function attempt(f) {
  /**
  Returns wrapper function that delegates to `f`. If `f` throws then captures
  error and returns promise that rejects with a thrown error. Otherwise returns
  return value. (Internal utility)
  **/
  return function attempt(options) {
    try { return f(options) }
    catch(error) { return rejection(error) }
  }
}

function isPromise(value) {
  /**
  Returns true if given `value` is promise. Value is assumed to be promise if
  it implements `then` method.
  **/
  return value && typeof(value.then) === 'function'
}

function defer(prototype) {
  /**
  Returns object containing following properties:
  - `promise` Eventual value representation implementing CommonJS [Promises/A]
    (http://wiki.commonjs.org/wiki/Promises/A) API.
  - `resolve` Single shot function that resolves returned `promise` with a given
    `value` argument.
  - `reject` Single shot function that rejects returned `promise` with a given
    `reason` argument.

  Given `prototype` argument is used as a prototype of the returned `promise`
  allowing one to implement additional API. If prototype is not passed then
  it falls back to `Object.prototype`.

  ## Examples

  // Simple usage.
  var deferred = defer()
  deferred.promise.then(console.log, console.error)
  deferred.resolve(value)

  // Advanced usage
  var prototype = {
    get: function get(name) {
      return this.then(function(value) {
        return value[name];
      })
    }
  }

  var foo = defer(prototype)
  deferred.promise.get('name').then(console.log)
  deferred.resolve({ name: 'Foo' })
  //=> 'Foo'
  */
  var pending = [], result
  prototype = (prototype || prototype === null) ? prototype : Object.prototype

  // Create an object implementing promise API.
  var promise = Object.create(prototype, {
    then: { value: function then(resolve, reject) {
      // create a new deferred using a same `prototype`.
      var deferred = defer(prototype)
      // If `resolve / reject` callbacks are not provided.
      resolve = resolve ? attempt(resolve) : resolution
      reject = reject ? attempt(reject) : rejection

      // Create a listeners for a enclosed promise resolution / rejection that
      // delegate to an actual callbacks and resolve / reject returned promise.
      function resolved(value) { deferred.resolve(resolve(value)) }
      function rejected(reason) { deferred.resolve(reject(reason)) }

      // If promise is pending register listeners. Otherwise forward them to
      // resulting resolution.
      if (pending) pending.push([ resolved, rejected ])
      else result.then(resolved, rejected)

      return deferred.promise
    }}
  })

  var deferred = {
    promise: promise,
    resolve: function resolve(value) {
      /**
      Resolves associated `promise` to a given `value`, unless it's already
      resolved or rejected.
      **/
      if (pending) {
        // store resolution `value` as a promise (`value` itself may be a
        // promise), so that all subsequent listeners can be forwarded to it,
        // which either resolves immediately or forwards if `value` is
        // a promise.
        result = isPromise(value) ? value : resolution(value)
        // forward all pending observers.
        while (pending.length) result.then.apply(result, pending.shift())
        // mark promise as resolved.
        pending = null
      }
    },
    reject: function reject(reason) {
      /**
      Rejects associated `promise` with a given `reason`, unless it's already
      resolved / rejected.
      **/
      deferred.resolve(rejection(reason))
    }
  }

  return deferred
}
exports.defer = defer

function promise(value, prototype) {
  /**
  Returns a promise resolved to a given `value`. Optionally second `prototype`
  arguments my be provided to be used as a prototype for a returned promise.
  **/
  var deferred = defer(prototype)
  deferred.resolve(value)
  return deferred.promise
}
exports.promise = promise

function error(reason, prototype) {
  /**
  Returns a promise that is rejected with a given `reason`. Optionally second
  `prototype` arguments my be provided to be used as a prototype for a returned
  promise.
  **/
  var deferred = defer(prototype)
  deferred.reject(reason)
  return deferred.promise
}
exports.error = error

// ! Internal utility function.
function join(promises, prototype) {
  /**
  takes array of promises and returns promise that resolves to an
  array of resolutions of these promises, preserving their order
  in the array.
  **/
  return promises.reduce(function(items, item) {
    return items.then(function(items) {
      return promise(item).then(function(item) {
        return items.concat(item)
      })
    })
  }, promise([], prototype))
}

function future(f, options, prototype) {
  /**
  Returned a promise that immediately resolves to `f(options)` or
  rejects on exception. If third argument optional `prototype` is
  provided it will be used as prototype for a return promise.
  **/
  return promise(options, prototype).then(f)
}
exports.future = future

function lazy(f, options, prototype) {
  /**
  This is just like future with a difference that it will call `f` on demand
  deferring this until (if ever) `then` of the returned promise is called.
  **/
  var result
  prototype = (prototype || prototype === null) ? prototype : Object.prototype
  return Object.create(prototype, {
    then: { value: function then(resolve, reject) {
      result = result || future(f, options)
      return result.then(resolve, reject)
    }}
  })
}
exports.lazy = lazy

function promised(f, prototype) {
  /**
  Returns a wrapped `f`, which when called returns a promise that resolves to
  `f(...)` passing all the given arguments to it, which by the way may be
  promises. Optionally second `prototype` argument may be provided to be used
  a prototype for a returned promise.

  ## Example

  var promise = promised(Array)(1, promise(2), promise(3))
  promise.then(console.log) // => [ 1, 2, 3 ]
  **/

  return function promised() {
    return future(function(args) {
      return call.apply(f, args)
    }, join(concat.apply([ this ], arguments)), prototype)
  }
}
exports.promised = promised

function lazed(f, prototype) {
  /**
  This compares to `promised` as `lazy` does to `future`. It calls `f` on
  demand deferring until (if ever) `then` of the returned promise is called.
  **/
  return function lazed() {
    return lazy(function(args) {
      return call.apply(f, args)
    }, join(concat.apply([ this ], arguments)), prototype)
  }
}
exports.lazed = lazed

});
