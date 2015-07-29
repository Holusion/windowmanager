var Manager = require('./build/Release/Manager').Manager
  , DBus = require("dbus")
  , util = require("util");

Manager.prototype.initDbus = function(callback){
  callback = callback || function(){};
  var self = this;
  this.bus = new DBus();
  this.session =  this.bus.getBus("session");
  this.session.getInterface('holusion.desktop.Panel', '/holusion/desktop/Panel', 'holusion.desktop.Panel.Interface1', function(err, iface) {
    if(err){
      callback();
    }else{
      self.hpanel = {
        open:function(path,cb){
          cb = cb||function(){};
          iface.Open['finish'] = function(result) {
             cb(result);
          };
          console.log("showing interface");
          iface.Open([path]);
        },
        hide:function(cb){
          cb = cb||function(){};
          iface.Hide['finish'] = function(result) {
             cb(result);
          };
          iface.Hide();
        },
        quit:function(cb){
          cb = cb||function(){};
          iface.Exit['finish'] = function(result) {
             cb(result);
          };
          iface.Exit();
        }
      }
    }
    callback(err);
  });
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
