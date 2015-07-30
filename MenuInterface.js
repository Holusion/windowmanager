var DBus = require("dbus")
  , spawn = require("child_process").spawn
  , Promise = require('es6-promise').Promise;


/**
 * MenuInterface class. open and close the menu window. Must not depend on wether it's called through dbus or through command line.
 * init can be called on construction or delayed.
 */
function MenuInterface(init){
  var self = this;
  this.bus = "com.holusion.desktop";
  this.path = "/com/holusion/desktop";
  this.panelInterface = "com.holusion.desktop.Interface1";
  this.executableName = "hpanel";
  if(init){
    this.init();
  }
}
/**
 * Init method. Can be called multiple times
 */
MenuInterface.prototype.init = function () {
  var self = this;
  if(!this.iface){
    this.iface = new Promise(function(resolve,reject){
      self.getDbusInterface(function(err,iface){
        if(!err && iface){
          resolve(iface);
        }else{
          self.getCliInterface(function(err2,iface){
            if(!err2 && iface){
              resolve(iface);
            }else{
              reject(err+" & "+err2);
            }
          });
        }
      });
    });
  }

};
MenuInterface.prototype.open = function (file,callback){
  this.iface.catch(function(e){callback(e)}).then(function(iface){
    iface.open(file,callback);
  })
}
MenuInterface.prototype.close = function (callback) {
  this.iface.catch(function(e){callback(e)}).then(function(iface){
    iface.close(callback);
  });
};

/**
 * Exit menu. Must not call any async method.
 */
MenuInterface.prototype.quit = function(){
  this.iface.catch(function(e){callback(e)}).then(function(iface){
    iface.quit(callback);
  })
}
/**
 * If successfull create an object with open,close,quit methods.
 * @param  {Function} callback(err,iface)
 */
MenuInterface.prototype.getDbusInterface = function (callback) {
  var bus = new DBus();
  var session =  bus.getBus("session");
  session.getInterface(this.bus, this.path, this.interface,function(err,iface){
    if(err || !iface){
      return callback(err,iface);
    }
    return callback(null,{
      open:function(path,cb){
        console.log("open dbus")
        cb = cb||function(){};
        iface.Open['finish'] = function(result) {
           cb(result);
        };
        iface.Open([path]);
      },
      close:function(cb){
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
    })
  });
};

MenuInterface.prototype.getCliInterface = function (callback) {
  var self = this;
  var which = spawn("which",[this.executableName]);
  var absPath = "";
  which.on("close",function(e){
    if(e){
      return callback(self.executableName+" executable not found");
    }
    return callback(null,{
      open:function(path,cb){
        console.log("open spawn")
        self.child_process = spawn(self.executableName,["--show ",path], {stdio:"inherit"});
        self.child_process.on("exit",function(code){
          self.child_process = null;
        });
        cb(null);
      },
      close:function(cb){
        this.quit(cb);
      },
      quit:function(cb){
        if(self.child_process){
          self.child_process.on("exit",function(code,signal){
            cb(null);
          });
          self.child_process.kill();
        }else{
          cb(null);
        }
      }
    })

  })
};
module.exports = MenuInterface;
