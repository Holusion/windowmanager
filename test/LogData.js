'use strict';
const {Writable: WritableStream} = require("stream");


module.exports = class LogData extends WritableStream {
  constructor({isTTY=false} ={}){
    super();
    this._buf = Buffer.alloc(0);
    this.isTTY = isTTY;
  }
  get locked(){ return false};
  getWriter(){ return undefined; /*?!*/}
  abort(){ return Promise.reject(new Error("unimplemented"))}

  _write(chunk, encoding, next){
    this._buf = Buffer.concat([
      this._buf,
      (typeof chunk == "string")?Buffer.from(chunk, encoding) : chunk,
    ]);
    next();
  }
  get contents(){
    return this._buf.toString('utf8');
  }
}
