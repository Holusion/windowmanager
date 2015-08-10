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
      console.log("inactive key : "+key);
    }
  })
  this.initDbus(callback);
  return this; //chainable with constructor
}

WindowManager.prototype.launch = function(file){
  console.log("launching :",file);
  this.launcher.start(file);
  this.hpanel.quit();
}

WindowManager.prototype.close = function(){
  console.log("closing menu panel");
  this.hpanel.quit();
  this.launcher.killChild();
}


module.exports = WindowManager;
