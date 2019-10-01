const Gun = require("gun");
const debounce = require("lodash/debounce");
const once = require("lodash/once");

// @ts-ignore
require("gun/sea");

/** @type {import('../contact-api/SimpleGUN').ISEA} */
// @ts-ignore
const Sea = global.SEA;


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
const gun = Gun({
  file: Config.DATA_FILE_NAME,
  peers: Config.PEERS
});

const user = gun.user();

/**
 * @param {string} token
 * @returns {Promise<boolean>}
 */
const isValidToken = async token => {
  return token === 'token';
  
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

      await API.Actions.acceptRequest(requestID, gun, user, Sea);

      this.socket.emit(Action.ACCEPT_REQUEST, {
        ok: true,
        msg: null,
        origBody: body
      });

      // refresh received requests
      API.Events.onSimplerReceivedRequests(
        debounce(
          once(async receivedRequests => {
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
        Sea
      );
    } catch (e) {
      this.socket.emit(Action.ACCEPT_REQUEST, {
        ok: false,
        msg: e.message,
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
    } catch (e) {
      this.socket.emit(Action.BLACKLIST, {
        ok: false,
        msg: e.message,
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
    } catch (e) {
      this.socket.emit(Action.GENERATE_NEW_HANDSHAKE_NODE, {
        ok: false,
        msg: e.message,
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
        Sea
      );

      this.socket.emit(Action.SEMD_HANDSHAKE_REQUEST, {
        ok: true,
        msg: null,
        origBody: body
      });
    } catch (e) {
      this.socket.emit(Action.SEMD_HANDSHAKE_REQUEST, {
        ok: false,
        msg: e.message,
        origBody: body
      });
    }
  };

  /**
   * @param {Readonly<{ body: string , recipientPublicKey: string , token: string }>} reqBody
   */
  sendMessage = async reqBody => {
    try {
      const { body, recipientPublicKey, token } = reqBody;

      await throwOnInvalidToken(token);

      await API.Actions.sendMessage(recipientPublicKey, body, gun, user, Sea);

      this.socket.emit(Action.SEND_MESSAGE, {
        ok: true,
        msg: null,
        origBody: reqBody
      });
    } catch (e) {
      this.socket.emit(Action.SEND_MESSAGE, {
        ok: false,
        msg: e.message,
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
    } catch (e) {
      this.socket.emit(Action.SET_AVATAR, {
        ok: false,
        msg: e.message,
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
    } catch (e) {
      this.socket.emit(Action.SET_DISPLAY_NAME, {
        ok: false,
        msg: e.message,
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
    } catch (e) {
      this.socket.emit(Event.ON_AVATAR, {
        ok: false,
        msg: e.message,
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
    } catch (e) {
      this.socket.emit(Event.ON_BLACKLIST, {
        ok: false,
        msg: e.message,
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
        Sea
      );
    } catch (e) {
      this.socket.emit(Event.ON_CHATS, {
        ok: false,
        msg: e.message,
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
    } catch (e) {
      console.log(e)
      this.socket.emit(Event.ON_DISPLAY_NAME, {
        ok: false,
        msg: e.message,
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
    } catch (e) {
      this.socket.emit(Event.ON_HANDSHAKE_ADDRESS, {
        ok: false,
        msg: e.message,
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
        Sea
      );
    } catch (e) {
      this.socket.emit(Event.ON_RECEIVED_REQUESTS, {
        msg: e.message,
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

      API.Events.onSimplerSentRequests(
        sentRequests => {
          this.socket.emit(Event.ON_SENT_REQUESTS, {
            msg: sentRequests,
            ok: true,
            origBody: body
          });
        },
        gun,
        user,
        Sea
      );
    } catch (e) {
      this.socket.emit(Event.ON_SENT_REQUESTS, {
        msg: e.message,
        ok: false,
        origBody: body
      });
    }
  };
}

let _isAuthenticating = false;
let _isRegistering = false;

const isAuthenticated = () => !!user.is;
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
    user.leave()

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

/**
 * @returns {string}
 */
const getPublicKey = () => {
  if (isAuthenticating() || !isAuthenticated()) {
    throw new Error("Gun must be authenticated to get the public key");
  }

  return user._.sea.pub
}


module.exports = {
  authenticate,
  createMediator,
  getPublicKey,
  isAuthenticated,
  isAuthenticating,
  isRegistering,
  register
};

