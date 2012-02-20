/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true devel: true
         forin: true */
/*global define: true */

(typeof define === "undefined" ? function ($) { $(require, exports, module) } : define)(function (require, exports, module, undefined) {

'use strict'

var core = require('../core'),
    defer = core.defer, promise = core.promise, error = core.error,
    future = core.future, lazy = core.lazy, promised = core.promised,
    lazed = core.lazed

exports['test all observers are notified'] = function(assert, done) {
  var expected = 'Taram pam param!'
  var deferred = defer()
  var pending = 10, i = 0

  function resolved(value) {
    assert.equal(value, expected, 'value resoved as expected: #' + pending)
    if (!--pending) done()
  }

  while (i++ < pending) deferred.promise.then(resolved)

  deferred.resolve(expected)
}

exports['test exceptions dont stop nitifactions'] = function(assert, done) {
  var threw = false, boom = Error('Boom!')
  var deferred = defer()

  var promise2 = deferred.promise.then(function() {
    threw = true
    throw boom
  })

  deferred.promise.then(function() {
    assert.ok(threw, 'observer is called even though previos one threw')
    promise2.then(function() {
      assert.fail('should not resolve')
    }, function(reason) {
      assert.equal(reason, boom, 'rejects to thrown error')
      done()
    })
  })

  deferred.resolve('go!')
}

exports['test subsequent resolves are ignored'] = function(assert, done) {
  var deferred = defer()
  deferred.resolve(1)
  deferred.resolve(2)
  deferred.reject(3)

  deferred.promise.then(function(actual) {
    assert.equal(actual, 1, 'resolves to firts value')
  }, function() {
    assert.fail('must not reject')
  })
  deferred.promise.then(function(actual) {
    assert.equal(actual, 1, 'subsequent resolutions are ignored')
    done()
  }, function() {
    assert.fail('must not reject')
  })
}

exports['test subsequent rejections are ignored'] = function(assert, done) {
  var deferred = defer()
  deferred.reject(1)
  deferred.resolve(2)
  deferred.reject(3)

  deferred.promise.then(function(actual) {
    assert.fail('must not resolve')
  }, function(actual) {
    assert.equal(actual, 1, 'must reject to first')
  })
  deferred.promise.then(function(actual) {
    assert.fail('must not resolve')
  }, function(actual) {
    assert.equal(actual, 1, 'must reject to first')
    done()
  })
}

exports['test error recovery'] = function(assert, done) {
  var boom = Error('Boom!')
  var deferred = defer()

  deferred.promise.then(function() {
    assert.fail('rejected promise should not resolve')
  }, function(reason) {
    assert.equal(reason, boom, 'rejection reason delivered')
    return 'recovery'
  }).then(function(value) {
    assert.equal(value, 'recovery', 'error handled by a handler')
    done()
  })

  deferred.reject(boom)
}


exports['test error recovery with promise'] = function(assert, done) {
  var deferred = defer()

  deferred.promise.then(function() {
    assert.fail('must rejcet')
  }, function(actual) {
    assert.equal(actual, 'reason', 'rejected')
    var deferred = defer()
    deferred.resolve('recovery')
    return deferred.promise
  }).then(function(actual) {
    assert.equal(actual, 'recovery', 'recorvered via promise')
    var deferred = defer()
    deferred.reject('error')
    return deferred.promise
  }).then(null, function(actual) {
    assert.equal(actual, 'error', 'rejected via promise')
    var deferred = defer()
    deferred.reject('end')
    return deferred.promise
  }).then(null, function(actual) {
    assert.equal(actual, 'end', 'rejeced via promise')
    done()
  })

  deferred.reject('reason')
}

exports['test propagation'] = function(assert, done) {
  var d1 = defer(), d2 = defer(), d3 = defer()

  d1.promise.then(function(actual) {
    assert.equal(actual, 'expected', 'resolves to expecetd value')
    done()
  })

  d1.resolve(d2.promise)
  d2.resolve(d3.promise)
  d3.resolve('expected')
}

exports['test chaining'] = function(assert, done) {
  var boom = Error('boom'), brax = Error('braxXXx')
  var deferred = defer()

  deferred.promise.then().then().then(function(actual) {
    assert.equal(actual, 2, 'value propagets unchanged')
    return actual + 2
  }).then(null, function(reason) {
    assert.fail('should not reject')
  }).then(function(actual) {
    assert.equal(actual, 4, 'value propagets through if not handled')
    throw boom
  }).then(function(actual) {
    assert.fail('exception must reject promise')
  }).then().then(null, function(actual) {
    assert.equal(actual, boom, 'reason propagets unchanged')
    throw brax
  }).then().then(null, function(actual) {
    assert.equal(actual, brax, 'reason changed becase of exception')
    return 'recovery'
  }).then(function(actual) {
    assert.equal(actual, 'recovery', 'recorverd from error')
    done()
  })

  deferred.resolve(2)
}


exports['test error'] = function(assert, done) {
  var expected = Error('boom')

  error(expected).then(function() {
    assert.fail('should reject')
  }, function(actual) {
    assert.equal(actual, expected, 'rejected with expected reason')
  }).then(function() {
    done()
  })
}

exports['test resolve to error'] = function(assert, done) {
  var expected = Error('boom')
  var deferred = defer()

  deferred.promise.then(function() {
    assert.fail('should reject')
  }, function(actual) {
    assert.equal(actual, expected, 'rejected with expected failure')
  }).then(function() {
    done()
  })

  deferred.resolve(error(expected))
}

exports['test promise'] = function(assert, done) {
  var expected = 'value'
  promise(expected).then(function(actual) {
    assert.equal(actual, expected, 'resolved as expected')
  }).then(function() {
    done()
  })
}

exports['test promise with prototype'] = function(assert, done) {
  var seventy = promise(70, {
    subtract: function subtract(y) {
      return this.then(function(x) { return x - y })
    }
  })

  seventy.subtract(17).then(function(actual) {
    assert.equal(actual, 70 - 17, 'resolves to expected')
    done()
  })
}

exports['test future with normal args'] = function(assert, done) {
  var sum = future(function(x) { return 7 + x }, 8)

  sum.then(function(actual) {
    assert.equal(actual, 7 + 8, 'resolves as expected')
    done()
  })
}

exports['test future with promise args'] = function(assert, done) {
  var deferred = defer()
  var sum = future(function(x) { return 11 + x }, deferred.promise)

  sum.then(function(actual) {
    assert.equal(actual, 11 + 24, 'resolved as expected')
    done()
  })

  deferred.resolve(24)
}

exports['test future error handleing'] = function(assert, done) {
  var expected = Error('boom')
  var f = future(function() {
    throw expected
  })

  f.then(function() {
    assert.fail('should reject')
  }, function(actual) {
    assert.equal(actual, expected, 'rejected as expected')
    done()
  })
}

exports['test return promise form future'] = function(assert, done) {
  var f = future(function() {
    return promise(17)
  })

  f.then(function(actual) {
    assert.equal(actual, 17, 'resolves to a promise resolution')
    done()
  })
}

exports['test future returning failure'] = function(assert, done) {
  var expected = Error('boom')
  var f = future(function() {
    return error(expected)
  })

  f.then(function() {
    assert.fail('must reject')
  }, function(actual) {
    assert.equal(actual, expected, 'rejects with expected reason')
    done()
  })
}

exports['test futures are greedy'] = function(assert, done) {
  var runs = 0
  var f = future(function() { ++runs })
  assert.equal(runs, 1, 'future runs task right away')
  done()
}

exports['test lazy futurues are lazy'] = function(assert, done) {
  var runs = 0
  var promise = lazy(function() { ++runs })
  assert.equal(runs, 0, 'lazy future runs on demand')
  promise.then(function() {
    assert.equal(runs, 1, 'lazy future runs task when required')
    promise.then()
    assert.equal(runs, 1, 'lazy future runs task only once')
    done()
  })
}

exports['test promised with normal args'] = function(assert, done) {
  var sum = promised(function(x, y) { return x + y })

  sum(7, 8).then(function(actual) {
    assert.equal(actual, 7 + 8, 'resolves as expected')
    done()
  })
}

exports['test promised with promise args'] = function(assert, done) {
  var sum = promised(function(x, y) { return x + y })
  var deferred = defer()

  sum(11, deferred.promise).then(function(actual) {
    assert.equal(actual, 11 + 24, 'resolved as expected')
    done()
  })

  deferred.resolve(24)
}

exports['test promised with prototype'] = function(assert, done) {
  var deferred = defer()
  var numeric = {}
  numeric.subtract = promised(function(y) { return this - y }, numeric)

  var sum = promised(function(x, y) { return x + y }, numeric)

  sum(7, 70).
    subtract(14).
    subtract(deferred.promise).
    subtract(5).
    then(function(actual) {
      assert.equal(actual, 7 + 70 - 14 - 23 - 5, 'resolved as expected')
      done()
    })

  deferred.resolve(23)
}

exports['test promised error handleing'] = function(assert, done) {
  var expected = Error('boom')
  var f = promised(function() {
    throw expected
  })

  f().then(function() {
    assert.fail('should reject')
  }, function(actual) {
    assert.equal(actual, expected, 'rejected as expected')
    done()
  })
}

exports['test return promise form promised'] = function(assert, done) {
  var f = promised(function() {
    return promise(17)
  })

  f().then(function(actual) {
    assert.equal(actual, 17, 'resolves to a promise resolution')
    done()
  })
}

exports['test promised returning failure'] = function(assert, done) {
  var expected = Error('boom')
  var f = promised(function() {
    return error(expected)
  })

  f().then(function() {
    assert.fail('must reject')
  }, function(actual) {
    assert.equal(actual, expected, 'rejects with expected reason')
    done()
  })
}

exports['test promised are greedy'] = function(assert, done) {
  var runs = 0
  var f = promised(function() { ++runs })
  var promise = f()
  assert.equal(runs, 1, 'promised runs task right away')
  done()
}

exports['test lazed futures are lazy'] = function(assert, done) {
  var runs = 0
  var f = lazed(function() { ++runs })
  var promise = f()
  assert.equal(runs, 0, 'lazed future runs on demand')
  promise.then(function() {
    assert.equal(runs, 1, 'lazed future runs task when required')
    promise.then()
    assert.equal(runs, 1, 'lazed future runs task only once')
    assert.notEqual(f().then(), promise,
                    'lazed future does not caches return value')
    assert.equal(runs, 2, 'lazed future returns different value each time')
    done()
  })
}

if (module == require.main)
  require("test").run(exports)

})
