var XKeyboard = require("../lib/Xutils/XKeyboard");

describe("XKeyboard",function(){
  it("getKey",function(){
    var getKey = XKeyboard.prototype.getKey;
    expect(typeof getKey ).to.equal("function");
    var mock = {
      kk2Name : { 1:"hello"},
      getModifiers : function(){ return ""},
      getKey : getKey
    }
    expect(mock.getKey({keycode:1})).to.equal("hello");
  });
})
