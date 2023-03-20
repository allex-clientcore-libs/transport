function createNoServerError(lib){
  'use strict';
  var AllexError = lib.Error;
  function NoServerError(protocol,address,port,originalerror){
    var description = 'No server at '+protocol+'://'+address+
    (
      originalerror ? ' ('+originalerror.toString()+')' : ''
    );
    if(port){
      description += (':'+port);
    }
    var ret = AllexError.call(this,'NO_SERVER',description);
    ret.transport = 'NoServerError';
    ret.address = address;
    ret.port = port;
    return ret;
  }
  lib.inherit(NoServerError,AllexError);
  return NoServerError;
}

module.exports = createNoServerError;

