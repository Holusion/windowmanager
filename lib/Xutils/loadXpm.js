var pixmapReader = require("xpixmap");
  var xpm = new pixmapReader();
module.exports = function (defaultImage) {
  return new Promise(function(resolve,reject){
    xpm.open("/etc/holusion-controller/layouts-enabled/background.xpm",function(err,logo){
      if(err || !logo){
        console.log("cannot load : /etc/holusion-controller/layout-enabled/background.xpm Falling back...")
        return xpm.open("/etc/holusion-controller/default/background.xpm",function(err2,logo){
          if(err2 || !logo){
            console.log("cannot load : /etc/holusion-controller/default/background.xpm Falling back...")
            return xpm.open(defaultImage,function(err3,logo){
              if(err3 || !logo){
                console.warn("cannot load last background fallback : "+defaultImage)
                reject("No layouts found");
              }
              console.log("loaded background : "+defaultImage)
              return resolve(logo)
            });
          }
          console.log("loaded background : /etc/holusion-controller/default/background.xpm")
          return resolve(logo)
        });
      }
      console.log("loaded background : /etc/holusion-controller/layouts-enabled/background.xpm")
      return resolve(logo)
    });
  })
};
