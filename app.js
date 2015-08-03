/**
 * Manager example usage
 */
var WindowManager = require("./index");
var manager = new WindowManager();
manager.init(function(err){
  if(err){
    return console.log(err);
  }else if(!err && manager.hpanel){
    console.log("managing menu");
    manager.hpanel.open(__dirname,function(e){
      console.log("opened panel");
    });
    process.on("SIGINT",function(){
      console.log("exiting");
      manager.hpanel.quit(function(){});
      process.exit();
    });
  }
}).on("KeyPress",function(key){
  console.log("key pressed : ",key);
});
