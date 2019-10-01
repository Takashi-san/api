/**
 * @prettier
 */

import Actions from "./actions";
import ErrorCode from "./errorCode";
import Events from "./events";
import Jobs from "./jobs";
import Key from "./key";
import * as Schema from "./schema";
import * as TestUtils from "./test-utils";
import { createMockGun } from "./__mocks__/mock-gun";
// @ts-ignore
require("gun/sea");

jest.mock("gun/sea");

/**
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
 * @typedef {import('./schema').HandshakeRequest} HandshakeRequest
 * @typedef {import('./schema').PartialOutgoing} PartialOutgoing
 * @typedef {import('./schema').Outgoing} Outgoing
 * @typedef {import('./schema').Message} Message
 * @typedef {import('./SimpleGUN').UserGUNNode} UserGUNNode
 * @typedef {import('./SimpleGUN').ISEA} ISEA
 */

/** @type {ISEA} */
// @ts-ignore
const Sea = SEA;

describe("__encryptAndPutResponseToRequest", () => {
  const NOT_AN_STRING = Math.random();

  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    expect.assertions(1);

    Actions.__encryptAndPutResponseToRequest(
      Math.random().toString(),
      Math.random().toString(),
      Math.random().toString(),
      createMockGun(),
      createMockGun().user(),
      Sea
    ).catch(e => {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
      done();
    });
  });

  it("throws a TypeError if the requestID argument isn't an string", done => {
    expect.assertions(1);

    Actions.__encryptAndPutResponseToRequest(
      // @ts-ignore
      NOT_AN_STRING,
      Math.random().toString(),
      Math.random().toString(),
      createMockGun(),
      createMockGun({ isAuth: true }).user(),
      Sea
    ).catch((/** @type {any} */ e) => {
      expect(e).toBeInstanceOf(TypeError);
      done();
    });
  });

  it("throws a TypeError if the requestorPubKey argument isn't an string", done => {
    expect.assertions(1);

    Actions.__encryptAndPutResponseToRequest(
      Math.random().toString(),
      // @ts-ignore
      NOT_AN_STRING,
      Math.random().toString(),
      createMockGun(),
      createMockGun({ isAuth: true }).user(),
      Sea
    ).catch((/** @type {any} */ e) => {
      done();
      expect(e).toBeInstanceOf(TypeError);
    });
  });

  it("throws a TypeError if the responseBody argument isn't an string", done => {
    expect.assertions(1);

    Actions.__encryptAndPutResponseToRequest(
      Math.random().toString(),
      Math.random().toString(),
      // @ts-ignore
      NOT_AN_STRING,
      createMockGun(),
      createMockGun({ isAuth: true }).user(),
      Sea
    ).catch((/** @type {any} */ e) => {
      done();
      expect(e).toBeInstanceOf(TypeError);
    });
  });

  it("throws a TypeError if the requestID argument is an empty string", done => {
    expect.assertions(1);

    Actions.__encryptAndPutResponseToRequest(
      "",
      Math.random().toString(),
      Math.random().toString(),
      createMockGun(),
      createMockGun({ isAuth: true }).user(),
      Sea
    ).catch(e => {
      done();
      expect(e).toBeInstanceOf(TypeError);
    });
  });

  it("throws a TypeError if the requestorPubKey argument is an empty string", done => {
    expect.assertions(1);

    Actions.__encryptAndPutResponseToRequest(
      Math.random().toString(),
      "",
      Math.random().toString(),
      createMockGun(),
      createMockGun({ isAuth: true }).user(),
      Sea
    ).catch(e => {
      expect(e).toBeInstanceOf(TypeError);
      done();
    });
  });

  it("throws a TypeError if the responseBody argument is an empty string", done => {
    expect.assertions(1);

    Actions.__encryptAndPutResponseToRequest(
      Math.random().toString(),
      Math.random().toString(),
      "",
      createMockGun(),
      createMockGun({ isAuth: true }).user(),
      Sea
    ).catch(e => {
      done();
      expect(e).toBeInstanceOf(TypeError);
    });
  });

  it("changes and encrypts the response of an existing request", async done => {
    expect.assertions(1);

    const gun = createMockGun();
    const user = gun.user();

    await new Promise(res => user.auth("a", "a", res));

    const requestorPK = Math.random().toString();
    /** @type {string} */
    const requestorEpub = await new Promise(res =>
      gun
        .user(requestorPK)
        .get("epub")
        // @ts-ignore
        .once(res)
    );
    const newResponse = Math.random().toString();

    /** @type {HandshakeRequest} */
    const theRequest = {
      from: requestorPK,
      response: Math.random().toString(),
      timestamp: Date.now()
    };

    /**
     * @type {GUNNode}
     */
    const theRequestNode = await new Promise((res, rej) => {
      const trn = user.get(Key.CURRENT_HANDSHAKE_NODE).set(theRequest, ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res(trn);
        }
      });
    });

    const requestID = /** @type {string} */ (theRequestNode._.get);

    await Actions.__encryptAndPutResponseToRequest(
      requestID,
      requestorPK,
      newResponse,
      gun,
      user,
      Sea
    );

    /** @type {HandshakeRequest} */
    const receivedRequest = await new Promise(res => {
      // @ts-ignore
      theRequestNode.once(res);
    });

    const { response: encryptedRes } = receivedRequest;

    const decryptedResponse = await Sea.decrypt(
      encryptedRes,
      await Sea.secret(requestorEpub, user._.sea)
    );

    expect(decryptedResponse).toMatch(newResponse);
    done();
  });
});

