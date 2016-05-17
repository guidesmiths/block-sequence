var bsr = require('block-sequence-reference')
var Block = require('..').Block
var assert = require('assert')
var async = require('async')

describe('Block', function() {

    var driver
    var store = {}

    beforeEach(function(done) {
        bsr({ store: store }, function(err, _driver) {
            if (err) return done(err)
            driver = _driver
            done()
        })
    })

    afterEach(function(done) {
        driver.close(done)
    })

    it('should require a driver', function(done) {
        new Block({}).on('error', function(err) {
            assert.equal(err.message, 'driver is required')
            done()
        })
    })

    it('should require a sequence name', function(done) {
        new Block({ driver: driver }).on('error', function(err) {
            assert.equal(err.message, 'sequence name is required')
            done()
        })
    })

    it('should prime blocks by default', function(done) {
        var blocked = false
        var block = new Block({
            driver: driver,
            size: 10,
            sequence: {
                name: 'block-tests'
            }
        })

        block.on('ready', function() {
            block.next(function(err, id) {
                assert.ifError(err)
                assert.equal(id, 1)
                assert.ok(!blocked)
                done()
            })
        }).on('blocking', function() {
            blocked = true
        })
    })


    it('should prime blocks when explicitly enabled', function(done) {
        var blocked = false
        var block = new Block({
            driver: driver,
            prime: true,
            size: 10,
            sequence: {
                name: 'block-tests'
            }
        })

        block.on('ready', function() {
            block.next(function(err, id) {
                assert.ifError(err)
                assert.equal(id, 1)
                assert.ok(!blocked)
                done()
            })
        }).on('blocking', function() {
            blocked = true
        })
    })

    it('should not prime blocks when explicitly disabled', function(done) {
        var blocked = false
        var block = new Block({
            driver: driver,
            prime: false,
            size: 10,
            sequence: {
                name: 'block-tests'
            }
        })

        block.on('ready', function() {
            assert.ok(false, 'Block should not have been primed')
        }).on('blocking', function() {
            blocked = true
        })

        setTimeout(function() {
            block.removeAllListeners('ready')
            block.next(function(err, id) {
                assert.ifError(err)
                assert.equal(id, 1)
                assert.ok(blocked)
                done()
            })
        }, 200)
    })

    it('should provide sequential ids', function(done) {
        var block = new Block({
            driver: driver,
            size: 10,
            sequence: {
                name: 'block-tests'
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

    it('should render ids', function(done) {
        var block = new Block({
            driver: driver,
            size: 10,
            template: '{{=it.sequence.name}}-{{=it.id}}',
            sequence: {
                name: 'block-tests'
            }
        })

        async.timesSeries(5, function(i, cb) {
            block.next(function(err, id) {
                assert.ifError(err)
                assert.equal(id, 'block-tests-' + (i + 1))
                cb()
            })
        }, done)
    })

    it('should left pad ids', function(done) {
        var block = new Block({
            driver: driver,
            size: 10,
            template: '{{=it.sequence.name}}-{{=it.id}}',
            padding: {
                size: 4,
                chars: '0'
            },
            sequence: {
                name: 'block-tests'
            }
        })

        async.timesSeries(5, function(i, cb) {
            block.next(function(err, id) {
                assert.ifError(err)
                assert.equal(id, 'block-tests-000' + (i + 1))
                cb()
            })
        }, done)
    })


    it('should recharge when exhaused', function(done) {
        var block = new Block({
            driver: driver,
            size: 4,
            sequence: {
                name: 'block-tests'
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

    it('should emit drained event when exhausted', function(done) {
        var block = new Block({
            driver: driver,
            size: 4,
            sequence: {
                name: 'block-tests'
            }
        }).on('drained', function(sequence) {
            assert.equal(sequence.name, 'block-tests')
            done()
        })

        async.timesSeries(4, function(i, cb) {
            block.next(cb)
        })
    })

    it('should emit ready event when charged', function(done) {
        new Block({
            driver: driver,
            size: 4,
            sequence: {
                name: 'block-tests'
            }
        }).on('ready', function(sequence) {
            assert.equal(sequence.name, 'block-tests')
            done()
        })
    })

    it('should emit an error event on repeated charge failure', function(done) {
        new Block({
            driver: badDriver,
            sequence: {
                name: 'block-tests'
            },
            retry: {
                limit: 10,
                interval: 1
            }
        }).on('error', function(err) {
            assert.equal(err.message, 'Failed to charge')
            assert.equal(badDriver.attempts, 10)
            done()
        })
    })

    var badDriver = {
        ensure: function(options, cb) {
            this.attempts = 0
            cb(null, { name: 'bad-sequence' })
        },
        allocate: function(options, cb) {
            this.attempts++
            cb(new Error('Failed to charge'))
        }
    }
})