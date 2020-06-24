'use strict';
var EventEmitter = require('events').EventEmitter
const x11 = require('x11');

const {Renderer} = require('freetype-draw');


class Pixmap {
  constructor(depth, width, height, buffer){
    this.depth = depth;
    this.width = width;
    this.height = height;
    this.data = buffer;
  }
}

class ErrorWindow {
  constructor({display, parent, x=0, y=0, width=400, height=100}){
    this.client = display.client;
    this._closed = false;
    
    this.windowId = this.client.AllocID();
    this.gc = this.client.AllocID();
    this.pixmap = this.client.AllocID();
    this.picture = this.client.AllocID();
    this.winPicture = this.client.AllocID();

    this.width = width;
    this.height = height;
    this.x = x;
    this.y = y;
    this.client.CreateWindow(this.windowId, parent|| display.screen[0].root, x, y, width, height, 0, 0, 0, 0,{
      //overrideRedirect:true,
      eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect|x11.eventMask.DestroyNotify
    });
    this.client.CreateGC(this.gc, this.windowId);
    this.client.CreatePixmap(this.pixmap, this.windowId, 24, this.width, this.height);

    const onRequireRender = (err, Render)=>{
      if(err) return console.warn("Failed to require render :", err);
      this.render = Render;
      this.render.CreatePicture(this.picture, this.pixmap, this.render.rgb24);
      this.render.CreatePicture(this.winPicture, this.windowId, this.render.rgb24);
    }

    if(display.Render){
      onRequireRender(null, display.Render);
    }else{
      this.client.require('render', onRequireRender);
    }
    this.textRenderer = new Renderer({
      font: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 
      width, 
      height,
    });
    this.textRenderer.color = "#FFFFFFFF";
  }

  draw(title, text){
    if(this.closed) throw new Error("called ErrorWindow.draw after close");
    this.title = title;
    this.text = text;
    this.textRenderer.clear();
    this.textRenderer.size = 25;
    this.textRenderer.draw(title, {x:10, y: 20, size: 25});
    this.textRenderer.size = 15;
    this.textRenderer.draw(text, {x:10, y: 50, size: 15});

    const b = this.textRenderer.buffer;
    
    for(let y=0; y < this.height;y++){
      for(let c=0; c <4; c++){
        b[y*this.width*4 + c] = 0xFF;
      }
    }
    for(let x=0; x < this.width;x++){
      for(let c=0; c <4; c++){
        b[((this.height - 1)*this.width + x)*4 + c] = 0xFF;
      }
    }
    this.client.PutImage(2, this.pixmap, this.gc, this.width, this.height, 0, 0, 0, 24, b);
    this.map();
  }
  
  _draw(){
    if(this.render){
      this.render.Composite(this.render.PictOp.Over, this.picture, 0, this.winPicture, 0, 0, 0, 0, 0, 0, this.width, this.height);
    }
    //if(!this.render) return console.warn("No render context (yet)");
    //this.render.FillRectangles(1, this.picture, [0x0, 0x0, 0x0, 0xffff], [0, 0, 3000, 3000]);
    //this.client.PutImage(2, this.picture, this.gc, this.width, this.height, 0, 0, 0, 24, this.b);
  }
  unmap(){
    if(this.mapped && ! this.closed) {
      this._mapped = false;
      this.client.UnmapWindow(this.windowId);
    }
  }
  map(){
    if(!this.mapped && !this.closed) {
      this._mapped = true;
      this.client.MapWindow(this.windowId);
    }
    this.raise();
  }
  raise(){
    this.client.RaiseWindow(this.windowId);
    this._draw();
  }
  get mapped(){
    return this._mapped;
  }
  get id(){
    return this.windowId;
  }
  get closed(){
    return this._closed;
  }
  destroy(){
    this._closed = true;
    if(this.render){
      this.render.FreePicture(this.picture);
      this.client.ReleaseID(this.picture);
      this.render.FreePicture(this.winPicture);
      this.client.ReleaseID(this.winPicture);
    }
    //this.client.FreePixmap(this.pixmap);
    //this.client.DestroyWindow(this.windowId);
  }
}


module.exports = {ErrorWindow};