describe("__createOutgoingFeed()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    expect.assertions(1);

    Actions.__createOutgoingFeed(
      Math.random().toString(),
      createMockGun().user(),
      Sea
    ).catch((/** @type {any} */ e) => {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
      done();
    });
  });

  it("it creates the outgoing feed with the 'with' public key provided", async done => {
    expect.assertions(1);

    try {
      const gun = createMockGun();
      const user = gun.user();

      await new Promise(res => user.auth("a", "a", res));

      const recipientPub = Math.random().toString();

      const outgoingID = await Actions.__createOutgoingFeed(
        recipientPub,
        user,
        Sea
      );

      /**
       * @type {PartialOutgoing}
       */
      const outgoing = await new Promise(res => {
        user
          .get(Key.OUTGOINGS)
          .get(outgoingID)
          // @ts-ignore
          .once(res);
      });

      const decryptedWith = await Sea.decrypt(
        outgoing.with,
        await Sea.secret(user._.sea.epub, user._.sea)
      );

      expect(decryptedWith).toMatch(recipientPub);
      done();
    } catch (e) {
      console.warn(e);
    }
  });

  it("creates a messages set sub-node with an initial special acceptance message", async () => {
    const mockGun = createMockGun({
      isAuth: true
    });

    const user = mockGun.user();

    const pk = Math.random().toString();

    const outgoingID = await Actions.__createOutgoingFeed(pk, user, Sea);

    const msg = await new Promise(res => {
      user
        .get(Key.OUTGOINGS)
        .get(outgoingID)
        .get(Key.MESSAGES)
        .once()
        .map()
        .once(res);
    });

    expect(msg.body).toBe(Actions.INITIAL_MSG);
  });

  it("returns a promise that resolves to the id of the newly-created outgoing feed", done => {
    expect.assertions(2);

    const mockGun = createMockGun({
      isAuth: true
    });

    Actions.__createOutgoingFeed(Math.random().toString(), mockGun.user(), Sea)
      .then(id => {
        expect(typeof id).toBe("string");
        expect(id.length).toBeGreaterThan(0);
        done();
      })
      .catch(e => {
        console.log(e);
      });
  });
});

