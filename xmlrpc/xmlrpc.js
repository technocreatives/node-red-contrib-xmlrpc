module.exports = function(RED) {
  'use strict';
  var xmlrpc = require('xmlrpc');

  function XmlRpcClientNode(n) {
    RED.nodes.createNode(this, n);

    // Configuration options passed by Node Red
    this.host = n.host;
    this.port = parseInt(n.port);
    this.path = n.path;

    // Node state
    var node = this;
    this.client = xmlrpc.createClient({
      host: this.host,
      port: this.port,
      path: this.path
    });

    this.methodCall = function(method, params, cb) {
      node.client.methodCall(method, params, cb);
    };
  }

  RED.nodes.registerType('xmlrpc-client', XmlRpcClientNode);

  function XmlRpcCallNode(n) {
    RED.nodes.createNode(this, n);
    this.method = n.method;
    this.client = n.client;
    this.clientConn = RED.nodes.getNode(this.client);

    var node = this;
    if (!this.clientConn) {
      this.error(RED._('missing client config', null));
      return;
    }

    this.on('input', function(msg) {
      var method = msg.method || node.method;
      var params = [].concat(msg.payload);
      node.clientConn.methodCall(method, params, function(error, value) {
        if (error) {
          node.error(RED._(error.message), msg);
          return;
        }
        msg.payload = value;
        node.send(msg);
      });
    });

  }

  RED.nodes.registerType('xmlrpc call', XmlRpcCallNode);

  function XmlRpcServerNode(n) {
    RED.nodes.createNode(this, n);
    var node = this;

    // Configuration options passed by Node Red
    this.host = n.host;
    this.port = parseInt(n.port);

    this.server = xmlrpc.createServer({
      host: this.host,
      port: this.port
    });
    this.server.on('NotFound', function(method, params) {
      node.warn(RED._('`' + method + '` method invoked, but not found'));
    });

    this.listen = function(method, callback) {
      if (node.server.listenerCount(method) !== 0) {
        node.warn(RED._('The method `' + method + '` is already registered.'));
        return;
      }
      node.server.on(method, callback);
    };

    this.removeListener = function(method) {
      node.server.removeAllListeners(method);
    };

    this.on('close', function(done) {
      if (node.server) {
        process.nextTick(function() {
          node.server.removeAllListeners();
          node.server.close(function() {
            done();
          });
        });

      } else {
        done();
      }
    });

  }

  RED.nodes.registerType('xmlrpc-server', XmlRpcServerNode);

  function XmlRpcListenerNode(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.method = n.method;
    this.server = n.server;
    this.serverConn = RED.nodes.getNode(this.server);

    if (!this.serverConn) {
      this.error(RED._('missing server config'), null);
      return;
    }

    this.serverConn.listen(this.method, function(err, params, cb) {
      if (err) {
        node.error(RED._(err.message), null);
        return;
      }
      var msg = {
        method: node.method,
        params: params,
        _xmlrpc: {
          cb: cb
        }
      };
      node.send(msg);
    });

    this.on('close', function(done) {
      if (node.serverConn) {
        node.serverConn.removeListener(node.method);
      }
      done();
    });
  }

  RED.nodes.registerType('xmlrpc listen', XmlRpcListenerNode);

  function XmlRpcResponseNode(n) {
    RED.nodes.createNode(this, n);
    var node = this;

    this.on('input', function(msg) {
      if (!msg._xmlrpc || !msg._xmlrpc.cb) {
        node.warn(RED._('Missing xmlrpc callback'));
        return;
      }
      var err = msg.err || null;
      var result = msg.payload;
      msg._xmlrpc.cb(err, result);
    });
  }

  RED.nodes.registerType('xmlrpc response', XmlRpcResponseNode);
};
