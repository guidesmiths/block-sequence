var EventEmitter = require('events').EventEmitter
var debug = require('debug')('block-sequence:block')
var util = require('util')
var async = require('async')
var get = require('lodash.get')
var has = require('lodash.has')
var once = require('lodash.once')
var padStart = require('lodash.padStart')
var defaultsDeep = require('lodash.defaultsdeep')

var dot = require('dot')

function Block(config) {

    var driver = get(config, 'driver')
    var prime = has(config, 'prime') ? config.prime : true
    var size = get(config, 'size') || 1000
    var retries = get(config, 'retry.limit') || 1000
    var interval = get(config, 'retry.interval') || 100
    var template = has(config, 'template') && dot.template(config.template)
    var padding = defaultsDeep(get(config, 'padding') || {}, { size: 0, chars: '0' })
    var queue = async.queue(getId, 1)
    var sequence
    var block
    var self = this

    queue.pause()

    var initOnce = once(function init() {
        if (!has(config, 'driver')) return self.emit('error', new Error('driver is required'))
        if (!has(config, 'sequence.name')) return self.emit('error', new Error('sequence name is required'))
        driver.ensure(config.sequence, function(err, _sequence) {
            if (err) return self.emit('error', err)
            sequence = _sequence
            charge()
        })
    })




    function charge() {
        debug('Charging block from sequence: %s with %d ids', sequence.name, size)
        queue.pause()
        async.retry({ times: retries, interval: interval }, function(cb) {
            setImmediate(function() {
                driver.allocate({ name: sequence.name, size: size }, function(err, _block) {
                    if (err) return cb(err)
                    block = _block
                    queue.resume()
                    cb()
                })
            })
        }, function(err) {
            if (err) return self.emit('error', err)
            self.emit('ready', sequence)
        })
    }

    function getId(meh, cb) {

        if (block.remaining === 0) return self.emit('error', 'Block from sequence: ' + sequence.name + ' was exhaused')

        var id = block.next
        if (padding.size) id = padStart(id, padding.size, padding.chars)
        if (template) id = template({ id: id, sequence: sequence })
        block.next++
        block.remaining--
        debug('Returning id: %s from sequence: %s. %d ids remaining', id, sequence.name, block.remaining)

        setImmediate(function() {
            cb(null, id)
        })

        if (block.remaining === 0) {
            debug('Block from sequence: %s has been drained', sequence.name)
            self.emit('drained', sequence)
            charge()
        }
    }

    this.next = function(cb) {
        initOnce()
        queue.push(undefined, cb)
        if (queue.paused) self.emit('blocking', sequence || config.sequence)
    }

    if (prime) setImmediate(initOnce)
    EventEmitter.call(this);
}

util.inherits(Block, EventEmitter);

module.exports = Block