describe("acceptRequest()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    expect.assertions(1);

    Actions.acceptRequest(
      Math.random().toString(),
      createMockGun(),
      createMockGun().user(),
      Sea
    ).catch(e => {
      expect(e.message).toEqual(ErrorCode.NOT_AUTH);
      done();
    });
  });

  it("throws if the provided request id does not correspond to an existing request", done => {
    expect.assertions(1);

    const gun = createMockGun({
      isAuth: true
    });

    const user = gun.user();

    Actions.acceptRequest("TOTALLY_NOT_A_KEY", gun, user, Sea).catch(e => {
      expect(e.message).toBe(ErrorCode.TRIED_TO_ACCEPT_AN_INVALID_REQUEST);
      done();
    });
  });

  it("creates an outgoing feed intended for the requestor, the outgoing feed's id can be obtained from the response field of the request", async done => {
    expect.assertions(1);

    const gun = createMockGun();

    const requestorUser = gun.user();
    const recipientUser = gun.user();
    await new Promise(res => requestorUser.auth("a", "a", res));
    await new Promise(res => recipientUser.auth("b", "b", res));

    const { epub: recipientEpub, pub: recipientPub } = recipientUser._.sea;

    const sharedSecret = await Sea.secret(recipientEpub, requestorUser._.sea);

    await Jobs.onAcceptedRequests(
      Events.onSentRequests,
      gun,
      requestorUser,
      Sea
    );

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    /** @type {string} */
    const handshakeAddr = await new Promise((res, rej) => {
      recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).once(n => {
        if (typeof n === "object" && n !== null) {
          res(n._["#"]);
        } else {
          rej(new TypeError("current handshake node not a node"));
        }
      });
    });

    await Actions.sendHandshakeRequest(
      handshakeAddr,
      recipientPub,
      gun,
      requestorUser,
      Sea
    );

    /** @type {string} */
    const requestID = await new Promise(res => {
      recipientUser
        .get(Key.CURRENT_HANDSHAKE_NODE)
        .once()
        .map()
        .once((_, reqID) => {
          if (reqID !== "unused") {
            res(reqID);
          }
        });
    });

    await Actions.acceptRequest(requestID, gun, recipientUser, Sea);

    const encryptedResponse = await new Promise(res => {
      recipientUser
        .get(Key.CURRENT_HANDSHAKE_NODE)
        .get(requestID)
        .once(r => {
          // @ts-ignore
          res(r.response);
        });
    });

    const recipientFeedID = await Sea.decrypt(encryptedResponse, sharedSecret);

    const recipientFeedExists = await new Promise(res => {
      recipientUser
        .get(Key.OUTGOINGS)
        .get(recipientFeedID)
        .once(n => {
          res(typeof n !== "undefined");
        });
    });

    expect(recipientFeedExists).toBe(true);
    done();
  });

  it("creates a recipient-to-outgoing record", async done => {
    const gun = createMockGun();

    const requestorUser = gun.user();
    const recipientUser = gun.user();
    await new Promise(res => requestorUser.auth("a", "a", res));
    await new Promise(res => recipientUser.auth("b", "b", res));

    const { pub: requestorPub } = requestorUser._.sea;
    const { epub: recipientEpub, pub: recipientPub } = recipientUser._.sea;

    const sharedSecret = await Sea.secret(recipientEpub, requestorUser._.sea);
    const recipientSecret = await Sea.secret(
      recipientEpub,
      recipientUser._.sea
    );

    await Jobs.onAcceptedRequests(
      Events.onSentRequests,
      gun,
      requestorUser,
      Sea
    );

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    /** @type {string} */
    const handshakeAddr = await new Promise((res, rej) => {
      recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).once(n => {
        if (typeof n === "object" && n !== null) {
          res(n._["#"]);
        } else {
          rej(new TypeError("current handshake node not a node"));
        }
      });
    });

    await Actions.sendHandshakeRequest(
      handshakeAddr,
      recipientPub,
      gun,
      requestorUser,
      Sea
    );

    /** @type {string} */
    const requestID = await new Promise(res => {
      recipientUser
        .get(Key.CURRENT_HANDSHAKE_NODE)
        .once()
        .map()
        .once((_, reqID) => {
          if (reqID !== "unused") {
            res(reqID);
          }
        });
    });

    await Actions.acceptRequest(requestID, gun, recipientUser, Sea);

    const encryptedResponse = await new Promise(res => {
      recipientUser
        .get(Key.CURRENT_HANDSHAKE_NODE)
        .get(requestID)
        .once(r => {
          // @ts-ignore
          res(r.response);
        });
    });

    const recipientFeedID = await Sea.decrypt(encryptedResponse, sharedSecret);

    recipientUser
      .get(Key.RECIPIENT_TO_OUTGOING)
      .once()
      .map()
      .once(async (encryptedOutgoingID, encryptedRequestorPub) => {
        if (typeof encryptedOutgoingID !== "string") {
          throw new TypeError("typeof encryptedRequestorPub !== 'string'");
        }

        const hopefullyRequestorPub = await Sea.decrypt(
          encryptedRequestorPub,
          recipientSecret
        );
        const hopefullyOutgoingID = await Sea.decrypt(
          encryptedOutgoingID,
          recipientSecret
        );

        expect(hopefullyRequestorPub).toBe(requestorPub);
        expect(hopefullyOutgoingID).toBe(recipientFeedID);

        done();
      });
  });
});

