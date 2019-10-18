/**
 * @prettier
 */
const ErrorCode = require("./errorCode");
const Key = require("./key");
const { isHandshakeRequest } = require("./schema");
/**
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
 * @typedef {import('./SimpleGUN').ISEA} ISEA
 * @typedef {import('./SimpleGUN').UserGUNNode} UserGUNNode
 * @typedef {import('./schema').HandshakeRequest} HandshakeRequest
 * @typedef {import('./schema').Message} Message
 * @typedef {import('./schema').Outgoing} Outgoing
 * @typedef {import('./schema').PartialOutgoing} PartialOutgoing
 */

/**
 * An special message signaling the acceptance.
 */
const INITIAL_MSG = "$$__SHOCKWALLET__INITIAL__MESSAGE";

/**
 * @returns {Message}
 */
const __createInitialMessage = () => ({
  body: INITIAL_MSG,
  timestamp: Date.now()
});

/**
 * @param {string} requestID
 * @param {string} requestorPubKey The public key of the requestor, will be used
 * to encrypt the response.
 * @param {string} responseBody An string that will be put to the request.
 * @param {GUNNode} gun
 * @param {UserGUNNode} user
 * @param {ISEA} SEA
 * @throws {ErrorCode.COULDNT_PUT_REQUEST_RESPONSE}
 * @returns {Promise<void>}
 */
