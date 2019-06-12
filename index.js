var util = require("util")
  , EventEmitter = require('events').EventEmitter
  , revert = require("revert-keys")
  , {manageXServer} = require('./lib/XManager')
  , {Launcher} = require("desktop-launch")

async function manageDisplay(opts={}){
  const m_options = Object.assign({}, opts); //make a copy since we want to modify options
  if(!m_options.headless){
    try{
      m_options.manager = await manageXServer();
    }catch(e){
      console.error("Failed to start as Root Window. Falling back to headless mode", e);
    }
  }
  return new WindowManager(m_options);
}

//Do not use directly, prefer its subclass with a determined "type".


class WindowManager extends EventEmitter{
  constructor({manager, shortcuts = []}){
    super();
    this.shortcuts = new Map();
    this.launcher =  new Launcher();
    this.hasChild = false;
    this.launcher.on("error",(e)=>{
      e.type = "launcher"; //keep original stack trace and add easy type information
      this.emit("error", e);
    });
    this.launcher.on("stdout",function(o){
      console.log("player stdout : "+o);
    });
    this.launcher.on("stderr",function(o){
      console.log("player stderr : "+o);
    });
    this.launcher.on("end",()=>{
      this.hasChild = false;
      if(!this.active){
        this.emit("end");
      }
    });
    this.cancelError = null;
    if(manager){
      this.manager = manager;
      this.manager.on("expose",()=>{
        if(!this.active){
          this.emit("end")
        }
      })
      this.manager.on("error",(e)=>{
        e.type = "x11"; //keep original stack trace and add easy type information
        this.emit("error", e);
      });
      if(shortcuts){
        for (const [code, action] of shortcuts){
          this.registerShortcut(code, action);
        }
      }
      this.manager.on("keydown",(e)=>{
        const action = this.shortcuts.get(e.uid);
        if(action){
          this.emit("command", action);
        }
      })
    }else{
      console.log("Running in headless mode");
    }
    
  }

  registerShortcut(code, action){
    const registered_shortcut = this.manager.registerShortcut(code);
          this.shortcuts.set(registered_shortcut.uid, action);
  }

  showError(title, text, timeout=5000){
    if(typeof this.cancelError === "function"){
      this.cancelError();
      this.cancelError = null;
    }
    if(this.manager){
      this.manager.drawError(title, text);
      this.cancelError = setTimeout(()=>{
        this.manager.unmapError();
      }, timeout);
    }
  }

  launch (file,opts){ // FIXME options are ignored right now?!
    var self = this;
    opts = (typeof opts === "object")?this.sanitizeOptions(opts):{};
    this.launcher.start(file).catch(function(e){
      console.error("WindowManager launch error : ",e);
      self.launcher.finder.find(file).then(function(entry){
        console.error("Was trying to launch : ",file,"with openner :",entry);
        self.showError("Error", e.message+" on "+file)
      })
    });
    this.hasChild = true;
  }

  sanitizeOptions (opts){
    var ret = {};
    if (opts.env){
      if(typeof opts.env === 'string'){
        try{
          ret.env = JSON.parse(opts.env);
        }catch(e){
          console.warn("Parsing environment : ",opts,"Error : ",e);
        }
      }else{
        ret.env = opts.env;
      }
    }
    if(opts.cwd){
      ret.cwd = opts.cwd;
    }
    return ret;
  }

  get active(){
    return this.hasChild && (!this.manager || this.manager.isExposed);
  }

  end (){
    this.launcher.killChild();
  }

  // Like this.end() but force shows the background image
  // No longer required once this.end() will handle focus properly
  expose (){
    this.launcher.killChild();
    if(this.manager) this.manager.focus();
  }

  //Fully close the window manager
  close (){
    this.launcher.close();
    if(this.manager) this.manager.exit(); //Closing background window.
  }
}


module.exports = {manageDisplay, WindowManager};
