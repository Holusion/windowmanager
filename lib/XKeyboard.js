var x11 = require('x11');
var keysyms = require('../data/keysymbols').records;
var ks2Name = {};
for (var k in keysyms)
    ks2Name[keysyms[k].keysym] = keysyms[k].names;

function XKeyboard (display){
  var self = this;
  this.kk2Name = {};

  var client = display.client
    , min = display.min_keycode
    , max = display.max_keycode;
  client.GetKeyboardMapping(min, max-min, function(err, list) {
      for (var i=0; i < list.length; ++i){
        var name = [];
        var sublist = list[i];
        for (var j =0; j < sublist.length; ++j)
          name.push(ks2Name[sublist[j]]);
        self.kk2Name[i+min] = name[0];
      }
    });
}
/**
 * Event is specified in the X protocol. it is identified with a KeyPress name for example.
 * @param  {[type]} event [description]
 * @return {[type]}       [description]
 */
XKeyboard.prototype.getKey = function (ev) {
  var modifiers = this.getModifiers(ev.buttons);
  var key;
  if (this.kk2Name[ev.keycode]){
    key = this.kk2Name[ev.keycode];
  }else{
    key = String.fromCharCode(ev.keycode);
  }
  return modifiers+key;
};

XKeyboard.prototype.getModifiers = function(keys){
  return ( ((keys & 8) == 8) ? 'alt+' : '') +
  ( ((keys & 4) == 4) ? 'ctrl+' : '') +
  ( ((keys & 1) == 1) ? 'shift+' : '');
}

module.exports = XKeyboard;