const __encryptAndPutResponseToRequest = async (
  requestID,
  requestorPubKey,
  responseBody,
  gun,
  user,
  SEA
) => {
  const u = /** @type {UserGUNNode} */ (user);

  if (!u.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  if (typeof requestID !== "string") {
    throw new TypeError();
  }

  if (requestID.length === 0) {
    throw new TypeError();
  }

  if (typeof requestorPubKey !== "string") {
    throw new TypeError();
  }

  if (requestorPubKey.length === 0) {
    throw new TypeError();
  }

  if (typeof responseBody !== "string") {
    throw new TypeError();
  }

  if (responseBody.length === 0) {
    throw new TypeError();
  }

  const currentHandshakeNode = u.get(Key.CURRENT_HANDSHAKE_NODE).get(requestID);

  /** @type {string} */
  const requestorEpub = await new Promise((res, rej) => {
    gun
      .user(requestorPubKey)
      .get("epub")
      .once(epub => {
        if (typeof epub !== "string") {
          rej(new Error("Expected gun.user(pub).get(epub) to be an string."));
        } else {
          if (epub.length === 0) {
            rej(
              new Error(
                "Expected gun.user(pub).get(epub) to be a populated string."
              )
            );
          } else {
            res(epub);
          }
        }
      });
  });

  const secret = await SEA.secret(requestorEpub, user._.sea);
  const encryptedResponse = await SEA.encrypt(responseBody, secret);

  return new Promise((res, rej) => {
    currentHandshakeNode.put(
      {
        response: encryptedResponse
      },
      ack => {
        if (ack.err) {
          rej(new Error(ErrorCode.COULDNT_PUT_REQUEST_RESPONSE));
        } else {
          res();
        }
      }
    );
  });
};

/**
 * Create a an outgoing feed. The feed will have an initial special acceptance
 * message. Returns a promise that resolves to the id of the newly-created
 * outgoing feed.
 * @param {string} withPublicKey Public key of the intended recipient of the
 * outgoing feed that will be created.
 * @throws {Error} If the outgoing feed cannot be created or if the initial
 * message for it also cannot be created. These errors aren't coded as they are
 * not meant to be caught outside of this module.
 * @param {UserGUNNode} user
 * @param {ISEA} SEA
 * @returns {Promise<string>}
 */
const __createOutgoingFeed = async (withPublicKey, user, SEA) => {
  try {
    if (!user.is) {
      throw new Error(ErrorCode.NOT_AUTH);
    }
    const mySecret = await SEA.secret(user._.sea.epub, user._.sea);
    const encryptedForMeRecipientPub = await SEA.encrypt(
      withPublicKey,
      mySecret
    );

    /** @type {PartialOutgoing} */
    const newPartialOutgoingFeed = {
      with: encryptedForMeRecipientPub
    };

    /** @type {GUNNode} */
    const outgoingFeedObj = await new Promise((res, rej) => {
      const outFeed = user
        .get(Key.OUTGOINGS)
        .set(newPartialOutgoingFeed, ack => {
          if (ack.err) {
            rej(new Error(ack.err));
          } else {
            res(outFeed);
          }
        });
    });

    const outgoingFeedID = /** @type {string} */ (outgoingFeedObj._["#"]);

    const outgoingFeed = user.get(Key.OUTGOINGS).get(outgoingFeedID);

    await new Promise((res, rej) => {
      outgoingFeed.get(Key.MESSAGES).set(__createInitialMessage(), ack => {
        if (ack.err) {
          rej(new Error(ack.err));
        } else {
          res();
        }
      });
    });

    return outgoingFeedID;
  } catch (e) {
    console.warn(
      `Got an error ${e.message} setting the initial message on an outgoing feed. Will now try to null out the outgoing feed...`
    );

    throw e;
  }
};

/**
 * Given a request's ID, that should be found on the user's current handshake
 * node, accept the request by creating an outgoing feed intended for the
 * requestor, then encrypting and putting the id of this newly created outgoing
 * feed on the response prop of the request.
 * @param {string} requestID The id for the request to accept.
 * @param {GUNNode} gun
 * @param {UserGUNNode} user Pass only for testing purposes.
 * @param {ISEA} SEA
 * @param {typeof __createOutgoingFeed} outgoingFeedCreator Pass only
 * for testing. purposes.
 * @param {typeof __encryptAndPutResponseToRequest}
 * responseToRequestEncryptorAndPutter Pass only for testing.
 * @throws {Error} Throws if trying to accept an invalid request, or an error on
 * gun's part.
 * @returns {Promise<void>}
 */
const acceptRequest = async (
  requestID,
  gun,
  user,
  SEA,
  outgoingFeedCreator = __createOutgoingFeed,
  responseToRequestEncryptorAndPutter = __encryptAndPutResponseToRequest
) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  /** @type {HandshakeRequest} */
  const { 
    response: encryptedForUsIncomingID, 
    from: senderPublicKey
  } = await new Promise((res, rej) => {
    const requestNode = user.get(Key.CURRENT_HANDSHAKE_NODE).get(requestID);

    requestNode.once(hr => {
      if (!isHandshakeRequest(hr)) {
        rej(new Error(ErrorCode.TRIED_TO_ACCEPT_AN_INVALID_REQUEST));
        return;
      }

      res(hr);
    });
  });

  /** @type {string} */
  const requestorEpub = await new Promise((res, rej) => {
    gun
      .user(senderPublicKey)
      .get("epub")
      .once(epub => {
        if (typeof epub !== "string") {
          rej(new Error("Expected gun.user(pub).get(epub) to be an string."));
        } else {
          if (epub.length === 0) {
            rej(
              new Error(
                "Expected gun.user(pub).get(epub) to be a populated string."
              )
            );
          } else {
            res(epub);
          }
        }
      });
  });

  const incomingID = await SEA.decrypt(
    encryptedForUsIncomingID, 
    await SEA.secret(requestorEpub, user._.sea)
  );

  const newlyCreatedOutgoingFeedID = await outgoingFeedCreator(
    senderPublicKey,
    user,
    SEA
  );

  const mySecret = await SEA.secret(user._.sea.pub, user._.sea);
  const encryptedForMeIncomingID = await SEA.encrypt(incomingID, mySecret);

  await new Promise((res, rej) => {
    user
      .get(Key.USER_TO_INCOMING)
      .get(senderPublicKey)
      .put(encryptedForMeIncomingID, ack => {
        if (ack.err) {
          rej(new Error(ack.err));
        } else {
          res();
        }
      });
  });

  const encryptedForMeOutgoingID = await SEA.encrypt(
    newlyCreatedOutgoingFeedID,
    mySecret
  );

  console.warn(
    `writing to recipient to outgoing: recipientKEY:: ${senderPublicKey} -- outgoingID: ${encryptedForMeOutgoingID}`
  );

  await new Promise((res, rej) => {
    user
      .get(Key.RECIPIENT_TO_OUTGOING)
      .get(senderPublicKey)
      .put(encryptedForMeOutgoingID, ack => {
        if (ack.err) {
          rej(new Error(ack.err));
        } else {
          res();
        }
      });
  });

  ////////////////////////////////////////////////////////////////////////////
  // NOTE: perform non-reversable actions before destructive actions
  // In case any of the non-reversable actions reject.
  // In this case, writing to the response is the non-revesarble op.
  ////////////////////////////////////////////////////////////////////////////

  await responseToRequestEncryptorAndPutter(
    requestID,
    senderPublicKey,
    newlyCreatedOutgoingFeedID,
    gun,
    user,
    SEA
  );  
};