describe("authenticate()", () => {
  it("throws if user passed in is not an string", () => {
    expect.assertions(1);

    const user = createMockGun();

    // @ts-ignore
    return Actions.authenticate(null, Math.random().toString(), user).catch(
      // @ts-ignore
      e => {
        expect(e).toBeInstanceOf(TypeError);
      }
    );
  });

  it("throws if user passed in is an empty string", () => {
    expect.assertions(1);

    const user = createMockGun({ isAuth: true }).user();

    return Actions.authenticate("", Math.random().toString(), user).catch(e => {
      expect(e).toBeInstanceOf(TypeError);
    });
  });

  it("throws if pass passed in is not an string", () => {
    expect.assertions(1);

    const user = createMockGun({ isAuth: true }).user();

    // @ts-ignore
    return Actions.authenticate(Math.random().toString(), null, user).catch(
      // @ts-ignore
      e => {
        expect(e).toBeInstanceOf(TypeError);
      }
    );
  });

  it("throws if pass passed in is an empty string", () => {
    expect.assertions(1);

    const user = createMockGun({ isAuth: true }).user();

    return Actions.authenticate(Math.random().toString(), "", user).catch(e => {
      expect(e).toBeInstanceOf(TypeError);
    });
  });

  it("throws an ALREADY_AUTH error if the user node is already authenticated", () => {
    expect.assertions(1);

    const user = createMockGun({ isAuth: true }).user();

    return Actions.authenticate(
      Math.random().toString(),
      Math.random().toString(),
      user
    ).catch(e => {
      expect(e.message).toBe(ErrorCode.ALREADY_AUTH);
    });
  });

  it("rejects if the authentication fails on gun's part", () => {
    expect.assertions(1);

    const user = createMockGun({ isAuth: true }).user();

    return Actions.authenticate(
      Math.random().toString(),
      Math.random().toString(),
      user
    ).catch(e => {
      const msgExists = typeof e.message === "string";

      expect(msgExists).toBe(true);
    });
  });

  it("rejects if the user node is not authenticated afterwards", () => {
    expect.assertions(1);

    const user = createMockGun({ isAuth: true }).user();

    return Actions.authenticate(
      Math.random().toString(),
      Math.random().toString(),
      {
        ...user,
        auth(_, __, cb) {
          // don't do nothing here
          cb({
            err: undefined,
            sea: {
              pub: Math.random()
                .toString()
                .toString()
                .toString()
            }
          });
        }
      }
    ).catch(e => {
      // TODO
      expect(e).toBeDefined();
    });
  });
});

