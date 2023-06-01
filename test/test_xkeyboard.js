'use strict';
const x11 = require('x11');
const XKeyboard = require("../lib/Xutils/XKeyboard");

describe("XKeyboard",function(){
  let test_key;
  const test_key_name = "Up";
  let client;
  let keyboard
  before(function(done){
    client = x11.createClient(function(err, display) {
      expect(err).to.be.undefined;
      XKeyboard.Init(display).then((k)=>{
        keyboard = k;
        test_key = keyboard.getFromName(test_key_name);
        done();
      }, done);
    })
  });
  after(function(){
    client.close();
  })
  //Do NOT test the soundness of the whole keysym -> keycode mapping as it's client-dependant
  describe("keyboard.getFromCode()",function(){
    it("Match the test key",function(){
      expect(test_key.keycode).to.be.a("number");
      const code_data = keyboard.getFromCode(test_key.keycode);
      expect(code_data).to.deep.equal(test_key);
    })
  })
  describe("keyboard.getFromUnicode()", function(){
    it("Return a char with keycode if available",function(){
      const space_char = keyboard.getFromUnicode(0x20);
      expect(space_char).to.be.an("object");
      expect(space_char).to.have.property("keycode").a("number");

    })
  })
  describe("keyboard.getFromName()", function() {
    it("Match multiple names",function(){
      //Maybe this test is too locale-dependant? some systems might not have the same two names
      const quote_key_1 = keyboard.getFromName("apostrophe");
      const quote_key_2 = keyboard.getFromName("quoteright");
      expect(quote_key_1).to.be.an("object");
      expect(quote_key_2).to.be.an("object");
      expect(quote_key_1).to.deep.equal(quote_key_2);
    })
    it("is case insensitive",function(){
      const space_char = keyboard.getFromName("space");
      expect(space_char).to.be.an("object");
      expect(keyboard.getFromName("Space")).to.deep.equal(space_char);
      expect(keyboard.getFromName("SPACE")).to.deep.equal(space_char);
      //Also test with one that has a default Uppercased first letter
      expect(keyboard.getFromName("up")).to.deep.equal(keyboard.getFromName("Up"));
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
        const mods = keyboard.getModifiers(key);
        expect(mods).to.equal(value);
      })
    }
  })

  describe("keyboard.parseShortcut()", function() {
    for(const [key, value] of fixtures.entries()){
      it(`Parse modifiers name : ${value} => ${key}`,function(){
        const mods = keyboard.parseShortcut(value+"+Up");
        expect(mods).to.have.property("modifiers",key& ~2 & ~16 & ~128); //ignore lock keys
      })
    }
    it("`refuses non-string arguments",function(){
      expect(_=>{keyboard.parseShortcut({})}).to.throw(Error);
      expect(_=>{keyboard.parseShortcut()}).to.throw(Error);
      expect(_=>{keyboard.parseShortcut(null)}).to.throw(Error);
    })
    it(`Accept random-order modifiers`,function(){
      const mods1 = keyboard.parseShortcut("ctrl+alt+shift+Up");
      const mods2 = keyboard.parseShortcut("ctrl+shift+alt+Up");
      expect(mods1).to.deep.equal(mods2);
    });
    [
      ["ctrl+shift+Return", 5, "Return"]
    ].forEach(function([shortcut, mods, key]){
      it(`Can be used on full shortcut sequence ${shortcut}`, function(){
        const sh = keyboard.parseShortcut(shortcut);
        expect(sh).to.deep.equal(Object.assign({modifiers:mods, uid: "5+65293"},keyboard.getFromName(key)));
      })
    })
    it("Return undefined value when shortcut is invalid",function(){
      expect(keyboard.parseShortcut("shift+foo")).to.be.undefined;
    })
    it("Accepts lowercase and uppercase letters",function(){
      expect(keyboard.parseShortcut("A")).to.deep.equal(keyboard.parseShortcut("a"));
      expect(keyboard.parseShortcut("A")).to.have.property("keycode").a("number");
    })
    it(`uses case-insensitive values as much as possible`,function(){
      //Some camel-cased keys are always going to prove difficult to parse
      const ref = keyboard.parseShortcut("ctrl+alt+g");
      expect(ref).to.be.an("object").have.property("names");
      [
        "Ctrl+alt+g",
        "Ctrl+Alt+g"
      ].forEach(t=>{
        expect(keyboard.parseShortcut(t)).to.deep.equal(ref);
      })
    });
  })
  describe("keyboard.parseEvent()",function(){
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
        keyboard.parseEvent(newEvent({keycode:0}));
      }).to.throw();
    });
    it("return modifiers as a string",function(){
      const d = keyboard.parseEvent(newEvent({ buttons:17 }));// numlock+shift
        expect(d).to.have.property("modifiers_name", "shift");
    });
    it("Gives the same uid for any combination of num/caps/scroll lock",function(){
      const ref = keyboard.parseEvent(newEvent({buttons:0}));
      [2,16,18,128,130,144,146].forEach(function(m){
        const d = keyboard.parseEvent(newEvent({buttons:m}));
        expect(d).to.have.property("uid", ref.uid);
      })
    })
    
  })
})
