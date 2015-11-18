var path = require("path")
  , dbus = require("dbus-native")
  , spawn = require("child_process").spawn;


/**
 * MenuInterface class. open and close the menu window. Must not depend on wether it's called through dbus or through command line.
 * init can be called on construction or delayed.
 */
function MenuInterface(init){
  var self = this;
  this.bus = "com.holusion.desktop";
  this.path = "/com/holusion/desktop";
  this.interface = "com.holusion.desktop.Interface1";
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
      self.getCliInterface(function(err,iface){
        if(!err && iface){
          resolve(iface);
        }else{
          reject(err);
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
  this.iface.then(function(iface){
    iface.close(callback);
  });
};

/**
 * Exit menu. Must not call any async method.
 */
MenuInterface.prototype.quit = function(callback){
  this.iface.then(function(iface){
    iface.quit(callback);
  });
}
/**
 * If successfull create an object with open,close,quit methods.
 * @param  {Function} callback(err,iface)
 */
MenuInterface.prototype.getDbusInterface = function (callback) {
  var session =  dbus.sessionBus();
  var service = session.getService(this.bus);
  service.getInterface(this.path, this.interface,callback);
};
/*
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
    console.log("dbus-quit")
    cb = cb||function(){};
    iface.Exit['finish'] = function(result) {
       cb(result);
    };
    iface.Exit();
  }

 */
MenuInterface.prototype.getCliInterface = function (callback) {
  var self = this;
  var child_process = null;
  var which = spawn("which",[this.executableName]);
  var absPath = "";
  which.stdout.on("data",function(d){
    absPath +=d;
  });
  which.on("close",function(e){
    if(e){
      return callback(self.executableName+" executable not found");
    }
    return callback(null,{
      open:function(path,cb){
        console.log("opening panel")
        if(child_process ){
          return cb("child already running");
        }
        child_process = spawn(self.executableName,["--","--target="+path], {stdio:"inherit",detached:true});//Make child create it's own group
        child_process.on("exit",function(code){
          console.log("child process exitted");
          child_process = null;
        });
        console.log("PID : ",child_process.pid)
        cb(null);
      },
      close:function(cb){
        console.log("closing")
        this.quit(cb);
      },
      quit:function(cb){
        cb = cb||function(){};
        if(child_process){
          child_process.on("exit",function(code,signal){
            cb(null);
          });
          process.kill(-child_process.pid);
        }else{
          cb(null);
        }
      }
    })

  })
};
module.exports = MenuInterface;
