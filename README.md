# block-sequence
A sequential id generator, which grabs blocks of ids rather than just one at a time. You can configure active/passive blocks and rotate through them, recharging exhausted blocks in the background while assigning ids from the active one.

## tl;dr
```js
var BlockArray = require('block-sequence').BlockArray
var init = require('block-sequence-mysql')

// Initialise the MySql Block Sequence Driver. Other drivers are available
init({ host: '127.0.0.1', database: 'bs_test', user: 'root' }, function(err, driver) {
    if (err) throw err

    // Ensure the sequence exists
    driver.ensure({ name: 'my-sequence' }, function(err, sequence) {
        if (err) throw err

        // Create a block array containing 1000 ids per block (defaults to 2 blocks)
        var idGenerator = new BlockArray({ block: { sequence: sequence, driver: driver, size: 1000 } })

        // Grab the next id
        idGenerator.next(function(err, id) {
            if (err) throw err
            console.log(id)
        })
    })
})
```

## Why not use a UUID generator
UUIDs a great for creating unique ids in a distributed environment without a shared persistent storge. Unfortunately they look horrible and aren't very user friendly if you need to read them out to anyone.

## Why not use something like shortId
I like shortId, but in a multi process / multi host architecture you need to congure each process with a unique worker id. There are also limitations on alphabet making it likely you'll need to use mixed case letters. This can cause problems for MySQL which is case insenstive by defaults and doesn't have a case sensitive utf-8 character set, meaning you have to do horrible things like use different character sets for id columns and data columns in the same table.

## Should I use strings or integers for Ids?
Unless performance is a genuine concern I choose strings, and make it obvious that they are strings by prefixing them with some alphabetic characters. The reasons to avoid integers are...

1. In a non type safe language like JavaScript frameworks such as express, and datastores such as redis return data as string. This causes havoc when you attempt to retrieve a record from mongo, without parsing the id first.

2. If you only use numbers a malicious script or accidental programming mistake could burn through ids very rapidly. If you've prefixed your ids with a string, you can change the prefix and reset the sequence.

## What string format should I use?
I use ```<system>-<entity>-<left padded sequence number>-<environment>```, i.e. if I were developing a Jobs board and wanted an id generator for vacancies in the live environment an example id would be ```jbs-vac-00070012-l```. block-sequence lets you do just this.

## Won't an id generator that relies on a database be slower and less reliable than a uuid generator?
Yes. That's why block-sequence reads blocks of ids, and recharges exhausted blocks while the current block is draining.

## What are the caveats?
1. Ids cannot be used to sort records by age (you probably shouldn't do this anyway)
2. When block-sequence initialises it charges it's id blocks immediately. If you node app crashes and restarts repeatedly you will end up burning through ids very quickly.

## How are the sequences stored?
block-sequence uses plugable drivers to keep track of sequences. The current drivers are

1. [block-sequence-reference](https://www.npmjs.com/package/block-sequence-reference) (in-memory reference implementation, only useful for testing)
2. [block-sequence-mongo](https://www.npmjs.com/package/block-sequence-mongo)
3. [block-sequence-redis](https://www.npmjs.com/package/block-sequence-redis)
4. [block-sequence-mysql](https://www.npmjs.com/package/block-sequence-mysql)
5. [block-sequence-postgres](https://www.npmjs.com/package/block-sequence-postgres)
6. [block-sequence-foxpro](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

To add another driver please ensure it passes the block-sequence-compliance-tests


## BlockArray Configuration
```json
{
  "size": 2,
  "block": {
    "size": 100,
    "retry": {
      "limit": 1000,
      "interval": 100
    },
    "sequence": {
      "name": "job-vacancies",
      "value": 0,
      "metadata": {
        "description": "Add any properties you like to metadata",
        "system": "jbs",
        "entity": "vac",
        "environment": "l"
      }
    },
    "padding": {
      "size": 10
    },
    "template": "{{=sequence.metadata.system}}-{{=sequence.metadata.entity}}-{{=id}}-{{=sequence.metadata.environment}}"
  }
}
```
The above configuration will configure a block array containing two blocks. The blocks of 100 ids each. When the first block drains completely the array will start drawing from the second block and the first block will be recharged. The recharging process will automatically retry up to 1000 times at 100ms intervals.

The padding and [doT.js](http://olado.github.io/doT/index.html) template will cause ```blockArray.next``` to yield an id similar to ```jbs-vac-0000001234-l```

## Driver Configuration
See the specific driver readme for how to configure the drivers

## Events
BlockArray emits the following events

### Error
When a block repeatedly fails to recharge and error event is emitted.

### Blocking
The active block always queues id requests, but will usually service them immediately afterwards. When a block is exhausted the next block in the array becomes active and is used to service future id requests, allowing the original block to recharge. During recharge the block's queue is paused. If all other blocks in the array are exhausted before recharge is complete then further id requests will be queued and a 'blocking' event emitted. If you experience this try increasing the block size.

Please note: Since the blocks recharge on startup, but you can start issuing id requests immediately you may receive blocking events while the block array is initialising.






