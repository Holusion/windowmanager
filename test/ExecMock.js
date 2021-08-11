'use strict';
const EventEmitter = require("events").EventEmitter;

class FakeStream extends EventEmitter{
  setEncoding(){}
}

class ExecMock extends EventEmitter{
  constructor(args){
    super();
    this.stdout = new FakeStream();
    this.stderr = new FakeStream();
    process.nextTick(()=>{
      this.stdout.emit("data","hello");
      this.stderr.emit("data","world");
      process.nextTick(this.emit.bind(this,"exit",args));
    })
  }

}
module.exports = ExecMock;