describe("blacklist()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    expect.assertions(1);

    Actions.blacklist(Math.random().toString(), createMockGun().user()).catch(
      e => {
        expect(e.message).toMatch(ErrorCode.NOT_AUTH);
        done();
      }
    );
  });

  it("it adds the public key to the blacklist", done => {
    expect.assertions(1);

    const user = createMockGun({ isAuth: true }).user();

    const pk = Math.random().toString();

    Actions.blacklist(pk, user).then(() => {
      user
        .get(Key.BLACKLIST)
        .once()
        .map()
        .once(k => {
          expect(k).toMatch(pk);
          done();
        });
    });
  });
});

describe("generateNewHandshake()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    expect.assertions(1);

    Actions.generateNewHandshakeNode(
      createMockGun(),
      createMockGun().user()
    ).catch(e => {
      expect(e.message).toMatch(ErrorCode.NOT_AUTH);
      done();
    });
  });

  it("generates a new handshake node with an special initializetion item in it", done => {
    expect.assertions(1);

    const gun = createMockGun({ isAuth: true });
    const user = gun.user();

    Actions.generateNewHandshakeNode(gun, user).then(() => {
      gun
        .get(Key.HANDSHAKE_NODES)
        .once()
        .map()
        .once(handshakeNode => {
          if (typeof handshakeNode === "object" && handshakeNode !== null) {
            expect(handshakeNode.unused).toEqual(0);
            done();
          }
        });
    });
  });

  it("assigns the newly generated handshake node to the user's currentHandshakeNode edge", done => {
    expect.assertions(1);

    const gun = createMockGun({ isAuth: true });
    const user = gun.user();

    Actions.generateNewHandshakeNode(gun, user).then(() => {
      gun
        .get(Key.HANDSHAKE_NODES)
        .once()
        .map()
        .once(handshakeNode => {
          // @ts-ignore let it blow up if not an object
          const id = handshakeNode["_"]["#"];

          user.get(Key.CURRENT_HANDSHAKE_NODE).once(chn => {
            // @ts-ignore let it blow up if not an object
            const chnID = chn["_"]["#"];

            expect(chnID).toMatch(id);
            done();
          });
        });
    });
  });
});

describe("logout()", () => {
  it("throws a NOT_AUTH error if the user node is not authenticated", done => {
    expect.assertions(1);
    const user = createMockGun().user();

    Actions.logout(user).catch(e => {
      expect(e.message).toMatch(ErrorCode.NOT_AUTH);
      done();
    });
  });

  it("throws a UNSUCCESSFUL_LOGOUT error if the logout fails", done => {
    expect.assertions(1);

    const user = createMockGun({
      isAuth: true
    }).user();

    user.leave = function() {};

    Actions.logout(user).catch(e => {
      expect(e.message).toMatch(ErrorCode.UNSUCCESSFUL_LOGOUT);
      done();
    });
  });
});

describe("register", () => {
  it("throws a TypeError if alias is not an string", done => {
    expect.assertions(1);

    const user = createMockGun().user();

    // @ts-ignore
    Actions.register(null, Math.random().toString(), user).catch(e => {
      expect(e).toBeInstanceOf(TypeError);
      done();
    });
  });

  it("throws an Error if alias is an string of length zero", done => {
    expect.assertions(1);

    const user = createMockGun().user();

    // @ts-ignore
    Actions.register("", Math.random().toString(), user).catch(e => {
      expect(e).toBeInstanceOf(Error);
      done();
    });
  });

  it("throws a TypeError if pass is not an string", done => {
    const user = createMockGun().user();

    // @ts-ignore
    Actions.register(Math.random().toString(), null, user).catch(e => {
      expect(e).toBeInstanceOf(TypeError);
      done();
    });
  });

  it("throws an Error if pass is an string of length zero", done => {
    expect.assertions(1);

    const user = createMockGun().user();

    // @ts-ignore
    Actions.register(Math.random().toString(), "", user).catch(e => {
      expect(e).toBeInstanceOf(Error);
      done();
    });
  });
});

