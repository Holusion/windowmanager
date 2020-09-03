'use strict';

function fitScreen(win, scr){
  let win_ratio = win.width/win.height;
  let scr_ratio = scr.width/scr.height;
  
  let width =  Math.min(scr.width, scr.height*win_ratio);
  let height = Math.min(scr.height, scr.width/win_ratio);
  return {
    x: (scr.width - width)/2,
    y: (scr.height - height)/2,
    width,
    height,
  }
}

module.exports = {
  fitScreen,
}