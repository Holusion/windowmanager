'use strict';
const fs = require("fs/promises");
const path = require("path");

/** @type {[string, number][]} */
const modifiers = [
  ["ctrl", 4],
  ["alt" , 8],
  ["shift",1]
];

module.exports = class XKeyboard{
  #keycodes = {};
  #records = {};
  #names = {}
  #unicodes = {};

  constructor({records, keycodes, names, unicodes}){
    this.#records = records;
    this.#keycodes = keycodes;
    this.#names = names;
    this.#unicodes = unicodes;
  }

  static async Init(display){
    let {records, names, keysyms, unicodes} = JSON.parse(await fs.readFile(path.join(__dirname, "data.json"), {encoding:"utf-8"}));
    let keycodes = {};
    const min = display.min_keycode
    const max = display.max_keycode;
    /** @type {[0|number][]} */
    const list = await new Promise((resolve, reject)=>{
      display.client.GetKeyboardMapping(min , max - min, function(err, list){
        if(err){
          return reject(err);
        }
        return resolve(list);
      })
    });

    // map keycode to key name
    for (let i=0; i < list.length; ++i){
      let sublist = list[i];
      for (let j = 0; j < sublist.length; ++j){
        const keysym = sublist[j];
        const key_data = records[keysyms[keysym]];
        if(key_data){
          // In practice (on a french system), only ["apostrophe", "quoteright"] have multiple names
          //if(1 < key_data.names.length) console.log("Key has multiple names :", key_data);
          //This modifies `keysym.records` and subsequent calls to fromName & cie. will be affected

          keycodes[i+min] = Object.assign(key_data, {keycode: i+min});
        }
        //Might be more matches, but dunno why we would want those
        break; 
      }
    }
    return new XKeyboard({records, keycodes, names, unicodes});
  }

  getFromName(name){
    for(let keyname of [name, name.toLowerCase(), name.charAt(0).toUpperCase()+name.slice(1)]){
      let k = this.#records[this.#names[keyname]];
      if(k && typeof k.keycode  == "number") return k;
    }
    return undefined
  }
  getFromCode(keycode){
    return this.#keycodes[keycode];
  }
  getFromUnicode(code){
    console.log("get from unicode : ", code);
    let matchs = [];
    if (typeof code === 'string') {
      if (code.length !== 1) {
        throw new Error('String must be 1 character');
      }
      matchs = this.getFromUnicode(code.charCodeAt(0));
    }
    else {
      matchs = (this.#unicodes[code] || []).map((i)=> {
        return this.#records[i];
      });
    }
    
    const matchs_with_keycode = matchs.filter(c => (typeof c.keycode !== "undefined"));
    return matchs_with_keycode[0] || matchs[0]
  }

  getModifiers(mod){
    return modifiers.filter(([name, value])=>{
      return value & mod
    }).map(([name])=> name).join("+");
  }

  parseShortcut(keys){
    if(typeof keys !== "string") throw new Error("Keys should be a string. Got " + typeof keys);
    const keyset = keys.split("+");
    const mainkey = this.getFromName(keyset.pop());
    if(!mainkey) return;
    const mod_names_map = new Map(modifiers);
    const mods = keyset.reduce(function(acc, mod_string){
      return  acc | (mod_names_map.get(mod_string.toLowerCase()) || 0);
    }, 0);
    const unique_name = `${mods}+${mainkey.keysym}`
    return Object.assign({modifiers: mods, uid: unique_name}, mainkey);
  }

  parseEvent(e){
    const main_key = this.getFromCode(e.keycode);
    if(!main_key){
      throw new Error("Unknown keycode for event : "+e);
    }
    const modifiers_name = this.getModifiers(e.buttons) || "";
    return Object.assign({},main_key,{
      modifiers_name: modifiers_name,
      uid: `${e.buttons & ~2 & ~16 & ~128}+${main_key.keysym}`
    });
  }
}
