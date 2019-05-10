'use strict';
const x11 = require('x11');
const ntk = require("ntk"); // required for initialization
const App = require("ntk/lib/app");

class ErrorWindow{
  constructor({display, parent, x=0, y=0, width=400, height=100}){
    this.app = new App(display);
    const windowId = this.app.X.AllocID();
    this.width = width;
    this.height = height;
    this.x = x;
    this.y = y;
    this.app.X.CreateWindow(windowId, parent|| display.screen[0].root, x, y, width, height, 0, 0, 0, 0,{
      //overrideRedirect:true,
      eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect
    });
    this.window = this.app.createWindow({id: windowId}); // Reuse window
    this.window_draw_context = this.window.getContext('2d');
    //this.window.map();
    const pixmap = this.app.createPixmap({parent: this.window, depth: 32, width, height});
    this.draw_context  = pixmap.getContext('2d');
  }
  draw(title, text){
    this.title = title;
    this.text = text;
    this.map();
  }
  _draw(){
    const ctx = this.draw_context;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, this.width, this.height, 1, 1, 1, 1);
    ctx.fillStyle = 'white';
    ctx.font = `40pt "DejaVuSans"`;
    ctx.fillText(this.title, 10, 40);
    ctx.font = `20pt "DejaVuSans"`;
    let offsetX = 10;
    for (const word of this.text.split(" ")){
      ctx.fillText(word, offsetX, 70);
      offsetX += ctx.measureText(word).width + 10;
    }
    this.window_draw_context.drawImage(ctx, 0, 0);
  }
  unmap(){
    if(this.mapped) this.window.unmap();
  }
  map(){
    if(!this.mapped) {
      this.window.map();
    }
    this.raise();
  }
  raise(){
    this.app.X.RaiseWindow(this.id);
    this._draw();
  }
  get mapped(){
    return this.window._mapped;
  }
  get id(){
    return this.window.id;
  }
  destroy(){
    this.window.destroy();
  }
}


module.exports = {ErrorWindow};