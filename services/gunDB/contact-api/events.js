/**
 * @prettier
 */
const ErrorCode = require("./errorCode");
const Key = require("./key");
const Schema = require("./schema");
const uniqBy = require("lodash/uniqBy");
/**
 * @typedef {import('./SimpleGUN').UserGUNNode} UserGUNNode
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
 * @typedef {import('./SimpleGUN').ISEA} ISEA
 * @typedef {import('./schema').HandshakeRequest} HandshakeRequest
 * @typedef {import('./schema').Message} Message
 * @typedef {import('./schema').Outgoing} Outgoing
 * @typedef {import('./schema').PartialOutgoing} PartialOutgoing
 * @typedef {import('./schema').Chat} Chat
 * @typedef {import('./schema').ChatMessage} ChatMessage
 * @typedef {import('./schema').SimpleSentRequest} SimpleSentRequest
 * @typedef {import('./schema').SimpleReceivedRequest} SimpleReceivedRequest
 */

/**
 *
 * @param {string} outgoingKey
 * @param {(message: Message, key: string) => void} cb
 * @param {UserGUNNode} user
 * @returns {void}
 */
const __onOutgoingMessage = (outgoingKey, cb, user) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  user
    .get(Key.OUTGOINGS)
    .get(outgoingKey)
    .get(Key.MESSAGES)
    .map()
    .on((data, key) => {
      if (Schema.isMessage(data)) {
        cb(data, key);
      }
    });
};

/**
 * Maps a sent request ID to the public key of the user it was sent to.
 * @param {(requestToUser: Record<string, string>) => void} cb
 * @param {UserGUNNode} user Pass only for testing purposes.
 * @returns {void}
 */
const __onSentRequestToUser = (cb, user) => {
  /** @type {Record<string, string>} */
  const requestToUser = {};

  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  user
    .get(Key.REQUEST_TO_USER)
    .map()
    .on((userPK, requestKey) => {
      if (typeof userPK !== "string") {
        console.error("got a non string value");
        return;
      }

      if (userPK.length === 0) {
        console.error("got an empty string value");
        return;
      }

      requestToUser[requestKey] = userPK;

      cb(requestToUser);
    });
};

/**
 * @param {(userToOutgoing: Record<string, string>) => void} cb
 * @param {UserGUNNode} user Pass only for testing purposes.
 * @returns {void}
 */
const __onUserToIncoming = (cb, user) => {
  /** @type {Record<string, string>} */
  const userToOutgoing = {};

  user
    .get(Key.USER_TO_INCOMING)
    .map()
    .on((data, key) => {
      if (typeof data !== "string") {
        console.error("got a non string value");
        return;
      }

      if (data.length === 0) {
        console.error("got an empty string value");
        return;
      }

      userToOutgoing[key] = data;

      cb(userToOutgoing);
    });
};

/**
 * @param {(avatar: string|null) => void} cb
 * @param {UserGUNNode} user Pass only for testing purposes.
 * @throws {Error} If user hasn't been auth.
 * @returns {void}
 */
const onAvatar = (cb, user) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  // Initial value if avvatar is undefined in gun
  cb(null);

  const u = /** @type {UserGUNNode} */ (user);

  u.get(Key.PROFILE)
    .get(Key.AVATAR)
    .on(avatar => {
      if (typeof avatar === "string" || avatar === null) {
        cb(avatar);
      }
    });
};

/**
 * @param {(blacklist: string[]) => void} cb
 * @param {UserGUNNode} user
 * @returns {void}
 */
const onBlacklist = (cb, user) => {
  /** @type {string[]} */
  const blacklist = [];

  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  // Initial value if no items are in blacklist in gun
  cb(blacklist);

  user
    .get(Key.BLACKLIST)
    .map()
    .on(publicKey => {
      if (typeof publicKey === "string" && publicKey.length > 0) {
        blacklist.push(publicKey);
        cb(blacklist);
      } else {
        console.warn("Invalid public key received for blacklist");
      }
    });
};

/**
 * @param {(currentHandshakeAddress: string|null) => void} cb
 * @param {UserGUNNode} user
 * @returns {void}
 */
