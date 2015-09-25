var EventEmitter = require('events').EventEmitter

function XBackground (image,win,X,Render){
  this.win = win;
  this.X = X;
  var self = this;
  var gc = X.AllocID();
  var logoPixmap = X.AllocID();
  var logoPicture = X.AllocID();
  var winPicture = X.AllocID();

  var ee = new EventEmitter();
  X.event_consumers[this.win] = ee;

  ee.on('event', function(ev) {
    if(ev.type == 12){
      X.MapWindow(self.win);
      Render.Composite(3, logoPicture, 0, winPicture, 0, 0, 0, 0, 0, 0, image.width, image.height);
    }
  });
  X.CreateGC(gc, this.win);
  X.CreatePixmap(logoPixmap, this.win, 24, image.width, image.height);
  X.PutImage(2, logoPixmap, gc, image.width, image.height, 0, 0, 0, 24, image.data);
  Render.CreatePicture(logoPicture, logoPixmap, Render.rgb24);
  Render.CreatePicture(winPicture, this.win, Render.rgb24);
  X.MapWindow(this.win);
}

module.exports = XBackground;