describe("sendMessage()", () => {
  describe("for the sender of a handshake request", () => {
    it("writes a message to the outgoing feed attached to the request", async () => {
      expect.assertions(1);

      const now = Date.now();
      const oldNow = Date.now;
      Date.now = () => {
        return now;
      };

      const {
        gun,
        requestor,
        recipientPub
      } = await TestUtils.createWithSuccessfulHandshake();

      const msgBody = Math.random().toString();

      await Actions.sendMessage(recipientPub, msgBody, gun, requestor, Sea);

      /** @type {Record<string, import("./schema").Outgoing>} */
      const outgoings = await new Promise(res => {
        let calls = 0;

        Events.onOutgoing(
          _outgoings => {
            if (calls === 3) {
              res(_outgoings);
            }

            calls++;
          },
          gun,
          requestor,
          Sea
        );
      });

      const theOutgoings = Object.values(outgoings);

      const [theOutgoing] = theOutgoings;

      const messages = Object.values(theOutgoing.messages);

      Date.now = oldNow;

      expect(messages).toContainEqual({
        body: msgBody,
        timestamp: now
      });

      //
    });
  });

  describe("for the recipient of a handshake address", () => {
    it("writes a message to the outgoing feed created for the request", async done => {
      expect.assertions(1);

      const {
        gun,
        requestor,
        recipientPub
      } = await TestUtils.createWithSuccessfulHandshake();

      const msgBody = Math.random().toString();

      await Actions.sendMessage(recipientPub, msgBody, gun, requestor, Sea);

      /** @type {import("./schema").Chat[]} */
      const chats = await new Promise(res => {
        let calls = 0;

        Events.onChats(
          _chats => {
            if (calls === 5) {
              res(_chats);
            }

            calls++;
          },
          gun,
          requestor,
          Sea
        );
      });

      const [chat] = chats;
      const { messages } = chat;
      const msg = messages[messages.length - 1];

      if (messages.length === 1) {
        throw new Error("messages.length === 1");
      }

      expect(msg.body).toBe(msgBody);
      done();
    });
  });
});

describe("sendHandshakeRequest()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    expect.assertions(1);

    Actions.sendHandshakeRequest(
      Math.random().toString(),
      Math.random().toString(),
      createMockGun(),
      createMockGun().user(),
      Sea
    ).catch(e => {
      expect(e.message).toMatch(ErrorCode.NOT_AUTH);
      done();
    });
  });

  it("places the handshake request on the handshake node of the given address", async done => {
    expect.assertions(1);

    const {
      gun,
      recipient,
      requestor,
      requestorPub,
      recipientPub
    } = await TestUtils.create();

    await Actions.generateNewHandshakeNode(gun, recipient);

    const recipientHandshakeAddress = await TestUtils.extractHandshakeAddress(
      recipient
    );

    await Actions.sendHandshakeRequest(
      recipientHandshakeAddress,
      recipientPub,
      gun,
      requestor,
      Sea
    );

    gun
      .get(Key.HANDSHAKE_NODES)
      .get(recipientHandshakeAddress)
      .once()
      .map()
      .once((data, key) => {
        if (key === "unused") {
          return;
        }
        // @ts-ignore
        const theRequest = /** @type {HandshakeRequest} */ (data);

        expect(theRequest.from).toMatch(requestorPub);

        done();
      });
  });

  it("creates an outgoing feed intended for the recipient", async done => {
    expect.assertions(4);

    const {
      gun,
      recipient,
      requestor,
      recipientPub
    } = await TestUtils.create();

    await Actions.generateNewHandshakeNode(gun, recipient);

    const recipientHandshakeAddress = await TestUtils.extractHandshakeAddress(
      recipient
    );

    await Actions.sendHandshakeRequest(
      recipientHandshakeAddress,
      recipientPub,
      gun,
      requestor,
      Sea
    );

    Events.onOutgoing(
      outgoings => {
        const [entries] = Object.entries(outgoings);
        const [, theOutgoing] = entries;

        if (!Schema.isOutgoing(theOutgoing)) {
          throw new TypeError("Expected an Outgoing");
        }

        expect(theOutgoing.with).toMatch(recipientPub);
        expect(theOutgoing.messages).toBeDefined();

        done();
      },
      gun,
      requestor,
      Sea
    );
  });

  it("creates a recipient to outgoing record", async () => {
    const {
      requestor,
      requestorSecret,
      recipientPub
    } = await TestUtils.createWithHandshakeAttempt();

    /** @type {[ string , string ]} */
    const [encryptedOutgoingID, encryptedRecipientPub] = await new Promise(
      (res, rej) => {
        requestor
          .get(Key.RECIPIENT_TO_OUTGOING)
          .once()
          .map()
          .once((encryptedOid, encryptedRecipientPub) => {
            if (typeof encryptedOid !== "string") {
              rej(new TypeError("typeof oid !== 'string'"));
              return;
            }

            res([encryptedOid, encryptedRecipientPub]);
          });
      }
    );

    const unencryptedRecipientPub = await Sea.decrypt(
      encryptedRecipientPub,
      requestorSecret
    );

    expect(typeof encryptedOutgoingID).toBe("string");
    expect(unencryptedRecipientPub).toBe(recipientPub);
  });
});

