'use strict';

const {fitScreen} = require("../lib/utils/rescale");


describe("fitScreen", function(){
  [
    [
      `homothetic grow 16:9`,
      {width:800, height: 450},
      {width:1920, height: 1080},
      {x: 0, y: 0, width: 1920, height:1080}
    ], [
      `homothetic grow 4:3`,
      {width:400, height: 300},
      {width:1440, height: 1080},
      {x: 0, y: 0, width: 1440, height:1080}
    ], [
      `grow 4:3 to 16:9`,
      {width:400, height: 300},
      {width:1920, height: 1080},
      {x: 240, y: 0, width: 1440, height:1080}
    ], [
      `grow 16:9 to 4:3`,
      {width:800, height: 450},
      {width:1440, height: 1080},
      {x: 0, y: 135, width: 1440, height:810}
    ], [
      `shrink 4:3 to 16:9`,
      {width:4000, height: 3000},
      {width:1920, height: 1080},
      {x: 240, y: 0, width: 1440, height:1080}
    ]
  ].forEach(([opName, win, scr, res])=>{
    it(opName, ()=>{
      expect(fitScreen(win, scr)).to.deep.equal(res);
    });
  })
})