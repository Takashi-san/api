// @ts-check
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

const FAIL = false

/**
 * https://api.lightning.community/#transaction
 * @typedef {object} Transaction
 * @prop {string} tx_hash The transaction hash
 * @prop {number} amount The transaction amount, denominated in satoshis
 * @prop {number} num_confirmations The number of confirmations
 * @prop {string} block_hash The hash of the block this transaction was included
 * in
 * @prop {number} block_height The height of the block this transaction was
 * included in
 * @prop {number} time_stamp Timestamp of this transaction
 * @prop {number} total_fees Fees paid for this transaction
 * @prop {string[]} dest_addresses Addresses that received funds for this
 * transaction
 * @prop {string} raw_tx_hex The raw transaction hex.
 */

/**
 * NOT based on any lightning API. Not supported by API as of commit
 * ed93a9e5c3915e1ccf6f76f0244466e999dbc939 .
 * @typedef {object} NonPaginatedTransactionsRequest
 * @prop {false} paginate
 */

/**
 * NOT based on any lightning API.
 * @typedef {object} PaginatedTransactionsRequest
 * @prop {number} page
 * @prop {true} paginate
 * @prop {number} itemsPerPage
 */

/**
 * https://api.lightning.community/#grpc-response-transactiondetails . Not
 * supported as of commit ed93a9e5c3915e1ccf6f76f0244466e999dbc939 .
 * @typedef {object} NonPaginatedTransactionsResponse
 * @prop {Transaction[]} transactions
 */

/**
 * @typedef {object} PaginatedTransactionsResponse
 * @prop {Transaction[]} content
 * @prop {number} page
 * @prop {number} totalPages
 * @prop {number} totalItems
 */

/**
 * https://api.lightning.community/#payment
 * @typedef {object} Payment
 * @prop {string} payment_hash  The payment hash
 * @prop {number} value  Deprecated, use value_sat or value_msat.
 * @prop {number} creation_date  The date of this payment
 * @prop {string[]} path The path this payment took
 * @prop {number} fee Deprecated, use fee_sat or fee_msat.
 * @prop {string} payment_preimage  The payment preimage
 * @prop {number} value_sat  The value of the payment in satoshis
 * @prop {number} value_msat  The value of the payment in milli-satoshis
 * @prop {string} payment_request  The optional payment request being fulfilled.
 * @prop {0|1|2|3} status  The status of the payment. UNKNOWN 0 IN_FLIGHT 1
 * SUCCEEDED 2 FAILED 3
 * @prop {number} fee_sat  The fee paid for this payment in satoshis
 * @prop {number} fee_msat  The fee paid for this payment in milli-satoshis
 */
/**
 * https://api.lightning.community/#hophint
 * @typedef {object} HopHint
 * @prop {string} node_id The public key of the node at the start of the
 * channel.
 * @prop {number} chan_id The unique identifier of the channel.
 * @prop {number} fee_base_msat The base fee of the channel denominated in
 * millisatoshis.
 * @prop {number} fee_proportional_millionths The fee rate of the channel for
 * sending one satoshi across it denominated in millionths of a satoshi.
 * @prop {number} cltv_expiry_delta The time-lock delta of the channel.
 */

/**
 * https://api.lightning.community/#routehint
 * @typedef {object} RouteHint
 * @prop {HopHint[]} hop_hints A list of hop hints that when chained together
 * can assist in reaching a specific destination.
 */

