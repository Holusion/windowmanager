'use strict';


const {WindowManager} = require("..");
const { expect } = require("chai");

describe("WindowManager", function(){
  let wm;
  beforeEach(()=>{
    wm = new WindowManager();
  })

  it("properly initializes", function(){
    expect(wm.active).to.be.false;
  })

  describe("spawn()", function(){
    it("handles simple case", function(done){
      wm.launcher.spawn = (file, args, opts)=>{
        expect(file).to.equal("/bin/sleep");
        expect(args).to.deep.equal([1]);
        expect(opts).to.be.not.ok;
        done();
      }
      wm.spawn("/bin/sleep", [1]);
    })
    it("Will parse arguments given as a string", function(done){
      wm.launcher.spawn = (file, args, opts)=>{
        expect(file).to.equal("/bin/echo");
        expect(args).to.deep.equal(["-n", "Hello"]);
        expect(opts).to.be.not.ok;
        done();
      }
      wm.spawn("/bin/echo", "-n Hello");
    })
  })
})