const onCurrentHandshakeAddress = (cb, user) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  // If undefined, callback below wont be called. Let's supply null as the
  // initial value.
  cb(null);

  user.get(Key.CURRENT_HANDSHAKE_NODE).on(handshakeNode => {
    if (typeof handshakeNode !== "object" || handshakeNode === null) {
      console.error("expected handshakeNode to be of type object");

      cb(null);

      return;
    }

    cb(handshakeNode._["#"]);
  });
};

/**
 * @param {(currentHandshakeNode: Record<string, HandshakeRequest>|null) => void} cb
 * @param {UserGUNNode} user Pass only for testing purposes.
 * @returns {void}
 */
const onCurrentHandshakeNode = (cb, user) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  /**
   * @type {Record<string, HandshakeRequest>}
   */
  const handshakes = {};

  user.get(Key.CURRENT_HANDSHAKE_NODE).on(handshakeNode => {
    if (handshakeNode === null) {
      cb(null);
    } else {
      user
        .get(Key.CURRENT_HANDSHAKE_NODE)
        .once()
        .map()
        .once((handshakeReq, key) => {
          if (Schema.isHandshakeRequest(handshakeReq)) {
            handshakes[key] = handshakeReq;
          }

          cb(handshakes);
        });
    }
  });
};

/**
 * @param {(displayName: string|null) => void} cb
 * @param {UserGUNNode} user Pass only for testing purposes.
 * @throws {Error} If user hasn't been auth.
 * @returns {void}
 */
const onDisplayName = (cb, user) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  const u = /** @type {UserGUNNode} */ (user);

  // Initial value if display name is undefined in gun
  cb(null);

  u.get(Key.PROFILE)
    .get(Key.DISPLAY_NAME)
    .on(displayName => {
      if (typeof displayName === "string" || displayName === null) {
        cb(displayName);
      }
    });
};

/**
 * @param {(messages: Record<string, Message>) => void} cb
 * @param {string} userPK Public key of the user from whom the incoming
 * messages will be obtained.
 * @param {string} incomingFeedID ID of the outgoing feed from which the
 * incoming messages will be obtained.
 * @param {GUNNode} gun (Pass only for testing purposes)
 * @param {UserGUNNode} user
 * @param {ISEA} SEA
 * @returns {void}
 */
const onIncomingMessages = (cb, userPK, incomingFeedID, gun, user, SEA) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  const otherUser = gun.user(userPK);

  /**
   * @type {Record<string, Message>}
   */
  const messages = {};

  otherUser
    .get(Key.OUTGOINGS)
    .get(incomingFeedID)
    .get(Key.MESSAGES)
    .map()
    .on(async (data, key) => {
      if (!Schema.isMessage(data)) {
        console.warn("non-message received");
        return;
      }

      const msg = data;

      const encryptedBody = msg.body;

      const secret = await SEA.secret(userPK, user._.sea);
      const decryptedBody = await SEA.decrypt(encryptedBody, secret);

      messages[key] = {
        // @ts-ignore TODO: See what's going on with typescript here
        ...msg,
        body: decryptedBody
      };

      cb(messages);
    });
};

/**
 *
 * @param {(outgoings: Record<string, Outgoing>) => void} cb
 * @param {UserGUNNode} user
 * @param {typeof __onOutgoingMessage} onOutgoingMessage
 */
const onOutgoing = (cb, user, onOutgoingMessage = __onOutgoingMessage) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  /**
   * @type {Record<string, Outgoing>}
   */
  const outgoings = {};

  /**
   * @type {string[]}
   */
  const outgoingsWithMessageListeners = [];

  const u = /** @type {UserGUNNode} */ (user);

  u.get(Key.OUTGOINGS)
    .map()
    .on((data, key) => {
      if (!Schema.isPartialOutgoing(data)) {
        console.warn("not partial outgoing");
        console.warn(JSON.stringify(data));
        return;
      }

      outgoings[key] = {
        messages: outgoings[key] ? outgoings[key].messages : {},
        with: data.with
      };

      if (!outgoingsWithMessageListeners.includes(key)) {
        outgoingsWithMessageListeners.push(key);

        onOutgoingMessage(
          key,
          (msg, msgKey) => {
            outgoings[key].messages = {
              ...outgoings[key].messages,
              [msgKey]: msg
            };

            cb(outgoings);
          },
          user
        );
      }

      cb(outgoings);
    });
};

