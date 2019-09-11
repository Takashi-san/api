/**
 * @prettier
 */

import * as Actions from "./actions";
import * as ErrorCode from "./errorCode";
import * as Events from "./events";
import * as Jobs from "./jobs";
import * as Key from "./key";
import * as Testing from "./testing";
import { createMockGun } from "./__mocks__/mock-gun";

/**
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
 * @typedef {import('./schema').HandshakeRequest} HandshakeRequest
 * @typedef {import('./schema').PartialOutgoing} PartialOutgoing
 * @typedef {import('./schema').Outgoing} Outgoing
 * @typedef {import('./schema').Message} Message
 * @typedef {import('./SimpleGUN').UserGUNNode} UserGUNNode
 */

describe("__encryptAndPutResponseToRequest", () => {
  const NOT_AN_STRING = Math.random();
  const mockGun = createMockGun({
    isAuth: true
  });

  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    expect.assertions(1);

    Actions.__encryptAndPutResponseToRequest(
      Math.random().toString(),
      Math.random().toString(),
      Math.random().toString(),
      createMockGun()
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
      mockGun
    ).catch((/** @type {any} */ e) => {
      done();
      expect(e).toBeInstanceOf(TypeError);
    });
  });

  it("throws a TypeError if the requestorPubKey argument isn't an string", done => {
    expect.assertions(1);

    Actions.__encryptAndPutResponseToRequest(
      Math.random().toString(),
      // @ts-ignore
      NOT_AN_STRING,
      Math.random().toString(),
      mockGun
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
      mockGun
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
      mockGun
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
      mockGun
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
      mockGun
    ).catch(e => {
      done();
      expect(e).toBeInstanceOf(TypeError);
    });
  });

  it("changes and encrypts the response of an existing request", done => {
    expect.assertions(1);

    const gun = createMockGun({
      isAuth: true
    });

    /** @type {HandshakeRequest} */
    const theRequest = {
      from: Math.random().toString(),
      response: Math.random().toString(),
      timestamp: Math.random()
    };

    /**
     * @type {GUNNode}
     */
    let theRequestNode;

    const requestorPK = Math.random().toString();
    const newResponse = Math.random().toString();

    theRequestNode = gun
      .get(Key.CURRENT_HANDSHAKE_NODE)
      .set(theRequest, ack => {
        if (!ack.err) {
          const requestID = /** @type {string} */ (theRequestNode._.get);

          Actions.__encryptAndPutResponseToRequest(
            requestID,
            requestorPK,
            newResponse,
            gun
          ).then(() => {
            theRequestNode.once(data => {
              // @ts-ignore
              const receivedRequest = /** @type {HandshakeRequest} */ (data);

              const { response: encryptedRes } = receivedRequest;

              const decryptedResponse = encryptedRes.slice("$$_TEST_".length);

              expect(decryptedResponse).toMatch(newResponse);
              done();
            });
          });
        } else {
          console.warn(ack.err);
        }
      });
  });
});

