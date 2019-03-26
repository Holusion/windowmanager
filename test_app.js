/**
 * Manager example usage
 */
var WindowManager = require("./index");
var manager = new WindowManager();
var str="";


manager.init(function(err){
  if(err){
    console.log("init error : ",err);
  }
});
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', function (chunk) {
    var lines = chunk.toString().split('\n');
    lines.unshift(str + lines.shift());
    str = lines.pop();
    lines.forEach(function(line) {
			args = line.match(/"[^"]+"|'[^']+'|\S+/g);
			command = args.shift();
        manager.launch(command,args);
    });
});
console.log("init")
console.log(process.argv[2])
if(process.argv[2]){
  manager.launch(process.argv[2],[]);
}
