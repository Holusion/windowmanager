'use strict';
/* example from : https://github.com/sidorares/node-x11/blob/master/examples/windowmanager/wm.js
   Base on : https://github.com/dominictarr/tiles
 */
const util = require("util")
  , EventEmitter = require('events').EventEmitter
  , x11 = require('x11')
  , loadXpm = require("./Xutils/loadXpm")
  , XBackground = require("./Xutils/XBackground")
  , XKeyboard = require("./Xutils/XKeyboard")
  , {ErrorWindow} = require("./Xutils/XErrorWindow");

const x11_prop = require("x11-prop");
/**
 * @type {function}
 * @param {*} X
 * @param {number} wid
 * @param {number|"string"} prop (name or atom)
 * @param {number|"string"} [type] (name or atom) (optional)
 * @return {Promise<void>}
*/
const set_property = util.promisify(x11_prop.set_property);

const {fitScreen} = require("./utils/rescale");


const Logger = require("@holusion/logger");
/**
 * 
 * @param {Config} opts 
 * @returns 
 */
function manageXServer(opts){
  return new Promise(function(resolve, reject){
    x11.createClient(function(err,display){
      if(err) return reject(err);

      display.client.require('render', function(err, Render) {
        if(err) reject(err);
        display.Render = Render;
        resolve(display);
      });
    })
  }).then(async display=>{

      let keyboard = await XKeyboard.Init(display);
      return new XManager(display, keyboard, opts);
  })
}
/**
 * init to manage root window. Then it will emit events on KeyPress.
 */
class XManager extends EventEmitter{
  /**@type {Map<number, {title:string, id:number}>} */
  frames = new Map();

