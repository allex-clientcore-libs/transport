function createTransportErrors(lib){
  'use strict';
  lib.DestinationError = require('./destinationerrorcreator')(lib);
  lib.UnsupportedProtocolError = require('./unsupportedprotocolerrorcreator')(lib);
  lib.UnconnectableError = require('./unconnectableerrorcreator')(lib);
  lib.NoServerError = require('./noservererrorcreator')(lib);
};

module.exports = createTransportErrors;
