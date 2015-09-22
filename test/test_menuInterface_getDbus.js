var MenuInterface = require("../lib/MenuInterface")
  , Promise = require('es6-promise').Promise
  , dbus = require('dbus-native');

describe("MenuInterface.getDbusInterface",function(){
  describe("mock",function(){
    beforeEach(function(){
      var mint = new MenuInterface();
      mint.bus = "org.foo.bar";
      mint.path = "/org/foo/bar";
      mint.interface = "org.foo.bar.iface";
      this.mint = mint;
    });
    it("init",function(done){
      this.mint.getDbusInterface = function(cb){
        cb(null,{fake:true});
      }
      this.mint.getCliInterface = function(cb){
        expect(true).to.be.false; //Should not be called!
      }
      this.mint.init();
      expect(this.mint.iface).to.be.instanceof(Promise);
      this.mint.iface.catch(function(err){expect(err).to.be.null}).then(function(iface){
        done();
      });
    });
    it("detect undeclared service",function(done){
      this.mint.getDbusInterface(function(err,iface){
        expect(err).to.be.not.null;
        expect(typeof iface).to.equal("undefined");
        done();
      });
    });
  });
  describe("real",function(){
    var mint, bus;
    const name = "org.foo.bar",ipath="/org/foo/bar",iface="org.foo.bar"
    before(function(){
      bus = dbus.sessionBus();
      bus.requestName(name, 0);
      var exampleIface = {
        name: iface,
        methods: {
            doStuff: [null, 's']
        }
      };
      var example = {
        doStuff: function() {
            return 'Received "' + s + '" - this is a reply';
        }
      };
      bus.exportInterface(example, ipath, exampleIface);
      mint = new MenuInterface();
      mint.bus = name;
      mint.path = ipath;
      mint.interface = iface;
    });
    it("detect existing service and interface",function(done){
      mint.getDbusInterface(function(err,iface){
        expect(err).to.be.null;
        expect(typeof iface).to.equal("object");
        expect(iface).to.have.property("doStuff");
        done();
      });
    });
  });
})
