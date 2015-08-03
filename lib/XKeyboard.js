var x11 = require('x11');
var keysyms = require('./keysymbols').records;
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
        var name = self.kk2Name[i+min] = [];
        var sublist = list[i];
        for (var j =0; j < sublist.length; ++j)
          name.push(ks2Name[sublist[j]]);
      }
    });
}
/**
 * Event is specified in the X protocol. it is identified with a KeyPress name for example.
 * @param  {[type]} event [description]
 * @return {[type]}       [description]
 */
XKeyboard.prototype.getKey = function (event) {
  var modifiers = this.getModifiers(event.buttons);
  key = String.fromCharCode(ev.keycode);
  matches = /^XK_(.+?),/.exec(this.kk2Name[ev.keycode]);
  if (matches){
    key = matches[1];
  }
  return key;
};

XKeyboard.prototype.getModifiers = function(keys){
  return ( ((keys & 8) == 8) ? 'alt+' : '') +
  ( ((keys & 4) == 4) ? 'ctrl+' : '') +
  ( ((keys & 1) == 1) ? 'shift+' : '');
}

module.exports = XKeyboard;
