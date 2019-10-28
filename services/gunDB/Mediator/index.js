const Gun = require("gun");
const debounce = require("lodash/debounce");
const once = require("lodash/once");


/** @type {import('../contact-api/SimpleGUN').ISEA} */
// @ts-ignore
const SEAx = require("gun/sea");

/** @type {import('../contact-api/SimpleGUN').ISEA} */
const mySEA = {}


mySEA.encrypt = (msg, secret) => {
  if (typeof msg !== 'string') {
    return SEAx.encrypt(msg, secret)
  }
  
  return SEAx.encrypt(msg, secret).then(encMsg => {
    return '$$__SHOCKWALLET__' + encMsg
  })
}

mySEA.decrypt = (encMsg, secret) => {
  if (typeof encMsg !== 'string') {
    return SEAx.decrypt(encMsg, secret)
  }
  
  return SEAx.decrypt(encMsg.slice('$$__SHOCKWALLET__'.length), secret)
  
}

mySEA.secret = (recipientOrSenderEpub, recipientOrSenderSEA) => {
  if (recipientOrSenderEpub === recipientOrSenderSEA.pub) {
    throw new Error('Do not use pub for mysecret')
  }
  return SEAx.secret(recipientOrSenderEpub, recipientOrSenderSEA)
}

const auth = require("../../auth/auth");

const Action = require("../action-constants.js");
const API = require("../contact-api/index");
const Config = require("../config");
const Event = require("../event-constants");


/**
 * @typedef {import('../contact-api/SimpleGUN').GUNNode} GUNNode
 * @typedef {import('../contact-api/SimpleGUN').UserGUNNode} UserGUNNode
 */

/**
 * @typedef {object} Emission
 * @prop {boolean} ok
 * @prop {string|null|Record<string, any>} msg
 * @prop {Record<string, any>} origBody
 */

/**
 * @typedef {object} SimpleSocket
 * @prop {(eventName: string, data: Emission) => void} emit
 * @prop {(eventName: string, handler: (data: any) => void) => void} on
 */

/** @type {GUNNode} */
// @ts-ignore
const gun = new Gun({
  file: Config.DATA_FILE_NAME,
  peers: Config.PEERS
});

const user = gun.user();

/**
 * @param {string} token
 * @returns {Promise<boolean>}
 */
const isValidToken = async token => {
  const validation = await auth.validateToken(token);

  if (typeof validation !== "object") {
    return false;
  }

  if (validation === null) {
    return false;
  }

  if (typeof validation.valid !== "boolean") {
    return false;
  }

  return validation.valid;
};

/**
 * @param {string} token
 * @throws {Error} If the token is invalid
 * @returns {Promise<void>}
 */
const throwOnInvalidToken = async token => {
  const isValid = await isValidToken(token);

  if (!isValid) {
    throw new Error("Token expired.");
  }
};

class Mediator {
  /**
   * @param {Readonly<SimpleSocket>} socket
   */
  constructor(socket) {
    this.socket = socket;

    this.connected = true;

    socket.on("disconnect", this.onDisconnect);

    socket.on(Action.ACCEPT_REQUEST, this.acceptRequest);
    socket.on(Action.BLACKLIST, this.blacklist);
    socket.on(Action.GENERATE_NEW_HANDSHAKE_NODE, this.generateHandshakeNode);
    socket.on(Action.SEMD_HANDSHAKE_REQUEST, this.sendHandshakeRequest);
    socket.on(Action.SEND_HANDSHAKE_REQUEST_WITH_INITIAL_MSG, this.sendHRWithInitialMsg)
    socket.on(Action.SEND_MESSAGE, this.sendMessage);
    socket.on(Action.SET_AVATAR, this.setAvatar);
    socket.on(Action.SET_DISPLAY_NAME, this.setDisplayName);

    socket.on(Event.ON_AVATAR, this.onAvatar);
    socket.on(Event.ON_BLACKLIST, this.onBlacklist);
    socket.on(Event.ON_CHATS, this.onChats);
    socket.on(Event.ON_DISPLAY_NAME, this.onDisplayName);
    socket.on(Event.ON_HANDSHAKE_ADDRESS, this.onHandshakeAddress);
    socket.on(Event.ON_RECEIVED_REQUESTS, this.onReceivedRequests);
    socket.on(Event.ON_SENT_REQUESTS, this.onSentRequests);
  }

