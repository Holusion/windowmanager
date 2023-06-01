'use strict';

const {fitScreen} = require("../lib/utils/rescale");


describe("fitScreen", function(){
  /**@type {[string,{width:number, height:number},{width:number, height:number}, XClientGeom]} */
  [
    [
      `homothetic grow 16:9`,
      {width:800, height: 450},
      {width:1920, height: 1080},
      {xPos: 0, yPos: 0, width: 1920, height:1080}
    ], [
      `homothetic grow 4:3`,
      {width:400, height: 300},
      {width:1440, height: 1080},
      {xPos: 0, yPos: 0, width: 1440, height:1080}
    ], [
      `grow 4:3 to 16:9`,
      {width:400, height: 300},
      {width:1920, height: 1080},
      {xPos: 240, yPos: 0, width: 1440, height:1080}
    ], [
      `grow 16:9 to 4:3`,
      {width:800, height: 450},
      {width:1440, height: 1080},
      {xPos: 0, yPos: 135, width: 1440, height:810}
    ], [
      `shrink 4:3 to 16:9`,
      {width:4000, height: 3000},
      {width:1920, height: 1080},
      {xPos: 240, yPos: 0, width: 1440, height:1080}
    ],[
      `round odd numbers`,
      {width:176, height:144},
      {width:800, height: 600},
      {xPos: 33, yPos: 0, width: 733, height:600}
    ]
  ].forEach((/**@type {[string,{width:number, height:number},{width:number, height:number}, XClientGeom]} */ [
    opName, win, scr, res
  ])=>{
    it(opName, ()=>{
      expect(fitScreen(win, scr)).to.deep.equal(res);
    });
  })
})