describe("setAvatar()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    expect.assertions(1);

    Actions.setAvatar(Math.random().toString(), createMockGun().user()).catch(
      e => {
        expect(e.message).toMatch(ErrorCode.NOT_AUTH);
        done();
      }
    );
  });

  it("throws a TypeError if the value provided is not an string or null", done => {
    expect.assertions(1);

    /** @type {string} */
    // @ts-ignore
    const number = 555;

    Actions.setAvatar(number, createMockGun({ isAuth: true }).user()).catch(
      e => {
        expect(e).toBeInstanceOf(TypeError);
        done();
      }
    );
  });

  it("sets the avatar to the provided string", done => {
    expect.assertions(1);

    const user = createMockGun({ isAuth: true }).user();
    const AVATAR = Math.random().toString();

    Actions.setAvatar(AVATAR, user).then(() => {
      user
        .get(Key.PROFILE)
        .get(Key.AVATAR)
        .once(avatar => {
          expect(avatar).toMatch(AVATAR);
          done();
        });
    });
  });

  it("sets the avatar to the provided null value", done => {
    expect.assertions(1);

    const user = createMockGun({ isAuth: true }).user();
    /** @type {null} */
    const AVATAR = null;

    Actions.setAvatar(AVATAR, user).then(() => {
      user
        .get(Key.PROFILE)
        .get(Key.AVATAR)
        .once(avatar => {
          expect(avatar).toBe(AVATAR);
          done();
        });
    });
  });
});

describe("setDisplayName()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    expect.assertions(1);

    Actions.setDisplayName(
      Math.random().toString(),
      createMockGun().user()
    ).catch(e => {
      expect(e.message).toMatch(ErrorCode.NOT_AUTH);
      done();
    });
  });

  it("throws a TypeError if the value provided is not an string", done => {
    expect.assertions(1);

    /** @type {string} */
    // @ts-ignore
    const _null = null;

    Actions.setDisplayName(_null, createMockGun({ isAuth: true }).user()).catch(
      e => {
        expect(e).toBeInstanceOf(TypeError);
        done();
      }
    );
  });

  it("throws an error if the value provided is an string of length zero", done => {
    expect.assertions(1);

    Actions.setDisplayName("", createMockGun({ isAuth: true }).user()).catch(
      e => {
        expect(e).toBeInstanceOf(Error);
        done();
      }
    );
  });
});