describe("__createOutgoingFeed()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    expect.assertions(1);

    Actions.__createOutgoingFeed(
      Math.random().toString(),
      createMockGun()
    ).catch((/** @type {any} */ e) => {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
      done();
    });
  });

  it("it creates the outgoing feed with the 'with' public key provided", done => {
    expect.assertions(1);

    const mockGun = createMockGun({
      isAuth: true
    });

    const pk = Math.random().toString();

    Actions.__createOutgoingFeed(pk, mockGun).then(outgoingID => {
      mockGun
        .get(Key.OUTGOINGS)
        .get(outgoingID)
        .once(data => {
          // @ts-ignore
          const outgoing = /** @type {PartialOutgoing} */ (data);
          expect(outgoing.with).toBe(pk);
          done();
        });
    });
  });

  it("creates a messages set sub-node with an initial special acceptance message", done => {
    expect.assertions(1);

    const mockGun = createMockGun({
      isAuth: true
    });

    const pk = Math.random().toString();

    Actions.__createOutgoingFeed(pk, mockGun).then(outgoingID => {
      mockGun
        .get(Key.OUTGOINGS)
        .get(outgoingID)
        .get(Key.MESSAGES)
        .once()
        .map()
        .once(data => {
          // @ts-ignore
          const msg = /** @type {Message} */ (data);
          expect(msg.body).toBe(Actions.INITIAL_MSG);
          done();
        });
    });
  });

  it("returns a promise that resolves to the id of the newly-created outgoing feed", done => {
    expect.assertions(2);

    const mockGun = createMockGun({
      isAuth: true
    });

    Actions.__createOutgoingFeed(Math.random().toString(), mockGun)
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

    Actions.acceptRequest(Math.random().toString(), createMockGun()).catch(
      e => {
        expect(e.message).toEqual(ErrorCode.NOT_AUTH);
        done();
      }
    );
  });

  it("throws if the provided request id does not correspond to an existing request", done => {
    expect.assertions(1);

    const gun = createMockGun({
      isAuth: true
    });

    Actions.acceptRequest("TOTALLY_NOT_A_KEY", gun).catch(e => {
      expect(e.message).toBe(ErrorCode.TRIED_TO_ACCEPT_AN_INVALID_REQUEST);
      done();
    });
  });

  it("creates an outgoing feed intended for the requestor, the outgoing feed's id can be obtained from the response field of the request", done => {
    expect.assertions(1);

    const user = createMockGun({
      isAuth: true
    });

    const currentHandshakeNode = user.get(Key.CURRENT_HANDSHAKE_NODE);

    const requestorPK = Math.random().toString();

    /** @type {HandshakeRequest} */
    const someRequest = {
      from: requestorPK,
      response: Math.random().toString(),
      timestamp: Math.random()
    };

    const requestNode = currentHandshakeNode.set(someRequest, ack => {
      if (ack.err) {
        return;
      }

      if (typeof requestNode._.get !== "string") {
        throw new TypeError();
      }

      const requestID = requestNode._.get;

      Actions.acceptRequest(requestID, user).then(() => {
        requestNode.once(requestData => {
          // @ts-ignore
          const receivedReq = /** @type {HandshakeRequest} */ (requestData);
          // TODO; Unencrypt
          const encryptedOutgoingID = receivedReq.response;

          const outgoingID = encryptedOutgoingID.slice("$$_TEST_".length);

          const outgoingExists =
            typeof user.get(Key.OUTGOINGS).get(outgoingID)._.put === "object" &&
            user.get(Key.OUTGOINGS)._.put !== null;

          expect(outgoingExists).toBe(true);
          done();
        });
      });
    });
  });

  it("creates a recipient-to-outgoing record", async done => {
    expect.assertions(1);

    const user = createMockGun({
      isAuth: true
    });

    const currentHandshakeNode = user.get(Key.CURRENT_HANDSHAKE_NODE);

    const requestorPK = Math.random().toString();

    /** @type {HandshakeRequest} */
    const someRequest = {
      from: requestorPK,
      response: Math.random().toString(),
      timestamp: Date.now()
    };

    /** @type {GUNNode} */
    const requestNode = await new Promise((res, rej) => {
      const _reqNode = currentHandshakeNode.set(someRequest, ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res(_reqNode);
        }
      });
    });

    const requestID = /** @type {string} */ (requestNode._.get);

    await Actions.acceptRequest(requestID, user);

    /** @type {string} */
    const outgoingID = await new Promise(res => {
      requestNode.once(requestData => {
        // @ts-ignore
        const encryptedOutgoingID = requestData.response;

        /** @type {string} */
        const outgoingID = encryptedOutgoingID.slice("$$_TEST_".length);

        res(outgoingID);
      });
    });

    user
      .get(Key.RECIPIENT_TO_OUTGOING)
      .get(requestorPK)
      .once(oid => {
        expect(oid).toMatch(outgoingID);
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

    const user = createMockGun();

    return Actions.authenticate("", Math.random().toString(), user).catch(e => {
      expect(e).toBeInstanceOf(TypeError);
    });
  });

  it("throws if pass passed in is not an string", () => {
    expect.assertions(1);

    const user = createMockGun();

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

    const user = createMockGun();

    return Actions.authenticate(Math.random().toString(), "", user).catch(e => {
      expect(e).toBeInstanceOf(TypeError);
    });
  });

  it("throws an ALREADY_AUTH error if the user node is already authenticated", () => {
    expect.assertions(1);

    const user = createMockGun({
      isAuth: true
    });

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

    const user = createMockGun({
      failUserAuth: true
    });

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

    const user = createMockGun();

    return Actions.authenticate(
      Math.random().toString(),
      Math.random().toString(),
      {
        ...user,
        auth(_, __, cb) {
          // don't do nothing here
          cb({ err: undefined });
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

    Actions.blacklist(Math.random().toString(), createMockGun()).catch(e => {
      expect(e.message).toMatch(ErrorCode.NOT_AUTH);
      done();
    });
  });

  it("it adds the public key to the blacklist", done => {
    expect.assertions(1);

    const user = createMockGun({ isAuth: true });

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

    Actions.generateNewHandshakeNode(createMockGun(), createMockGun()).catch(
      e => {
        expect(e.message).toMatch(ErrorCode.NOT_AUTH);
        done();
      }
    );
  });

  it("generates a new handshake node with an special initializetion item in it", done => {
    expect.assertions(1);

    const gun = createMockGun();

    Actions.generateNewHandshakeNode(gun, createMockGun({ isAuth: true })).then(
      () => {
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
      }
    );
  });

  it("assigns the newly generated handshake node to the user's currentHandshakeNode edge", done => {
    expect.assertions(1);

    const gun = createMockGun();
    const user = createMockGun({ isAuth: true });

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
    const user = createMockGun();

    Actions.logout(user).catch(e => {
      expect(e.message).toMatch(ErrorCode.NOT_AUTH);
      done();
    });
  });

  it("throws a UNSUCCESSFUL_LOGOUT error if the logout fails", done => {
    expect.assertions(1);

    const user = createMockGun({
      isAuth: true
    });

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

    const user = createMockGun();

    // @ts-ignore
    Actions.register(null, Math.random().toString(), user).catch(e => {
      expect(e).toBeInstanceOf(TypeError);
      done();
    });
  });

  it("throws an Error if alias is an string of length zero", done => {
    expect.assertions(1);

    const user = createMockGun();

    // @ts-ignore
    Actions.register("", Math.random().toString(), user).catch(e => {
      expect(e).toBeInstanceOf(Error);
      done();
    });
  });

  it("throws a TypeError if pass is not an string", done => {
    const user = createMockGun();

    // @ts-ignore
    Actions.register(Math.random().toString(), null, user).catch(e => {
      expect(e).toBeInstanceOf(TypeError);
      done();
    });
  });

  it("throws an Error if pass is an string of length zero", done => {
    expect.assertions(1);

    const user = createMockGun();

    // @ts-ignore
    Actions.register(Math.random().toString(), "", user).catch(e => {
      expect(e).toBeInstanceOf(Error);
      done();
    });
  });
});

describe("sendMessage()", () => {
  describe("for the sender of a handshake request", () => {
    it("writes a message to the outgoing feed attached to the request", async done => {
      expect.assertions(2);

      let calls = 0;

      const msgBody = Math.random().toString();

      const gun = createMockGun();

      Testing.injectSeaMockToGun(gun);

      const user = gun.user();

      await new Promise(res => {
        user.auth(Math.random().toString(), Math.random().toString(), ack => {
          if (ack.err) {
            throw new Error(ack.err);
          } else {
            res(ack.err);
          }
        });
      });

      const handshakeNode = gun.get(Key.HANDSHAKE_NODES).set({ unused: 0 });
      const handshakeAddress = /** @type {string} */ (handshakeNode._.get);
      const recipientEpub = Math.random().toString();

      await Actions.sendHandshakeRequest(
        handshakeAddress,
        recipientEpub,
        gun,
        user
      );

      /** @type {string} */
      const outgoingID = await new Promise(res => {
        user
          .get(Key.OUTGOINGS)
          .once()
          .map()
          .once(outgoing => {
            if (typeof outgoing === "object" && outgoing !== null) {
              res(outgoing._["#"]);
            } else {
              throw new Error();
            }
          });
      });

      await Actions.sendMessage(recipientEpub, msgBody, user);

      user
        .get(Key.OUTGOINGS)
        .get(outgoingID)
        .get(Key.MESSAGES)
        .once()
        .map()
        .once(msg => {
          if (typeof msg === "object" && msg !== null) {
            calls++;

            const matchesInitialOrMsgBody =
              msg.body === Actions.INITIAL_MSG || msg.body === msgBody;

            expect(matchesInitialOrMsgBody).toBe(true);

            if (calls === 2) {
              done();
            }
          }
        });
    });
  });

  describe("for the recipient of a handshake address", () => {
    it("writes a message to the outgoing feed created for the request", async done => {
      expect.assertions(2);

      const msgBody = Math.random().toString();

      let calls = 0;

      const recipientPK = "recipientPK";
      const requestorPK = "requestorPK";

      const gun = createMockGun();

      Testing.injectSeaMockToGun(gun);

      const recipientUser = gun.user();

      Testing.injectSeaMockToGun(gun);

      const requestorUser = gun.user();

      await new Promise((res, rej) => {
        recipientUser.auth(recipientPK, Math.random().toString(), ack => {
          if (ack.err) {
            rej(ack.err);
          } else {
            res();
          }
        });
      });

      await new Promise((res, rej) => {
        requestorUser.auth(requestorPK, Math.random().toString(), ack => {
          if (ack.err) {
            rej(ack.err);
          } else {
            res();
          }
        });
      });

      Jobs.onAcceptedRequests(Events.onSentRequests, requestorUser);

      await Actions.generateNewHandshakeNode(gun, recipientUser);

      const handshakeAddr = await new Promise((res, rej) => {
        recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).once(n => {
          if (typeof n === "object" && n !== null) {
            res(n._["#"]);
          } else {
            rej("wrong node type");
          }
        });
      });

      await Actions.sendHandshakeRequest(
        handshakeAddr,
        recipientPK,
        gun,
        requestorUser
      );

      /** @type {string} */
      const reqID = await new Promise((res, rej) => {
        Events.onSentRequests(sentRequests => {
          const [maybePair] = Object.entries(sentRequests);

          if (maybePair) {
            const [reqID] = maybePair;

            if (typeof reqID) {
              res(reqID);
            } else {
              rej();
            }
          }
        }, requestorUser);
      });

      await Actions.acceptRequest(reqID, recipientUser);

      await Actions.sendMessage(requestorPK, msgBody, recipientUser);

      const outgoingID = await new Promise(res => {
        recipientUser
          .get(Key.OUTGOINGS)
          .once()
          .map()
          .once(outgoing => {
            if (typeof outgoing === "object" && outgoing !== null) {
              const _outgoingID = outgoing._["#"];

              res(_outgoingID);
            } else {
              throw new Error();
            }
          });
      });

      recipientUser
        .get(Key.OUTGOINGS)
        .get(outgoingID)
        .get(Key.MESSAGES)
        .once()
        .map()
        .once(msg => {
          calls++;

          const matchesInitialOrMsgBody =
            // @ts-ignore
            msg.body === Actions.INITIAL_MSG || msg.body === msgBody;

          expect(matchesInitialOrMsgBody).toBe(true);
          if (calls === 2) {
            done();
          }
        });
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
      createMockGun()
    ).catch(e => {
      expect(e.message).toMatch(ErrorCode.NOT_AUTH);
      done();
    });
  });

  it("places the handshake request on the handshake node of the given address", done => {
    expect.assertions(1);

    const gun = createMockGun();
    const user = createMockGun({ isAuth: true });
    const requestorEpub = user.is ? user.is.pub : ""; // empty string will throw

    const handshakeNode = gun.get(Key.HANDSHAKE_NODES).set({ unused: 0 });
    const handshakeNodeID = /** @type {string} */ (handshakeNode._.get);
    const recipientEpub = Math.random().toString();

    Actions.sendHandshakeRequest(handshakeNodeID, recipientEpub, gun, user)
      .then(() => {
        gun
          .get(Key.HANDSHAKE_NODES)
          .get(handshakeNodeID)
          .once()
          .map()
          .once((data, key) => {
            if (key === "unused") {
              return;
            }
            // @ts-ignore
            const theRequest = /** @type {HandshakeRequest} */ (data);

            expect(theRequest.from).toMatch(requestorEpub);

            done();
          });
      })
      .catch(e => console.error(e));
  });

  it("creates an outgoing feed intended for the recipient", done => {
    expect.assertions(2);

    const gun = createMockGun();
    const user = createMockGun({ isAuth: true });

    const handshakeNode = gun.get(Key.HANDSHAKE_NODES).set({ unused: 0 });
    const handshakeNodeID = /** @type {string} */ (handshakeNode._.get);
    const recipientEpub = Math.random().toString();

    Actions.sendHandshakeRequest(handshakeNodeID, recipientEpub, gun, user)
      .then(() => {
        user
          .get(Key.OUTGOINGS)
          .once()
          .map()
          .once(data => {
            // @ts-ignore force cast
            const theOutgoing = /** @type {Outgoing} */ (data);

            expect(theOutgoing.with).toMatch(recipientEpub);
            expect(theOutgoing.messages).toBeDefined();

            done();
          });
      })
      .catch(e => console.error(e));
  });

  it("creates a recipient to outgoing record", done => {
    expect.assertions(2);

    const gun = createMockGun();
    const user = createMockGun({ isAuth: true });

    const handshakeNode = gun.get(Key.HANDSHAKE_NODES).set({ unused: 0 });
    const handshakeNodeID = /** @type {string} */ (handshakeNode._.get);
    const recipientEpub = Math.random().toString();

    Actions.sendHandshakeRequest(handshakeNodeID, recipientEpub, gun, user)
      .then(() => {
        user
          .get(Key.RECIPIENT_TO_OUTGOING)
          .once()
          .map()
          .once((oid, recPK) => {
            expect(typeof oid).toMatch("string");
            expect(recPK).toMatch(recipientEpub);

            done();
          });
      })
      .catch(e => console.error(e));
  });
});

describe("setAvatar()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    expect.assertions(1);

    Actions.setAvatar(Math.random().toString(), createMockGun()).catch(e => {
      expect(e.message).toMatch(ErrorCode.NOT_AUTH);
      done();
    });
  });

  it("throws a TypeError if the value provided is not an string or null", done => {
    expect.assertions(1);

    // @ts-ignore
    Actions.setAvatar(666, createMockGun({ isAuth: true })).catch(e => {
      expect(e).toBeInstanceOf(TypeError);
      done();
    });
  });

  it("sets the avatar to the provided string", done => {
    expect.assertions(1);

    const user = createMockGun({ isAuth: true });
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

    const user = createMockGun({ isAuth: true });
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

    Actions.setDisplayName(Math.random().toString(), createMockGun()).catch(
      e => {
        expect(e.message).toMatch(ErrorCode.NOT_AUTH);
        done();
      }
    );
  });

  it("throws a TypeError if the value provided is not an string", done => {
    expect.assertions(1);

    // @ts-ignore
    Actions.setDisplayName(null, createMockGun({ isAuth: true })).catch(e => {
      expect(e).toBeInstanceOf(TypeError);
      done();
    });
  });

  it("throws an error if the value provided is an string of length zero", done => {
    expect.assertions(1);

    // @ts-ignore
    Actions.setDisplayName("", createMockGun()).catch(e => {
      expect(e).toBeInstanceOf(Error);
      done();
    });
  });
});