  /**
   * @param {Readonly<{ requestID: string , token: string }>} body
   */
  acceptRequest = async body => {
    try {
      const { requestID, token } = body;

      await throwOnInvalidToken(token);

      await API.Actions.acceptRequest(requestID, gun, user, mySEA);

      this.socket.emit(Action.ACCEPT_REQUEST, {
        ok: true,
        msg: null,
        origBody: body
      });

      // refresh received requests
      API.Events.onSimplerReceivedRequests(
        debounce(
          once(receivedRequests => {
            this.socket.emit(Event.ON_RECEIVED_REQUESTS, {
              msg: receivedRequests,
              ok: true,
              origBody: body
            });
          }),
          300
        ),
        gun,
        user,
        mySEA
      );
    } catch (err) { console.log(err);
      this.socket.emit(Action.ACCEPT_REQUEST, {
        ok: false,
        msg: err.message,
        origBody: body
      });
    }
  };

  /**
   * @param {Readonly<{ publicKey: string , token: string }>} body
   */
  blacklist = async body => {
    try {
      const { publicKey, token } = body;

      await throwOnInvalidToken(token);

      await API.Actions.blacklist(publicKey, user);

      this.socket.emit(Action.BLACKLIST, {
        ok: true,
        msg: null,
        origBody: body
      });
    } catch (err) { console.log(err);
      this.socket.emit(Action.BLACKLIST, {
        ok: false,
        msg: err.message,
        origBody: body
      });
    }
  };