/**
 * https://api.lightning.community/#invoice
 * @typedef {object} Invoice
 * @prop {string} memo  An optional memo to attach along with the invoice. Used
 * for record keeping purposes for the invoice's creator, and will also be set
 * in the description field of the encoded payment request if the
 * description_hash field is not being used.
 * @prop {string} receipt  Deprecated. An optional cryptographic receipt of
 * payment which is not implemented.
 * @prop {string} r_preimage The hex-encoded preimage (32 byte) which will allow
 * settling an incoming HTLC payable to this preimage
 * @prop {string} r_hash The hash of the preimage
 * @prop {number} value  The value of this invoice in satoshis
 * @prop {boolean} settled Whether this invoice has been fulfilled
 * @prop {number} creation_date  When this invoice was created
 * @prop {number} settle_date  When this invoice was settled
 * @prop {string} payment_request A bare-bones invoice for a payment within the
 * Lightning Network. With the details of the invoice, the sender has all the
 * data necessary to send a payment to the recipient.
 * @prop {string} description_hash Hash (SHA-256) of a description of the
 * payment. Used if the description of payment (memo) is too long to naturally
 * fit within the description field of an encoded payment request.
 * @prop {number} expiry Payment request expiry time in seconds. Default is 3600
 * (1 hour).
 * @prop {string} fallback_addr Fallback on-chain address.
 * @prop {number} cltv_expiry Delta to use for the time-lock of the CLTV
 * extended to the final hop.
 * @prop {RouteHint[]} route_hints RouteHint  Route hints that can each be
 * individually used to assist in reaching the invoice's destination.
 * @prop {boolean} private Whether this invoice should include routing hints for
 * private channels.
 * @prop {number} add_index The "add" index of this invoice. Each newly created
 * invoice will increment this index making it monotonically increasing. Callers
 * to the SubscribeInvoices call can use this to instantly get notified of all
 * added invoices with an add_index greater than this one.
 * @prop {number} settle_index  The "settle" index of this invoice. Each newly
 * settled invoice will increment this index making it monotonically increasing.
 * Callers to the SubscribeInvoices call can use this to instantly get notified
 * of all settled invoices with an settle_index greater than this one.
 * @prop {number} amt_paid Deprecated, use amt_paid_sat or amt_paid_msat.
 * @prop {number} amt_paid_sat The amount that was accepted for this invoice, in
 * satoshis. This will ONLY be set if this invoice has been settled. We provide
 * this field as if the invoice was created with a zero value, then we need to
 * record what amount was ultimately accepted. Additionally, it's possible that
 * the sender paid MORE that was specified in the original invoice. So we'll
 * record that here as well.
 * @prop {number} amt_paid_msat  The amount that was accepted for this invoice,
 * in millisatoshis. This will ONLY be set if this invoice has been settled. We
 * provide this field as if the invoice was created with a zero value, then we
 * need to record what amount was ultimately accepted. Additionally, it's
 * possible that the sender paid MORE that was specified in the original
 * invoice. So we'll record that here as well.
 * @prop {0|1|2|3} state The state the invoice is in. OPEN 0 SETTLED 1 CANCELED
 * 2 ACCEPTED 3
 */

/**
 * https://api.lightning.community/#grpc-response-walletbalanceresponse
 * @typedef {object} WalletBalanceResponse
 * @prop {number} total_balance The balance of the wallet
 * @prop {number} confirmed_balance The confirmed balance of a wallet(with >= 1
 * confirmations)
 * @prop {number} unconfirmed_balance The unconfirmed balance of a wallet(with 0
 * confirmations)
 */

/**
 * Not supported as of commit ed93a9e5c3915e1ccf6f76f0244466e999dbc939 .
 * @typedef {object} ListPaymentsRequest
 * @prop {boolean=} include_incomplete If true, then return payments that have
 * not yet fully completed. This means that pending payments, as well as failed
 * payments will show up if this field is set to True.
 */

/**
 * NOT based on any lightning API.
 * @typedef {object} PaginatedListPaymentsRequest
 * @prop {number} page
 * @prop {true} paginate
 * @prop {number} itemsPerPage
 */

/**
 * @typedef {object} PaginatedListPaymentsResponse
 * @prop {Payment[]} content
 * @prop {number} page
 * @prop {number} totalPages
 * @prop {number} totalItems
 */

/**
 * @type {Transaction[]}
 */
const TRANSACTIONS = [{
  amount: 100,
  block_hash: 'block_hash',
  block_height: 5,
  dest_addresses: ['dest_address1', 'dest_address2'],
  num_confirmations: 6,
  raw_tx_hex: 'raw_tx_hex',
  time_stamp: Date.now(),
  total_fees: 1,
  tx_hash: 'tx_hash'
}];

/**
 * @type {Payment[]}
 */
