"use strict";

// app/routes.js

const debug = require("debug")("lncliweb:routes");
const logger = require("winston");
const request = require("request");
const graphviz = require("graphviz");
const commandExistsSync = require("command-exists").sync;
const rp = require("request-promise");
const responseTime = require("response-time");
const jsonfile = require("jsonfile");
const Http = require("axios");
const getListPage = require("../utils/paginate");
const server = require("./server");
const auth = require("../services/auth/auth");
const GunDB = require("../services/gunDB/Mediator");

const DEFAULT_MAX_NUM_ROUTES_TO_QUERY = 10;

let channel_point;
// module.exports = (app) => {
module.exports = (
  app,
  lightning,
  db,
  config,
  walletUnlocker,
  lnServicesData,
  mySocketsEvents,
  { serverHost, serverPort }
) => {
  const checkHealth = () => {
    return new Promise((resolve, reject) => {
      lightning.getInfo({}, async (err, response) => {
        const LNDStatus = {
          message: err ? err.details : "Success",
          success: !err
        };
        try {
          const APIHealth = await Http.get(
            `http://localhost:${serverPort}/ping`
          );
          const APIStatus = {
            message: APIHealth.data,
            responseTime: APIHealth.headers["x-response-time"],
            success: true
          };
          resolve({
            LNDStatus,
            APIStatus
          });
        } catch (err) {
          const APIStatus = {
            message: err.response.data,
            responseTime: APIHealth.headers["x-response-time"],
            success: false
          };
          resolve({
            LNDStatus,
            APIStatus
          });
        }
      });
    });
  };

  const handleError = async (res, err) => {
    const health = await checkHealth();
    if (health.LNDStatus.success) {
      if (err) {
        res.send({
          error: err.message.split(": ")[1]
        });
      } else {
        res.sendStatus(403);
      }
    } else {
      res.status(500);
      res.send({ errorMessage: "LND is down" });
    }
  };

  const unlockWallet = password =>
    new Promise((resolve, reject) => {
      const args = {
        wallet_password: Buffer.from(password, "utf-8")
      };
      walletUnlocker.unlockWallet(args, function(unlockErr, unlockResponse) {
        if (unlockErr) {
          reject(unlockErr);
          return;
        }

        resolve(unlockResponse);
      });
    });

  app.use(["/ping"], responseTime());

  /**
   * health check
   */
  app.get("/health", async (req, res) => {
    console.log(lightning);
    const health = await checkHealth();
    res.send(health);
  });

  /**
   * kubernetes health check
   */
  app.get("/healthz", async (req, res) => {
    const health = await checkHealth();
    res.send(health);
  });

  app.get("/ping", async (req, res) => {
    res.send("OK");
  });

  app.get("/api/lnd/connect", (req, res) => {
    res.status(200);
    res.json({});
  });

  app.post("/api/mobile/error", (req, res) => {
    console.log(JSON.stringify(req.body));
    res.json({ msg: OK });
  });

  app.post("/api/lnd/auth", async (req, res) => {
    try {
      const health = await checkHealth();
      // If we're connected to lnd, unlock the wallet using the password supplied
      // and generate an auth token if that operation was successful.
      if (health.LNDStatus.success) {
        const { alias, password } = req.body;

        await recreateLnServices();

        if (walletUnlocker) {
          await unlockWallet(password);
        }

        const publicKey = await GunDB.authenticate(alias, password);

        // Send an event to update lightning's status
        mySocketsEvents.emit("updateLightning");

        // Generate auth token and send it as a JSON response
        const token = await auth.generateToken();
        res.json({
          authorization: token,
          user: {
            alias,
            publicKey
          }
        });

        return true;
      } else {
        res.status(500);
        res.send({ field: "health", message: "LND is down", success: false });
        return false;
      }
    } catch (err) {
      logger.debug("Unlock Error:", err);
      res.status(400);
      res.send({ field: "user", message: err.message, success: false });
    }
  });

  let recreateLnServices = async (callback, cs) => {
    if (cs) {
      cs();
    }

    let lnServices = await require("../services/lnd/lightning")(
      lnServicesData.lndProto,
      lnServicesData.lndHost,
      lnServicesData.lndCertPath,
      lnServicesData.macaroonPath
    );
    lightning = lnServices.lightning;
    walletUnlocker = lnServices.walletUnlocker;

    if (callback) {
      setTimeout(() => {
        callback();
      }, 3000);
    }
    return true;
  };

  app.post("/api/lnd/connect", (req, res) => {
    let args = {
      wallet_password: Buffer.from(req.body.password, "utf-8")
    };

    lightning.getInfo({}, function(err, response) {
      if (err) {
        // try to unlock wallet
        recreateLnServices(
          () => {
            walletUnlocker.unlockWallet(args, function(
              unlockErr,
              unlockResponse
            ) {
              if (unlockErr) {
                console.log("unlock Error:", unlockErr);
                logger.debug("unlock Error:", unlockErr);
                unlockErr.error = unlockErr.message;
                console.log("unlockErr.message", unlockErr.message);
                return checkHealth().then(health => {
                  if (health.LNDStatus.success) {
                    let errorMessage = unlockErr.details;
                    res.status(400);
                    res.send({ errorMessage: unlockErr.message });
                  } else {
                    res.status(500);
                    res.send({ errorMessage: "LND is down" });
                  }
                });
              } else {
                recreateLnServices(
                  () => {
                    mySocketsEvents.emit("updateLightning");
                    return auth.generateToken().then(token => {
                      res.json({
                        authorization: token
                      });
                    });
                  },
                  () => console.log("second")
                );
              }
            });
          },
          () => console.log("first")
        );
      } else {
        return auth.generateToken().then(token => {
          res.json({
            authorization: token
          });
        });
      }
    });
  });

  app.post("/api/lnd/wallet", (req, res) => {
    const { password, alias } = req.body;
    if (!alias) {
      return req.status(400).json({
        field: "alias",
        message: "Please specify an alias for your new wallet"
      });
    }

    if (!password) {
      return req.status(400).json({
        field: "password",
        message: "Please specify a password for your new wallet"
      });
    }

    walletUnlocker.genSeed({}, async (genSeedErr, genSeedResponse) => {
      if (genSeedErr) {
        logger.debug("GenSeed Error:", genSeedErr);

        const healthResponse = await checkHealth();
        if (healthResponse.LNDStatus.success) {
          const message = genSeedErr.details;
          return res
            .status(400)
            .send({ field: "health", message, success: false });
        } else {
          return res
            .status(500)
            .send({ field: "health", message: "LND is down", success: false });
        }
      }

      logger.debug("GenSeed:", genSeedResponse);
      const mnemonicPhrase = genSeedResponse.cipher_seed_mnemonic;
      const walletArgs = {
        wallet_password: Buffer.from(password, "utf8"),
        cipher_seed_mnemonic: mnemonicPhrase
      };
      walletUnlocker.initWallet(
        walletArgs,
        async (initWalletErr, initWalletResponse) => {
          if (initWalletErr) {
            console.log("initWallet Error:", initWalletErr.message);
            const healthResponse = await checkHealth();
            if (healthResponse.LNDStatus.success) {
              const errorMessage = initWalletErr.details;
              logger.debug("initWallet Error:", errorMessage);

              return res.status(400).json({
                field: "initWallet",
                message: errorMessage,
                success: false
              });
            } else {
              return res.status(500).json({
                field: "health",
                message: "LND is down",
                success: false
              });
            }
          }
          logger.debug("initWallet:", initWalletResponse);

          const fs = require("fs");

          const waitUntilFileExists = seconds => {
            logger.debug(
              `Waiting for admin.macaroon to be created. Seconds passed: ${seconds}`
            );
            setTimeout(async () => {
              if (!fs.existsSync(lnServicesData.macaroonPath)) {
                return waitUntilFileExists(seconds + 1);
              }

              logger.debug("admin.macaroon file created");

              mySocketsEvents.emit("updateLightning");
              const lnServices = await require("../services/lnd/lightning")(
                lnServicesData.lndProto,
                lnServicesData.lndHost,
                lnServicesData.lndCertPath,
                lnServicesData.macaroonPath
              );
              lightning = lnServices.lightning;
              walletUnlocker = lnServices.walletUnlocker;
              const token = await auth.generateToken();
              const publicKey = await GunDB.register(alias, password);
              return res.json({
                mnemonicPhrase: mnemonicPhrase,
                authorization: token,
                user: {
                  alias,
                  publicKey
                }
              });
            }, 1000);
          };

          waitUntilFileExists(1);
        }
      );
    });
  });

  // get lnd info
  app.get("/api/lnd/getinfo", (req, res) => {
    console.log(lightning.estimateFee);
    lightning.getInfo({}, function(err, response) {
      if (err) {
        console.log("GetInfo Error:", err);
        logger.debug("GetInfo Error:", err);
        return checkHealth().then(health => {
          if (health.LNDStatus.success) {
            err.error = err.message;
            res.send(err);
          } else {
            res.status(500);
            res.send({ errorMessage: "LND is down" });
          }
        });
      } else {
        console.log("GetInfo:", response);
        logger.debug("GetInfo:", response);
        if (!response.uris || response.uris.length === 0) {
          if (config.lndAddress) {
            response.uris = [
              response.identity_pubkey + "@" + config.lndAddress
            ];
          }
        }
        res.json(response);
      }
    });
  });

  // get lnd node info
  app.post("/api/lnd/getnodeinfo", (req, res) => {
    lightning.getNodeInfo({ pub_key: req.body.pubkey }, function(
      err,
      response
    ) {
      if (err) {
        logger.debug("GetNodeInfo Error:", err);
        return checkHealth().then(health => {
          if (health.LNDStatus.success) {
            err.error = err.message;
            res.send(err);
          } else {
            res.status(500);
            res.send({ errorMessage: "LND is down" });
          }
        });
      } else {
        logger.debug("GetNodeInfo:", response);
        res.json(response);
      }
    });
  });

  app.get("/api/lnd/getnetworkinfo", (req, res) => {
    lightning.getNetworkInfo({}, function(err, response) {
      if (err) {
        logger.debug("GetNetworkInfo Error:", err);
        return checkHealth().then(health => {
          if (health.LNDStatus.success) {
            err.error = err.message;
            res.send(err);
          } else {
            res.status(500);
            res.send({ errorMessage: "LND is down" });
          }
        });
      } else {
        logger.debug("GetNetworkInfo:", response);
        res.json(response);
      }
    });
  });

  // get lnd node active channels list
  app.get("/api/lnd/listpeers", (req, res) => {
    lightning.listPeers({}, function(err, response) {
      if (err) {
        logger.debug("ListPeers Error:", err);
        return checkHealth().then(health => {
          if (health.LNDStatus.success) {
            err.error = err.message;
            res.send(err);
          } else {
            res.status(500);
            res.send({ errorMessage: "LND is down" });
          }
        });
      } else {
        logger.debug("ListPeers:", response);
        res.json(response);
      }
    });
  });

  // newaddress
  app.post("/api/lnd/newaddress", (req, res) => {
    lightning.newAddress({ type: req.body.type }, function(err, response) {
      if (err) {
        logger.debug("NewAddress Error:", err);
        return checkHealth().then(health => {
          if (health.LNDStatus.success) {
            err.error = err.message;
            res.send(err);
          } else {
            res.status(500);
            res.send({ errorMessage: "LND is down" });
          }
        });
      } else {
        logger.debug("NewAddress:", response);
        res.json(response);
      }
    });
  });

  // connect peer to lnd node
  app.post("/api/lnd/connectpeer", (req, res) => {
    if (req.limituser) {
      return checkHealth().then(health => {
        if (health.LNDStatus.success) {
          return res.sendStatus(403); // forbidden
        } else {
          res.status(500);
          res.send({ errorMessage: "LND is down" });
        }
      });
    } else {
      var connectRequest = {
        addr: { pubkey: req.body.pubkey, host: req.body.host },
        perm: true
      };
      logger.debug("ConnectPeer Request:", connectRequest);
      lightning.connectPeer(connectRequest, function(err, response) {
        if (err) {
          logger.debug("ConnectPeer Error:", err);
          err.error = err.message;
          res.send(err);
        } else {
          logger.debug("ConnectPeer:", response);
          res.json(response);
        }
      });
    }
  });

  // disconnect peer from lnd node
  app.post("/api/lnd/disconnectpeer", (req, res) => {
    if (req.limituser) {
      return checkHealth().then(health => {
        if (health.LNDStatus.success) {
          return res.sendStatus(403); // forbidden
        } else {
          res.status(500);
          res.send({ errorMessage: "LND is down" });
        }
      });
    } else {
      var disconnectRequest = { pub_key: req.body.pubkey };
      logger.debug("DisconnectPeer Request:", disconnectRequest);
      lightning.disconnectPeer(disconnectRequest, function(err, response) {
        if (err) {
          logger.debug("DisconnectPeer Error:", err);
          err.error = err.message;
          res.send(err);
        } else {
          logger.debug("DisconnectPeer:", response);
          res.json(response);
        }
      });
    }
  });

  // get lnd node opened channels list
  app.get("/api/lnd/listchannels", (req, res) => {
    lightning.listChannels({}, function(err, response) {
      if (err) {
        logger.debug("ListChannels Error:", err);
        return checkHealth().then(health => {
          if (health.LNDStatus.success) {
            err.error = err.message;
            res.send(err);
          } else {
            res.status(500);
            res.send({ errorMessage: "LND is down" });
          }
        });
      } else {
        logger.debug("ListChannels:", response);
        res.json(response);
      }
    });
  });

  // get lnd node pending channels list
  app.get("/api/lnd/pendingchannels", (req, res) => {
    lightning.pendingChannels({}, function(err, response) {
      if (err) {
        logger.debug("PendingChannels Error:", err);
        return checkHealth().then(health => {
          if (health.LNDStatus.success) {
            err.error = err.message;
            res.send(err);
          } else {
            res.status(500);
            res.send({ errorMessage: "LND is down" });
          }
        });
      } else {
        logger.debug("PendingChannels:", response);
        res.json(response);
      }
    });
  });

  app.get("/api/lnd/unifiedTrx", (req, res) => {
    const { itemsPerPage, page, reversed = true } = req.body;
    const offset = (page - 1) * itemsPerPage;
    lightning.listPayments({}, async (err, { payments = [] } = {}) => {
      if (err) {
        return handleError(res, err);
      }

      lightning.listInvoices(
        { reversed, index_offset: offset, num_max_invoices: itemsPerPage },
        async (err, { invoices, last_index_offset }) => {
          if (err) {
            return handleError(res, err);
          }

          lightning.getTransactions(
            {},
            async (err, { transactions = [] } = {}) => {
              if (err) {
                return handleError(res, err);
              }

              res.json({
                transactions: getListPage({
                  entries: transactions,
                  itemsPerPage,
                  page
                }),
                payments: getListPage({
                  entries: payments,
                  itemsPerPage,
                  page
                }),
                invoices: {
                  content: invoices,
                  page,
                  totalPages: Math.ceil(last_index_offset / itemsPerPage),
                  totalItems: last_index_offset
                }
              });
            }
          );
        }
      );
    });
  });

  // get lnd node payments list
  app.get("/api/lnd/listpayments", (req, res) => {
    const { itemsPerPage, page, paginate = true } = req.body;
    lightning.listPayments({}, async (err, { payments = [] } = {}) => {
      if (err) {
        logger.debug("ListPayments Error:", err);
        handleError(res, err);
      } else {
        logger.debug("ListPayments:", payments);
        if (paginate) {
          res.json(getListPage({ entries: payments, itemsPerPage, page }));
        } else {
          res.json({ payments });
        }
      }
    });
  });

  // get lnd node invoices list
  app.get("/api/lnd/listinvoices", (req, res) => {
    const { page, itemsPerPage, reversed = true } = req.body;
    const offset = (page - 1) * itemsPerPage;
    const limit = page * itemsPerPage;
    lightning.listInvoices(
      { reversed, index_offset: offset, num_max_invoices: itemsPerPage },
      async (err, { invoices, last_index_offset }) => {
        if (err) {
          logger.debug("ListInvoices Error:", err);
          const health = await checkHealth();
          if (health.LNDStatus.success) {
            err.error = err.message;
            res.send({ message: err.message, success: false });
          } else {
            res.status(500);
            res.send({ message: health.LNDStatus.message, success: false });
          }
        } else {
          logger.debug("ListInvoices:", response);
          res.json({
            content: invoices,
            page,
            totalPages: Math.ceil(last_index_offset / itemsPerPage),
            success: true
          });
        }
      }
    );
  });

  // get lnd node forwarding history
  app.get("/api/lnd/forwardinghistory", (req, res) => {
    lightning.forwardingHistory({}, function(err, response) {
      if (err) {
        logger.debug("ForwardingHistory Error:", err);
        return checkHealth().then(health => {
          if (health.LNDStatus.success) {
            err.error = err.message;
            res.send(err);
          } else {
            res.status(500);
            res.send({ errorMessage: "LND is down" });
          }
        });
      } else {
        logger.debug("ForwardingHistory:", response);
        res.json(response);
      }
    });
  });

  // get the lnd node wallet balance
  app.get("/api/lnd/walletbalance", (req, res) => {
    lightning.walletBalance({}, function(err, response) {
      if (err) {
        logger.debug("WalletBalance Error:", err);
        return checkHealth().then(health => {
          if (health.LNDStatus.success) {
            err.error = err.message;
            res.send(err);
          } else {
            res.status(500);
            res.send({ errorMessage: "LND is down" });
          }
        });
      } else {
        logger.debug("WalletBalance:", response);
        res.json(response);
      }
    });
  });

  app.post("/api/lnd/decodePayReq", (req, res) => {
    const { payReq } = req.body;
    lightning.decodePayReq({ pay_req: payReq }, async (err, paymentRequest) => {
      if (err) {
        logger.debug("DecodePayReq Error:", err);
        const health = await checkHealth();
        if (health.LNDStatus.success) {
          err.error = err.message;
          res.status(400).send(err);
        } else {
          res.status(500).send({ errorMessage: "LND is down" });
        }
      } else {
        logger.debug("DecodePayReq:", response);
        res.json({
          decodedRequest: paymentRequest
        });
      }
    });
  });

  // get the lnd node channel balance
  app.get("/api/lnd/channelbalance", (req, res) => {
    lightning.channelBalance({}, function(err, response) {
      if (err) {
        logger.debug("ChannelBalance Error:", err);
        return checkHealth().then(health => {
          if (health.LNDStatus.success) {
            err.error = err.message;
            res.send(err);
          } else {
            res.status(500);
            res.send({ errorMessage: "LND is down" });
          }
        });
      } else {
        logger.debug("ChannelBalance:", response);
        res.json(response);
      }
    });
  });

  app.get("/api/lnd/channelbalance", (req, res) => {
    lightning.channelBalance({}, function(err, response) {
      if (err) {
        logger.debug("ChannelBalance Error:", err);
        return checkHealth().then(health => {
          if (health.LNDStatus.success) {
            err.error = err.message;
            res.send(err);
          } else {
            res.status(500);
            res.send({ errorMessage: "LND is down" });
          }
        });
      } else {
        logger.debug("ChannelBalance:", response);
        res.json(response);
      }
    });
  });

  // openchannel
  app.post("/api/lnd/openchannel", (req, res) => {
    if (req.limituser) {
      return checkHealth().then(health => {
        if (health.LNDStatus.success) {
          res.sendStatus(403); // forbidden
        } else {
          res.status(500);
          res.send({ errorMessage: "LND is down" });
        }
      });
    } else {
      var openChannelRequest = {
        node_pubkey_string: req.body.pubkey,
        local_funding_amount: 500000,
        push_sat: 50000
      };
      console.log("OpenChannelRequest", openChannelRequest);
      logger.debug("OpenChannelRequest", openChannelRequest);
      lightning.openChannelSync(openChannelRequest, function(err, response) {
        if (err) {
          console.log("OpenChannelRequest Error:", err);
          logger.debug("OpenChannelRequest Error:", err);
          return checkHealth().then(health => {
            if (health.LNDStatus.success) {
              err.error = err.message;
              res.send(err);
            } else {
              res.status(500);
              res.send({ errorMessage: "LND is down" });
            }
          });
        } else {
          console.log("OpenChannelRequest:", response);
          channel_point = response;
          logger.debug("OpenChannelRequest:", response);
          res.json(response);
        }
      });
    }
  });

  // closechannel
  app.post("/api/lnd/closechannel", (req, res) => {
    if (req.limituser) {
      return checkHealth().then(health => {
        if (health.LNDStatus.success) {
          // return res.sendStatus(403); // forbidden
          res.sendStatus(403); // forbidden
        } else {
          res.status(500);
          res.send({ errorMessage: "LND is down" });
        }
      });
    } else {
      var closeChannelRequest = {
        channel_point: {
          funding_txid_bytes: "",
          funding_txid_str: "",
          output_index: ""
        },
        force: true
      };
      console.log("CloseChannelRequest", closeChannelRequest);
      logger.debug("CloseChannelRequest", closeChannelRequest);
      lightning.closeChannel(closeChannelRequest, function(err, response) {
        if (err) {
          console.log("CloseChannelRequest Error:", err);
          return checkHealth().then(health => {
            if (health.LNDStatus.success) {
              logger.debug("CloseChannelRequest Error:", err);
              err.error = err.message;
              res.send(err);
            } else {
              res.status(500);
              res.send({ errorMessage: "LND is down" });
            }
          });
        } else {
          console.log("CloseChannelRequest:", response);
          logger.debug("CloseChannelRequest:", response);
          res.json(response);
        }
      });
    }
  });

  // sendpayment
  app.post("/api/lnd/sendpayment", (req, res) => {
    if (req.limituser) {
      return checkHealth().then(health => {
        if (health.LNDStatus.success) {
          res.sendStatus(403); // forbidden
        } else {
          res.status(500);
          res.send({ errorMessage: "LND is down" });
        }
      });
    } else {
      var paymentRequest = { payment_request: req.body.payreq };
      if (req.body.amt) {
        paymentRequest.amt = req.body.amt;
      }
      logger.debug("Sending payment", paymentRequest);
      lightning.sendPaymentSync(paymentRequest, function(err, response) {
        if (err) {
          logger.debug("SendPayment Error:", err);
          return checkHealth().then(health => {
            if (health.LNDStatus.success) {
              err.error = err.message;
              res.send(err);
            } else {
              res.status(500);
              res.send({ errorMessage: "LND is down" });
            }
          });
        } else {
          logger.debug("SendPayment:", response);
          res.json(response);
        }
      });
    }
  });

  // addinvoice
  app.post("/api/lnd/addinvoice", (req, res) => {
    if (req.limituser) {
      return checkHealth().then(health => {
        if (health.LNDStatus.success) {
          res.sendStatus(403); // forbidden
        } else {
          res.status(500);
          res.send({ errorMessage: "LND is down" });
        }
      });
    } else {
      var invoiceRequest = { memo: req.body.memo };
      if (req.body.value) {
        invoiceRequest.value = req.body.value;
      }
      if (req.body.expiry) {
        invoiceRequest.expiry = req.body.expiry;
      }
      lightning.addInvoice(invoiceRequest, function(err, response) {
        if (err) {
          logger.debug("AddInvoice Error:", err);
          return checkHealth().then(health => {
            if (health.LNDStatus.success) {
              err.error = err.message;
              res.send(err);
            } else {
              res.status(500);
              res.send({ errorMessage: "LND is down" });
            }
          });
        } else {
          logger.debug("AddInvoice:", response);
          res.json(response);
        }
      });
    }
  });

  // signmessage
  app.post("/api/lnd/signmessage", (req, res) => {
    if (req.limituser) {
      return checkHealth().then(health => {
        if (health.LNDStatus.success) {
          res.sendStatus(403); // forbidden
        } else {
          res.status(500);
          res.send({ errorMessage: "LND is down" });
        }
      });
    } else {
      lightning.signMessage(
        { msg: Buffer.from(req.body.msg, "utf8") },
        function(err, response) {
          if (err) {
            logger.debug("SignMessage Error:", err);
            return checkHealth().then(health => {
              if (health.LNDStatus.success) {
                err.error = err.message;
                res.send(err);
              } else {
                res.status(500);
                res.send({ errorMessage: "LND is down" });
              }
            });
          } else {
            logger.debug("SignMessage:", response);
            res.json(response);
          }
        }
      );
    }
  });

  // verifymessage
  app.post("/api/lnd/verifymessage", (req, res) => {
    lightning.verifyMessage(
      { msg: Buffer.from(req.body.msg, "utf8"), signature: req.body.signature },
      function(err, response) {
        if (err) {
          logger.debug("VerifyMessage Error:", err);
          return checkHealth().then(health => {
            if (health.LNDStatus.success) {
              err.error = err.message;
              res.send(err);
            } else {
              res.status(500);
              res.send({ errorMessage: "LND is down" });
            }
          });
        } else {
          logger.debug("VerifyMessage:", response);
          res.json(response);
        }
      }
    );
  });

  // sendcoins
  app.post("/api/lnd/sendcoins", (req, res) => {
    if (req.limituser) {
      return checkHealth().then(health => {
        if (health.LNDStatus.success) {
          res.sendStatus(403); // forbidden
        } else {
          res.status(500);
          res.send({ errorMessage: "LND is down" });
        }
      });
    } else {
      var sendCoinsRequest = { addr: req.body.addr, amount: req.body.amount };
      logger.debug("SendCoins", sendCoinsRequest);
      lightning.sendCoins(sendCoinsRequest, function(err, response) {
        if (err) {
          logger.debug("SendCoins Error:", err);
          return checkHealth().then(health => {
            if (health.LNDStatus.success) {
              err.error = err.message;
              res.send(err);
            } else {
              res.status(500);
              res.send({ errorMessage: "LND is down" });
            }
          });
        } else {
          logger.debug("SendCoins:", response);
          res.json(response);
        }
      });
    }
  });

  // queryroute
  app.post("/api/lnd/queryroute", (req, res) => {
    var numRoutes =
      config.maxNumRoutesToQuery || DEFAULT_MAX_NUM_ROUTES_TO_QUERY;
    lightning.queryRoutes(
      { pub_key: req.body.pubkey, amt: req.body.amt, num_routes: numRoutes },
      function(err, response) {
        if (err) {
          logger.debug("QueryRoute Error:", err);
          return checkHealth().then(health => {
            if (health.LNDStatus.success) {
              err.error = err.message;
              res.send(err);
            } else {
              res.status(500);
              res.send({ errorMessage: "LND is down" });
            }
          });
        } else {
          logger.debug("QueryRoute:", response);
          res.json(response);
        }
      }
    );
  });

  app.post("/api/lnd/estimatefee", (req, res) => {
    const { amount, confirmationBlocks } = req.body;
    lightning.estimateFee(
      {
        AddrToAmount: {
          tb1qnpq3vj8p6jymah6nnh6wz3p333tt360mq32dtt: amount
        },
        target_conf: confirmationBlocks
      },
      async (err, fee) => {
        if (err) {
          const health = await checkHealth();
          if (health.LNDStatus.success) {
            res.send({
              error: err.message
            });
          } else {
            res.status(500);
            res.send({ errorMessage: "LND is down" });
          }
        } else {
          logger.debug("EstimateFee:", fee);
          res.json(fee);
        }
      }
    );
  });

  app.post("/api/lnd/listunspent", (req, res) => {
    const { minConfirmations = 3, maxConfirmations = 6 } = req.body;
    lightning.listUnspent(
      {
        min_confs: minConfirmations,
        max_confs: maxConfirmations
      },
      async (err, unspent) => {
        if (err) {
          return handleError(res, err);
        } else {
          logger.debug("ListUnspent:", unspent);
          res.json(unspent);
        }
      }
    );
  });

  app.get("/api/lnd/transactions", (req, res) => {
    const { page, paginate = true, itemsPerPage } = req.body;
    lightning.getTransactions({}, async (err, { transactions = [] } = {}) => {
      if (err) {
        return handleError(res, err);
      } else {
        logger.debug("Transactions:", transactions);
        if (paginate) {
          res.json(getListPage({ entries: transactions, itemsPerPage, page }));
        } else {
          res.json({ transactions });
        }
      }
    });
  });

  app.post("/api/lnd/sendmany", (req, res) => {
    const { addresses } = req.body;
    lightning.sendMany(
      { AddrToAmount: addresses },
      async (err, transactions) => {
        if (err) {
          return handleError(res, err);
        } else {
          logger.debug("Transactions:", transactions);
          res.json(transactions);
        }
      }
    );
  });

  app.get("/api/lnd/closedchannels", (req, res) => {
    const { closeTypeFilters = [] } = req.query;
    const lndFilters = closeTypeFilters.reduce(
      (filters, filter) => ({ ...filters, [filter]: true }),
      {}
    );
    lightning.closedChannels(lndFilters, async (err, channels) => {
      if (err) {
        return handleError(res, err);
      } else {
        logger.debug("Channels:", channels);
        res.json(channels);
      }
    });
  });

  app.post("/api/lnd/exportchanbackup", (req, res) => {
    const { channelPoint } = req.body;
    lightning.exportChannelBackup(
      { chan_point: { funding_txid_str: channelPoint } },
      async (err, backup) => {
        if (err) {
          return handleError(res, err);
        } else {
          logger.debug("ExportChannelBackup:", backup);
          res.json(backup);
        }
      }
    );
  });

  app.post("/api/lnd/exportallchanbackups", (req, res) => {
    lightning.exportAllChannelBackups({}, async (err, channelBackups) => {
      if (err) {
        return handleError(res, err);
      } else {
        logger.debug("ExportAllChannelBackups:", channelBackups);
        res.json(channelBackups);
      }
    });
  });

  /**
   * Return app so that it can be used by express.
   */
  // return app;
};
