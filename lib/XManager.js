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

const x11_prop = require("x11-prop");
const set_property = util.promisify(x11_prop.set_property);
const {fitScreen} = require("./utils/rescale");


const {logger} = require("@holusion/logger");

function manageXServer(opts){
  return new Promise(function(resolve, reject){
    x11.createClient(function(err,display){
      if(err) return reject(err);
      const X = display.client;
      display.client.require('render', function(err, Render) {
        if(err) reject(err);
        display.Render = Render;
        getKeyMaps(display,function(err){
          if(err) reject(err);
          resolve(new XManager(display, opts));
        })
      })
    })
  })
}
/**
 * init to manage root window. Then it will emit events on KeyPress.
 */
class XManager extends EventEmitter{
  constructor(display, opts={autoResize: false}){
    super();
    this.opts = opts;
    this.display = display;
    this.root = this.createRootContainer(display);
    this.X.QueryTree(this.root, (err, tree)=> {
      var manage = this.manage.bind(this);
      tree.children.forEach(manage);
    })

    //Require xtest to send fake inputs
    this.xtestExt = new Promise((resolve)=>{
        this.X.require("xtest", function(err, ext){
          if(err){
            logger.warn("failed to require extension xtest");
            resolve();
          }else{
            resolve(ext);
          }
        })
    })

    const rid = display.screen[0].root;
    //Initialize iwdth & height as well as we can
    this.width = display.screen[0].pixel_width;
    this.height = display.screen[0].pixel_height;

    logger.info(`Initial screen size : ${this.width}x${this.height}`);

    this.X.require("randr", (err, Randr)=>{
      if(err){
        return this.emit("error", err);
      }
      logger.debug("Randr signature : ", Randr);
      Randr.SelectInput(rid, Randr.NotifyMask.ScreenChange);
    })

    Promise.all([
      "_NET_WM_STATE",
      "_NET_WM_STATE_FULLSCREEN",
      "_NET_WM_STATE_MAXIMIZED_VERT",
      "_NET_WM_STATE_MAXIMIZED_HORZ",
    ].map(a => this.InternAtom(false, a)))
    .then(async ([wm_state_atom, wm_fullscreen_atom])=>{
      logger.debug("Atom Type : ", this.X.atoms.ATOM);
      await set_property(this.X, rid, '_NET_SUPPORTED', this.X.atoms.ATOM, 32, [wm_state_atom, wm_fullscreen_atom]);
      await set_property(this.X, rid, '_WM_STATE', this.X.atoms.ATOM, 32, [wm_fullscreen_atom]);
    })

    this.createBackground();

    this.error_window = new ErrorWindow({display,parent:this.root, x:display.screen[0].pixel_width-405, y: 5});
    this.frames = {};
    this.X.ChangeWindowAttributes(rid, { eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect|x11.eventMask.DestroyNotify|x11.eventMask.PropertyChange }, (err)=> {
      //logger.log("Got window attributes");
      if(err.error == 10){
        this.emit("error", new Error("Another window manager is already running"));
      }else if(err){
        this.emit("error",new Error("Error : "+err+"instanciating window manager"));
      }
    })

    this.X.on('error', function(err) {
      logger.warn("WindowManager : ",err);
      /*
      if(process.env["NODE_ENV"] == "development"){
        throw err;
      }//*/
    }).on('event', (ev)=> {
      // logger.log(self.frames, ev.wid);
      switch(ev.name){
        case "KeyPress":
          try{
            this.emit("keydown",parseEvent(ev));
          }catch(err){
            this.emit("error",err);
          }
          break;
        case "KeyRelease": //KeyRelease
        case "Expose":
          break;
        case "DestroyNotify": //DestroyNotify
          if(typeof this.frames[ev.wid] == "undefined"){
            logger.log("frame", ev.wid, "was not managed");
            return;
          }
          logger.info("received a destroyNotify for : ",ev.wid);
          this.X.DestroyWindow(this.frames[ev.wid]); //destroy top level window container.
          delete this.frames[ev.wid];
          if(Object.keys(this.frames).length ==0){
            this.emit("expose",ev);
          }else{
            logger.info("still managing frames : ", this.frames);
          }
          break;
        case "UnmapNotify":
        case "MapNotify":
          break;
        case "MapRequest":
          if (!this.frames[ev.wid]){
            this.manage(ev.wid);
          }
          break;
        case "ConfigureNotify":
          logger.info("Configure Notify : ",ev);
          this.X.GetProperty(0, ev.wid, this.X.atoms.WM_NORMAL_HINTS, this.X.atoms.WM_SIZE_HINTS, 0, 1000, (err, prop)=>{
            if(err) return logger.log("GetProperty (ConfigureRequest)", err);
            if(prop.data.length == 0) return;
            let flags = prop.data.readInt32LE(0);
            let flag_names = [
              "USPosition",
              "USSize",
              "PPosition",
              "PSize",
              "PMinSize",
              "PMaxSize",
              "PResizeInc",
              "PAspect"	,
              "PBaseSize",
              "PWinGravity",
            ].filter((_, idx)=>{
              return (flags >>idx &1)
            })
            logger.info("Ignoring configure Notify data with flags : ", flag_names.join(", "));
          })
          break;
        case "ConfigureRequest":
          logger.log(`ConfigureRequest ${ev.wid} to ${ev.width}x${ev.height}${Math.sign(ev.x) == -1 ? "-":"+"}${ev.x}${Math.sign(ev.y) == -1 ? "-":"+"}${ev.y}`)
          let container = this.frames[ev.wid];
          if(container) this.X.MoveResizeWindow(container, ev.x, ev.y, ev.width, ev.height);
          this.X.ResizeWindow(ev.wid, ev.width, ev.height);
          break;
        case "PropertyNotify":
          logger.info("Property change for atom ",this.X.atom_names[ev.atom] || ev.atom);
          break;
        case "ClientMessage":
          this.handleClientMessage(ev);
          break;
        case "MappingNotify":
          break;
        //Randr extension events
        case "RRScreenChangeNotify":
          //logger.log(`RandR screen change : ${ev.width}x${ev.height}`);
          this.width = ev.width;
          this.height = ev.height;
          this.X.ResizeWindow(this.root, ev.width, ev.height);
          if(this.opts.autoResize){
            //FIXME Should resize contained windows
          }
          break;
        default:
          if(ev.type !=21){ //ReparentNotify has no name  assigned for whatever reason
            logger.debug("Uncatched win event : ",ev.name? ev.name : ev.type);
          }
      }
    });
  }
  
