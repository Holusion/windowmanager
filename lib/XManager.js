var util = require("util")
  , EventEmitter = require('events').EventEmitter
  , x11 = require('x11')
  , pixmapReader = require("xpixmap")
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
    self.createBackground();
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
            self.X.RaiseWindow(self.bg);
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
  var wid = this.X.AllocID();
  var gc = this.X.AllocID();
  var xpm = new pixmapReader();
  this.bg = wid;
  self.X.GetGeometry(self.root, function(err, clientGeom) {
    if(err){
      return console.error("cannot get root window geometry : ",err);
    }
    self. X.require('render', function(error, Render) {
      if(error){
        return console.error("cannot get render context : ",err);
      }
      self.X.CreateWindow(wid,self.root, 0, 0, clientGeom.width, clientGeom.height, 0, 0, 0, 0,
      {
        overrideRedirect:true,
        eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect|x11.eventMask.KeyPress
      });
      xpm.open(__dirname+"/../data/logo.xpm",function(err,logo){
        if(err){
          return console.error("cannot load background image file : ",err);
        }
        var logoPixmap = self.X.AllocID();
        var logoPicture = self.X.AllocID();
        var winPicture = self.X.AllocID();
        var ee = new EventEmitter();
        self.X.event_consumers[wid] = ee;
        ee.on('event', function(ev) {
          if(ev.type == 12){
            self.X.MapWindow(self.bg);
            Render.Composite(3, logoPicture, 0, winPicture, 0, 0, 0, 0, 0, 0, logo.width, logo.height);
          }
        });
        self.X.CreateGC(gc, wid);
        self.X.CreatePixmap(logoPixmap, wid, 24, logo.width, logo.height);
        self.X.PutImage(2, logoPixmap, gc, logo.width, logo.height, 0, 0, 0, 24, logo.data);
        Render.CreatePicture(logoPicture, logoPixmap, Render.rgb24);
        Render.CreatePicture(winPicture, wid, Render.rgb24);
        self.X.MapWindow(wid);
      });
    });
  });

};
XManager.prototype.readPNG = function (imagePath) {

};
module.exports = XManager;
