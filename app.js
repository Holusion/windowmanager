/**
 * Manager example usage
 */
var WindowManager = require("./index");
var manager = new WindowManager();
var toggled = false;

function launch(){
	console.log("launching app");
	manager.launch("/usr/bin/xterm")
}

manager.init(function(err){
  if(err){
    console.log("init error : ",err);
  }
});
setTimeout(launch,4000);
