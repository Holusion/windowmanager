'use strict';
/* example from : https://github.com/sidorares/node-x11/blob/master/examples/windowmanager/wm.js
   Base on : https://github.com/dominictarr/tiles
 */
var util = require("util")
  , EventEmitter = require('events').EventEmitter
  , x11 = require('x11')
  , loadXpm = require("./Xutils/loadXpm")
  , XKeyboard = require("./Xutils/XKeyboard")
  , XBackground = require("./Xutils/XBackground");

/**
 * init to manage root window. Then it will emit events on KeyPress.
 */
class XManager extends EventEmitter{
  constructor(){
    super();
    this.display = this.X = this.root, this.keyboard = null;
    this.frames = {};
  }
  get isExposed(){ //Always return true if no display
    return !this.isActive || (0 == Object.keys(this.frames).length);
  }
	get isActive(){
		return  typeof this.display !== "undefined";
	}

  init(callback) { //callback is optionnal
    var self = this;    
    callback = (typeof callback == "function")? callback: function(err){
      console.warn("Failed to init window manager : ",err);
    }
		this.client = x11.createClient(function(err,display){
      if(err){
        //Errors are critical here. If we can't create a client, we're in no-screen mode
        return callback(err);
      } //Later, we'll check if this.display has been set to see if XManager is active
      self.display = display;
      self.X = display.client;
      
      var rid = display.screen[0].root;
      
      self.keyboard = new XKeyboard(display);
      self.X.ChangeWindowAttributes(rid, { eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect|x11.eventMask.DestroyNotify }, function(err) {
        if(err.error == 10){
          console.warn("Another window manager is already running");
          err = null ; //Hide error
          // self.createBackground();
        }else if(err){
          return callback("Error : ",err,"instanciating window manager");
        }
        callback(err);
      });
      self.root = self.createFakeRoot(display);
      self.createBackground();
      // Manage all existing windows
      self.X.QueryTree(self.root, function(err, tree) {
        var manage = self.manage.bind(self);
        tree.children.forEach(manage);
      });
  }).on('error', function(err) {
    console.warn("WindowManager : ",err);
    if(process.env["NODE_ENV"] == "development"){
      throw err;
    }
  }).on('event', function(ev) {
    // console.log(self.frames, ev.wid);
      switch(ev.type){
        case 12: //Exposure

          break;
        case 17: //DestroyNotify
          console.log("received a destroyNotify for : ",ev.wid);
          self.X.DestroyWindow(self.frames[ev.wid]); //destroy top level window container.
          
          delete self.frames[ev.wid];
          if(Object.keys(self.frames).length ==0){
            self.emit("expose",ev);
          }else{
            console.log("still managing frames : ",self.frames,self.bg.win);
          }
          break;
        case 18: //MappingNotify
            break;
        case 19: //MapNotify
          break;
        case 20: //MapRequest
          if (!self.frames[ev.wid]){
            self.manage(ev.wid);
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
  }
  createFakeRoot(display){
    var wid = this.X.AllocID();
    //Create a window that'll act as root window in case we didn't manage to acquire it.
    var self = this;
    self.X.GrabServer();
    self.X.CreateWindow(wid, display.screen[0].root, 0, 0, display.screen[0].pixel_width, display.screen[0].pixel_height, 0, 0, 0, 0,{
        eventMask: x11.eventMask.Exposure
    });
    self.X.MapWindow(wid);
    self.X.UngrabServer();
    return wid;
  }
  manage(wid){
    var self = this;
    
    self.X.GetWindowAttributes(wid, function(err, attrs) {
      if (attrs[8]){ // override-redirect flag
        // don't manage
        console.log("don't manage : " + wid);
        self.X.MapWindow(wid);
        return;
      }
      var fid = self.X.AllocID();
      self.frames[wid] = fid;
      // self.X.ChangeWindowAttributes(wid, {eventMask:attrs.myEventMasks|x11.eventMask.KeyRelease|x11.eventMask.KeyPress }, function(err) {});
      //Don't override window position
      self.X.GetGeometry(wid, function(err, clientGeom) {
        
        
        self.X.CreateWindow(fid, self.root, clientGeom.xPos, clientGeom.yPos, clientGeom.width, clientGeom.height, 0, 0, 0, 0,
          {
            eventMask: x11.eventMask.DestroyNotify|x11.eventMask.ButtonMotion|x11.eventMask.ButtonPress|x11.eventMask.SubstructureNotify| x11.eventMask.SubstructureRedirect| x11.eventMask.Exposure
          });
          self.X.GrabServer();
          if(self.bg && self.bg.focus && self.bg.win){
            self.X.UnmapWindow(self.bg.win);
            self.bg.focus = false;
          }
          var ee = new EventEmitter();
          self.X.event_consumers[fid] = ee;
          ee.on('event', function(ev) {            
            if (ev.type === 17) // DestroyNotify
            {
              console.log("destroy : ",fid);
              self.X.DestroyWindow(fid);
              delete self.frames[fid];
            }
          });
        
        self.X.ReparentWindow(wid, fid, 0, 0);
        self.X.MapWindow(fid);
        self.X.MapWindow(wid);
        self.X.SetInputFocus(wid, 1);
        self.X.RaiseWindow(wid);
        self.X.UngrabServer();
      });
    });
  }

  focus(){
    if (!this.isActive) return;
    if(this.bg){
      this.bg.focus = true;
      this.X.MapWindow(this.bg.win);
      this.X.SetInputFocus(this.bg.win,1);
      this.X.RaiseWindow(this.bg.win);
    }

  }
  createBackground () {
    var self = this;
    var wid = this.X.AllocID();
    self.X.GetGeometry(self.root, function(err, clientGeom) {
      if(err){
        return console.error("cannot get root window geometry : ",err);
      }
      self.X.require('render', function(error, Render) {
        if(error){
          return console.error("cannot get render context : ",err);
        }
        console.log(clientGeom.xPos, clientGeom.yPos, clientGeom.width, clientGeom.height);
        self.X.CreateWindow(wid,self.root, 0, 0, clientGeom.width, clientGeom.height, 0, 0, 0, 0,
        {
          overrideRedirect:true,
          eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect|x11.eventMask.KeyPress
        });
        loadXpm(__dirname+"/../data/logo.xpm").then(function(logo){
          console.log("Background found !!!!!");
          self.bg = new XBackground(logo, wid, clientGeom, self.X, Render);
        }).catch(function(e){console.error("cannot load background XPM : ",e)});
      });
    });
  }

  exit (){
    if(this.bg && this.bg.win){
       this.X.DestroyWindow(this.bg.win);
       this.bg = null;
    }
  }
}
module.exports = XManager;
