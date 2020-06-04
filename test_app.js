/**
 * Manager example usage
 */
var {manageDisplay} = require("./index");
var str="";

manageDisplay().then( manager=> {
  setInterval(()=>{
    manager.showError("Date", new Date().toLocaleString());
  },1000);
})

