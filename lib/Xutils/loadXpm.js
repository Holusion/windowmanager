const pixmapReader = require("xpixmap");
const xpm = new pixmapReader();

const {logger} = require("@holusion/logger");



module.exports = function loadXpm (defaultImage) {
  return new Promise(function(resolve,reject){
    xpm.open("/etc/holusion-controller/layouts-enabled/background.xpm",function(err,logo){
      if(err || !logo){
        logger.info("cannot load : /etc/holusion-controller/layout-enabled/background.xpm Falling back...")
        return xpm.open("/etc/holusion-controller/default/background.xpm",function(err2,logo){
          if(err2 || !logo){
            logger.info("cannot load : /etc/holusion-controller/default/background.xpm Falling back...")
            return xpm.open(defaultImage, function(err3,logo){
              if(err3 || !logo){
                logger.warn("cannot load last background fallback : "+defaultImage)
                reject("No layouts found");
              }
              logger.info("loaded background : "+defaultImage)
              return resolve(logo)
            });
          }
          logger.info("loaded background : /etc/holusion-controller/default/background.xpm")
          return resolve(logo)
        });
      }
      logger.info("loaded background : /etc/holusion-controller/layouts-enabled/background.xpm")
      return resolve(logo)
    });
  })
};
