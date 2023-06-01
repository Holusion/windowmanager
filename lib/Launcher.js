'use strict';
const utils = require("util")
const {dirname} = require("path");
const {EventEmitter} = require("events");
const {spawn:originalSpawn, ChildProcess} = require("child_process");

const Finder = require("xdg-apps");
const dbus = require('dbus-native');

const makeCommandLine = require("./utils/makeCommandLine");

const Logger = require("@holusion/logger");

class ErrNotFound extends Error{
  constructor(filename, reason){
    super(`${filename} not found : ${reason || "(details not provided)"}`);
    this.type="ENOTFOUND";
  }
}



class Launcher extends EventEmitter{
  /**
   * 
   * @param {object} [param0] 
   * @param {Logger} [param0.logger=Logger.logger]
   */
  constructor({logger=Logger.logger}={}){
    super();
    this.logger = logger;
    //Early instanciation because we can already fetch every desktop file we will need later.
    //Promises allow us to start querying immediately.
    this.finder = new Finder("desktop");
    this._event_pipes = {
      error: this.emit.bind(this, "error"),
      end: this.emit.bind(this,"end"),
      stdout: this.emit.bind(this,"stdout"),
      stderr: this.emit.bind(this,"stderr")
    }
    this._listeners = [];
  }
  /**
   * 
   * @param {import("child_process").ChildProcess} child 
   */
  pipe(child){
    // For some errors, child's pipes are not even set-up. Spec is not really clear about this
    // https://github.com/nodejs/node/blob/v10.x/lib/internal/child_process.js
    if(child.stdout){
      child.stdout.setEncoding("utf8");
      child.stdout.on("data",this._event_pipes["stdout"]);
      child.stderr.setEncoding("utf8");
      child.stderr.on("data",this._event_pipes["stderr"]);
    }
    
    child.once("error", this._event_pipes["error"]);
    child.once("exit",this._event_pipes["end"]);
    this._child = child;
  }
  close(){
    this.killChild();
    //Do not create a dbus connection if it has not been used
    if(this._session_bus){
      this._session_bus.connection.end();
    }
  }
  get child(){
    return this._child || null;
  }
  get sessionBus(){
    if(!this._session_bus){
      this._session_bus =  dbus.sessionBus();
      //Technique to find the moment when the application is closed :
      //If the name argument matches the service name you want to know about.
      //If the old_owner argument is empty, then the service has just claimed the name on the bus.
      //If new_owner is empty then the service has gone away from the bus (for whatever reason).
      this._session_bus.getService("org.freedesktop.DBus").getInterface("/org/freedesktop/DBus", "org.freedesktop.DBus", (err, call) => {
        call.on("NameOwnerChanged", (name, old_owner, new_owner) => {
          if(this.child_service_id && name == this.child_service_id && !new_owner) {
            this.logger.log("NameOwnerChanged", name, "exits");
            this.emit("end");
          }
        })
      });
    }
    return this._session_bus;
  }

/**
 * Open a file or an array of file. Don't forget to catch errors using promise syntax :
 * 		launcher.start("path/to/file").catch(function(e){//catch errors});
 *
 * @param  {string} file file to open
 * @param {object} [conf] - start options. Ignored for DBus services
 * @param {string} [conf.args] - additional arguments, space-separated
 * @param {import("child_process").SpawnOptions} [conf.opts] - options to pass through to spawn
 * @return {Promise<any>}
 */
  async start(file, {args="", ...opts}={}) {
    let entry;
    try {
      entry = await this.finder.findEntry(file);
    }catch(e){
      throw new ErrNotFound(file, e.message);
    }
    
    const res = {
      had_child: ((this.child)?true: false),
      had_dbus: ((this.child_service_id)?true: false),
      is_open: (entry?true: false),
      is_dbus: ((entry && entry['DBusActivatable'] == 'true')? true: false),
      entry
    };
    if (res.had_dbus){
      //FIXME handle early kill
      //We unref the service id though it has not yet been stopped which might not be very wise
      this.child_service_id = null;
    }
    let child

    if ( res.is_dbus ) {
      this.logger.debug(`Opening ${file} with DBus service ${entry['ID']}`);
      try{
        await this.openDbus(file, entry['ID']);
      }catch(e){
        throw new Error(`Failed to open Dbus service : ${e}`);
      }
      
    } else if (res.is_open ) {
      this.logger.debug(`Opening ${file} with executable ${entry["Exec"]} ${args}`);
      try{
        this.execDE(file, entry['Exec'], {args, ...opts})
      }catch(e){
        throw new Error(`failed to open ${file} with ${entry["Exec"]} : ${e}`);
      }
      
    } else { //default to directly exec file
      this.logger.debug(`Executing ${file} directly`);
      try{
        this.execDE(file, entry, Object.assign({cwd: dirname(file)}, {args, ...opts}));
      }catch(e){
        throw new Error(`failed to execute ${file} : ${e}`);
      }
    }
    return res;
  }
  /**
   * Execs given Desktop Entry applied to file
   * @param {string} file - target filepath or URL
   * @param {string} line - desktop-entry formatted line* 
   * @param {import("child_process").SpawnOptions & {args?:string}} [conf] - start options. Ignored for DBus services
   * @returns {ChildProcess}
   */
  execDE(file, line, {args="", ...opts}={}) {
    // If it errors out, it will only emit on next tick.
    // We _could_ make it throw or succeed after setImmediate() expires
    var obj = makeCommandLine(file,line, args);
    //logger.log("Spawn : %s with args :", obj.exec, obj.params);
    return this.spawn(obj.exec, obj.params, opts);
  }
  /**
   * Proxy to core `spawn` method that additonally kills any previous children and pipe the new child's stdout/stderr
   * @param {string} command 
   * @param {string[]} [args] 
   * @param {import("child_process").SpawnOptions} [options]
   * @returns {ChildProcess}
   */
  spawn(command, args, options){
    this.killChild();
    let child = this._spawn(command, args, options)
    this.pipe(child);
    return child;
  }
  /**
   * @private
   */
  get _spawn(){
    return this._spawnOverride? this._spawnOverride: originalSpawn;
  }
  /**
   * Use _spawn setter to override spawn for testing purposes
   * @private
   */
  set _spawn(v){
    this._spawnOverride = v;
  }

