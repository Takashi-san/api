import Action from "../action-constants.js";
import * as API from "../contact-api/index.js";
import Event from "../event-constants.js";
import * as Gun from "./gun.js";
/**
 * @typedef {import('../contact-api/SimpleGUN').GUNNode} GUNNode
 * @typedef {import('../contact-api/SimpleGUN').UserGUNNode} UserGUNNode
 */

/**
 * @typedef {object} User
 * @prop {string|null} avatar
 * @prop {string|null} currentHandshakeAddress
 * @prop {string|null} displayName
 * @prop {string} publicKey
 */

/**
 * @type {(() => void)[]}
 */
const userListeners = [];

/**
 * @type {Record<string, User>}
 */
const users = {};

/**
 * @param {string} publicKey
 */
const createUserForListening = publicKey => {
  if (users[publicKey]) {
    return;
  }

  users[publicKey] = {
    avatar: null,
    currentHandshakeAddress: null,
    displayName: null,
    publicKey
  };

  const u = Gun.createGun().user(publicKey);

  userListeners.forEach(l => l());

  u.get(API.Key.PROFILE)
    .get(API.Key.AVATAR)
    .on(avatar => {
      // @ts-ignore
      users[publicKey].avatar = avatar;

      console.log("here1");

      userListeners.forEach(l => l());
    });

  u.get(API.Key.PROFILE)
    .get(API.Key.DISPLAY_NAME)
    .on(displayName => {
      console.log("here2");
      // @ts-ignore
      users[publicKey].displayName = displayName;

      userListeners.forEach(l => l());
    });

  u.get(API.Key.CURRENT_HANDSHAKE_NODE).on(hn => {
    console.log("here3");
    // @ts-ignore
    users[publicKey].currentHandshakeAddress = hn === null ? null : hn._["#"];

    userListeners.forEach(l => l());
  });
};

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

export default class Mediator {
  /**
   * @param {Readonly<SimpleSocket>} socket
   */
  constructor(socket) {
    this.socket = socket;

    this.connected = true;

    socket.on("disconnect", this.onDisconnect);

    socket.on(Action.ACCEPT_REQUEST, this.acceptRequest);
    socket.on(Action.AUTHENTICATE, this.authenticate);
    socket.on(Action.BLACKLIST, this.blacklist);
    socket.on(Action.GENERATE_NEW_HANDSHAKE_NODE, this.generateHandshakeNode);
    socket.on(Action.LOGOUT, this.logout);
    socket.on(Action.REGISTER, this.register);
    socket.on(Action.SEMD_HANDSHAKE_REQUEST, this.sendHandshakeRequest);
    socket.on(Action.SEND_MESSAGE, this.sendMessage);
    socket.on(Action.SET_AVATAR, this.setAvatar);
    socket.on(Action.SET_DISPLAY_NAME, this.setDisplayName);

    socket.on(Event.ON_ALL_USERS, this.onAllUsers);
    socket.on(Event.ON_AVATAR, this.onAvatar);
    socket.on(Event.ON_BLACKLIST, this.onBlacklist);
    socket.on(Event.ON_CHATS, this.onChats);
    socket.on(Event.ON_DISPLAY_NAME, this.onDisplayName);
    socket.on(Event.ON_HANDSHAKE_ADDRESS, this.onHandshakeAddress);
    socket.on(Event.ON_RECEIVED_REQUESTS, this.onReceivedRequests);
    socket.on(Event.ON_SENT_REQUESTS, this.onSentRequests);
  }

  /**
   * @private
   * @type {(() => void)|null}
   */
  userListener = null;

  /**
   * @param {Readonly<{ requestID: string , token: string }>} body
   */
  acceptRequest = body => {
    const { requestID, token } = body;
    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Action.ACCEPT_REQUEST, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Actions.acceptRequest(requestID, user)
      .then(() => {
        const connectedAndAuthed =
          this.connected && !!Gun.getUserForToken(token);

        if (connectedAndAuthed) {
          this.socket.emit(Action.ACCEPT_REQUEST, {
            ok: true,
            msg: null,
            origBody: body
          });

          // refresh received requests

          let sent = false;

          API.Events.onSimplerReceivedRequests(
            receivedRequests => {
              if (this.connected && !!Gun.getUserForToken(token) && !sent) {
                sent = true;

                this.socket.emit(Event.ON_RECEIVED_REQUESTS, {
                  msg: receivedRequests,
                  ok: true,
                  origBody: { token }
                });
              }
            },
            Gun.createGun(),
            user
          );
        }
      })
      .catch(e => {
        if (this.connected) {
          this.socket.emit(Action.ACCEPT_REQUEST, {
            ok: false,
            msg: e.message,
            origBody: body
          });
        }
      });
  };

