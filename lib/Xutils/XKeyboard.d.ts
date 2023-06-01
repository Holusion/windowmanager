export as namespace XKeyboard;

interface Key {
  keysym: number;
  names: string[];
  status: string;
  unicode: number;
}

interface KeyRecord extends Key {
  keycode :number
}

interface Shortcut extends KeyRecord{
  /**OR-ed modifiers keycodes for this shortcut */
  modifiers :number;
  /**The shortcut display name */
  uid :string;
}

type KeyNames = Record<string, number> 

interface XKeyboardData{
  /**Record of keys that may map to our keyboard */
  records :KeyRecord[];
  /** key names mapping to records */
  names :Record<string, number>;
  /** unicode reverse mapping */
  unicodes :Record<string,number[]>;
}


/**
 * Many things taken from the `keysym` module, rewritten to be asynchronous and handle X keycodes
 * @class
 */
declare class XKeyboard{
  constructor(data:XKeyboardData);

  #records :KeyRecord[];
  #names :Record<string, number>;
  #unicodes :Record<string,number[]>;

  /**
   * Initializes a keyboard using a Display from x11
   */
  static async Init(display:any):Promise<XKeyboard>;

  /**
   * Get a key from its name. Auto handle case-insensitive fallbacks if necessary
   */
  getFromName(name :string) :?KeyRecord;
  getFromCode(keycode:number):?KeyRecord;

  getFromUnicode(code:string|number):?KeyRecord;

  getModifiers(mod:number):string;

  parseShortcut(keys:string):Shortcut;

  parseEvent(e:{keycode:number}):Shortcut;
}

export = XKeyboard;