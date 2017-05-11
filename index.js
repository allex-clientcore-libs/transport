var net = require('net');

function createTransportFactory(lib, TalkerFactory) {
  'use strict';

  var q = lib.q,
    talkerFactory = new TalkerFactory(),
    wsTalkers = new lib.Map(),
    socketTalkers = new lib.Map();

  if ('undefined' === typeof window) {
    process.on('exit', destroyAllTalkers);
  } else {
    window.onclose = destroyAllTalkers;
  }

  function destroyAllTalkers() {
    lib.containerDestroyAll(socketTalkers);
    socketTalkers.destroy();
    lib.containerDestroyAll(wsTalkers);
    wsTalkers.destroy();
  }

  function TalkerSlot() {
    this.getMap().add(this.getName(), this);
  }
  TalkerSlot.prototype.destroy = function () {
    this.getMap().remove(this.getName());
  }
  TalkerSlot.prototype.getMap = lib.dummyFunc;
  TalkerSlot.prototype.getName = lib.dummyFunc;

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
  WSTalkerSlot.prototype.destroy = function () {
    if (!this.connectionstring) {
      return;
    }
    this.talker = null;
    this.defer = null;
    TalkerSlot.prototype.destroy.call(this);
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
    this.defer = defer;
    this.socket = null;
    this.connect();
    this.talker = null;
    TalkerSlot.call(this);
  }
  SocketSlot.prototype.destroy = function () {
    this.socket = null;
    this.defer = null;
    this.port = null;
    this.address = null;
    TalkerSlot.prototype.destroy.call(this);
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
    this.socket.on('connect',this.onConnected.bind(this));
    this.socket.on('error',this.onDisconnected.bind(this));
    if(this.port){
      this.socket.connect(this.port,this.address);
    }else{
      this.socket.connect(this.address);
    }
  };
  SocketSlot.prototype.onDisconnected = function(error){
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
  SocketSlot.prototype.onConnected = function(socket){
    if (!this.socket) {
      //wut?
      console.error('no socket?');
      return;
    }
    this.socket.removeAllListeners();
    this.resolve();
  };

  function factory(type) {
    var slot, connectionstring, address, port, defer;
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
            return slot.defer.promise;
          } else {
            socketTalkers.remove(connectionstring);
          }
        }
        defer = q.defer();
        slot = new SocketSlot(address, port, defer);
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
    }
  }

  require('./errors')(lib);

  return factory;
}

module.exports = createTransportFactory;
