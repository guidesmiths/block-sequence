var debug = require('debug')('block-sequence:blockarray')
var EventEmitter = require('events').EventEmitter
var util = require('util')
var times = require('lodash.times')
var Block = require('./Block')

var BlockArray = function(config) {

    var self = this
    var blockIndex = 0
    var blockList = times(config.size || 2, function() {
        return new Block(config.block)
            .on('drained', function() {
                blockIndex = (blockIndex + 1) % blockList.length
                debug('Switching to block %d', blockIndex)
            }).on('error', function(err) {
                self.emit('error', err)
            }).on('blocking', function(sequence) {
                self.emit('blocking', sequence)
            })
    })

    this.next = function(cb) {
        blockList[blockIndex].next(cb)
    }

    EventEmitter.call(this);
}

util.inherits(BlockArray, EventEmitter);

module.exports = BlockArray
