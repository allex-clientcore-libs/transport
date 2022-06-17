var net = require('net');

function createTransportFactory(lib, TalkerFactory) {
  'use strict';

  var q = lib.q,
    talkerFactory = new TalkerFactory(),
    httpTalkers = new lib.Map(),
    wsTalkers = new lib.Map(),
    socketTalkers = new lib.Map();

  var _factoryOn = true;

  if ('undefined' === typeof window) {
    process.on('SIGTERM', destroyAllTalkers);
    process.on('SIGINT', destroyAllTalkers);
    process.on('exit', destroyAllTalkers);
  } else {
    window.onclose = destroyAllTalkers;
  }

  function destroyAllTalkers(signal) {
    var err;
    _factoryOn = false;
    err = new lib.Error(lib.isString(signal) ? signal : 'TIME_TO_TERMINATE_TALKING');
    lib.containerDestroyAll(httpTalkers, err);
    httpTalkers.destroy(err);
    lib.containerDestroyAll(socketTalkers, err);
    socketTalkers.destroy(err);
    lib.containerDestroyAll(wsTalkers, err);
    wsTalkers.destroy(err);
  }

  function TalkerSlot() {
    this.getMap().add(this.getName(), this);
  }
  TalkerSlot.prototype.destroy = function () {
    this.getMap().remove(this.getName());
  }
  TalkerSlot.prototype.getMap = lib.dummyFunc;
  TalkerSlot.prototype.getName = lib.dummyFunc;

  function HttpTalkerSlot(connectionstring, address, port, defer) {
    if (!connectionstring) {
      throw new lib.Error('NO_WS_CONNECTION_STRING');
    }
    this.connectionstring = connectionstring;
    this.defer = defer;
    TalkerSlot.call(this);
    this.talker = talkerFactory.newHttpTalker(connectionstring, address, port, defer);
    this.talker.aboutToDie.attach(this.destroy.bind(this));
  }
  HttpTalkerSlot.prototype.destroy = function (exception) {
    TalkerSlot.prototype.destroy.call(this, exception);
    if (this.talker) {
      this.talker.destroy(exception);
    }
    this.talker = null;
    this.defer = null;
    this.connectionstring = null;
  };
  HttpTalkerSlot.prototype.getMap = function () {
    return httpTalkers;
  };
  HttpTalkerSlot.prototype.getName = function () {
    return this.connectionstring;
  };

  function WSTalkerSlot(connectionstring, address, port, defer) {
    if (!connectionstring) {
      throw new lib.Error('NO_WS_CONNECTION_STRING');
    }
    this.connectionstring = connectionstring;
    this.defer = defer;
    TalkerSlot.call(this);
    defer.promise.then(null, this.destroy.bind(this));
    this.talker = talkerFactory.newWSTalker(connectionstring, address, port, defer);
    this.talker.aboutToDie.attach(this.destroy.bind(this));
  }
  WSTalkerSlot.prototype.destroy = function (exception) {
    if (!this.connectionstring) {
      return;
    }
    this.talker = null;
    this.defer = null;
    TalkerSlot.prototype.destroy.call(this, exception);
    this.connectionstring = null;
  };
  WSTalkerSlot.prototype.getMap = function () {
    return wsTalkers;
  };
  WSTalkerSlot.prototype.getName = function () {
    return this.connectionstring;
  };

  function SocketSlot(address, port, defer) {
    this.address = address;
    this.port = port;
    this.onConnectedBound = this.onConnected.bind(this);
    this.onErrorBound = this.onError.bind(this);
    this.onClosedBound = this.onClosed.bind(this);
    this.defer = defer;
    this.socket = null;
    this.connect();
    this.talker = null;
    TalkerSlot.call(this);
  }
  SocketSlot.prototype.destroy = function (exception) {
    this.talker = null;
    this.socket = null;
    this.defer = null;
    this.onClosedBound = null;
    this.onErrorBound = null;
    this.onConnectedBound = null;
    this.port = null;
    this.address = null;
    TalkerSlot.prototype.destroy.call(this, exception);
  };
  SocketSlot.prototype.getMap = function () {
    return socketTalkers;
  };
  SocketSlot.prototype.getName = function () {
    return this.address+':'+this.port;
  };
  SocketSlot.prototype.resolve = function () {
    if (!this.defer) {
      return;
    }
    if (this.talker) {
      return;
    }
    this.talker = talkerFactory.newTcpTalker(this.socket, null, false);
    this.defer.resolve(this.talker);
  };
  SocketSlot.prototype.reject = function (reason) {
    if (!this.defer) {
      return;
    }
    this.defer.reject(reason);
    this.destroy();
  };
  SocketSlot.prototype.connect = function(){
    if(this.socket){
      this.reject(new lib.Error('ALREADY_CONNECTED', 'Already connected to '+this.address+':'+this.port));
    }
    if(this.talker){
      this.reject(new lib.Error('ALREADY_CONNECTED', 'Already connected to '+this.address+':'+this.port));
    }
    //console.log('connecting to',this.address,this.port);
    if(!(this.address)){//&&this.port)){
      return;
    }
    this.socket = new net.Socket();
    this.socket.on('connect',this.onConnectedBound);
    this.socket.on('error',this.onErrorBound);
    this.socket.on('close', this.onClosedBound);
    if(this.port){
      this.socket.connect(this.port,this.address);
    }else{
      this.socket.connect(this.address);
    }
  };
  SocketSlot.prototype.onError = function(error){
    if(this.socket){
      this.socket.removeAllListeners();
    }
    this.socket = null;
    switch(error.code){
      case 'ENOENT':
      case 'ENOTFOUND':
        this.reject(new lib.DestinationError('socket',this.address,this.port));
        break;
      case 'ECONNREFUSED':
        this.reject(new lib.NoServerError('socket',this.address,this.port));
      default:
        setTimeout(this.connect.bind(this),100);
        break;
    }
  };
  SocketSlot.prototype.onClosed = function () {
    if (this.socket) {
      this.socket.removeListener('close', this.onClosedBound);
    }
    this.destroy();
  };
  SocketSlot.prototype.onConnected = function(socket){
    if (!this.socket) {
      //wut?
      console.error('no socket?');
      return;
    }
    this.socket.removeListener('connect', this.onConnectedBound);
    this.socket.removeListener('error', this.onErrorBound);
    this.resolve();
  };

  function talkerchecker (type, address, port, talker) {
    var _t = type, _a = address, _p = port;
    type = null;
    address = null;
    port = null;
    if (!(talker && talker.isUsable())) {
      return factory(_t, _a, _p);
    }
    return talker;
  }

  function factory(type) {
    var slot, connectionstring, address, port, defer;
    if (!_factoryOn) {
      return q(null);
    }
    switch(type) {
      case 'inproc':
        return talkerFactory.newInProcTalker(arguments[1]);
      case 'socket':
        return talkerFactory.newTcpTalker(arguments[1], arguments[2], arguments[3]);
      case 'initiatingsocket':
        address = arguments[1];
        port = arguments[2];
        connectionstring = address+':'+port;
        var slot = socketTalkers.get(connectionstring);
        if (slot) {
          if (slot.defer) {
            return slot.defer.promise.then(
              talkerchecker.bind(null, type, address, port)
            );
          } else {
            socketTalkers.remove(connectionstring);
          }
        }
        defer = q.defer();
        slot = new SocketSlot(address, port, defer);
        return slot.defer.promise;
      case 'http':
        connectionstring = arguments[1];
        address = arguments[2];
        port = arguments[3];
        slot = httpTalkers.get(connectionstring);
        defer = q.defer();
        if (slot) {
          return slot.defer.promise;
        }
        slot = new HttpTalkerSlot(connectionstring, address, port, defer);
        return slot.defer.promise;
      case 'ws':
        /*
        return new WSTalker(arguments[1], arguments[2], arguments[3], arguments[4]);
        */
        connectionstring = arguments[1];
        address = arguments[2];
        port = arguments[3];
        slot = wsTalkers.get(connectionstring);
        defer = q.defer();
        if (slot) {
          return slot.defer.promise;
        }
        slot = new WSTalkerSlot(connectionstring, address, port, defer);
        return slot.defer.promise;
        case 'proc':
          return talkerFactory.newProcessTalker(arguments[1], arguments[2]);
        case 'externalproc':
          return talkerFactory.newExternalProcessTalker(arguments[1], arguments[2]);
        }
  }

  require('./errors')(lib);

  return factory;
}

module.exports = createTransportFactory;