  constructor(display, keyboard, config={}){
    super();
    this.config = config;
    this.keyboard = keyboard;
    this.display = display;
    this.root = this.createRootContainer(display);
    this.X.QueryTree(this.root, (err, tree)=> {
      var manage = this.manage.bind(this);
      tree.children.forEach(manage);
    })

    //Require xtest to send fake inputs
    this.xtestExt = new Promise((resolve)=>{
        this.X.require("xtest", (err, ext)=>{
          if(err){
            this.logger.warn("failed to require extension xtest");
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

    this.logger.info(`Initial screen size : ${this.width}x${this.height}`);

    this.X.require("randr", (err, Randr)=>{
      if(err){
        return this.emit("error", err);
      }
      if(!Randr.present){
        this.logger.warn("bad Randr config : ", Randr);
      }
      Randr.SelectInput(rid, Randr.NotifyMask.ScreenChange);
    })


    Promise.all([
    ].map(a => this.InternAtom(false, a).then(atom=>[a, atom])))
    .then(atoms=>atoms.map(atom=>console.log(`ATOM ${atom[0]}: ${atom[1]}`)))

    Promise.all([
      "_NET_SUPPORTED",
      "_NET_WM_STATE",
      "_NET_WM_STATE_FULLSCREEN",
      //Everything else just queried to populate known atom numbers for later use
      "_NET_WM_STATE_MODAL",
      "_NET_WM_STATE_STICKY",
      "_NET_WM_STATE_MAXIMIZED_VERT",
      "_NET_WM_STATE_MAXIMIZED_HORZ",
      "_NET_WM_STATE_SHADED",
      "_NET_WM_STATE_SKIP_TASKBAR",
      "_NET_WM_STATE_SKIP_PAGER",
      "_NET_WM_STATE_HIDDEN",
      "_NET_WM_STATE_ABOVE",
      "_NET_WM_STATE_BELOW",
      "_NET_WM_STATE_DEMANDS_ATTENTION",
      "_NET_WM_ACTION_FULLSCREEN",
      "_NET_WM_ALLOWED_ACTIONS",
    ].map(a => this.InternAtom(false, a)))
    .then(async ([net_supported_atom, wm_state_atom, wm_fullscreen_atom])=>{
      let d = Buffer.alloc(8);
      d.writeUInt32LE(1, 0); //_NET_WM_STATE_ADD
      d.writeUInt32LE(wm_fullscreen_atom, 4);
      this.X.ChangeProperty(0, rid, net_supported_atom, this.X.atoms.ATOM, 32, d);
      this.X.ChangeProperty(0, rid, wm_state_atom, this.X.atoms.ATOM, 32, d);
    })

    this.createBackground();

    this.error_window = new ErrorWindow({display,parent:this.root, x:display.screen[0].pixel_width-405, y: 5});
    this.X.ChangeWindowAttributes(rid, { eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect|x11.eventMask.DestroyNotify|x11.eventMask.PropertyChange }, (err)=> {
      //logger.log("Got window attributes");
      if(err.error == 10){
        this.emit("error", new Error("Another window manager is already running"));
      }else if(err){
        this.emit("error",new Error("Error : "+err+"instanciating window manager"));
      }
    })

    this.X.on('error', (err)=>{
      //Stack trace doesn't help
      this.logger.warn(`WindowManager (code : ${err.error}) ${err.message}`);
      /*
      if(process.env["NODE_ENV"] == "development"){
        throw err;
      }//*/
    }).on('event', (ev)=> {
      switch(ev.name){
        case "KeyPress":
          try{
            this.emit("keydown",this.keyboard.parseEvent(ev));
          }catch(err){
            this.emit("error",err);
          }
          break;
        case "KeyRelease": //KeyRelease
          break;
        case "Expose":
          //this.X.MapWindow(this.bg.win);
          break;
        case "DestroyNotify": //DestroyNotify
        let frame = this.frames.get(ev.wid);
          if(!frame){
            this.logger.log("frame", ev.wid, "was not managed");
            return;
          }
          this.logger.info("received a destroyNotify for : ",frame.title);
          this.X.DestroyWindow(frame.id); //destroy window container.
          this.frames.delete(ev.wid);
          if(this.frames.size == 0){
            this.emit("expose",ev);
          }else{
            this.logger.info("still managing frames : ", [...this.frames.values()].map(f=>f.title).join(", "));
          }
          break;
        case "UnmapNotify":
        case "MapNotify":
          break;
        case "MapRequest":
          if (!this.frames.has(ev.wid)){
            this.manage(ev.wid);
          }
          break;
        case "ConfigureNotify":
          //A window has been resized
          //this.logger.debug(`ConfigureNotify ${ev.wid} to ${ev.width}x${ev.height}${Math.sign(ev.x) == -1 ? "-":"+"}${ev.x}${Math.sign(ev.y) == -1 ? "-":"+"}${ev.y}`)
          break;
        case "ConfigureRequest":
          //A window requests a resize
          this.fit({windowid: ev.wid, xPos:ev.x, yPos: ev.y, width: ev.width, height: ev.height });
          break;
        case "PropertyNotify":
          this.logger.debug("Property change for atom ",this.X.atom_names[ev.atom] || ev.atom, ev.state);
          break;
        case "ClientMessage":
          this.handleClientMessage(ev);
          break;
        case "MappingNotify":
          break;
        //Randr extension events
        case "RRScreenChangeNotify":
          //this.logger.log(`RandR screen change : ${ev.width}x${ev.height}`);
          this.width = ev.width;
          this.height = ev.height;
          this.X.GrabServer();
          this.X.ResizeWindow(this.root, ev.width, ev.height);
          this.X.ResizeWindow(this.bg.win, ev.width, ev.height);
          for(let [windowid, {title, id:containerId}] of this.frames.entries()){
            this.fit({windowid, width: ev.width, height: ev.height});
            this.X.MapWindow(containerId);
            this.X.MapWindow(windowid);
          }
          this.X.MapWindow(this.root);
          this.X.MapWindow(this.bg.win);
          this.X.UngrabServer();
          break;
        default:
          if(ev.type !=21){ //ReparentNotify has no name  assigned for whatever reason
            this.logger.debug("Uncatched win event : ",ev.name? ev.name : ev.type);
          }
      }
    });
  }
  
  handleClientMessage(ev){
    this.X.GetAtomName(ev.message_type, (err, name)=>{
      if(err) return this.logger.warn("Failed to get ATOM :", err);
      switch(name){
        case '_NET_WM_STATE':
          //this.logger.info("WM_STATE : ",this.frames.get(ev.wid)?.title ?? ev.wid, ev.data.map(d=>this.X.atom_names[d] || d))
          break;
        case '_NET_REQUEST_FRAME_EXTENTS':
          this.logger.info("EXTENTS ; ", ev);
          break;
        default:
          this.logger.info("Unknown ATOM : ", name, ev);
      }
    })
  }

  get logger(){
    return this.config.logger;
  }

  get autoResize(){
    return this.config.autoResize;
  }

  get X(){
    return this.display.client;
  }
  get isExposed(){ //Always return true if no display
    return !this.isActive || (0 == this.frames.size);
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
    const shortcut = this.keyboard.parseShortcut(full_shortcut);
    if(!shortcut){
      throw new Error("No keys found for shortcut : "+ full_shortcut);
    }else if(!shortcut.keycode){
      throw new Error(`Key "${(shortcut.name?shortcut.names[0]: full_shortcut)}" has no registered keycode in current keymap`);
    }else{
      // Grab the key with each combination of capslock(2), numlock(16) and scrollock (128)
      //logger.log("Register shortcut : ", shortcut);
      [0,2,16,18,128,130,144,146].forEach((base_mod)=>{
        op(this.display.screen[0].root, 0, base_mod | shortcut.modifiers , shortcut.keycode, 1, 1);
      });
    }
    return shortcut;
  }

  sendKeys(keys){
    const target = this.frames.keys().next().value.id;
    const shortcut = this.keyboard.parseShortcut(keys);
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

    /**
     * @type {GetProperty}
     */
    this.GetProperty = util.promisify(this.X["GetProperty"]).bind(this.X);
    /**
     * @type {InternAtom}
     */
    this.InternAtom = util.promisify(this.X["InternAtom"]).bind(this.X);
    /**
     * @type {GetGeometry}
     */
    this.GetGeometry = util.promisify(this.X["GetGeometry"]).bind(this.X);

    return wid;
  }

  unmapError(){
    this.error_window.unmap();
  }

  drawError(title, text){
    this.error_window.draw(title, text);
  }

  /**
   * 
   * @param {Pick<XClientGeom,"width"|"height"> & Partial<XClientGeom>} g
   */
  formatGeometry({width, height, xPos=0, yPos=0}){
    return `${width}x${height}${Math.sign(xPos) == -1 ? "-":"+"}${xPos}${Math.sign(yPos) == -1 ? "-":"+"}${yPos}`;
  }

  /**
   * 
   * @param {Pick<XClientGeom, "windowid"|"width"|"height"> & Partial<XClientGeom>} clientGeom client requested geometry
   */
  fit(clientGeom){
    const wid = clientGeom.windowid;
    const title = this.frames.get(wid)?.title ?? wid;
    const target = this.frames.get(wid)?.id ?? wid
    const bestGeometry = this.autoResize? fitScreen(clientGeom, {width: this.width, height:this.height}): clientGeom;
    this.logger.debug(`resize "${title}" geometry: ${this.formatGeometry(clientGeom)}${this.autoResize?` (computed to ${this.formatGeometry(bestGeometry)})`:""}.`)

    //move the window's container if we can.
    this.X.MoveResizeWindow(target, bestGeometry.xPos, bestGeometry.yPos, bestGeometry.width, bestGeometry.height);
    if(wid != target && this.autoResize) this.X.ResizeWindow(wid, bestGeometry.width, bestGeometry.height);
  }

  manage(wid){
    this.X.GetWindowAttributes(wid, (err, attrs) => {
      if(err){
        this.logger.warn(`Failed to get window attributes : `, err);
        this.X.MapWindow(wid);
        return;
      }
      if (attrs?.[8]){ // override-redirect flag
        // don't manage
        this.logger.info(`don't manage [${wid}] : override-redirect flag is set`);
        this.X.MapWindow(wid);
        return;
      }

      var fid = this.X.AllocID();
      this.frames.set(wid,{id:fid, title: wid.toString(10)});
      
      this.GetProperty(0, wid, this.X.atoms.WM_NAME, this.X.atoms.STRING, 0, 200).then((prop)=>{
        let frame = this.frames.get(wid)
        if(frame) frame.title = prop.data.toString("utf8");
      });
      

      this.GetGeometry(wid)
      .then((pos)=>{
        this.X.CreateWindow(fid, 
          this.root, 
          pos.xPos, pos.yPos, 
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
        if(this.bg){
          this.bg.focus = false;
        }
        if(this.error_window && this.error_window.mapped){
          this.error_window.raise();
        }
        this.X.UngrabServer();
        
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
    var wid = this.X.AllocID();
    this.X.GetGeometry(this.root, (err, clientGeom)=>{
      if(err){
        return this.logger.error("cannot get root window geometry : ",err);
      }
      this.X.require('render', (error, Render)=>{
        if(error){
          return this.logger.error("cannot get render context : ",err);
        }
        //logger.log(clientGeom.xPos, clientGeom.yPos, clientGeom.width, clientGeom.height);
        this.X.CreateWindow(wid, this.root, 0, 0, clientGeom.width, clientGeom.height, 0, 0, 0, 0,
        {
          overrideRedirect: true,
          eventMask: x11.eventMask.Exposure|x11.eventMask.KeyPress|x11.eventMask.SubstructureNotify
        });
        loadXpm(__dirname+"/../data/logo.xpm").then((logo)=>{
          this.bg = new XBackground(logo, wid, clientGeom, this.X, Render);
        }).catch((e)=>{this.logger.error("cannot load background : ",e)});
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
