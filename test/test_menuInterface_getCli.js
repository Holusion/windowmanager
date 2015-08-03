var MenuInterface = require("../lib/MenuInterface");

describe("MenuInterface.getCliInterface",function(){
  it("can find executable",function(done){
    var mint = new MenuInterface();
    mint.executableName = "ls";
    mint.getCliInterface(function(err,iface){
      expect(err).to.be.null;
      expect(iface).to.be.not.null;
      expect(typeof iface.open).to.equal("function");
      done();
    });
  });
  it("can open",function(done){
    var mint = new MenuInterface();
    mint.executableName = "sleep";
    mint.getCliInterface(function(err,iface){
      expect(err).to.be.null;
      expect(iface).to.be.not.null;
      iface.open("0",function(e){
        expect(e).to.be.null;
        done();
      });

    });
  });
  it("can close",function(done){
    var mint = new MenuInterface();
    mint.executableName = "sleep";
    mint.getCliInterface(function(err,iface){
      expect(err).to.be.null;
      expect(mint.child_process).to.be.undefined;
      expect(iface).to.be.not.null;
      iface.open("10",function(e){
        expect(e).to.be.null;
        iface.quit(function(e){
          done(e);
        });
      });
    });
  });
})