/**
 * @param {string} user
 * @param {string} pass
 * @param {UserGUNNode} userNode
 */
const authenticate = (user, pass, userNode) =>
  new Promise((resolve, reject) => {
    if (typeof user !== "string") {
      throw new TypeError("expected user to be of type string");
    }

    if (typeof pass !== "string") {
      throw new TypeError("expected pass to be of type string");
    }

    if (user.length === 0) {
      throw new TypeError("expected user to have length greater than zero");
    }

    if (pass.length === 0) {
      throw new TypeError("expected pass to have length greater than zero");
    }

    if (!!userNode.is) {
      throw new Error(ErrorCode.ALREADY_AUTH);
    }

    userNode.auth(user, pass, ack => {
      if (ack.err) {
        reject(new Error(ack.err));
      } else if (!userNode.is) {
        reject(new Error("authentication failed"));
      } else {
        resolve();
      }
    });
  });

/**
 * @param {string} publicKey
 * @param {UserGUNNode} user Pass only for testing.
 * @throws {Error} If there's an error saving to the blacklist.
 * @returns {Promise<void>}
 */
const blacklist = (publicKey, user) =>
  new Promise((resolve, reject) => {
    if (!user.is) {
      throw new Error(ErrorCode.NOT_AUTH);
    }

    user.get(Key.BLACKLIST).set(publicKey, ack => {
      if (ack.err) {
        reject(new Error(ack.err));
      } else {
        resolve();
      }
    });
  });

/**
 * @param {GUNNode} gun
 * @param {UserGUNNode} user
 * @throws {TypeError}
 * @returns {Promise<void>}
 */
const generateNewHandshakeNode = (gun, user) =>
  new Promise((resolve, reject) => {
    if (!user.is) {
      throw new Error(ErrorCode.NOT_AUTH);
    }

    // create an empty set with an 'unused' item
    const newHandshakeNode = gun
      .get(Key.HANDSHAKE_NODES)
      .set({ unused: 0 }, ack => {
        if (ack.err) {
          reject(new Error(ack.err));
        } else {
          user.get(Key.CURRENT_HANDSHAKE_NODE).put(newHandshakeNode, ack => {
            if (ack.err) {
              reject(new Error(ack.err));
            } else {
              resolve();
            }
          });
        }
      });
  });

/**
 * @param {UserGUNNode} user
 * @throws {Error} UNSUCCESSFUL_LOGOUT
 * @returns {Promise<void>}
 */
const logout = user => {
  if (!user.is) {
    return Promise.reject(new Error(ErrorCode.NOT_AUTH));
  }

  user.leave();

  // https://gun.eco/docs/User#user-leave
  const logoutWasSuccessful = typeof user._.sea === "undefined";

  if (logoutWasSuccessful) {
    return Promise.resolve();
  } else {
    return Promise.reject(new Error(ErrorCode.UNSUCCESSFUL_LOGOUT));
  }
};

/**
 * @param {string} alias
 * @param {string} pass
 * @param {UserGUNNode} user
 * @returns {Promise<void>}
 */
const register = (alias, pass, user) =>
  new Promise((resolve, reject) => {
    const u = /** @type {UserGUNNode} */ (user);

    if (typeof alias !== "string") {
      throw new TypeError();
    }

    if (alias.length === 0) {
      throw new Error();
    }

    if (typeof pass !== "string") {
      throw new TypeError();
    }

    if (pass.length === 0) {
      throw new Error();
    }

    u.create(alias, pass, ack => {
      if (ack.err) {
        reject(new Error(ack.err));
      } else {
        resolve();
      }
    });
  });

/**
 * Sends a handshake to the
 * @param {string} handshakeAddress
 * @param {string} recipientPublicKey
 * @param {GUNNode} gun
 * @param {UserGUNNode} user
 * @param {ISEA} SEA
 * @throws {Error|TypeError}
 * @returns {Promise<void>}
 */
