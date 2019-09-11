/**
 * @prettier
 */
import * as ErrorCode from "./errorCode.js";
import * as Key from "./key.js";
import { gun as mainGun, user as userGun } from "./gun.js";
import { isHandshakeRequest } from "./schema.js";
/**
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
 * @typedef {import('./SimpleGUN').UserGUNNode} UserGUNNode
 * @typedef {import('./schema').HandshakeRequest} HandshakeRequest
 * @typedef {import('./schema').Message} Message
 * @typedef {import('./schema').Outgoing} Outgoing
 * @typedef {import('./schema').PartialOutgoing} PartialOutgoing
 */

/**
 * An special message signaling the acceptance.
 */
export const INITIAL_MSG = "$$__SHOCKWALLET__INITIAL__MESSAGE";

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
 * @param {UserGUNNode} user
 * @throws {ErrorCode.COULDNT_PUT_REQUEST_RESPONSE}
 * @returns {Promise<void>}
 */
export const __encryptAndPutResponseToRequest = (
  requestID,
  requestorPubKey,
  responseBody,
  user
) =>
  new Promise((resolve, reject) => {
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

    const currentHandshakeNode = u
      .get(Key.CURRENT_HANDSHAKE_NODE)
      .get(requestID);

    currentHandshakeNode.put(
      {
        // TODO: encrypt
        response: "$$_TEST_" + responseBody
      },
      ack => {
        if (ack.err) {
          reject(new Error(ErrorCode.COULDNT_PUT_REQUEST_RESPONSE));
        } else {
          resolve();
        }
      }
    );
  });

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
 * @returns {Promise<string>}
 */
export const __createOutgoingFeed = (withPublicKey, user) =>
  new Promise((resolve, reject) => {
    if (!user.is) {
      throw new Error(ErrorCode.NOT_AUTH);
    }

    /** @type {PartialOutgoing} */
    const newPartialOutgoingFeed = {
      with: withPublicKey
    };

    const outgoingFeed = user
      .get(Key.OUTGOINGS)
      .set(newPartialOutgoingFeed, outgoingFeedAck => {
        if (outgoingFeedAck.err) {
          reject(new Error(outgoingFeedAck.err));
        } else {
          outgoingFeed
            .get(Key.MESSAGES)
            .set(__createInitialMessage(), msgAck => {
              if (msgAck.err) {
                user
                  .get(Key.OUTGOINGS)
                  .get(/** @type {string} */ (outgoingFeed._.get))
                  .put(null);

                reject(new Error());
              } else {
                resolve(/** @type {string} */ (outgoingFeed._.get));
              }
            });
        }
      });
  });

/**
 * Given a request's ID, that should be found on the user's current handshake
 * node, accept the request by creating an outgoing feed intended for the
 * requestor, then encrypting and putting the id of this newly created outgoing
 * feed on the response prop of the request.
 * @param {string} requestID The id for the request to accept.
 * @param {UserGUNNode=} user Pass only for testing purposes.
 * @param {typeof __createOutgoingFeed} outgoingFeedCreator Pass only for testing.
 * purposes.
 * @param {typeof __encryptAndPutResponseToRequest} responseToRequestEncryptorAndPutter Pass only for testing.
 * @throws {Error} Throws if trying to accept an invalid request, or an error on
 * gun's part.
 * @returns {Promise<void>}
 */
export const acceptRequest = (
  requestID,
  user = userGun,
  outgoingFeedCreator = __createOutgoingFeed,
  responseToRequestEncryptorAndPutter = __encryptAndPutResponseToRequest
) =>
  new Promise((resolve, reject) => {
    const u = /** @type {UserGUNNode} */ user;

    if (!u.is) {
      throw new Error(ErrorCode.NOT_AUTH);
    }

    const requestNode = u.get(Key.CURRENT_HANDSHAKE_NODE).get(requestID);

    // this detects an empty node
    if (typeof requestNode._.put === "undefined") {
      throw new Error(ErrorCode.TRIED_TO_ACCEPT_AN_INVALID_REQUEST);
    }

    requestNode.once(handshakeRequest => {
      if (!isHandshakeRequest(handshakeRequest)) {
        reject(new Error(ErrorCode.TRIED_TO_ACCEPT_AN_INVALID_REQUEST));
        return;
      }

      /** @type {string} */
      let outgoingFeedID;

      outgoingFeedCreator(handshakeRequest.from, user)
        .then(outfid => {
          outgoingFeedID = outfid;

          return responseToRequestEncryptorAndPutter(
            requestID,
            "$$_TEST",
            outgoingFeedID,
            user
          );
        })
        .then(
          () =>
            new Promise(res => {
              user
                .get(Key.USER_TO_INCOMING)
                .get(handshakeRequest.from)
                .put(handshakeRequest.response, ack => {
                  if (ack.err) {
                    throw new Error(ack.err);
                  } else {
                    res();
                  }
                });
            })
        )
        .then(
          () =>
            new Promise(res => {
              user
                .get(Key.RECIPIENT_TO_OUTGOING)
                .get(handshakeRequest.from)
                .put(outgoingFeedID, ack => {
                  if (ack.err) {
                    throw new Error(ack.err);
                  } else {
                    res();
                  }
                });
            })
        )
        .then(() => {
          resolve();
        })
        .catch(() => {
          reject(new Error(ErrorCode.COULDNT_ACCEPT_REQUEST));
        });
    });
  });

