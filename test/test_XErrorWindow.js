'use strict';
const x11 = require('x11');

const {ErrorWindow} = require("../lib/Xutils/XErrorWindow");

describe("XErrorWindow", ()=>{
  let display, X, root, wid;
  before((done)=>{
    const client = x11.createClient(function(err,d){
      expect(err).to.be.not.ok;
      display = d;
      X = d.client;
      wid = X.AllocID();
      X.CreateWindow(wid, display.screen[0].root, 0, 0, 1, 1, 0, 0, 0, 0, 
        { eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect }
      );
      done(err);
    });
    //A race condition here that can not be traced
    //causes some test to fail randomly with ERR_STREAM_WRITE_AFTER_END
    client.on("error", (e)=> expect.fail(e));
  })
  after((done)=>{
    X.DestroyWindow(wid);
    X.ReleaseID(wid);
    X.on("end", done);
    X.terminate();
  })
  it("can destroy window", function(){
    const e = new ErrorWindow({display, parent: root});
    expect(()=>e.destroy()).not.to.throw(Error);
  });

  it("calling draw after destroy will throw an error", function(){
    const e = new ErrorWindow({display, parent: root});
    expect(()=>e.destroy()).not.to.throw(Error);
    expect(()=>e.draw()).to.throw(Error);
  });

  it("can draw text", function(){
    const e = new ErrorWindow({display, parent: root});
    expect(()=>e.draw("Hello", "hello nodejs")).not.to.throw();
  });
})