  onDisconnect = () => {
    this.connected = false;
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  generateHandshakeNode = async body => {
    try {
      const { token } = body;

      await throwOnInvalidToken(token);

      await API.Actions.generateNewHandshakeNode(gun, user);

      this.socket.emit(Action.GENERATE_NEW_HANDSHAKE_NODE, {
        ok: true,
        msg: null,
        origBody: body
      });
    } catch (err) { console.log(err);
      this.socket.emit(Action.GENERATE_NEW_HANDSHAKE_NODE, {
        ok: false,
        msg: err.message,
        origBody: body
      });
    }
  };

  /**
   * @param {Readonly<{ handshakeAddress: string , recipientPublicKey: string , token: string }>} body
   */
  sendHandshakeRequest = async body => {
    try {
      const { handshakeAddress, recipientPublicKey, token } = body;

      await throwOnInvalidToken(token);

      await API.Actions.sendHandshakeRequest(
        handshakeAddress,
        recipientPublicKey,
        gun,
        user,
        mySEA
      );

      this.socket.emit(Action.SEMD_HANDSHAKE_REQUEST, {
        ok: true,
        msg: null,
        origBody: body
      });
    } catch (err) { console.log(err);
      this.socket.emit(Action.SEMD_HANDSHAKE_REQUEST, {
        ok: false,
        msg: err.message,
        origBody: body
      });
    }
  };

  /**
   * @param {Readonly<{ initialMsg: string , handshakeAddress: string , recipientPublicKey: string , token: string }>} body
   */
  sendHRWithInitialMsg = async body => {
    try {
      const { initialMsg, handshakeAddress, recipientPublicKey, token } = body;

      await throwOnInvalidToken(token);

      await API.Actions.sendHRWithInitialMsg(
        initialMsg,
        handshakeAddress,
        recipientPublicKey,
        gun,
        user,
        mySEA
      );

      this.socket.emit(Action.SEND_HANDSHAKE_REQUEST_WITH_INITIAL_MSG, {
        ok: true,
        msg: null,
        origBody: body
      });
    } catch (err) { console.log(err);
      this.socket.emit(Action.SEND_HANDSHAKE_REQUEST_WITH_INITIAL_MSG, {
        ok: false,
        msg: err.message,
        origBody: body
      });
    }
  }

  /**
   * @param {Readonly<{ body: string , recipientPublicKey: string , token: string }>} reqBody
   */
  sendMessage = async reqBody => {
    try {
      const { body, recipientPublicKey, token } = reqBody;

      await throwOnInvalidToken(token);

      await API.Actions.sendMessage(recipientPublicKey, body, gun, user, mySEA);

      this.socket.emit(Action.SEND_MESSAGE, {
        ok: true,
        msg: null,
        origBody: reqBody
      });
    } catch (err) { console.log(err);
      this.socket.emit(Action.SEND_MESSAGE, {
        ok: false,
        msg: err.message,
        origBody: reqBody
      });
    }
  };

  /**
   * @param {Readonly<{ avatar: string|null , token: string }>} body
   */
  setAvatar = async body => {
    try {
      const { avatar, token } = body;

      await throwOnInvalidToken(token);

      await API.Actions.setAvatar(avatar, user);

      this.socket.emit(Action.SET_AVATAR, {
        ok: true,
        msg: null,
        origBody: body
      });
    } catch (err) { console.log(err);
      this.socket.emit(Action.SET_AVATAR, {
        ok: false,
        msg: err.message,
        origBody: body
      });
    }
  };

  /**
   * @param {Readonly<{ displayName: string , token: string }>} body
   */
  setDisplayName = async body => {
    try {
      const { displayName, token } = body;

      await throwOnInvalidToken(token);

      await API.Actions.setDisplayName(displayName, user);

      this.socket.emit(Action.SET_DISPLAY_NAME, {
        ok: true,
        msg: null,
        origBody: body
      });
    } catch (err) { console.log(err);
      this.socket.emit(Action.SET_DISPLAY_NAME, {
        ok: false,
        msg: err.message,
        origBody: body
      });
    }
  };

  //////////////////////////////////////////////////////////////////////////////

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onAvatar = async body => {
    try {
      const { token } = body;

      await throwOnInvalidToken(token);

      API.Events.onAvatar(avatar => {
        this.socket.emit(Event.ON_AVATAR, {
          msg: avatar,
          ok: true,
          origBody: body
        });
      }, user);
    } catch (err) { console.log(err);
      this.socket.emit(Event.ON_AVATAR, {
        ok: false,
        msg: err.message,
        origBody: body
      });
    }
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onBlacklist = async body => {
    try {
      const { token } = body;

      await throwOnInvalidToken(token);

      API.Events.onBlacklist(blacklist => {
        this.socket.emit(Event.ON_BLACKLIST, {
          msg: blacklist,
          ok: true,
          origBody: body
        });
      }, user);
    } catch (err) { console.log(err);
      this.socket.emit(Event.ON_BLACKLIST, {
        ok: false,
        msg: err.message,
        origBody: body
      });
    }
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onChats = async body => {
    try {
      const { token } = body;

      await throwOnInvalidToken(token);

      API.Events.onChats(
        chats => {
          this.socket.emit(Event.ON_CHATS, {
            msg: chats,
            ok: true,
            origBody: body
          });
        },
        gun,
        user,
        mySEA
      );
    } catch (err) { console.log(err);
      this.socket.emit(Event.ON_CHATS, {
        ok: false,
        msg: err.message,
        origBody: body
      });
    }
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onDisplayName = async body => {
    try {
      const { token } = body;

      await throwOnInvalidToken(token);

      API.Events.onDisplayName(displayName => {
        this.socket.emit(Event.ON_DISPLAY_NAME, {
          msg: displayName,
          ok: true,
          origBody: body
        });
      }, user);
    } catch (err) { console.log(err);
      this.socket.emit(Event.ON_DISPLAY_NAME, {
        ok: false,
        msg: err.message,
        origBody: body
      });
    }
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onHandshakeAddress = async body => {
    try {
      const { token } = body;

      await throwOnInvalidToken(token);

      API.Events.onCurrentHandshakeAddress(addr => {
        this.socket.emit(Event.ON_HANDSHAKE_ADDRESS, {
          ok: true,
          msg: addr,
          origBody: body
        });
      }, user);
    } catch (err) { console.log(err);
      this.socket.emit(Event.ON_HANDSHAKE_ADDRESS, {
        ok: false,
        msg: err.message,
        origBody: body
      });
    }
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onReceivedRequests = async body => {
    try {
      const { token } = body;

      await throwOnInvalidToken(token);

      API.Events.onSimplerReceivedRequests(
        receivedRequests => {
          this.socket.emit(Event.ON_RECEIVED_REQUESTS, {
            msg: receivedRequests,
            ok: true,
            origBody: body
          });
        },
        gun,
        user,
        mySEA
      );
    } catch (err) { console.log(err);
      this.socket.emit(Event.ON_RECEIVED_REQUESTS, {
        msg: err.message,
        ok: false,
        origBody: body
      });
    }
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onSentRequests = async body => {
    try {
      const { token } = body;

      await throwOnInvalidToken(token);

      await API.Events.onSimplerSentRequests(
        sentRequests => {
          this.socket.emit(Event.ON_SENT_REQUESTS, {
            msg: sentRequests,
            ok: true,
            origBody: body
          });
        },
        gun,
        user,
        mySEA
      );
    } catch (err) { console.log(err);
      this.socket.emit(Event.ON_SENT_REQUESTS, {
        msg: err.message,
        ok: false,
        origBody: body
      });
    }
  };
}

let _isAuthenticating = false;
let _isRegistering = false;

const isAuthenticated = () => typeof user.is === 'object' && user.is !== null;
const isAuthenticating = () => _isAuthenticating;
const isRegistering = () => _isRegistering;

/**
 * Returns a promise containing the public key of the newly created user.
 * @param {string} alias
 * @param {string} pass
 * @returns {Promise<string>}
 */
const authenticate = (alias, pass) => {
  return new Promise((res, rej) => {
    if (isAuthenticated()) {
      API.Jobs.onAcceptedRequests(gun, user, mySEA)

      // @ts-ignore
      res(user.is.pub)
      return
    }

    if (isAuthenticating()) {
      throw new Error(
        "Cannot authenticate while another authentication attempt is going on"
      );
    }


    _isAuthenticating = true;

    user.auth(alias, pass, ack => {
      _isAuthenticating = false;


      if (typeof ack !== "object" || ack === null) {
        rej(new Error("Unknown error."));
        return;
      }

      if (typeof ack.err === "string") {
        rej(new Error(ack.err));
      } else if (typeof ack.sea === "object") {
        API.Jobs.onAcceptedRequests(gun, user, mySEA)
        res(ack.sea.pub);
      } else {
        rej(new Error("Unknown error."));
      }
    });
  });
};

/**
 * Creates an user for gun. Returns a promise containing the public key of the
 * newly created user.
 * @param {string} alias
 * @param {string} pass
 * @throws {Error} If gun is authenticated or is in the process of
 * authenticating. Use `isAuthenticating()` and `isAuthenticated()` to check for
 * this first. It can also throw if the alias is already registered on gun.
 * @returns {Promise<string>}
 */
const register = (alias, pass) =>
  new Promise((res, rej) => {
    if (isRegistering()) {
      throw new Error("Already registering.");
    }

    if (isAuthenticating()) {
      throw new Error(
        "Cannot register while gun is being authenticated (reminder: there should only be one user created for each node)."
      );
    }

    if (isAuthenticated()) {
      throw new Error(
        "Cannot register if gun is already authenticated (reminder: there should only be one user created for each node)."
      );
    }

    _isRegistering = true;

    user.create(alias, pass, ack => {
      _isRegistering = false;

      if (typeof ack.err === "string") {
        rej(new Error(ack.err));
      } else if (typeof ack.pub === "string") {
        res(ack.pub);
      } else {
        rej(new Error("unknown error"));
      }
    });
  });

/**
 * @param {SimpleSocket} socket
 * @throws {Error} If gun is not authenticated or is in the process of
 * authenticating. Use `isAuthenticating()` and `isAuthenticated()` to check for
 * this first.
 * @returns {Mediator}
 */
const createMediator = socket => {
  // if (isAuthenticating() || !isAuthenticated()) {
  //   throw new Error("Gun must be authenticated to create a Mediator");
  // }

  return new Mediator(socket);
};

module.exports = {
  authenticate,
  createMediator,
  isAuthenticated,
  isAuthenticating,
  isRegistering,
  register
};
