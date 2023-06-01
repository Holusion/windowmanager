'use strict';
/**
 * 
 * @param {Pick<XClientGeom, "width"|"height"> & Partial<XClientGeom>} win 
 * @param {{width:number, height:number}} scr 
 * @returns 
 */
function fitScreen(win, scr){
  let win_ratio = win.width/win.height;
  let scr_ratio = scr.width/scr.height;
  
  let width =  Math.min(scr.width, Math.floor(scr.height*win_ratio));
  let height = Math.min(scr.height, Math.floor(scr.width/win_ratio));
  return {
    ...win,
    xPos: Math.floor((scr.width - width)/2),
    yPos: Math.floor((scr.height - height)/2),
    width,
    height,
  }
}

module.exports = {
  fitScreen,
}