  /**
   * @param {Readonly<{ alias: string , pass: string }>} body
   */
  authenticate = body => {
    const { alias, pass } = body;

    const user = Gun.getUserForAlias(alias);

    const emitAuth = () => {
      try {
        if (!this.connected) return;

        const token = Gun.getTokenForAlias(alias);
        const is = user.is;

        if (token === null) {
          throw new Error("Internal Error: Expected token to not be null.");
        }

        if (token.length === 0) {
          throw new Error(
            "Internal Error: Expected token to be an string of length greater than zero."
          );
        }

        if (!is) {
          throw new Error("Internal Error: user.is undefined");
        }

        const publicKey = is.pub;

        this.socket.emit(Action.AUTHENTICATE, {
          ok: true,
          msg: {
            publicKey,
            token
          },
          origBody: body
        });
      } catch (e) {
        console.error(`Actions.AUTHENTICATE: ${e.message}`);

        if (!this.connected) return;

        this.socket.emit(Action.AUTHENTICATE, {
          ok: false,
          msg: e.message,
          origBody: body
        });
      }
    };

    if (!!Gun.getTokenForAlias(alias)) {
      emitAuth();
      return;
    }

    API.Actions.authenticate(alias, pass, user)
      .then(() => {
        emitAuth();

        if (user.is) {
          createUserForListening(user.is.pub);
        } else {
          console.warn("couldnt get user.is after authenticating");
        }

        API.Jobs.onAcceptedRequests(API.Events.onSentRequests, user);
      })
      .catch(e => {
        console.error(`Actions.AUTHENTICATE: ${e.message}`);

        if (this.connected) {
          this.socket.emit(Action.AUTHENTICATE, {
            ok: false,
            msg: e.message,
            origBody: body
          });
        }
      });
  };

  /**
   * @param {Readonly<{ publicKey: string , token: string }>} body
   */
  blacklist = body => {
    const { publicKey, token } = body;

    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Action.BLACKLIST, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Actions.blacklist(publicKey, user)
      .then(() => {
        if (this.connected) {
          this.socket.emit(Action.BLACKLIST, {
            ok: true,
            msg: null,
            origBody: body
          });
        }
      })
      .catch(e => {
        if (this.connected) {
          this.socket.emit(Action.BLACKLIST, {
            ok: false,
            msg: e.message,
            origBody: body
          });
        }
      });
  };

  onDisconnect = () => {
    this.connected = false;
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  generateHandshakeNode = body => {
    const { token } = body;
    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Action.GENERATE_NEW_HANDSHAKE_NODE, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Actions.generateNewHandshakeNode(Gun.createGun(), user)
      .then(() => {
        if (this.connected) {
          this.socket.emit(Action.GENERATE_NEW_HANDSHAKE_NODE, {
            ok: true,
            msg: null,
            origBody: body
          });
        }
      })
      .catch(e => {
        if (this.connected) {
          this.socket.emit(Action.GENERATE_NEW_HANDSHAKE_NODE, {
            ok: true,
            msg: e.message,
            origBody: body
          });
        }
      });
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  logout = body => {
    const { token } = body;
    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Action.LOGOUT, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Actions.logout(user)
      .then(() => {
        if (this.connected) {
          this.socket.emit(Action.LOGOUT, {
            ok: true,
            msg: null,
            origBody: body
          });
        }
      })
      .catch(e => {
        if (this.connected) {
          this.socket.emit(Action.LOGOUT, {
            ok: false,
            msg: e.message,
            origBody: body
          });
        }
      });
  };

  /**
   * @param {Readonly<{ alias: string , pass: string }>} body
   */
  register = body => {
    const { alias, pass } = body;

    const user = Gun.createGun().user();

    API.Actions.register(alias, pass, user)
      .then(() => {
        if (this.connected) {
          this.socket.emit(Action.REGISTER, {
            ok: true,
            msg: null,
            origBody: body
          });
        }
      })
      .catch(e => {
        if (this.connected) {
          this.socket.emit(Action.REGISTER, {
            ok: false,
            msg: e.message,
            origBody: body
          });
        }
      });
  };

  /**
   * @param {Readonly<{ handshakeAddress: string , recipientPublicKey: string , token: string }>} body
   */
  sendHandshakeRequest = body => {
    const { handshakeAddress, recipientPublicKey, token } = body;
    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Action.SEMD_HANDSHAKE_REQUEST, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    console.log(body);

    API.Actions.sendHandshakeRequest(
      handshakeAddress,
      recipientPublicKey,
      Gun.createGun(),
      user
    )
      .then(() => {
        if (this.connected) {
          this.socket.emit(Action.SEMD_HANDSHAKE_REQUEST, {
            ok: true,
            msg: null,
            origBody: body
          });
        }
      })
      .catch(e => {
        if (this.connected) {
          this.socket.emit(Action.SEMD_HANDSHAKE_REQUEST, {
            ok: false,
            msg: e.message,
            origBody: body
          });
        }
      });
  };

  /**
   * @param {Readonly<{ body: string , recipientPublicKey: string , token: string }>} reqBody
   */
  sendMessage = reqBody => {
    const { body, recipientPublicKey, token } = reqBody;
    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Action.SEND_MESSAGE, {
        ok: false,
        msg: "Token expired.",
        origBody: reqBody
      });

      return;
    }

    console.log(`sendMessage ReqBody: ${JSON.stringify(reqBody)}`);

    API.Actions.sendMessage(recipientPublicKey, body, user)
      .then(() => {
        if (this.connected) {
          this.socket.emit(Action.SEND_MESSAGE, {
            ok: true,
            msg: null,
            origBody: reqBody
          });
        }
      })
      .catch(e => {
        console.error(e);
        if (this.connected) {
          this.socket.emit(Action.SEND_MESSAGE, {
            ok: false,
            msg: e.message,
            origBody: reqBody
          });
        }
      });
  };

