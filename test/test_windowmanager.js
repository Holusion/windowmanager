'use strict';
const os = require("os");
const path = require("path");
const {promises: fs} = require('fs');

const {WindowManager} = require("..");
const { expect } = require("chai");
const { once } = require("events");
const Logger = require("@holusion/logger");

const LogData = require("./LogData");


describe("WindowManager", function(){

  this.beforeEach(function(){
    this.stdout = new LogData();
    //@ts-ignore
    this.logger = new Logger({stdout: this.stdout });
    //@ts-ignore
    this.wm = new WindowManager(undefined, {logger:this.logger});
  });
  this.afterEach(function(){
    this.wm.close();
  })

  it("properly initializes", function(){
    expect(this.wm.active).to.be.false;
  })

  describe("spawn()", function(){
    it("handles simple case", function(done){
      this.wm.launcher.spawn = (file, args, opts)=>{
        expect(file).to.equal("/bin/sleep");
        expect(args).to.deep.equal([1]);
        expect(opts).to.be.not.ok;
        done();
      }
      this.wm.spawn("/bin/sleep", [1]);
    })
    it("Will parse arguments given as a string", function(done){
      this.wm.launcher.spawn = (file, args, opts)=>{
        expect(file).to.equal("/bin/echo");
        expect(args).to.deep.equal(["-n", "Hello"]);
        expect(opts).to.be.not.ok;
        done();
      }
      this.wm.spawn("/bin/echo", "-n Hello");
    });
  });
  describe("launch()", function(){
    this.beforeEach(async function(){
      this.dir = await fs.mkdtemp(path.join(os.tmpdir(), "windowmanager-tests-"));
    });
    this.afterEach(async function(){
      await fs.rm(this.dir, {recursive: true, force: true});
    });

    it("starts a script file", async function (){
      const filepath = path.join(this.dir,"exec");
      await fs.writeFile(filepath, 
        [
          "#!/bin/sh",
          'echo "Hello world"',
          ""
        ].join("\n"),
        {encoding: "utf-8"}
      );
      await fs.chmod(filepath, 0o755);
      this.wm.launch(filepath);
      let stdout = "";
      this.wm.on("stdout", (s)=> stdout += s);
      await expect(Promise.race([
        once(this.wm, "error"),
        once(this.wm, "end")
      ])).to.be.fulfilled;
      expect(stdout).to.equal("Hello world\n");
    });
    describe("tries to start a bad file", function(){
      this.beforeEach(async function(){
        this.filepath = path.resolve(this.dir, "video.sh")
        await fs.copyFile(
          path.resolve(__dirname, "fixtures/video.mp4"),
          this.filepath, //ahah!
        );
        await fs.chmod(this.filepath, 0o755);
      })
      it("in a shell", async function(){
        this.wm.launch(this.filepath, {shell: true});
        let stderr = "";
        this.wm.on("stderr", (s)=> stderr += s);
        await expect(Promise.race([
          once(this.wm, "error"),
          once(this.wm, "end")
        ])).to.be.fulfilled;
        expect(stderr).to.match(/Exec format error/);
      });
      it("without a shell", async function(){
        this.wm.launch(this.filepath);
        let stderr = "";
        this.wm.on("stderr", (s)=> stderr += s);
        await expect(Promise.race([
          once(this.wm, "error"),
          once(this.wm, "end")
        ])).to.be.fulfilled;
        expect(stderr).to.match(/Unterminated quoted string/);
      });
    });
  });
});