/**
 * @param {(sentRequests: Record<string, HandshakeRequest>) => void} cb
 * @param {UserGUNNode} user Pass only for testing purposes.
 * @returns {void}
 */
const onSentRequests = (cb, user) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  /**
   * @type {Record<string, HandshakeRequest>}
   */
  const sentRequests = {};

  const u = /** @type {UserGUNNode} */ (user);

  u.get(Key.SENT_REQUESTS)
    .map()
    .on((req, reqKey) => {
      if (!Schema.isHandshakeRequest(req)) {
        console.error("non-handshakerequest received");
        return;
      }

      sentRequests[reqKey] = req;

      cb(sentRequests);
    });
};

/**
 * Massages all of the more primitive data structures into a more manageable
 * 'Chat' paradigm.
 * @param {(chats: Chat[]) => void} cb
 * @param {GUNNode} gun
 * @param {UserGUNNode} user
 * @param {ISEA} SEA
 * @returns {void}
 */
const onChats = (cb, gun, user, SEA) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  /**
   * @type {Record<string, Chat>}
   */
  const recipientPKToChat = {};

  /**
   * Keep track of the users for which we already set up avatar listeners.
   * @type {string[]}
   */
  const usersWithAvatarListeners = [];

  /**
   * Keep track of the users for which we already set up display name listeners.
   * @type {string[]}
   */
  const usersWithDisplayNameListeners = [];

  /**
   * Keep track of the user for which we already set up incoming feed listeners.
   * @type {string[]}
   */
  const usersWithIncomingListeners = [];

  const callCB = () => {
    // Only provide chats that have incoming listeners which would be contacts
    // that were actually accepted / are going on
    const chats = Object.values(recipientPKToChat).filter(chat =>
      usersWithIncomingListeners.includes(chat.recipientPublicKey)
    );

    // in case someone else elsewhere forgets about sorting
    chats.forEach(chat => {
      chat.messages = chat.messages
        .slice(0)
        .sort((a, b) => a.timestamp - b.timestamp);
    });

    cb(chats);
  };

  callCB();

  onOutgoing(outgoings => {
    for (const outgoing of Object.values(outgoings)) {
      const recipientPK = outgoing.with;

      if (!recipientPKToChat[recipientPK]) {
        recipientPKToChat[recipientPK] = {
          messages: [],
          recipientAvatar: "",
          recipientDisplayName: recipientPK,
          recipientPublicKey: recipientPK
        };
      }

      const messages = recipientPKToChat[recipientPK].messages;

      for (const [msgK, msg] of Object.entries(outgoing.messages)) {
        if (!messages.find(m => m.id === msgK)) {
          messages.push({
            body: msg.body,
            id: msgK,
            outgoing: true,
            timestamp: msg.timestamp
          });
        }
      }
    }

    callCB();
  }, user);

  __onUserToIncoming(uti => {
    for (const [recipientPK, incomingFeedID] of Object.entries(uti)) {
      if (!recipientPKToChat[recipientPK]) {
        recipientPKToChat[recipientPK] = {
          messages: [],
          recipientAvatar: "",
          recipientDisplayName: recipientPK,
          recipientPublicKey: recipientPK
        };
      }

      const chat = recipientPKToChat[recipientPK];

      if (!usersWithIncomingListeners.includes(recipientPK)) {
        usersWithIncomingListeners.push(recipientPK);

        onIncomingMessages(
          msgs => {
            for (const [msgK, msg] of Object.entries(msgs)) {
              const messages = chat.messages;

              if (!messages.find(m => m.id === msgK)) {
                messages.push({
                  body: msg.body,
                  id: msgK,
                  outgoing: false,
                  timestamp: msg.timestamp
                });
              }
            }

            callCB();
          },
          recipientPK,
          incomingFeedID,
          gun,
          user,
          SEA
        );
      }

      if (!usersWithAvatarListeners.includes(recipientPK)) {
        usersWithAvatarListeners.push(recipientPK);

        gun
          .user(recipientPK)
          .get(Key.PROFILE)
          .get(Key.AVATAR)
          .on(avatar => {
            if (typeof avatar === "string") {
              chat.recipientAvatar = avatar;
              callCB();
            }
          });
      }

      if (!usersWithDisplayNameListeners.includes(recipientPK)) {
        usersWithDisplayNameListeners.push(recipientPK);

        gun
          .user(recipientPK)
          .get(Key.PROFILE)
          .get(Key.DISPLAY_NAME)
          .on(displayName => {
            if (typeof displayName === "string") {
              chat.recipientDisplayName = displayName;
              callCB();
            }
          });
      }
    }
  }, user);
};

