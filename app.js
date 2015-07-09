/**
 * Manager example usage
 */
var Manager = require("./index");
var manager = new Manager();
manager.init(function(err){
  console.log("initialized manager");
  if(!err && manager.hpanel){
    console.log("managing menu");
    manager.hpanel.show();

    setInterval(function(){
      manager.hpanel.hide();
      setTimeout(function(){
        manager.hpanel.show();
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
