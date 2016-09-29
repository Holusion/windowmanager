var util = require("util")
  , EventEmitter = require('events').EventEmitter
  , revert = require("revert-keys")
  , XManager = require('./lib/XManager')
  , Launcher = require("desktop-launch")
  , MenuInterface = require("./lib/MenuInterface")
  , actions = require("./data/shortcuts.json").records
  , shortcuts = revert(actions);



function WindowManager (){
  this.xmaster = new XManager();
  this.hpanel= new MenuInterface();
  this.launcher = new Launcher();
  this.launcher.on("error",function(e){
    console.error("Launcher Error : ",e);
  });
  this.launcher.on("stdout",function(o){
    console.log("player stdout : "+o);
  });
  this.launcher.on("stderr",function(o){
    console.log("player stderr : "+o);
  });
}
util.inherits(WindowManager,EventEmitter);
WindowManager.prototype.initDbus = function(callback){
  callback = callback || function(){};
  var self = this;
  this.hpanel.init();
  this.hpanel.iface.catch(callback).then(function(iface){callback(null)});
}

WindowManager.prototype.init = function(callback){
  var self = this;
  this.xmaster.init();
  this.xmaster.on("KeyPress",function(key){
    if(shortcuts[key]){
      self.emit("command",shortcuts[key]);
    }else{
      //console.log("inactive key : "+key);
    }
  })
  this.hasChild = false;
  this.xmaster.on("expose",function(){
    if(!self.hasChild){
      self.emit("end")
    }
    self.hasChild = false;
  })
  this.launcher.on("end",function(){
    if(!self.hasChild){
      self.emit("end")
    }
    self.hasChild = false;
  })
  this.initDbus(callback);
  return this; //chainable with constructor
}

WindowManager.prototype.launch = function(file,opts){
  var self = this;
  opts = (typeof opts === "object")?this.sanitizeOptions(opts):{};
  this.hpanel.quit();
  this.launcher.start(file).catch(function(e){
    console.error("WindowManager launch error : ",e);
    this.launcher.finder.find(file).then(function(entry){
      console.error("Was trying to launch : ",file,"with openner :",entry);
    })
  });
  this.hasChild = true;
}
WindowManager.prototype.sanitizeOptions = function(opts){
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
WindowManager.prototype.expose = function(){
  this.launcher.killChild();
  this.xmaster.focus();
}
WindowManager.prototype.open = function(folder){
  this.launcher.killChild();
  this.hpanel.open(folder);
}

WindowManager.prototype.close = function(){
  console.log("closing menu panel");
  this.hpanel.quit();
  this.launcher.killChild();
  this.xmaster.exit(); //Closing background window.
}


module.exports = WindowManager;
