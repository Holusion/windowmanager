var revert = require("revert-keys");
describe("data - shortcuts.json",function(){
  var actions;
  before(function(){
    actions = require('../data/shortcuts.json').records;
  })
  it("exports an object",function(){
    expect(typeof actions).to.equal("object");
  });
  it("have object keys",function(){
    for (var action in actions){
      expect(typeof actions[action]).to.equal("object");
    }
  });
  it("can be searched",function(){
    expect(revert(actions)["ctrl+Escape"]).to.equal("menu");
  });
})
