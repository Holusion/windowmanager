'use strict';

const {fitScreen, boundsChanged} = require("../lib/utils/rescale");

const noHints = {x: 0, y: 0, width: 0, height: 0};

describe("fitScreen", function(){
  /**@type {[string,{width:number, height:number},{width:number, height:number}, XClientGeom]} */
  [
    [
      `homothetic grow 16:9 (no hints, maximize)`,
      {width:800, height: 450},
      noHints,
      {width:1920, height: 1080},
      true,
      {x: 0, y: 0, width: 1920, height:1080}
    ], [
      `homothetic grow 4:3 (no hints, maximize)`,
      {width:400, height: 300},
      noHints,
      {width:1440, height: 1080},
      true,
      {x: 0, y: 0, width: 1440, height:1080}
    ], [
      `grow 4:3 to 16:9 (no hints, maximize)`,
      {width:400, height: 300},
      noHints,
      {width:1920, height: 1080},
      true,
      {x: 240, y: 0, width: 1440, height:1080}
    ], [
      `grow 16:9 to 4:3 (no hints, maximize)`,
      {width:800, height: 450},
      noHints,
      {width:1440, height: 1080},
      true,
      {x: 0, y: 135, width: 1440, height:810}
    ], [
      `homothetic shrink (no hints)`,
      {width:3840, height: 2160},
      noHints,
      {width:1920, height: 1080},
      false,
      {x: 0, y: 0, width: 1920, height:1080}
    ], [
      `shrink 4:3 to 16:9 (no hints)`,
      {width:4000, height: 3000},
      noHints,
      {width:1920, height: 1080},
      false,
      {x: 240, y: 0, width: 1440, height:1080}
    ], [
      `shrink 4:3 to 16:9 (no hints, maximize)`,
      {width:4000, height: 3000},
      noHints,
      {width:1920, height: 1080},
      true,
      {x: 240, y: 0, width: 1440, height:1080}
    ], [
      `round odd numbers`,
      {width:176, height:144},
      noHints,
      {width:800, height: 600},
      true,
      {x: 33, y: 0, width: 733, height:600}
    ], [
      `use WM hints (no maximize)`,
      {width:400, height: 300},
      {x: 50, y: 50, width: 1200, height: 720},
      {width:1920, height: 1080},
      false,
      {x: 50, y: 50, width: 1200, height:720}
    ], [
      `use WM position hints (no maximize)`, // electron is known to give x/y hints but no width/height
      {width:400, height: 300},
      {x: 50, y: 50, width: 0, height: 0},
      {width:1920, height: 1080},
      false,
      {x: 50, y: 50, width: 400, height:300}
    ], [
      `use WM hints (maximize)`,
      {width:400, height: 300},
      {x: 50, y: 50, width: 1280, height: 720},
      {width:1920, height: 1080},
      true,
      {x: 0, y: 0, width: 1920, height:1080}
    ],
  ].forEach((/**@type {[string,{width:number, height:number}, import("../lib/utils/rescale").WMHints, {width:number, height:number}, Boolean, import("../lib/utils/rescale").Bounds]} */ [
    opName, win, hints, scr, maximize, res
  ])=>{
    it(opName, ()=>{
      expect(fitScreen(win, hints, scr, maximize)).to.deep.equal(res);
    });
  })
})

describe("boundsChanged", function(){
  it("deepEquals", function(){
    expect(boundsChanged(
      {x:10, y: 20, width: 400,  height: 300},
      {x:10, y: 20, width: 400,  height: 300},
    )).to.be.false;
  })
})