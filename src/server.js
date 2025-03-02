"use strict";

/**
 * Module dependencies.
 */
const server = async program => {
  const express = require("express");
  const app = express();

  const fs = require("fs");
  const bodyParser = require("body-parser"); // pull information from HTML POST (express4)
  const session = require("express-session");
  const methodOverride = require("method-override"); // simulate DELETE and PUT (express4)
  // load app default configuration data
  const defaults = require("../config/defaults");
  // load other configuration data
  const config = require("../config/config");
  // define useful global variables ======================================
  module.useTLS = program.usetls;
  module.serverPort = program.serverport || defaults.serverPort;
  module.httpsPort = module.serverPort;
  module.serverHost = program.serverhost || defaults.serverHost;

  // setup winston logging ==========
  const logger = require("../config/log")(
    program.logfile || defaults.logfile,
    program.loglevel || defaults.loglevel
  );

  // utilities functions =================
  const utils = require("../utils/server-utils")(module);
  const db = require("../services/database")(defaults.dataPath);

  // setup lightning client =================
  const lnrpc = require("../services/lnd/lightning");
  const lndHost = program.lndhost || defaults.lndHost;
  const lndCertPath = program.lndCertPath || defaults.lndCertPath;
  const macaroonPath = program.macaroonPath || defaults.macaroonPath;

  const wait = seconds =>
    new Promise(resolve => {
      const timer = setTimeout(() => resolve(timer), seconds * 1000);
    });

  const startServer = async () => {
    try {
      const macaroonExists = fs.existsSync(macaroonPath);
      const lnServices = await lnrpc(
        defaults.lndProto,
        lndHost,
        lndCertPath,
        macaroonExists ? macaroonPath : null
      );
      const lightning = lnServices.lightning;
      const walletUnlocker = lnServices.walletUnlocker;
      const lnServicesData = {
        lndProto: defaults.lndProto,
        lndHost: lndHost,
        lndCertPath: lndCertPath,
        macaroonPath: macaroonPath
      };

      // init lnd module =================
      const lnd = require("../services/lnd/lnd")(lightning);

      const unprotectedRoutes = {
        GET: {
          "/healthz": true,
          "/ping": true,
          "/api/lnd/connect": true,
          "/api/lnd/auth": true
        },
        POST: {
          "/api/lnd/connect": true,
          "/api/lnd/wallet": true,
          "/api/lnd/auth": true
        },
        PUT: {},
        DELETE: {}
      };
      const auth = require("../services/auth/auth");

      app.use(async (req, res, next) => {
        if (unprotectedRoutes[req.method][req.path]) {
          next();
        } else {
          try {
            const response = await auth.validateToken(req.headers.authorization.replace('Bearer ', ''));
            if (response.valid) {
              next();
            } else {
              res.status(401).json({ message: "Please log in" });
            }
          } catch (e) {
            res.status(401).json({ message: "Please log in" });
          }
        }
      });

      const sensitiveRoutes = {
        GET: {},
        POST: {
          "/api/lnd/connect": true,
          "/api/lnd/wallet": true
        },
        PUT: {},
        DELETE: {}
      };
      app.use((req, res, next) => {
        if (sensitiveRoutes[req.method][req.path]) {
          console.log(
            JSON.stringify({
              time: new Date(),
              ip: req.ip,
              method: req.method,
              path: req.path,
              sessionId: req.sessionId
            })
          );
        } else {
          console.log(
            JSON.stringify({
              time: new Date(),
              ip: req.ip,
              method: req.method,
              path: req.path,
              body: req.body,
              query: req.query,
              sessionId: req.sessionId
            })
          );
        }
        next();
      });
      app.use(
        session({
          secret: config.sessionSecret,
          cookie: { maxAge: config.sessionMaxAge },
          resave: true,
          rolling: true,
          saveUninitialized: true
        })
      );
      app.use(bodyParser.urlencoded({ extended: "true" })); // parse application/x-www-form-urlencoded
      app.use(bodyParser.json()); // parse application/json
      app.use(bodyParser.json({ type: "application/vnd.api+json" })); // parse application/vnd.api+json as json
      app.use(methodOverride());
      // error handler
      app.use(function(err, req, res, next) {
        // Do logging and user-friendly error message display
        logger.error(err);
        res
          .status(500)
          .send({ status: 500, message: "internal error", type: "internal" });
      });

      let server;
      if (program.usetls) {
        server = require("https").createServer(
          {
            key: require("fs").readFileSync(program.usetls + "/key.pem"),
            cert: require("fs").readFileSync(program.usetls + "/cert.pem")
          },
          app
        );
      } else {
        server = require("http").Server(app);
      }

      const io = require("socket.io")(server);

      // setup sockets =================
      var lndLogfile = program.lndlogfile || defaults.lndLogFile;

      let mySocketsEvents = require("./sockets")(
        io,
        lightning,
        lnd,
        program.user,
        program.pwd,
        program.limituser,
        program.limitpwd,
        lndLogfile,
        lnServicesData
      );

      const routes = require("./routes")(
        app,
        lightning,
        db,
        config,
        walletUnlocker,
        lnServicesData,
        mySocketsEvents,
        {
          serverHost: module.serverHost,
          serverPort: module.serverPort
        }
      );

      const colors = require("../utils/colors");

      app.use(require("./cors")); // enable CORS headers
      // app.use(bodyParser.json({limit: '100000mb'}));
      app.use(bodyParser.json({ limit: "50mb" }));
      app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

      server.listen(module.serverPort, module.serverHost);

      logger.info(
        "App listening on " + module.serverHost + " port " + module.serverPort
      );

      module.server = server;

      // const localtunnel = require('localtunnel');
      //
      // const tunnel = localtunnel(port, (err, t) => {
      // 	console.log('err', err);
      // 	console.log('t', t.url);
      // });
    } catch (err) {
      console.error(err);
      logger.info("Restarting server in 30 seconds...");
      await wait(30);
      startServer();
      return false;
    }
  };

  startServer();
};

module.exports = server;
