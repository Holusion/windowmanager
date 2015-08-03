var util = require("util")
  , EventEmitter = require('events').EventEmitter
  , x11 = require('x11')
  , XKeyboard = require("./XKeyboard");

/**
 * init to manage root window. Then it will emit events on KeyPress.
 */
function XManager (){
  this.display = this.X = this.root, this.keyboard = null;
  this.frames = [];
}
util.inherits(XManager,EventEmitter);

XManager.prototype.init = function () {
  var self = this;
  x11.createClient(function(err,display){
    self.display = display;
    self.X = display.client;
    self.root = display.screen[0].root;
    self.keyboard = new XKeyboard(display);
    self.X.ChangeWindowAttributes(self.root, { eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect|x11.eventMask.KeyPress }, function(err) {
        if(err.error == 10){
          console.error("Another window manager is already running");
        }else if(err){
          console.log("Error : ",err,"instanciating window manager");
        }else{
          self.X.QueryTree(root, function(err, tree) {
            var manage = self.manage.bind(self);
            tree.children.forEach(function(child){
              self.manage(child);
            });
          });
        }
    });

  }).on('error', function(err) {
      console.warn("WindowManager : ",err);
  }).on('event', function(ev) {
      var  modifiers
        , key
        , matches;
      //console.log("root_win event",ev.name);
      if(ev.name == "KeyPress"){
        var key = self.keyboard.getKey(ev);
        if(key){
          self.emit("KeyPress",key);
        }
      }else if(ev.name == "KeyRelease"){
        //KeyRelease if fired Once before KeyPress and multiple times when making a long press. Otherwise similar to KeyPress
      }else if (ev.type === 20) { // MapRequest
          if (!self.frames[ev.wid])
              self.manage(ev.wid);
          return;
      } else if (ev.type === 23){ // ConfigureRequest
          self.X.ResizeWindow(ev.wid, ev.width, ev.height);
      } else if (ev.type === 12) { // Exposure
      }
  });
};

XManager.prototype.manage = function (wid){
  var self = this;
  this.frames[wid] = 1;
  this.X.GetWindowAttributes(wid, function(err, attrs) {
    if (attrs[8]){ // override-redirect flag
      // don't manage
      console.log("don't manage : " + wid);
      self.X.MapWindow(wid);
      return;
    }else{
      console.log("MANAGE WINDOW: " + wid);
    }
    self.X.GrabServer();
    self.X.ChangeSaveSet(0, wid);
    self.X.ReparentWindow(wid, self.root, 0, 0);
    self.X.MapWindow(wid);
    self.X.UngrabServer();
  });
}

module.exports = XManager;
