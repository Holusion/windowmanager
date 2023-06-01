const { fitScreen } = require('../utils/rescale');

var EventEmitter = require('events').EventEmitter

function XBackground (image, win, clientGeom, X, Render){
  this.win = win;
  this.X = X;
  this.focus = true;
  var gc = X.AllocID();
  var logoPixmap = X.AllocID();
  var logoPicture = X.AllocID();
  var winPicture = X.AllocID();
  var fill = X.AllocID();


  let position = {
    width: image.width,
    height: image.height,
    xPos: Math.floor((clientGeom.width-image.width)/2),
    yPos: Math.floor((clientGeom.height-image.height)/2),
  };
  X.ChangeProperty(0, this.win, X.atoms.WM_NAME, X.atoms.STRING, 8, "Wallpaper");

  X.CreateGC(gc, this.win);
  X.CreatePixmap(logoPixmap, this.win, 24, image.width, image.height);
  X.PutImage(2, logoPixmap, gc, image.width, image.height, 0, 0, 0, 24, image.data);



  Render.CreatePicture(logoPicture, logoPixmap, Render.rgb24);
  Render.CreateSolidFill(fill, 0,0,0,1);

  //Texture to receive the window image
  Render.CreatePicture(winPicture, this.win, Render.rgb24);
  
  const update = ()=>{
    X.GrabServer();
    Render.Composite(Render.PictOp.Over, fill, 0, winPicture, 0, 0, 0, 0, 0, 0, clientGeom.width, clientGeom.height);
    if(this.focus) Render.Composite(Render.PictOp.Over, logoPicture, 0, winPicture, 0, 0, 0, 0, position.xPos, position.yPos, position.width, position.height);
    X.MapWindow(this.win);
    X.UngrabServer();
  }

  let timer = setTimeout(update, 50);

  var ee = new EventEmitter();
  X.event_consumers[this.win] = ee;
  ee.on('event', (ev)=> {
    switch(ev.name){
      case "ConfigureNotify":
        position = {
          width: image.width,
          height: image.height,
          xPos: Math.floor((ev.width-image.width)/2),
          yPos: Math.floor((ev.height-image.height)/2),
        }
        clearTimeout(timer);
        update();
        break;
      case "DestroyNotify":
        clearTimeout(timer);
        break;
      case "Expose":
        //Delay redraws of the background
        clearTimeout(timer);
        timer = setTimeout(update, 50);
        break;
      default:
        console.log("Background event : ", ev.name);
    }
  });
}

module.exports = XBackground;
