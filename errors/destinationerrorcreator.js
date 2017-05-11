function createDestinationError(lib){
  'use strict';
  var AllexError = lib.Error;
  function DestinationError(protocol,address,port){
    var description = 'Could not connect to '+protocol+'://'+address;
    if(port){
      description += (':'+port);
    }
    var ret = AllexError.call(this,'ADDRESS_NOT_FOUND',description);
    ret.transport = 'DestinationError';
    ret.address = address;
    ret.port = port;
    return ret;
  }
  lib.inherit(DestinationError,AllexError);
  return DestinationError;
}

module.exports = createDestinationError;
