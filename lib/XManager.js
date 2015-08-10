var util = require("util")
  , EventEmitter = require('events').EventEmitter
  , x11 = require('x11')
  , XKeyboard = require("./XKeyboard");

/**
 * init to manage root window. Then it will emit events on KeyPress.
 */
function XManager (){
  this.display = this.X = this.root, this.keyboard = null;
  this.frames = {};
}
util.inherits(XManager,EventEmitter);

XManager.prototype.init = function () {
  var self = this;
  x11.createClient(function(err,display){
    self.display = display;
    self.X = display.client;
    self.root = display.screen[0].root;
    self.keyboard = new XKeyboard(display);
    self.createBackground();
    self.X.ChangeWindowAttributes(self.root, { eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect|x11.eventMask.KeyRelease|x11.eventMask.KeyPress }, function(err) {
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
      switch(ev.type){
        case 2: //KeyPress
          var key = self.keyboard.getKey(ev);
          if(key){
            self.emit("KeyPress",key);
          }else{
            console.log("unknown key for event : ",ev);
          }
          break;
        case 3:
          //KeyRelease
          break;
        case 12: //Exposure
          //console.log('EXPOSE', ev);
          break;
        case 17: //DestroyNotify
          console.log("received a destroyNotify : ",ev.wid);
          self.X.DestroyWindow(self.frames[ev.wid]); //destroy top level window container.
          delete self.frames[ev.wid];
          if(Object.keys(self.frames).length ==0 && self.bg){
            console.log("set focus");
            self.X.SetInputFocus(self.bg,1);
          }
          break;
        case 18: //MappingNotify
            break;
        case 19: //MapNotify
          break;
        case 20: //MapRequest
          if (!self.frames[ev.wid]){
            self.manage(ev.wid);
          }else{
            self.X.MapWindow(ev.wid);
            console.log("already managing : ",ev.wid);
          }
          break;
        case 23: //ConfigureRequest
          self.X.ResizeWindow(ev.wid, ev.width, ev.height);
          break;
        case 34: //MappingNotify
          break;
        default:
          //console.log("root_win event",ev);
      }
  });
};

XManager.prototype.manage = function (wid){
  var self = this;
  var fid = this.X.AllocID();
  this.frames[wid] = fid;
  this.X.GetGeometry(wid, function(err, clientGeom) {
    self.X.GetWindowAttributes(wid, function(err, attrs) {
      if (attrs[8]){ // override-redirect flag
        // don't manage
        console.log("don't manage : " + wid);
        self.X.MapWindow(wid);
        return;
      }
      //console.log("attrs",attrs);
      self.X.GrabServer();
      self.X.ChangeWindowAttributes(wid, {
      eventMask:attrs.myEventMasks|x11.eventMask.KeyRelease|x11.eventMask.KeyPress }, function(err) {});
      self.X.CreateWindow(fid, self.root, 0, 0, clientGeom.width, clientGeom.height, 0, 0, 0, 0,
      {
        eventMask: x11.eventMask.DestroyNotify|x11.eventMask.KeyRelease|x11.eventMask.KeyPress| x11.eventMask.SubstructureNotify| x11.eventMask.SubstructureRedirect| x11.eventMask.Exposure
      });
      self.X.ChangeSaveSet(0, wid);
      self.X.ReparentWindow(wid, fid, 0, 0);
      self.X.MapWindow(fid);
      self.X.MapWindow(wid);
      self.X.UngrabServer();
      var ee = new EventEmitter();
      self.X.event_consumers[fid] = ee;
      ee.on('event', function(ev) {
        if (ev.type === 17) // DestroyNotify
        {
          console.log("destroy : ",fid);
           self.X.DestroyWindow(fid);
        }
      });
    });
  });
}

XManager.prototype.createBackground = function () {
  var self = this;
  var black = this.display.screen[0].black_pixel;
  var white = this.display.screen[0].white_pixel;
  var wid = this.X.AllocID();
  this.bg = wid;
  self.X.GetGeometry(self.root, function(err, clientGeom) {
    self.X.CreateWindow(wid,self.root, 0, 0, clientGeom.width, clientGeom.height, 0, 0, 0, 0,
    {
      overrideRedirect:true,
      backgroundPixel: black,
      eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect
    });
    var ee = new EventEmitter();
    self.X.event_consumers[wid] = ee;
    ee.on('event', function(ev) {
      if(ev.type == 12){
        console.log("Expose event on background");
        self.X.MapWindow(self.bg);
      }
    });
    self.X.MapWindow(wid);
  });

};

module.exports = XManager;
