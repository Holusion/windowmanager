'use strict';
const path = require("path");

const {Launcher, ErrNotFound} = require("../lib/Launcher");
const ExecMock = require("./ExecMock");

const delay = (d) => new Promise((r)=> setTimeout(r,d));

describe("Launcher",function(){
  describe("start()",function(){
    let launcher;
    beforeEach(function(){
      launcher =  new Launcher();
    });

    afterEach(function(){
      launcher.close();
    })
    it("Throw an explicit error if file is null",function(){
      launcher.execDE = function(file, line, opts){
        expect.fail("Exec should not be called");
      }
      return launcher.start(null)
      .catch((e)=>{
        expect(e).to.be.instanceof(ErrNotFound);
      })
    });
    it("Throw an explicit error if file is not found",function(){
      launcher.execDE = function(file, line, opts){
        throw new Error("ENOENT");
      }
      return launcher.start("/path/to/bin")
      .catch((e)=>{
        expect(e).to.be.instanceof(Error);
        expect(e.message).to.match(/\/path\/to\/bin.*ENOENT/);
      })
    });
    it("open with desktop handler",function(done){
      launcher.execDE = function(file, line, opts){
        expect(file).to.equal("/path/to/file.txt");
        expect(line).to.equal("foo %f");
        done();
      }
      launcher.start("/path/to/file.txt")
    });
    it("supports paths with special characters",function(done){
      launcher.execDE = function(file, line, opts){
        expect(file).to.equal("/path/t o/file$.txt");
        expect(line).to.equal("foo %f");
        done();
      }
      launcher.start("/path/t o/file$.txt")
    });
    it("open as binary",function(done){
      launcher.execDE = function(file, line, opts){
        expect(file).to.equal("/path/to/file");
        expect(line).to.be.null;
        done();
      }
      launcher.start("/path/to/file")
    });
    it("open as DBus",function(done){
      launcher.execDE = function(){
        done(new Error("Exec should not be called in this case"));
      }
      launcher.openDbus = function(file, id){
        expect(file).to.equal("/path/to/file.bar");
        expect(id).to.equal("bar.desktop");
        done();
      }
      launcher.start("/path/to/file.bar");
    });
    it("open URI schemes",function(done){
      launcher.execDE = function(file, line, opts){
        expect(file).to.equal("foo:///path/to/file");
        expect(line).to.equal("foo %f");
        done();
      }
      launcher.start("foo:///path/to/file")
    });
    it("open URI schemes with dbus",function(done){
      launcher.execDE = function(){
        done(new Error("Exec should not be called in this case"));
      }
      launcher.openDbus = function(file, id){
        expect(file).to.equal("bar:///path/to/file");
        expect(id).to.equal("bar.desktop");
        done();
      }
      launcher.start("bar:///path/to/file")
    });
    it("Uses dirname as default cwd",function(done){
      launcher.start("/usr/bin/pwd");
      launcher.on("stdout",function(d){
        expect(d.toString()).to.equal("/usr/bin\n");
        done();
      })
    })
    it("accepts custom working directory",function(done){
      launcher.start("/bin/pwd", {cwd:__dirname});
      launcher.on("stdout",function(d){
        expect(d.toString()).to.equal(__dirname+"\n");
        done();
      })
    })
    it("emit an error if file doesn't exist",function(done){
      launcher.on("error", function(err){
        expect(err).to.be.instanceof(Error);
        expect(err).to.have.property("code", "ENOENT");
        done();
      })
      launcher.start("/path/to/foo.bin")
    })
  })

  describe("execDE()",function(){

    describe("mocked",function(){
      let launcher;
      beforeEach(function(){
        launcher = new Launcher();
        // @ts-ignore
        launcher._spawn = function(a,b,c){
          return new ExecMock([a,b,c]);
        }
      });
      afterEach(function(){
        launcher.close();
      })
      it("Pipe child.stdout and child.stderr",function(done){
        let msgs = 0;
        launcher.on("stdout",function(l){
          expect(l).to.equal("hello");
          msgs++;
        })
        launcher.on("stderr",function(l){
          expect(l).to.equal("world");
          msgs++;
        })
        launcher.on("end",function(){
          expect(msgs).to.equal(2);
          done()
        })
        var res = launcher.execDE("arg1", "arg2");
      });
      it("takes spawn options from 3rd arg",function(done){
        launcher._spawn = function(command,args,options){
          expect(options).to.deep.equal({env:{NODE_ENV:"development"}});
          done();
          return new ExecMock([command,args,options]);
        }
        launcher.execDE("1","sleep %f",{env:{NODE_ENV:"development"}});
      });
      it("parse arguments",function(done){
        launcher._spawn = function(command,args,options){
          expect(command).to.equal("foo")
          expect(args[0]).to.equal("/path/to something.txt");
          expect(args).to.have.property("length", 1);
          done();
          return new ExecMock([command,args,options]);
        }
        launcher.execDE("/path/to something.txt","foo %f");
      });
    });

    describe("Spawn and kill childs",function(){
      let launcher;
      beforeEach(function(){
        launcher = new Launcher();
      });
      afterEach(function(){
        launcher.close();
      })
      it("parse app launchers",function(){
        let child = launcher.execDE("1","sleep %f");
        expect(child).to.be.not.null;
        expect(process.kill(child.pid),0).to.be.true;
      });
      it("parse binary file execution",function(){
        let child = launcher.execDE(path.resolve(__dirname,"fixtures/stubFile.sh"));
        expect(child).to.be.not.null;
      });

      it("emit an error if file doesn't exist", function(done){
        launcher.on("error",function(err){
          expect(err).to.have.property("code", "ENOENT");
          done();
        })
        const child = launcher.execDE("/path/to/foo.bin");
      })
      
      it("throw an error if file can't be executed", function(done){
        launcher.on("error",function(err){
          expect(err).to.have.property("code", "EACCES");
          done();
        })
        launcher.execDE(path.resolve(__dirname,"fixtures/applications/bar.desktop"));
      })

      it("Emit end on child exit",function(done){
        launcher.on("end",function(){
          done();
        })
        launcher.execDE("0.01", "sleep %f");
      })
      it("Doesn't emit end when child is replaced",async function(){
        launcher.on("end",function(){
          expect.fail("end event should not fire for early-killed child");
        })
        for (let i=0;i <20; i++){
          launcher.execDE("2", "sleep %f");
          await delay(10);
        }
        launcher.killChild();
      })
    });
  })
})
