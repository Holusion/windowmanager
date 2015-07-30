var Manager = require('./build/Release/Manager').Manager
  , MenuInterface = require("./MenuInterface")
  , util = require("util");

Manager.prototype.initDbus = function(callback){
  callback = callback || function(){};
  var self = this;
  var menu = new MenuInterface(true);
  this.hpanel = menu;
  menu.iface.catch(callback).then(function(iface){callback(null)});
}


Manager.prototype.init = function(callback){
  this.manage(); //c++ addon init
  this.initDbus(callback);
  return this; //chainable with constructor
}
Manager.prototype.close = function(){
  console.log("closing menu panel")
  //this.hpanel.quit();
}


module.exports = Manager;