  getInterface(id) {
    let uri = "/" + id.replace(/\./g, '/'); //Transform desktop id to service name (service.name)
    var service = this.sessionBus.getService(id);
    //logger.log('Opening file', id, uri);

    return new Promise((resolve, reject) => {
      service.getInterface(uri, "org.freedesktop.Application", (err, call) => {
        if(err) {
          reject(new ErrNotFound(uri, err));
        } else {
          resolve(call);
        }
      })
    })
  }

  //FIXME should "end" when it fails?
  async openDbus(file, id){
    if(!id || typeof id !== "string" || !id.endsWith(".desktop")) {
      throw new TypeError(`id parameter should be a string ending with .desktop. Got ${id}`);
    }
    id = id.replace(".desktop", "")
    //We replace all points in id by / to get the path of the interface
    //We call org.freedesktop.Application => See spec :https://standards.freedesktop.org/desktop-entry-spec/latest/ar01s07.html
    const call = await this.getInterface(id);
    //Open method need an array in param
    let files = ((Array.isArray(file))?file: [file]);
    
    await call.Open(files, {"desktop-startup-id" : ["s", "default_main_window"]}, (err) => {
      if(err) throw new Error(`Error while calling Open: ${err}`);
    });
    this.child_service_id = id;
    return id;
  }

  //This function is slightly unsafe because we kill the child by PID without checking if it's still alive.
  killChild() {
    if(this.child !== null && typeof this.child.pid == "number"){
      const old_child = this.child; //Keep reference to this.child 
      try{
        this.child.removeListener('exit', this._event_pipes["end"]); //prevent end being fired in the next tick after killChild()
        this.child.removeListener('error', this._event_pipes["error"]); //prevent end being fired in the next tick after killChild()
        // stdout and stderr are automatically closed once the child is dead.
        process.kill(this.child.pid);
      }catch(e){
        if(e.code !== "ESRCH"){ //child_process might already have exitted. In which case it's not necessary to throw an error...
          this.emit("error",e);
        }
      }finally{
        this._child = null;
      }
    }
  }
}


module.exports = {Launcher, ErrNotFound};
