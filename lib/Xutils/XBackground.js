var EventEmitter = require('events').EventEmitter

function XBackground (image,win, clientGeom, X,Render){
  this.win = win;
  this.X = X;
  this.focus = true;
  var self = this;
  var gc = X.AllocID();
  var logoPixmap = X.AllocID();
  var logoPicture = X.AllocID();
  var winPicture = X.AllocID();
  var fill = X.AllocID();

  var ee = new EventEmitter();
  X.event_consumers[this.win] = ee;

  ee.on('event', function(ev) {
    if(ev.type == 12){
      X.MapWindow(self.win);
      x= (clientGeom.width-image.width)/2
      y= (clientGeom.height-image.height)/2
      Render.Composite(Render.PictOp.Over, fill, 0, winPicture, 0, 0, 0, 0, 0, 0, clientGeom.width, clientGeom.height);
      Render.Composite(Render.PictOp.Over, logoPicture, 0, winPicture, 0, 0, 0, 0, x, y, image.width, image.height);
    }
  });
  X.CreateGC(gc, this.win);
  X.CreatePixmap(logoPixmap, this.win, 24, image.width, image.height);
  X.PutImage(2, logoPixmap, gc, image.width, image.height, 0, 0, 0, 24, image.data);
  Render.CreatePicture(logoPicture, logoPixmap, Render.rgb24);
  Render.CreatePicture(winPicture, this.win, Render.rgb24);
  Render.CreateSolidFill(fill, 0,0,0,1);
  X.MapWindow(this.win);
}

module.exports = XBackground;