/**
 *
 * @param {(simpleReceivedRequests: SimpleReceivedRequest[]) => void} cb
 * @param {GUNNode} gun
 * @param {UserGUNNode} user
 * @returns {void}
 */
const onSimplerReceivedRequests = (cb, gun, user) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  /** @type {Record<string, SimpleReceivedRequest>} */
  const idToReceivedRequest = {};

  /** @type {string[]} */
  const requestorsWithAvatarListeners = [];

  /** @type {string[]} */
  const requestorsWithDisplayNameListeners = [];

  /** @type {Set<string>} */
  const requestorsAlreadyAccepted = new Set();

  user
    .get(Key.USER_TO_INCOMING)
    .map()
    .on((_, userPK) => {
      requestorsAlreadyAccepted.add(userPK);
    });

  const callCB = () => {
    const pendingReceivedRequests = Object.values(idToReceivedRequest);

    // sort from newest to oldest
    pendingReceivedRequests.sort((a, b) => b.timestamp - a.timestamp);

    // in case the requestor mistakenly sent a dupe request, remove the oldest
    // one
    const withoutDups = uniqBy(pendingReceivedRequests, rr => rr.requestorPK);
    // sort again from oldest to newest
    withoutDups.sort((a, b) => a.timestamp - b.timestamp);

    cb(
      // remove already accepted requestors
      withoutDups.filter(rr => !requestorsAlreadyAccepted.has(rr.requestorPK))
    );
  };

  callCB();

  user
    .get(Key.CURRENT_HANDSHAKE_NODE)
    .map()
    .on((req, reqID) => {
      if (!Schema.isHandshakeRequest(req)) {
        console.warn(`non request received: ${JSON.stringify(req)}`);
        return;
      }

      if (!idToReceivedRequest[reqID]) {
        idToReceivedRequest[reqID] = {
          id: reqID,
          requestorAvatar: "",
          requestorDisplayName: "",
          requestorPK: req.from,
          response: req.response,
          timestamp: req.timestamp
        };
      }

      if (!requestorsWithAvatarListeners.includes(req.from)) {
        requestorsWithAvatarListeners.push(req.from);

        gun
          .user(req.from)
          .get(Key.PROFILE)
          .get(Key.AVATAR)
          .on(avatar => {
            if (typeof avatar === "string") {
              for (const receivedReq of Object.values(idToReceivedRequest)) {
                if (receivedReq.requestorPK === req.from) {
                  receivedReq.requestorAvatar = avatar;

                  callCB();
                }
              }
            }
          });
      }

      if (!requestorsWithDisplayNameListeners.includes(req.from)) {
        requestorsWithDisplayNameListeners.push(req.from);

        gun
          .user(req.from)
          .get(Key.PROFILE)
          .get(Key.DISPLAY_NAME)
          .on(displayName => {
            if (typeof displayName === "string") {
              for (const receivedReq of Object.values(idToReceivedRequest)) {
                if (receivedReq.requestorPK === req.from) {
                  receivedReq.requestorDisplayName = displayName;

                  callCB();
                }
              }
            }
          });
      }

      callCB();
    });
};

/**
 * @param {(sentRequests: SimpleSentRequest[]) => void} cb
 * @param {GUNNode} gun
 * @param {UserGUNNode} user
 * @returns {void}
 */
