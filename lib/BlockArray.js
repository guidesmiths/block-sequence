var debug = require('debug')('block-sequence:blockarray')
var EventEmitter = require('events')
var util = require('util')
var _ = require('lodash')
var Block = require('./Block')

var BlockArray = function(config) {

    var self = this
    var blockIndex = 0
    var blockList = _.times(config.size || 2, function() {
        return new Block(config.block)
            .on('drained', function() {
                blockIndex = (blockIndex + 1) % blockList.length
                debug('Switching to block %d', blockIndex)
            }).on('error', function(err) {
                self.emit('error', err)
            })
    })

    this.next = function(cb) {
        blockList[blockIndex].next(cb)
    }

    EventEmitter.call(this);
}

util.inherits(BlockArray, EventEmitter);

module.exports = BlockArray