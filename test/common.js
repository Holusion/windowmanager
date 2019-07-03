//TEST FRAMEWORKS
const chai = require('chai');
const cap = require('chai-as-promised');
const path = require("path");
//chai.config.includeStack = true;


process.env["XDG_DATA_DIRS"] = path.resolve(__dirname,"fixtures");
chai.use(cap);
//server.start(server.app);
global.expect = chai.expect;