const PAYMENTS = [{
    creation_date: Date.now(),
    fee: 1,
    fee_msat: 1000,
    fee_sat: 1,
    path: ['path1', 'path2'],
    payment_hash: 'payment_hash',
    payment_preimage: 'payment_preimage',
    payment_request: 'payment_request',
    status: 2,
    value: 100,
    value_msat: 100000,
    value_sat: 100,
}]

/** @type {Invoice[]} */
const INVOICES = [{
  add_index: 1,
  amt_paid: 100,
  amt_paid_msat: 100000,
  amt_paid_sat: 100,
  cltv_expiry: 1,
  creation_date: Date.now(),
  description_hash: 'description_hash',
  expiry: 3600,
  fallback_addr: 'fallback_addr',
  memo: 'memo',
  payment_request: 'payment_request',
  private: false,
  r_hash: 'r_hash',
  r_preimage: 'r_preimage',
  receipt: 'receipt',
  route_hints: [{ hop_hints: [{ chan_id: 1, cltv_expiry_delta: 1, fee_base_msat: 100000, fee_proportional_millionths: 1000000000000, node_id: 'node_id' }] }],
  settle_date: Date.now(),
  settle_index: 1,
  settled: true,
  state: 1,
  value: 100
}]

let channel_point;
// module.exports = (app) => {
module.exports = (
  /** @type {import('express').Application} */
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
      if (FAIL) {
        throw new Error('Error message goes here')
      }

      const { alias, password } = req.body;

      if (!alias) {
        throw new TypeError('Missing alias')
      }

      if (!password) {
        throw new TypeError('Missing password')
      }

      const publicKey = await GunDB.authenticate(alias, password)

      return res.status(200).json({
        authorization: 'token',
        user: {
          publicKey,
        }
      })
    } catch (e) {
      return res.status(500).json({
        errorMessage: e.message
      })
    }
  });

  app.post("/api/lnd/wallet", async (req, res) => {
    try {
      if (FAIL) {
        throw new Error('Error messages goes here')
      }

      const { alias, password } = req.body;

      if (!alias) {
        throw new TypeError('Missing alias')
      }

      if (!password) {
        throw new TypeError('Missing password')
      }

      const publicKey = await GunDB.register(alias, password)

      return res.status(200).json({
        authorization: 'token',
        user: {
          publicKey,
        }
      })

    } catch (e) {
      return res.status(500).json({
        errorMessage: e.message
      })
    }
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
                  entries: invoices,
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
    try {
      /** @type {PaginatedListPaymentsRequest} */
      const request = req.body;

      /**
       * @type {PaginatedListPaymentsResponse}
       */
      const _res = getListPage({
        entries: PAYMENTS,
        itemsPerPage: request.itemsPerPage,
        page: request.page
      })

      return res.status(200).json(_res)
    } catch (e) {
      return res.status(500).json({
        errorMessage: e.message
      })
    }
  });

  // get lnd node invoices list
  app.get("/api/lnd/listinvoices", (req, res) => {
    try {
      /**
     * NOT based on any lightning API.
     * @typedef {object} PaginatedListInvoicesRequest
     * @prop {number} itemsPerPage
     * @prop {number} page
     */

    /**
     * NOT based on any lightning API.
     * @typedef {object} PaginatedListInvoicesResponse
     * @prop {Invoice[]} entries
     * @prop {number} page
     * @prop {number} totalPages
      */
      
      /** @type {PaginatedListInvoicesRequest} */
      const request = req.body
      const { page, itemsPerPage } = request;

      /** @type {PaginatedListInvoicesResponse} */
      const _res = {
        entries: INVOICES,
        page: 1,
        totalPages: 1
      }

      return res.status(200).json(_res)
    } catch (e) {
      return res.status(500).json({
        errorMessage: e.message
      })
   }
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
    return res.status(200).json({
      total_balance: 200,
      confirmed_balance: 100,
      unconfirmed_balance: 100,
    })
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
    try {
      /** @type {PaginatedTransactionsRequest} */
      const request = req.body;

      /**
         * @type {PaginatedTransactionsResponse}
         */
        const _res = getListPage({
          entries: TRANSACTIONS,
          itemsPerPage: request.itemsPerPage,
          page: request.page
        })

        return res.status(200).json(_res)      
    } catch (e) {
      return res.status(500).json({
        errorMessage: e.message
      })
    }
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