const sendHandshakeRequest = async (
  handshakeAddress,
  recipientPublicKey,
  gun,
  user,
  SEA
) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  if (typeof handshakeAddress !== "string") {
    throw new TypeError(
      `handshakeAddress is not string, got: ${typeof handshakeAddress}`
    );
  }

  if (typeof recipientPublicKey !== "string") {
    throw new TypeError(
      `recipientPublicKey is not string, got: ${typeof recipientPublicKey}`
    );
  }

  if (handshakeAddress.length === 0) {
    throw new TypeError("handshakeAddress is an string of length 0");
  }

  if (recipientPublicKey.length === 0) {
    throw new TypeError("recipientPublicKey is an string of length 0");
  }

  const outgoingFeedID = await __createOutgoingFeed(
    recipientPublicKey,
    user,
    SEA
  );

  const mySecret = await SEA.secret(user._.sea.epub, user._.sea);

  const encryptedForMeOutgoingID = await SEA.encrypt(outgoingFeedID, mySecret);

  console.warn("------------");
  console.warn(
    `writing to recipient to outgoing: recipientKEY:: ${recipientPublicKey} -- outgoingID: ${encryptedForMeOutgoingID}`
  );
  console.warn("------");

  await new Promise((res, rej) => {
    user
      .get(Key.RECIPIENT_TO_OUTGOING)
      .get(recipientPublicKey)
      .put(encryptedForMeOutgoingID, ack => {
        if (ack.err) {
          rej(
            new Error(
              `Error writing to recipientToOutgoing on handshake request creation: ${ack.err}`
            )
          );
        } else {
          res();
        }
      });
  });

  /** @type {string} */
  const recipientEpub = await new Promise((res, rej) => {
    gun
      .user(recipientPublicKey)
      .get("epub")
      .once(epub => {
        if (typeof epub !== "string") {
          rej(
            new Error(
              `Expected gun.user(pub).get(epub) to be an string. Instead got: ${typeof epub}`
            )
          );
        } else {
          if (epub.length === 0) {
            rej(
              new Error(
                "Expected gun.user(pub).get(epub) to be a populated string."
              )
            );
          } else {
            res(epub);
          }
        }
      });
  });

  const secret = await SEA.secret(recipientEpub, user._.sea);
  const encryptedOutgoingFeedID = await SEA.encrypt(outgoingFeedID, secret);

  /** @type {HandshakeRequest} */
  const handshakeRequestData = {
    response: encryptedOutgoingFeedID,
    from: user.is.pub,
    timestamp: Date.now()
  };

  /** @type {GUNNode} */
  const handshakeRequest = await new Promise((res, rej) => {
    const hr = gun
      .get(Key.HANDSHAKE_NODES)
      .get(handshakeAddress)
      .set(handshakeRequestData, ack => {
        if (ack.err) {
          rej(new Error(`Error trying to create request: ${ack.err}`));
        } else {
          res(hr);
        }
      });
  });

  const encryptedForMeRecipientPublicKey = await SEA.encrypt(
    recipientPublicKey,
    mySecret
  );

  // This needs to come before the write to sent requests. Because that write
  // triggers Jobs.onAcceptedRequests and it in turn reads from request-to-user
  await new Promise((res, rej) => {
    user
      .get(Key.REQUEST_TO_USER)
      .get(handshakeRequest._["#"])
      .put(encryptedForMeRecipientPublicKey, ack => {
        if (ack.err) {
          rej(
            new Error(
              `Error saving recipient public key to request to user: ${ack.err}`
            )
          );
        } else {
          res();
        }
      });
  });

  await new Promise((res, rej) => {
    user.get(Key.SENT_REQUESTS).set(handshakeRequest, ack => {
      if (ack.err) {
        rej(
          new Error(
            `Error saving newly created request to sent requests: ${ack.err}`
          )
        );
      } else {
        res();
      }
    });
  });
};

/**
 * @param {string} recipientPublicKey
 * @param {string} body
 * @param {GUNNode} gun
 * @param {UserGUNNode} user
 * @param {ISEA} SEA
 * @returns {Promise<void>}
 */