const onSimplerSentRequests = (cb, gun, user) => {
  /**
   * @type {Record<string, Omit<SimpleSentRequest, 'timestamp'> & { timestamp?: undefined|number}>}
   **/
  const idToPartialSimpleSentRequest = {};

  /**
   * Keep track of recipients that already have listeners for their avatars.
   * @type {string[]}
   */
  const recipientsWithAvatarListener = [];

  /**
   * Keep track of recipients that already have listeners for their display
   * name.
   * @type {string[]}
   */
  const recipientsWithDisplayNameListener = [];

  /**
   * Keep track of recipients that already have listeners for their current
   * handshake node.
   * @type {string[]}
   */
  const recipientsWithCurrentHandshakeNodeListener = [];

  /**
   * @type {Set<string>}
   */
  const recipientsThatHaveAcceptedRequest = new Set();

  const callCB = () => {
    // CAST: If the timestamp is a number then we already know the simple sent
    // request is complete
    const sentRequests = /** @type {SimpleSentRequest[]} */ (Object.values(
      idToPartialSimpleSentRequest
    )
      .filter(sr => typeof sr.timestamp === "number")
      .filter(
        sr => !recipientsThatHaveAcceptedRequest.has(sr.recipientPublicKey)
      ));

    // from newest to oldest
    sentRequests.sort((a, b) => b.timestamp - a.timestamp);

    // since it is reverse sorted, uniqBy will keep the LATEST  sent request for
    // a given recipient
    const withoutDups = uniqBy(sentRequests, sr => sr.recipientPublicKey);

    // sort them from oldest to newest
    withoutDups.sort((a, b) => a.timestamp - b.timestamp);

    cb(withoutDups);
  };

  callCB();

  user
    .get(Key.USER_TO_INCOMING)
    .map()
    .on((_, userPK) => {
      recipientsThatHaveAcceptedRequest.add(userPK);

      callCB();
    });

  __onSentRequestToUser(srtu => {
    for (const [sentRequestID, recipientPK] of Object.entries(srtu)) {
      if (!idToPartialSimpleSentRequest[sentRequestID]) {
        idToPartialSimpleSentRequest[sentRequestID] = {
          id: sentRequestID,
          recipientAvatar: "",
          recipientChangedRequestAddress: false,
          recipientDisplayName: "",
          recipientPublicKey: recipientPK
        };
      }

      if (!recipientsWithAvatarListener.includes(recipientPK)) {
        recipientsWithAvatarListener.push(recipientPK);

        gun
          .user(recipientPK)
          .get(Key.PROFILE)
          .get(Key.AVATAR)
          .on(avatar => {
            if (typeof avatar === "string") {
              idToPartialSimpleSentRequest[
                sentRequestID
              ].recipientAvatar = avatar;

              callCB();
            }
          });
      }

      if (!recipientsWithDisplayNameListener.includes(recipientPK)) {
        recipientsWithDisplayNameListener.push(recipientPK);

        gun
          .user(recipientPK)
          .get(Key.PROFILE)
          .get(Key.DISPLAY_NAME)
          .on(displayName => {
            if (typeof displayName === "string") {
              idToPartialSimpleSentRequest[
                sentRequestID
              ].recipientDisplayName = displayName;

              callCB();
            }
          });
      }

      if (!recipientsWithCurrentHandshakeNodeListener.includes(recipientPK)) {
        recipientsWithCurrentHandshakeNodeListener.push(recipientPK);

        gun
          .user(recipientPK)
          .get(Key.CURRENT_HANDSHAKE_NODE)
          .on(() => {
            gun
              .user(recipientPK)
              .get(Key.CURRENT_HANDSHAKE_NODE)
              .get(sentRequestID)
              .once(data => {
                if (typeof data === "undefined") {
                  idToPartialSimpleSentRequest[
                    sentRequestID
                  ].recipientChangedRequestAddress = true;

                  callCB();
                }
              });
          });
      }

      if (
        typeof idToPartialSimpleSentRequest[sentRequestID].timestamp ===
        "undefined"
      ) {
        user
          .get(Key.SENT_REQUESTS)
          .get(sentRequestID)
          .once(sr => {
            if (Schema.isHandshakeRequest(sr)) {
              idToPartialSimpleSentRequest[sentRequestID].timestamp =
                sr.timestamp;

              callCB();
            } else {
              console.warn("non handshake request received");
            }
          });
      }
    }

    callCB();
  }, user);
};

module.exports = {
  __onSentRequestToUser,
  __onUserToIncoming,
  onAvatar,
  onBlacklist,
  onCurrentHandshakeAddress,
  onCurrentHandshakeNode,
  onDisplayName,
  onIncomingMessages,
  onOutgoing,
  onSentRequests,
  onChats,
  onSimplerReceivedRequests,
  onSimplerSentRequests
};
