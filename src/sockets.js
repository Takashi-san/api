// app/sockets.js

const logger = require("winston");
const bitcore = require("bitcore-lib");
const Mediator = require("../services/gunDB/Mediator/index.js");
const fs = require("fs");

// TODO
module.exports = function(
  io,
  lightning,
  lnd,
  login,
  pass,
  limitlogin,
  limitpass,
  lndLogfile,
  lnServicesData
) {
  const EventEmitter = require("events");

  class MySocketsEvents extends EventEmitter {}

  const mySocketsEvents = new MySocketsEvents();

  let clients = [];

  let authEnabled = (login && pass) || (limitlogin && limitpass);

  let userToken = null;
  let limitUserToken = null;
  if (login && pass) {
    userToken = new Buffer(login + ":" + pass).toString("base64");
  }
  if (limitlogin && limitpass) {
    limitUserToken = new Buffer(limitlogin + ":" + limitpass).toString(
      "base64"
    );
  }

  // register the lnd invoices listener
  let registerLndInvoiceListener = function(socket) {
    socket._invoiceListener = {
      dataReceived(data) {
        socket.emit("invoice", data);
      }
    };
    lnd.registerInvoiceListener(socket._invoiceListener);
  };

  // unregister the lnd invoices listener
  let unregisterLndInvoiceListener = function(socket) {
    lnd.unregisterInvoiceListener(socket._invoiceListener);
  };

  // register the socket listeners
  let registerSocketListeners = function(socket) {
    registerLndInvoiceListener(socket);
  };

  // unregister the socket listeners
  let unregisterSocketListeners = function(socket) {
    unregisterLndInvoiceListener(socket);
  };

  io.on("connection", async function(socket) {
    // socketConnection = socket;
    // this is where we create the websocket connection
    // with the GunDB service.

    Mediator.createMediator(socket);


    let lnServices;
    if (fs.existsSync(lnServicesData.macaroonPath)) {
      lnServices = await require("../services/lnd/lightning")(
        lnServicesData.lndProto,
        lnServicesData.lndHost,
        lnServicesData.lndCertPath,
        lnServicesData.macaroonPath
      );
    } else {
      lnServices = await require("../services/lnd/lightning")(
        lnServicesData.lndProto,
        lnServicesData.lndHost,
        lnServicesData.lndCertPath
      );
    }
    lightning = lnServices.lightning;

    mySocketsEvents.addListener("updateLightning", async () => {

      let lnServices;
      if (fs.existsSync(lnServicesData.macaroonPath)) {
        lnServices = await require("../services/lnd/lightning")(
          lnServicesData.lndProto,
          lnServicesData.lndHost,
          lnServicesData.lndCertPath,
          lnServicesData.macaroonPath
        );
      } else {
        lnServices = await require("../services/lnd/lightning")(
          lnServicesData.lndProto,
          lnServicesData.lndHost,
          lnServicesData.lndCertPath
        );
      }
      lightning = lnServices.lightning;
    });

    logger.debug("socket.handshake", socket.handshake);

    if (authEnabled) {
      try {
        let authorizationHeaderToken;
        if (socket.handshake.query.auth) {
          authorizationHeaderToken = socket.handshake.query.auth;
        } else if (socket.handshake.headers.authorization) {
          authorizationHeaderToken = socket.handshake.headers.authorization.substr(
            6
          );
        } else {
          socket.disconnect("unauthorized");
          return;
        }
        if (authorizationHeaderToken === userToken) {
          socket._limituser = false;
        } else if (authorizationHeaderToken === limitUserToken) {
          socket._limituser = true;
        } else {
          socket.disconnect("unauthorized");
          return;
        }
      } catch (err) {
        // probably because of missing authorization header
        logger.debug(err);
        socket.disconnect("unauthorized");
        return;
      }
    } else {
      socket._limituser = false;
    }

    /** printing out the client who joined */
    logger.debug("New socket client connected (id=" + socket.id + ").");

    socket.emit("hello", { limitUser: socket._limituser });

    socket.broadcast.emit("hello", { remoteAddress: socket.handshake.address });

    /** pushing new client to client array*/
    clients.push(socket);

    registerSocketListeners(socket);

    /** listening if client has disconnected */
    socket.on("disconnect", function() {
      clients.splice(clients.indexOf(socket), 1);
      unregisterSocketListeners(socket);
      logger.debug("client disconnected (id=" + socket.id + ").");
    });
  });


  return mySocketsEvents;
};
