'use strict';

/**
 * @typedef {object} Bounds
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {object} WMHints
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} [min_width]
 * @property {number} [min_height]
 * @property {number} [max_width]
 * @property {number} [max_height]
 * @property {number} [width_inc]
 * @property {number} [height_inc]
 * @property {number} [min_aspect]
 * @property {number} [max_aspect]
 * @property {number} [base_width]
 * @property {number} [base_height]
 * @property {number} [gravity]
 */

/**
 * Scale up/down bounds to fit the screen
 * @param {Pick<XClientGeom, "width"|"height"> & Partial<XClientGeom>} win 
 * @param {WMHints} hints
 * @param {{width:number, height:number}} scr 
 * @param {boolean} maximize maximize windows
 * @returns {Bounds}
 */
function fitScreen(win, hints, scr, maximize){
  let aspect = ((hints.width && hints.height)? hints.width/hints.height : win.width/win.height);

  let width = Math.min(scr.width, (maximize)?  Math.floor(scr.height*aspect) :
    hints.width || Math.min(win.width, scr.height*aspect));
  
  let height = Math.min(scr.height, (maximize)?Math.floor(scr.width/aspect) :
    hints.height || width/aspect);

  return {
    x:  ((width != (hints.width?hints.width: win.width))? Math.floor((scr.width - width)/2):hints.x || win.xPos||0) ,
    y: ((height != (hints.height?hints.height: win.height))? Math.floor((scr.height - height)/2): hints.y || win.yPos||0) ,
    width,
    height,
  }
}

/**
 * 
 * @param {Bounds|XClientGeom} a 
 * @param {Bounds|XClientGeom} b 
 */
function boundsChanged(a, b){
  return !((a["x"] || a["xPos"]) == (b["x"] || b["xPos"])
    && (a["y"] || a["yPos"]) == (b["y"] || b["yPos"])
    && a["width"] == b["width"]
    && a["height"] == b["height"]);
}

module.exports = {
  fitScreen,
  boundsChanged
}