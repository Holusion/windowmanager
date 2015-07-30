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

    setInterval(function(){
      manager.hpanel.hide(function(e){
        
      });
      setTimeout(function(){
        manager.hpanel.open(__dirname);
      },3000)
    },6000)
    process.on("SIGINT",function(){
      manager.hpanel.quit(function(){
        console.log("exiting");
        process.exit();
      });
    })
  }
});
