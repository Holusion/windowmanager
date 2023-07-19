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
  , {ErrorWindow} = require("./Xutils/XErrorWindow")
  , AsyncLock = require("async-lock");

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

const {fitScreen, boundsChanged} = require("./utils/rescale");

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
  /**@type {Map<number, {title:string, id:number, bounds ?:import("./utils/rescale").Bounds}>} */
  frames = new Map();

  #lock = new AsyncLock();
  async lock(cb){
    return await this.#lock.acquire("X", cb);
  }

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
    this.lock(async ()=>{
      await Promise.all([
        "_NET_SUPPORTED",
        "_NET_WM_STATE",
        "_NET_WM_STATE_FULLSCREEN",
        //Everything else just queried to populate known atom numbers for later use
        "_NET_WM_STATE_MAXIMIZED_VERT",
        "_NET_WM_STATE_MAXIMIZED_HORZ",
        "_NET_WM_STATE_MODAL",
        "_NET_WM_STATE_STICKY",
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
      .then(async ([
        net_supported_atom,
         wm_state_atom, 
         wm_fullscreen_atom,
        ])=>{
        //Somehow doesn't seem to work
        this.X.ChangeProperty(2, rid, net_supported_atom, this.X.atoms.ATOM, 32, 
          Buffer.from(Uint32Array.from([wm_fullscreen_atom]).buffer)
        )
      });
  
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
      this.logger.warn(`WindowManager (code : ${err.error})`, err.message);
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
          this.lock(()=>{
            let frame = this.frames.get(ev.wid);
            if(!frame){
              this.logger.log("frame", ev.wid, "was not managed");
              return;
            }
            this.logger.info("received a destroyNotify for : %s(%d)",frame.title, ev.wid);
            this.X.DestroyWindow(frame.id); //destroy window container.
            this.frames.delete(ev.wid);
            if(this.frames.size == 0){
              this.emit("expose",ev);
            }else{
              this.logger.info("still managing frames : ", [...this.frames.values()].map(f=>f.title).join(", "));
            }
            //this.focus(this.frames.size == 0);
          });
          break;
        case "UnmapNotify":
        case "MapNotify":
          break;
        case "MapRequest":
          if (!this.frames.has(ev.wid)){
            this.lock(async ()=>{
              await this.manage(ev.wid);
            })
          }
          break;
        case "ConfigureNotify":
          //A window has been resized
          //this.logger.debug(`ConfigureNotify ${ev.wid} to ${ev.width}x${ev.height}${Math.sign(ev.x) == -1 ? "-":"+"}${ev.x}${Math.sign(ev.y) == -1 ? "-":"+"}${ev.y}`)
          break;
        case "ConfigureRequest":
          //A window requests a resize
          this.lock(async ()=>{
            await this.fit(ev);
          });
          break;
        case "PropertyNotify":
          //this.logger.debug("Property change for atom ",this.X.atom_names[ev.atom] || ev.atom, ev.rawData.toString("utf8"));
          break;
        case "ClientMessage":
          this.handleClientMessage(ev);
          break;
        case "MappingNotify":
          break;
        //Randr extension events
        case "RRScreenChangeNotify":
          //this.logger.log(`RandR screen change : ${ev.width}x${ev.height}`);
          this.lock(()=>{
            this.width = ev.width;
            this.height = ev.height;
            this.X.ResizeWindow(this.root, ev.width, ev.height);
            this.X.ResizeWindow(this.bg.win, ev.width, ev.height);
            for(let [windowid, {title, id: containerId, bounds}] of this.frames.entries()){
              this.fit({wid:windowid, ...bounds});
            }
            this.X.MapWindow(this.root);
            this.X.MapWindow(this.bg.win);
          });
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
        case '_NET_WM_MOVERESIZE':
          //Happens on user-drag. Electron in particular does this. not-handled.
          //this.logger.info(`WM_MOVERESIZE Requested : x:${ev.data[0]} y:${ev.data[1]} `,);
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

    this.GetWindowAttributes = util.promisify(this.X["GetWindowAttributes"]).bind(this.X);
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
   * @param {*} wid 
   * @returns {Promise<Array<string|number>>}
   */
  async getWmState(wid){

    const prop = await this.GetProperty(0, wid, this.X.atoms._NET_WM_STATE, 0, 0, 200)
    /**@type {Array<string|number>} */
    let atoms = [];
    for(let atom of new Uint32Array(prop.data)){
      atoms.push( this.X.atom_names[atom]||atom)
    }
    return atoms;
  }

  async getHints(wid){
    const prop = await this.GetProperty(0, wid, this.X.atoms.WM_NORMAL_HINTS, this.X.atoms.WM_SIZE_HINTS, 0, 32);
    const flags = prop.data.length?prop.data.readUInt32LE(0): 0;
    return {
      flags,
      x: (flags & 0x1 || flags & 0x1<<2)? prop.data.readInt32LE(4):0,
      y: (flags & 0x1 || flags & 0x1<<2)? prop.data.readInt32LE(8):0,
      width: (flags & 0x1<<1 || flags & 0x1<<3)?prop.data.readInt32LE(12):0,
      height: (flags & 0x1<<1 || flags & 0x1<<3)?prop.data.readInt32LE(16):0,
      min_width: (flags & 0x1 <<4)? prop.data.readInt32LE(20):0,
      min_height:(flags & 0x1 <<4)? prop.data.readInt32LE(24):0,
      max_width: (flags & 0x1 <<5)? prop.data.readInt32LE(28):0,
      max_height: (flags & 0x1 <<5)? prop.data.readInt32LE(32):0,
      width_inc: (flags & 0x1 <<6)? prop.data.readInt32LE(36):1,
      height_inc: (flags & 0x1 <<6)? prop.data.readInt32LE(40):1,
      min_aspect: (flags & 0x1 <<7)? prop.data.readInt32LE(44) / prop.data.readInt32LE(48):0, // collapse fraction
      max_aspect: (flags & 0x1 <<7)? prop.data.readInt32LE(52) / prop.data.readInt32LE(56):0, // collapse fraction
      base_width: (flags & 0x1 <<8)? prop.data.readInt32LE(60):0,
      base_height: (flags & 0x1 <<8)? prop.data.readInt32LE(64):0,
      gravity: 0, //No idea of the value type
    };
  }

  /**
   * 
   * @param {{wid:number, x:number, y:number, width:number, height:number}} clientGeom client requested geometry
   */
  async fit(clientGeom){
    let user = true;
    const wid = clientGeom.wid;
    if(!this.frames.has(wid)) return; //Skip requests from yet unmanaged frames

    const [hints, wmState] = await Promise.all([
      this.getHints(wid),
      this.getWmState(wid)
    ])
    const fullscreen = wmState.indexOf("_NET_WM_STATE_FULLSCREEN") != -1
    const frame = this.frames.get(wid);
    const title = frame?.title || wid;
    
    let bounds = fitScreen(clientGeom, hints, {width: this.width, height:this.height}, this.autoResize);
    if(fullscreen){
      user = false; // Otherwise VLC goes crazy?
      bounds = {x:0, y:0, width: this.width, height: this.height};
    }
    
    if(frame && frame.bounds && boundsChanged(bounds, frame.bounds)){
      this.logger.debug(`Fitting ${title} (${this.formatGeometry(clientGeom)}) ${fullscreen?"(fullscreen)":`with hints ${this.formatGeometry(hints)}`} into ${this.formatGeometry(bounds)}`)

      this.move(wid,bounds, user);
      if(frame) this.frames.set(wid, {...frame, bounds});
    }
  }
  /**
   * 
   * @param {number} wid 
   * @param {{x: number, y: number, width: number, height: number}} bounds 
   */
  move(wid, bounds, user=true){
    const target = this.frames.get(wid)?.id;
    if(target) this.X.MoveResizeWindow(target, bounds.x, bounds.y, bounds.width, bounds.height);
    this.X.ResizeWindow(wid, bounds.width, bounds.height);
    if(user) this.configureNotify(wid, bounds);
  }
  
  configureNotify(wid, bounds){
    //See https://www.x.org/releases/current/doc/man/man3/xcb_configure_notify_event_t.3.xhtml
    const event = Buffer.alloc(32); //32 is hard-coded in proto
    let offset = 0;
    offset = event.writeUInt8(22 /*ConfigureNotify type */, 0);
    offset++; //1 byte padding
    //offset = event.writeUInt16LE(0, offset) //Sequence
    offset = event.writeUInt32LE(wid, offset); //event
    offset = event.writeUInt32LE(wid, offset); //window
    offset = event.writeUInt16LE(0, offset);//above_sibling
    offset = event.writeInt16LE(bounds.x, offset); //x
    offset = event.writeInt16LE(bounds.y, offset); //y
    offset = event.writeUInt16LE(bounds.width, offset); //width
    offset = event.writeUInt16LE(bounds.height, offset); //height
    offset = event.writeUInt16LE(0, offset); //borderWidth
    offset = event.writeUInt16LE(0, offset); //mask
    this.X.SendEvent(wid, 0, x11.eventMask.StructureNotify, event);
  }

  async manage(wid){
    try{
      const attrs = await this.GetWindowAttributes(wid);
      const titleProp = await this.GetProperty(0, wid, this.X.atoms.WM_NAME, this.X.atoms.STRING, 0, 200);
      const hints = await this.getHints(wid);
      const clientGeom = await this.GetGeometry(wid);
      const wmState = await this.getWmState(wid);
  
      if (attrs?.[8]){ // override-redirect flag
        // don't manage
        this.logger.info(`don't manage [${wid}] : override-redirect flag is set`);
        this.X.MapWindow(wid);
        return;
      }
      var fid = this.X.AllocID();
      this.logger.info("Manage : ", wid, fid);
        
      //Necessary if we want to listen to end-of-fullscreen events in the future or things like WM_NAME changes
      //this.X.ChangeWindowAttributes(wid, {eventMask: x11.eventMask.PropertyChange| attrs.myEventMasks});

      let bounds = fitScreen(clientGeom, hints, {width: this.width, height:this.height}, this.autoResize);

      this.frames.set(wid, {id:fid, title: wid.toString(10), bounds});

      this.X.CreateWindow(fid, 
        this.root, 
        clientGeom.xPos, clientGeom.yPos, 
        clientGeom.width, clientGeom.height, 
        0, 0, 0, 0,
        {eventMask: x11.eventMask.DestroyNotify|x11.eventMask.ButtonMotion|x11.eventMask.ButtonPress|x11.eventMask.SubstructureNotify| x11.eventMask.SubstructureRedirect| x11.eventMask.Exposure }
      );
      this.X.GrabServer();
      this.X.ReparentWindow(wid, fid, 0, 0);


      if(boundsChanged(bounds, clientGeom)){
        this.move(wid, bounds, false);
      }
      this.X.MapWindow(fid);
      this.X.MapWindow(wid);
      this.X.SetInputFocus(wid, 1);
      this.X.RaiseWindow(wid);
      this.X.UngrabServer();


      //Register the frame
      const managed_frame = this.frames.get(wid);
      if(!managed_frame) return; //Frame has been destroyed
      const frame = {...managed_frame, title: titleProp.data.toString("utf8")}
      if(titleProp.data.length) this.frames.set(wid, frame);

      if(this.bg){
        this.bg.focus = false;
      }
      if(this.error_window && this.error_window.mapped){
        this.error_window.raise();
      }
    }catch(e){
      console.warn("Fail to manage window %d", wid, e);
    }
  }

  focus(raise=true){
    if (!this.isActive) return;
    if(this.bg){
      if(raise){
        this.bg.focus = true;
        this.X.SetInputFocus(this.bg.win,1);
        this.X.RaiseWindow(this.bg.win);
      }else{
        this.bg.focus = false;
      }
      this.X.MapWindow(this.bg.win);
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