const sendMessage = async (recipientPublicKey, body, gun, user, SEA) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  if (typeof recipientPublicKey !== "string") {
    throw new TypeError(
      `expected recipientPublicKey to be an string, but instead got: ${typeof recipientPublicKey}`
    );
  }

  if (recipientPublicKey.length === 0) {
    throw new TypeError(
      "expected recipientPublicKey to be an string of length greater than zero"
    );
  }

  if (typeof body !== "string") {
    throw new TypeError(
      `expected message to be an string, instead got: ${typeof body}`
    );
  }

  if (body.length === 0) {
    throw new TypeError(
      "expected message to be an string of length greater than zero"
    );
  }

  const mySecret = await SEA.secret(user._.sea.epub, user._.sea);

  console.warn("--------------------");
  console.warn(
    `fetching from recipient-to-outgoing key: ${recipientPublicKey}`
  );
  console.warn("------------------");

  /** @type {string} */
  const encryptedForMeOutgoingID = await new Promise((res, rej) => {
    user
      .get(Key.RECIPIENT_TO_OUTGOING)
      .get(recipientPublicKey)
      .once(efmoid => {
        if (typeof efmoid === "string") {
          res(efmoid);
        } else {
          rej(
            new Error(
              `sendMessage(): Expected outgoingID to be an string, instead got: ${typeof efmoid}`
            )
          );
        }
      });
  });

  /** @type {string} */
  const recipientEpub = await new Promise((res, rej) => {
    gun
      .user(recipientPublicKey)
      .get("epub")
      .once(epub => {
        if (typeof epub !== "string") {
          rej(
            new Error(
              "sendMessage(): Expected gun.user(pub).get(epub) to be an string."
            )
          );
        } else {
          if (epub.length === 0) {
            rej(
              new Error(
                "sendMessage(): Expected gun.user(pub).get(epub) to be a populated string."
              )
            );
          }
          res(epub);
        }
      });
  });

  const secret = await SEA.secret(recipientEpub, user._.sea);
  const encryptedBody = await SEA.encrypt(body, secret);

  const newMessage = {
    body: encryptedBody,
    timestamp: Date.now()
  };

  const outgoingID = await SEA.decrypt(encryptedForMeOutgoingID, mySecret);

  return new Promise((res, rej) => {
    user
      .get(Key.OUTGOINGS)
      .get(outgoingID)
      .get(Key.MESSAGES)
      .set(newMessage, ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
  });
};

/**
 * @param {string|null} avatar
 * @param {UserGUNNode} user
 * @throws {TypeError} Rejects if avatar is not an string or an empty string.
 * @returns {Promise<void>}
 */
const setAvatar = (avatar, user) =>
  new Promise((resolve, reject) => {
    if (!user.is) {
      throw new Error(ErrorCode.NOT_AUTH);
    }

    if (typeof avatar === "string" && avatar.length === 0) {
      throw new TypeError(
        "'avatar' must be an string and have length greater than one or be null"
      );
    }

    if (typeof avatar !== "string" && avatar !== null) {
      throw new TypeError(
        "'avatar' must be an string and have length greater than one or be null"
      );
    }

    user
      .get(Key.PROFILE)
      .get(Key.AVATAR)
      .put(avatar, ack => {
        if (ack.err) {
          reject(new Error(ack.err));
        } else {
          resolve();
        }
      });
  });

/**
 * @param {string} displayName
 * @param {UserGUNNode} user
 * @throws {TypeError} Rejects if displayName is not an string or an empty
 * string.
 * @returns {Promise<void>}
 */
const setDisplayName = (displayName, user) =>
  new Promise((resolve, reject) => {
    if (!user.is) {
      throw new Error(ErrorCode.NOT_AUTH);
    }

    if (typeof displayName !== "string") {
      throw new TypeError();
    }

    if (displayName.length === 0) {
      throw new TypeError();
    }

    user
      .get(Key.PROFILE)
      .get(Key.DISPLAY_NAME)
      .put(displayName, ack => {
        if (ack.err) {
          reject(new Error(ack.err));
        } else {
          resolve();
        }
      });
  });

/**
 * @param {string} initialMsg
 * @param {string} handshakeAddress
 * @param {string} recipientPublicKey
 * @param {GUNNode} gun
 * @param {UserGUNNode} user
 * @param {ISEA} SEA
 * @throws {Error|TypeError}
 * @returns {Promise<void>}
 */
const sendHRWithInitialMsg = async (
  initialMsg,
  handshakeAddress,
  recipientPublicKey,
  gun,
  user,
  SEA
) => {
  await sendHandshakeRequest(
    handshakeAddress,
    recipientPublicKey,
    gun,
    user,
    SEA
  );

  await sendMessage(recipientPublicKey, initialMsg, gun, user, SEA);
};

module.exports = {
  INITIAL_MSG,
  __encryptAndPutResponseToRequest,
  __createOutgoingFeed,
  acceptRequest,
  authenticate,
  blacklist,
  generateNewHandshakeNode,
  logout,
  register,
  sendHandshakeRequest,
  sendMessage,
  setAvatar,
  setDisplayName,
  sendHRWithInitialMsg
};
