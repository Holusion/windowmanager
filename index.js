var XManager = require('./lib/XManager')
  , MenuInterface = require("./lib/MenuInterface")
  , util = require("util")
  , EventEmitter = require('events').EventEmitter;

function WindowManager (){
  this.xmaster = new XManager();
  this.hpanel= new MenuInterface();
}
util.inherits(WindowManager,EventEmitter);
WindowManager.prototype.initDbus = function(callback){
  callback = callback || function(){};
  var self = this;
  this.hpanel.init();
  this.hpanel.iface.catch(callback).then(function(iface){callback(null)});
}

WindowManager.prototype.init = function(callback){

  this.xmaster.init(); //c++ addon init
  this.initDbus(callback);
  return this; //chainable with constructor
}
WindowManager.prototype.close = function(){
  console.log("closing menu panel")
  //this.hpanel.quit();
}


module.exports = WindowManager;
