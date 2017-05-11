function createUnconnectableError(lib){
  'use strict';
  var AllexError = lib.Error;
  function UnconnectableError(connectionstring){
    var ret = AllexError.call(this,'BAD_ADDRESS','Connection string '+connectionstring+' is not connectable');
    ret.transport = 'UnconnectableError';
    ret.connectionstring = connectionstring;
    return ret;
  }
  lib.inherit(UnconnectableError,AllexError);
  return UnconnectableError;
}

module.exports = createUnconnectableError;
