function createUnsupportedProtocolError(lib){
  'use strict';
  var AllexError = lib.Error;
  function UnsupportedProtocolError(protocol){
    var ret = AllexError.call(this,'UNSUPPORTED_PROTOCOL','Protocol '+protocol+' is not supported');
    ret.transport = 'UnsupportedProtocolError';
    ret.protocol = protocol;
    return ret;
  }
  lib.inherit(UnsupportedProtocolError,AllexError);
  return UnsupportedProtocolError;
}

module.exports = createUnsupportedProtocolError;

