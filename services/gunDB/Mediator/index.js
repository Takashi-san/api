const Gun = require("gun");
// @ts-ignore
require("gun/sea");

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

module.exports = class Mediator {
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
  acceptRequest = body => {
    const { requestID, token } = body;

    // TODO: Validate token

    if (!token) {
      this.socket.emit(Action.ACCEPT_REQUEST, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Actions.acceptRequest(requestID, user)
      .then(() => {
        // TODO: check auth status
        const connectedAndAuthed = this.connected;

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
              // TODO: check auth status
              const connectedAndAuthed = this.connected;

              if (connectedAndAuthed && !sent) {
                sent = true;

                this.socket.emit(Event.ON_RECEIVED_REQUESTS, {
                  msg: receivedRequests,
                  ok: true,
                  origBody: { token }
                });
              }
            },
            gun,
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
   * @param {Readonly<{ publicKey: string , token: string }>} body
   */
  blacklist = body => {
    const { publicKey, token } = body;

    // TODO: Validate token

    if (!token) {
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
    // TODO: Validate token

    if (!token) {
      this.socket.emit(Action.GENERATE_NEW_HANDSHAKE_NODE, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Actions.generateNewHandshakeNode(gun, user)
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
   * @param {Readonly<{ handshakeAddress: string , recipientPublicKey: string , token: string }>} body
   */
  sendHandshakeRequest = body => {
    const { handshakeAddress, recipientPublicKey, token } = body;
    // TODO: Validate token

    if (!token) {
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
      gun,
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
    // TODO: Validate token

    if (!token) {
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
    // TODO: Validate token

    if (!token) {
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
    // TODO: Validate token

    if (!token) {
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
  onAvatar = body => {
    const { token } = body;

    // TODO: Validate token

    if (!token) {
      this.socket.emit(Event.ON_AVATAR, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onAvatar(avatar => {
      if (this.connected && !!token) {
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

    // TODO: Validate token

    if (!token) {
      this.socket.emit(Event.ON_BLACKLIST, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onBlacklist(blacklist => {
      // TODO: Validate token
      if (this.connected && !!token) {
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

    // TODO: Validate token

    if (!token) {
      this.socket.emit(Event.ON_CHATS, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onChats(
      chats => {
        // TODO: Validate token
        if (this.connected && !!token) {
          this.socket.emit(Event.ON_CHATS, {
            msg: chats,
            ok: true,
            origBody: { token }
          });
        }
      },
      gun,
      user
    );
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onDisplayName = body => {
    const { token } = body;

    // TODO: Validate token

    if (!token) {
      this.socket.emit(Event.ON_DISPLAY_NAME, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onDisplayName(displayName => {
      if (this.connected && !!token) {
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

    // TODO: Validate token

    if (!token) {
      this.socket.emit(Event.ON_HANDSHAKE_ADDRESS, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onCurrentHandshakeAddress(addr => {
      // TODO: Validate token
      if (this.connected && !!token) {
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

    // TODO: Validate token

    if (!token) {
      this.socket.emit(Event.ON_RECEIVED_REQUESTS, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onSimplerReceivedRequests(
      receivedRequests => {
        // TODO: Validate token
        if (this.connected && !!token) {
          this.socket.emit(Event.ON_RECEIVED_REQUESTS, {
            msg: receivedRequests,
            ok: true,
            origBody: { token }
          });
        }
      },
      gun,
      user
    );
  };

  /**
   * @param {Readonly<{ token: string }>} body
   */
  onSentRequests = body => {
    const { token } = body;

    // TODO: Validate token

    if (!token) {
      this.socket.emit(Event.ON_SENT_REQUESTS, {
        ok: false,
        msg: "Token expired.",
        origBody: body
      });

      return;
    }

    API.Events.onSimplerSentRequests(
      sentRequests => {
        // TODO: Validate token
        if (this.connected && !!token) {
          this.socket.emit(Event.ON_SENT_REQUESTS, {
            msg: sentRequests,
            ok: true,
            origBody: { token }
          });
        }
      },
      gun,
      user
    );
  };
};
