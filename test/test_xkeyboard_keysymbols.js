describe("XKeyboard - keysymbols.json",function(){
  it("exports a list",function(){
    var syms = require('../lib/keysymbols.json').records;
    expect(typeof syms).to.equal("object");
    for (var k in syms){
      try{
        expect(typeof syms[k].keysym).to.equal("number");
        expect(typeof syms[k].names).to.equal("object");
        expect(Object.keys(syms[k]).length).to.be.above(0);
      }catch(e){
        console.log("on : ",syms[k]);
        throw e;
      }
    }
  })
})
