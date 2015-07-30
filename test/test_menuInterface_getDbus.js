var MenuInterface = require("../MenuInterface")
, Promise = require('es6-promise').Promise;

describe("MenuInterface.getDbusInterface",function(){
  beforeEach(function(){
    var mint = new MenuInterface();
    mint.bus = "org.foo.bar";
    mint.path = "/org/foo/bar";
    mint.panelInterface = "org.foo.bar.iface";
    this.mint = mint;
  })
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
    })

  })
  it("can fail",function(done){
    this.mint.getDbusInterface(function(err,iface){
      expect(err).to.be.not.null;
      done();
    });
  });
})
