var Manager = require('./build/Release/Manager').Manager
  , DBus = require("dbus")
  , util = require("util");

Manager.prototype.initDbus = function(){
  var self = this;
  this.bus = new DBus();
  this.session =  this.bus.getBus("session");
  this.session.getInterface('holusion.desktop.Panel', '/holusion/desktop/Panel', 'holusion.desktop.Panel.Interface1', function(err, iface) {
    if(err){
      callback();
    }else{
      self.hpanel = {
        show:function(cb){
          cb = cb||function(){};
          iface.Show['finish'] = function(result) {
             cb(result);
          };
          iface.Show();
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
  this.initDbus();
  return this; //chainable with constructor
}



module.exports = Manager;
