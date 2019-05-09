'use strict';
const x11 = require('x11');
const {fromKeysym, fromName, fromUnicode, records} = require("keysym")
//keysyms is an array of records like :
// {"keysym":32,"unicode":32,"status":".","names":["space"]},

const modifiers = [
  ["ctrl", 4],
  ["alt" , 8],
  ["shift",1]
];

const kk2name = {};

//Populate the "keycode" field of mapped keys
function getKeyMaps(display, callback){
  let ks2name = {};
  for (var k in records)
    ks2name[records[k].keysym] = records[k].names;
  const client = display.client
  const min = display.min_keycode
  const max = display.max_keycode;
  display.client.GetKeyboardMapping(min , max - min, function(err, list){
    if(err){
      return callback(err);
    }
    // map keycode to key name
    for (let i=0; i < list.length; ++i){
        let sublist = list[i];
        for (let j = 0; j < sublist.length; ++j){
          const key_data = fromKeysym(sublist[j]);
          if(key_data){
            // In practice (on a french system), only ["apostrophe", "quoteright"] have multiple names
            //if(1 < key_data.names.length) console.log("Key has multiple names :", key_data);
            //This modifies `keysym.records` and subsequent calls to fromName & cie. will be affected
            kk2name[i+min] = Object.assign(key_data,{keycode:i+min});
          }
          //Might be more matches, but dunno why we would want those
          break; 
        }
    }
    return callback(null);
  })
}

// Does not work if getKeyMaps hasn't been called yet.
function getFromCode(keycode){
  //return fromKeysym(keysym - this.min);
  return kk2name[keycode];
}

function getFromName(name){
  return fromName(name);
}

function getModifiers(mod){
  return modifiers.filter(([name, value])=>{
    return value & mod
  }).map(([name])=> name).join("+");
}


function parseShortcut(keys){
  if(!keys) return;
  const keyset = keys.split("+");
  const mainkey = getFromName(keyset.pop());
  if(!mainkey) return;
  const mod_names_map = new Map(modifiers);
  const mods = keyset.reduce(function(acc, mod){
    return  acc | (mod_names_map.get(mod) || 0);
  }, 0);
  const unique_name = `${mods}+${mainkey.keysym}`
  return Object.assign({modifiers: mods, uid: unique_name}, mainkey);
}

function parseEvent(e){
  const main_key = getFromCode(e.keycode);
  if(!main_key){
    throw new Error("Unknown keycode : "+e.keycode);
  }
  const modifiers_name = getModifiers(e.buttons) || "";
  return Object.assign({},main_key,{
    modifiers_name: modifiers_name,
    uid: `${e.buttons & ~2 & ~16 & ~128}+${main_key.keysym}`
  });
}

module.exports = {
  getKeyMaps, 
  getFromName, 
  getFromCode, 
  getModifiers,
  parseShortcut,
  parseEvent};
