'use strict';
const x11 = require('x11');
const {getKeyMaps, getFromName, getFromUnicode, getFromCode, getModifiers, parseModifiers, parseShortcut, parseEvent} = require("../lib/Xutils/XKeyboard");

describe("XKeyboard",function(){
  let test_key;
  const test_key_name = "Up";
  before(function(done){
    x11.createClient(function(err,display) {
      expect(err).to.be.undefined;
      getKeyMaps(display,function(err){
        test_key = getFromName(test_key_name);
        done(err);
      })
    })
  });
  //Do NOT test the soundness of the whole keysym -> keycode mapping as it's client-dependant
  describe("getFromCode()",function(){
    it("Match the test key",function(){
      expect(test_key.keycode).to.be.a.number;
      const code_data = getFromCode(test_key.keycode);
      expect(code_data).to.deep.equal(test_key);
    })
  })
  describe("getFromUnicode()", function(){
    it("Return a char with keycode if available",function(){
      const space_char = getFromUnicode(0x20);
      expect(space_char).to.be.an("object");
      expect(space_char).to.have.property("keycode").a("number");

    })
  })
  describe("getFromName()", function() {
    it("Match multiple names",function(){
      //Maybe this test is too locale-dependant? some systems might not have the same two names
      const quote_key_1 = getFromName("apostrophe");
      const quote_key_2 = getFromName("quoteright");
      expect(quote_key_1).to.be.an("object");
      expect(quote_key_2).to.be.an("object");
      expect(quote_key_1).to.deep.equal(quote_key_2);
    })
    it("is case insensitive",function(){
      const space_char = getFromName("space");
      expect(space_char).to.be.an("object");
      expect(getFromName("Space")).to.deep.equal(space_char);
      expect(getFromName("SPACE")).to.deep.equal(space_char);
      //Also test with one that has a default Uppercased first letter
      expect(getFromName("up")).to.deep.equal(getFromName("Up"));
    })
  });
  const fixtures = new Map([
    [0,""],
    [1, "shift"],
    [5, "ctrl+shift"],
    [16 | 5, "ctrl+shift"] //ignore numlock
  ])
  describe("getModifiers()",function(){
    for(const [key, value] of fixtures.entries()){
      it(`Get modifiers name: ${key} => ${value}`,function(){
        const mods = getModifiers(key);
        expect(mods).to.equal(value);
      })
    }
  })

  describe("parseShortcut()", function() {
    for(const [key, value] of fixtures.entries()){
      it(`Parse modifiers name : ${value} => ${key}`,function(){
        const mods = parseShortcut(value+"+Up");
        expect(mods).to.have.property("modifiers",key& ~2 & ~16 & ~128); //ignore lock keys
      })
    }
    it(`Accept random-order modifiers`,function(){
      const mods1 = parseShortcut("ctrl+alt+shift+Up");
      const mods2 = parseShortcut("ctrl+shift+alt+Up");
      expect(mods1).to.deep.equal(mods2);
    });
    [
      ["ctrl+shift+Return", 5, "Return"]
    ].forEach(function([shortcut, mods, key]){
      it(`Can be used on full shortcut sequence ${shortcut}`, function(){
        const sh = parseShortcut(shortcut);
        expect(sh).to.deep.equal(Object.assign({modifiers:mods, uid: "5+65293"},getFromName(key)));
      })
    })
    it("Return undefined value when shortcut is invalid",function(){
      expect(parseShortcut("shift+foo")).to.be.undefined;
    })
    it(`uses case-insensitive values as much as possible`,function(){
      //Some camel-cased keys are always going to prove difficult to parse
      const ref = parseShortcut("ctrl+alt+G");
      expect(ref).to.be.an("object").have.property("names");
      [
        "Ctrl+alt+G",
        "Ctrl+Alt+G"
      ].forEach(t=>{
        expect(parseShortcut(t)).to.deep.equal(ref);
      })
    });
  })
  describe("parseEvent()",function(){
    const sample_event = Object.freeze({
      type: 2,
      seq: 46,
      name: 'KeyPress',
      time: 491778106,
      // keycode: 111, do not set keycode
      root: 877,
      wid: 877,
      child: 2097153,
      rootx: 213,
      rooty: 214,
      x: 213,
      y: 214,
      buttons: 16,
      sameScreen: 1
    })
    function newEvent(props){
      return Object.assign({keycode: test_key.keycode},sample_event, props);
    }
    it("Throw on unknown key",function(){
      expect(function(){
        parseEvent(newEvent({keycode:0}));
      }).to.throw();
    });
    it("return modifiers as a string",function(){
      const d = parseEvent(newEvent({ buttons:17 }));// numlock+shift
        expect(d).to.have.property("modifiers_name", "shift");
    });
    it("Gives the same uid for any combination of num/caps/scroll lock",function(){
      const ref = parseEvent(newEvent({buttons:0}));
      [2,16,18,128,130,144,146].forEach(function(m){
        const d = parseEvent(newEvent({buttons:m}));
        expect(d).to.have.property("uid", ref.uid);
      })
    })
    
  })
})
