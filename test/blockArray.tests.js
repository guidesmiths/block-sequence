var bsr = require('block-sequence-reference')
var BlockArray = require('..').BlockArray
var assert = require('assert')
var async = require('async')

describe('BlockArray', function() {

    var driver

    beforeEach(function(done) {
        bsr({}, function(err, _driver) {
            if (err) return done(err)
            driver = _driver
            done()
        })
    })

    afterEach(function(done) {
        driver.close(done)
    })

    it('should require a driver', function(done) {
        var count = 0
        new BlockArray({}).on('error', function(err) {
            assert.equal(err.message, 'driver is required')
            count++
            assert.ok(count <= 2)
            if (count === 2) done()

        })
    })

    it('should require a sequence name', function(done) {
        var count = 0
        new BlockArray({ block: { driver: driver } }).on('error', function(err) {
            assert.equal(err.message, 'sequence name is required')
            count++
            assert.ok(count <= 2)
            if (count === 2) done()
        })
    })

    it('should provide sequential ids', function(done) {
        var block = new BlockArray({
            block: {
                driver: driver,
                size: 10,
                sequence: {
                    name: 'block-tests'
                }
            }
        })

        async.timesSeries(5, function(i, cb) {
            block.next(function(err, id) {
                assert.ifError(err)
                assert.equal(id, i + 1)
                cb()
            })
        }, done)
    })

    it('should recharge when exhaused', function(done) {
        var block = new BlockArray({
            block: {
                driver: driver,
                size: 4,
                sequence: {
                    name: 'block-tests'
                }
            }
        })

        async.timesSeries(10, function(i, cb) {
            block.next(function(err, id) {
                assert.ifError(err)
                assert.equal(id, i + 1)
                cb()
            })
        }, done)
    })

    it('should emit an error event on repeated charge failure', function(done) {
        new BlockArray({
            block: {
                driver: badDriver,
                sequence: {
                    name: 'block-tests'
                },
                retry: {
                    limit: 10,
                    interval: 1
                }
            }
        }).on('error', function(err) {
            assert.equal(err.message, 'Failed to charge')
            if (badDriver.attempts !== 20) return
            done()
        })
    })

    it('should emit a blocking event when queueing', function(done) {
        var block = new BlockArray({
            block: {
                driver: slowDriver,
                size: 1,
                sequence: {
                    name: 'block-tests'
                },
                retry: {
                    limit: 10,
                    interval: 1
                }
            }
        }).once('blocking', function(sequence) {
            assert.equal(sequence.name, 'block-tests')
            done()
        })

        async.times(3, function(n, cb) {
            block.next(cb)
        })
    })

    var badDriver = {
        ensure: function(options, cb) {
            this.attempts = 0
            cb(null, options)
        },
        allocate: function(options, cb) {
            this.attempts++
            cb(new Error('Failed to charge'))
        }
    }

    var slowDriver = {
        ensure: function(options, cb) {
            this.attempts = 0
            cb(null, options)
        },
        allocate: function(options, cb) {
            this.attempts++
            setTimeout(function() {
                cb(null, { name: options.name, value: 100 })
            }, 1000)
        }
    }

})