  /**
   * @param {Readonly<{ avatar: string|null , token: string }>} body
   */
  setAvatar = body => {
    const { avatar, token } = body;
    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Action.SET_AVATAR, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Actions.setAvatar(avatar, user)
      .then(() => {
        if (this.connected) {
          this.socket.emit(Action.SET_AVATAR, {
            ok: true,
            msg: null,
            origBody: body
          });
        }
      })
      .catch(e => {
        if (this.connected) {
          this.socket.emit(Action.SET_AVATAR, {
            ok: false,
            msg: e.message,
            origBody: body
          });
        }
      });
  };

  /**
   * @param {Readonly<{ displayName: string , token: string }>} body
   */
  setDisplayName = body => {
    const { displayName, token } = body;
    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Action.SET_DISPLAY_NAME, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Actions.setDisplayName(displayName, user)
      .then(() => {
        if (this.connected) {
          this.socket.emit(Action.SET_DISPLAY_NAME, {
            ok: true,
            msg: null,
            origBody: body
          });
        }
      })
      .catch(e => {
        if (this.connected) {
          this.socket.emit(Action.SET_DISPLAY_NAME, {
            ok: false,
            msg: e.message,
            origBody: body
          });
        }
      });
  };

  //////////////////////////////////////////////////////////////////////////////

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onAllUsers = body => {
    const { token } = body;

    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Event.ON_ALL_USERS, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    this.userListener = () => {
      if (this.connected) {
        this.socket.emit(Event.ON_ALL_USERS, {
          ok: true,
          msg: Object.values(users).filter(u => {
            if (user.is) {
              return u.publicKey !== user.is.pub;
            } else {
              console.error("u.is undefined");
              return true;
            }
          }),
          origBody: body
        });
      }
    };

    this.userListener();

    userListeners.push(this.userListener);
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onAvatar = body => {
    const { token } = body;

    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Event.ON_AVATAR, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onAvatar(avatar => {
      if (this.connected && !!Gun.getUserForToken(token)) {
        this.socket.emit(Event.ON_AVATAR, {
          msg: avatar,
          ok: true,
          origBody: { token }
        });
      }
    }, user);
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onBlacklist = body => {
    const { token } = body;

    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Event.ON_BLACKLIST, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onBlacklist(blacklist => {
      if (this.connected && !!Gun.getUserForToken(token)) {
        this.socket.emit(Event.ON_BLACKLIST, {
          msg: blacklist,
          ok: true,
          origBody: { token }
        });
      }
    }, user);
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onChats = body => {
    const { token } = body;

    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Event.ON_CHATS, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onChats(
      chats => {
        if (this.connected && !!Gun.getUserForToken(token)) {
          this.socket.emit(Event.ON_CHATS, {
            msg: chats,
            ok: true,
            origBody: { token }
          });
        }
      },
      Gun.createGun(),
      user
    );
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onDisplayName = body => {
    const { token } = body;

    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Event.ON_DISPLAY_NAME, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onDisplayName(displayName => {
      if (this.connected && !!Gun.getUserForToken(token)) {
        this.socket.emit(Event.ON_DISPLAY_NAME, {
          msg: displayName,
          ok: true,
          origBody: { token }
        });
      }
    }, user);
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onHandshakeAddress = body => {
    const { token } = body;

    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Event.ON_HANDSHAKE_ADDRESS, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onCurrentHandshakeAddress(addr => {
      if (this.connected && !!Gun.getUserForToken(token)) {
        this.socket.emit(Event.ON_HANDSHAKE_ADDRESS, {
          ok: true,
          msg: addr,
          origBody: body
        });
      }
    }, user);
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onReceivedRequests = body => {
    const { token } = body;

    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Event.ON_RECEIVED_REQUESTS, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onSimplerReceivedRequests(
      receivedRequests => {
        if (this.connected && !!Gun.getUserForToken(token)) {
          this.socket.emit(Event.ON_RECEIVED_REQUESTS, {
            msg: receivedRequests,
            ok: true,
            origBody: { token }
          });
        }
      },
      Gun.createGun(),
      user
    );
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onSentRequests = body => {
    const { token } = body;

    const user = Gun.getUserForToken(token);

    if (user === null) {
      this.socket.emit(Event.ON_SENT_REQUESTS, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onSimplerSentRequests(
      sentRequests => {
        if (this.connected && !!Gun.getUserForToken(token)) {
          this.socket.emit(Event.ON_SENT_REQUESTS, {
            msg: sentRequests,
            ok: true,
            origBody: { token }
          });
        }
      },
      Gun.createGun(),
      user
    );
  };
}