/**
 * @param {string} user
 * @param {string} pass
 * @param {UserGUNNode} userNode
 */
export const authenticate = (user, pass, userNode = userGun) =>
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
 * @param {UserGUNNode=} user Pass only for testing.
 * @throws {Error} If there's an error saving to the blacklist.
 * @returns {Promise<void>}
 */
export const blacklist = (publicKey, user = userGun) =>
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
 * @param {GUNNode=} gun
 * @param {UserGUNNode=} user
 * @throws {TypeError}
 * @returns {Promise<void>}
 */
export const generateNewHandshakeNode = (gun = mainGun, user = userGun) =>
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
export const logout = (user = userGun) => {
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
export const register = (alias, pass, user = userGun) =>
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
 * @param {UserGUNNode} user
 * @throws {Error|TypeError}
 * @returns {Promise<void>}
 */
export const sendHandshakeRequest = (
  handshakeAddress,
  recipientPublicKey,
  gun = mainGun,
  user = userGun
) =>
  new Promise((resolve, reject) => {
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

    __createOutgoingFeed(recipientPublicKey, user)
      .then(async outgoingFeedID => {
        if (typeof user.is === "undefined") {
          reject(new TypeError());
          return;
        }

        await new Promise((res, rej) => {
          user
            .get(Key.RECIPIENT_TO_OUTGOING)
            .get(recipientPublicKey)
            .put(outgoingFeedID, ack => {
              if (ack.err) {
                rej(
                  new Error(
                    `error writing to recipientToOutgoing on handshake request creation: ${ack.err}`
                  )
                );
              } else {
                res();
              }
            });
        });

        /** @type {HandshakeRequest} */
        const handshakeRequestData = {
          // TODO: Encrypt, make it indistinguishable from a non-response
          response: outgoingFeedID,
          from: user.is.pub,
          timestamp: Date.now()
        };

        const handshakeRequestNode = gun
          .get(Key.HANDSHAKE_NODES)
          .get(handshakeAddress)
          .set(handshakeRequestData, ack => {
            if (ack.err) {
              reject(new Error(ack.err));
            } else {
              user.get(Key.SENT_REQUESTS).set(handshakeRequestNode, ack => {
                if (ack.err) {
                  reject(new Error(ack.err));
                } else {
                  user
                    .get(Key.REQUEST_TO_USER)
                    .get(/** @type {string} */ (handshakeRequestNode._.get))
                    .put(recipientPublicKey, ack => {
                      if (ack.err) {
                        reject(new Error(ack.err));
                      } else {
                        resolve();
                      }
                    });
                }
              });
            }
          });
      })
      .catch(e => {
        reject(e);
      });
  });

/**
 * @param {string} recipientPublicKey
 * @param {string} body
 * @param {UserGUNNode} user
 * @returns {Promise<void>}
 */
export const sendMessage = (recipientPublicKey, body, user) => {
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

  return new Promise((res, rej) => {
    user
      .get(Key.RECIPIENT_TO_OUTGOING)
      .get(recipientPublicKey)
      .once(outgoingID => {
        if (typeof outgoingID === "string") {
          res(outgoingID);
        } else {
          rej(
            new Error(
              `Expected outgoingID to be an string, instead got: ${typeof outgoingID}`
            )
          );
        }
      });
  }).then(
    (/** @type {string} */ outgoingID) =>
      new Promise((res, rej) => {
        /** @type {Message} */
        const newMessage = {
          body,
          timestamp: Date.now()
        };

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
      })
  );
};

/**
 * @param {string|null} avatar
 * @param {UserGUNNode} user
 * @throws {TypeError} Rejects if avatar is not an string or an empty string.
 * @returns {Promise<void>}
 */
export const setAvatar = (avatar, user = userGun) =>
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
export const setDisplayName = (displayName, user = userGun) =>
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
