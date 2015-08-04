/**
 * Manager example usage
 */
var WindowManager = require("./index");
var manager = new WindowManager();
var toggled = false;
var toggle = function(callback){
  if(toggled){
    console.log("closing panel");
    manager.hpanel.quit(callback);
  }else{
    console.log("opening panel");
    manager.hpanel.open(__dirname,callback);//*/
  }
  toggled = !toggled;
}
manager.init(function(err){
  if(err){
    return console.log(err);
  }else if(!err && manager.hpanel){
    
    process.on("SIGINT",function(){
      console.log("exiting");
      manager.hpanel.quit(function(){
        process.exit();
      });
    });
  }
}).on("command",function(action){
  if(action === "menu"){
    toggle(function(e){
      if(e) console.log(e)
    })
  }
});
