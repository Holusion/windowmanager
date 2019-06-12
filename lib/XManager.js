'use strict';
/* example from : https://github.com/sidorares/node-x11/blob/master/examples/windowmanager/wm.js
   Base on : https://github.com/dominictarr/tiles
 */
const util = require("util")
  , EventEmitter = require('events').EventEmitter
  , x11 = require('x11')
  , loadXpm = require("./Xutils/loadXpm")
  , XBackground = require("./Xutils/XBackground")
  , {getKeyMaps, parseEvent, parseShortcut, getFromCode} = require("./Xutils/XKeyboard")
  , {ErrorWindow} = require("./Xutils/XErrorWindow");



function manageXServer(){
  return new Promise(function(resolve, reject){
    x11.createClient(function(err,display){
      if(err) return reject(err);
      const X = display.client;
      console.log("Got display");
      display.client.require('render', function(err, Render) {
        if(err) reject(err);
        display.Render = Render;
        getKeyMaps(display,function(err){
          if(err) reject(err);
          resolve(new XManager(display));
        })
      })
    })
  })
}
/**
 * init to manage root window. Then it will emit events on KeyPress.
 */
class XManager extends EventEmitter{
  constructor(display){
    super();
    this.display = display;
    this.root = this.createRootContainer(display);
    this.X.QueryTree(this.root, (err, tree)=> {
      var manage = this.manage.bind(this);
      tree.children.forEach(manage);
    })
    this.createBackground();
    console.log("Screen size : ",display.screen[0].pixel_width, display.screen[0].pixel_height);
    this.error_window = new ErrorWindow({display,parent:this.root, x:display.screen[0].pixel_width-405, y: 5});
    this.frames = {};
    const rid = display.screen[0].root;
    this.X.ChangeWindowAttributes(rid, { eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect|x11.eventMask.DestroyNotify }, (err)=> {
      console.log("Got window attributes");
      if(err.error == 10){
        this.emit("error", new Error("Another window manager is already running"));
      }else if(err){
        this.emit("error",new Error("Error : "+err+"instanciating window manager"));
      }
      getKeyMaps(display,function(err){
        if(err) reject(err);
        resolve(new XManager(display));
      })
    })
    this.X.on('error', function(err) {
      console.warn("WindowManager : ",err);
      if(process.env["NODE_ENV"] == "development"){
        throw err;
      }
    }).on('event', (ev)=> {
      // console.log(self.frames, ev.wid);
      switch(ev.type){
        case 2:
          try{
            this.emit("keydown",parseEvent(ev));
          }catch(err){
            this.emit("error",err);
          }
          break;
        case 4: //KeyRelease
        case 12: //Exposure

          break;
        case 17: //DestroyNotify
          if(typeof this.frames[ev.wid] == "undefined"){
            console.log("frame", ev.wid, "was not managed");
            return;
          }
          console.log("received a destroyNotify for : ",ev.wid);
          this.X.DestroyWindow(this.frames[ev.wid]); //destroy top level window container.
          
          
          delete this.frames[ev.wid];
          if(Object.keys(this.frames).length ==0){
            this.emit("expose",ev);
          }else{
            console.log("still managing frames : ",this.frames,this.bg.win);
          }
          break;
        case 18: //MappingNotify
            break;
        case 19: //MapNotify
          break;
        case 20: //MapRequest
          if (!this.frames[ev.wid]){
            this.manage(ev.wid);
          }
          break;
        case 23: //ConfigureRequest
          this.X.ResizeWindow(ev.wid, ev.width, ev.height);
          break;
        case 34: //MappingNotify
          break;
        default:
          //console.log("root_win event",ev);
      }
    });
  }
  
  get X(){
    return this.display.client;
  }
  get isExposed(){ //Always return true if no display
    return !this.isActive || (0 == Object.keys(this.frames).length);
  }
	get isActive(){
		return  typeof this.display !== "undefined";
	}



  registerShortcut(full_shortcut){
    const shortcut = parseShortcut(full_shortcut);
    if(!shortcut){
      throw new Error("No keys found for shortcut : "+ full_shortcut);
    }else if(!shortcut.keycode){
      throw new Error("Key "+shortctut?shortcut.names[0]:full_shortcut+" has no registered keycode in current keymap");
    }else{
      // Grab the key with each combination of capslock(2), numlock(16) and scrollock (128)
      //console.log("Register shortcut : ", shortcut);
      [0,2,16,18,128,130,144,146].forEach((base_mod)=>{
        this.X.GrabKey(this.display.screen[0].root, 0, base_mod | shortcut.modifiers , shortcut.keycode, 1, 1);
      })
    }
    return shortcut;
  }

  createRootContainer(display){
    var wid = this.X.AllocID();
    //Create a window that'll act as root window in case we didn't manage to acquire it.
    this.X.GrabServer();
    this.X.CreateWindow(wid, display.screen[0].root, 0, 0, display.screen[0].pixel_width, display.screen[0].pixel_height, 0, 0, 0, 0,{
        eventMask: x11.eventMask.Exposure|x11.eventMask.KeyPress
    });
    this.X.MapWindow(wid);
    this.X.UngrabServer();
    return wid;
  }
  unmapError(){
    this.error_window.unmap();
  }
  drawError(title, text){
    this.error_window.draw(title, text);
  }

  manage(wid){
    var self = this;
    this.X.GetWindowAttributes(wid, function(err, attrs) {
      if (attrs[8]){ // override-redirect flag
        // don't manage
        console.log("don't manage : " + wid);
        self.X.MapWindow(wid);
        return;
      }else{
        //console.log("Manage :", wid);
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
          self.X.ReparentWindow(wid, fid, 0, 0);
          self.X.MapWindow(fid);
          self.X.MapWindow(wid);
          //self.X.SetInputFocus(wid, 1);
          self.X.RaiseWindow(wid);
          if(self.bg && self.bg.focus && self.bg.win){
            self.X.UnmapWindow(self.bg.win);
            self.bg.focus = false;
          }
          if(self.error_window && self.error_window.mapped){
            self.error_window.raise();
          }
          self.X.UngrabServer();
          
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
      this.error_window.raise();
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
        //console.log(clientGeom.xPos, clientGeom.yPos, clientGeom.width, clientGeom.height);
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
    }
    if(this.error_window){
      this.error_window.destroy();
    }
    this.X.close();
  }
}

module.exports = {manageXServer, XManager};