  handleClientMessage(ev){
    this.X.GetAtomName(ev.message_type, (err, name)=>{
      if(err) return logger.warn("Failed to get ATOM :", err);
      switch(name){
        case '_NET_WM_STATE':
          logger.info("WM_STATE : ", ev.data.map(d=>this.X.atom_names[d] || d))
          break;
        case '_NET_REQUEST_FRAME_EXTENTS':
          break;
        default:
          logger.info("Unknown ATOM : ", name, ev);
      }
    })
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

  registerShortcut(s){
    return this.forEachKey(s, this.X.GrabKey);
  }
  unregisterShortcut(full_shortcut){
    return this.forEachKey(full_shortcut, this.X.UngrabKey);
  }
  
  forEachKey(full_shortcut, op){
    const shortcut = parseShortcut(full_shortcut);
    if(!shortcut){
      throw new Error("No keys found for shortcut : "+ full_shortcut);
    }else if(!shortcut.keycode){
      throw new Error(`Key "${(shortcuts.name?shortcut.names[0]: full_shortcut)}" has no registered keycode in current keymap`);
    }else{
      // Grab the key with each combination of capslock(2), numlock(16) and scrollock (128)
      //logger.log("Register shortcut : ", shortcut);
      [0,2,16,18,128,130,144,146].forEach((base_mod)=>{
        op(this.display.screen[0].root, 0, base_mod | shortcut.modifiers , shortcut.keycode, 1, 1);
      })
    }
    return shortcut;
  }

  sendKeys(keys){
    const target = Object.keys(this.frames)[0];
    const shortcut = parseShortcut(keys);
    return this.xtestExt.then(xtest =>{
      if(!xtest) throw new Error("failed to send shortcut because xtest extension failed to load");
      xtest.FakeInput(xtest.KeyPress, shortcut.keycode, 0, target, 0, 0);
      setTimeout(()=>{
        xtest.FakeInput(xtest.KeyRelease, shortcut.keycode, 0, target, 0, 0);
      },50);
    })
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

    ["GetProperty", "GetGeometry", "InternAtom"].forEach((key)=>{
      this[key] = util.promisify(this.X[key]).bind(this.X);
    })
    return wid;
  }
  unmapError(){
    this.error_window.unmap();
  }
  drawError(title, text){
    this.error_window.draw(title, text);
  }

  manage(wid){
    this.X.GetWindowAttributes(wid, (err, attrs) => {
      //logger.log("Window Attributes : ", attrs);
      if (attrs[8]){ // override-redirect flag
        // don't manage
        logger.info(`don't manage [${wid}] : override-redirect flag is set`);
        this.X.MapWindow(wid);
        return;
      }else{
        //logger.log("Manage window with attributes : ", attrs);
      }
      
      var fid = this.X.AllocID();
      this.frames[wid] = fid;

      this.GetGeometry(wid)
      .then((clientGeom)=>{
        let pos;
        if(this.opts.autoResize){
          pos = fitScreen(
            clientGeom, 
            {width: this.width, height: this.height},
          )
          logger.info(`Window root geometry: ${this.width}x${this.height}`);
          logger.info(`Trying to resize to : ${pos.width}x${pos.height}`);
          this.X.ResizeWindow(wid, pos.width, pos.height);
        }else{
          pos = {
            x: clientGeom.xPos,
            y: clientGeom.yPos,
            width: clientGeom.width,
            height: clientGeom.height,
          }
        }
        return pos;
      },()=>{
        return { 
          x:0, 
          y:0, 
          width: this.display.screen[0].pixel_width, 
          height: this.display.screen[0].pixel_height 
        }
      })
      .then((pos)=>{
        this.X.CreateWindow(fid, 
          this.root, 
          pos.x, pos.y, 
          pos.width, pos.height, 
          0, 0, 0, 0,
          {eventMask: x11.eventMask.DestroyNotify|x11.eventMask.ButtonMotion|x11.eventMask.ButtonPress|x11.eventMask.SubstructureNotify| x11.eventMask.SubstructureRedirect| x11.eventMask.Exposure }
        );
        this.X.GrabServer();
        this.X.ReparentWindow(wid, fid, 0, 0);
        this.X.MapWindow(fid);
        this.X.MapWindow(wid);
        this.X.SetInputFocus(wid, 1);
        this.X.RaiseWindow(wid);
        if(this.bg && this.bg.focus && this.bg.win){
          this.X.UnmapWindow(this.bg.win);
          this.bg.focus = false;
        }
        if(this.error_window && this.error_window.mapped){
          this.error_window.raise();
        }
        this.X.UngrabServer();
        
        var ee = new EventEmitter();
        this.X.event_consumers[fid] = ee;
        ee.on('event', (ev)=> {            
          if (ev.type === 17) // DestroyNotify
          {
            logger.info("destroy : ",fid);
            this.X.DestroyWindow(fid);
            delete this.frames[fid];
          }else{
            logger.info("FID event : ", ev.name);
          }
        });
      })
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
        return logger.error("cannot get root window geometry : ",err);
      }
      self.X.require('render', function(error, Render) {
        if(error){
          return logger.error("cannot get render context : ",err);
        }
        //logger.log(clientGeom.xPos, clientGeom.yPos, clientGeom.width, clientGeom.height);
        self.X.CreateWindow(wid,self.root, 0, 0, clientGeom.width, clientGeom.height, 0, 0, 0, 0,
        {
          overrideRedirect:true,
          eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect|x11.eventMask.KeyPress
        });
        loadXpm(__dirname+"/../data/logo.xpm").then(function(logo){
          self.bg = new XBackground(logo, wid, clientGeom, self.X, Render);
        }).catch(function(e){logger.error("cannot load background XPM : ",e)});
      });
    });
  }

  exit (done=function(){}){
    this.X.removeAllListeners('event');
    if(this.bg && this.bg.win){
       this.X.DestroyWindow(this.bg.win);
       this.X.ReleaseID(this.bg.win);
    }
    if(this.error_window){
      this.error_window.destroy();
    }
    this.X.on('end', done);
    this.X.terminate();
  }
}

module.exports = {manageXServer, XManager};
