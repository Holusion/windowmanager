var Manager = require('./build/Release/Manager').Manager
  , DBus = require("dbus")
  , util = require("util");

Manager.prototype.init = function(callback){
  var self = this;
  this.manage(); //c++ addon init
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
          iface.Hide['finish'] = function(result) {
             cb(result);
          };
          iface.Hide();
        },
        quit:function(cb){
          iface.Exit['finish'] = function(result) {
             cb(result);
          };
          iface.Exit();
        }
      }
    }
    callback(err);
  });
  return this; //chainable with constructor
}



/*
var dbuscli = new DBus();
var bus = dbuscli.getBus('session');

bus.getInterface('holusion.desktop.Panel', '/holusion/desktop/Panel', 'holusion.desktop.Panel.Interface1', function(err, iface) {
    if(err){
      return console.log(err);
    }
    iface.Show();
    setTimeout(function(){
      console.log("hidding")
      iface.Hide();
      //iface.Show();
    },6000);
    process.on("SIGINT",function(){
      console.log("exiting");
      iface.Exit['finish'] = function(result) {
    	   process.exit();
    	};
      iface.Exit();

    })
});
*/
module.exports = Manager;
