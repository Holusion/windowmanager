/**
 * Manager example usage
 */
var Manager = require("./index");
var manager = new Manager();
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
});
