/**
 * @prettier
 */
import * as Actions from "./actions.js";
import * as ErrorCode from "./errorCode.js";
import * as Events from "./events.js";
import * as Key from "./key.js";
import * as Jobs from "./jobs.js";
import { createMockGun } from "./__mocks__/mock-gun.js";
import { injectSeaMockToGun, __MOCK_USER_SUPER_NODE } from "./testing.js";
/**
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
 * @typedef {import('./schema').HandshakeRequest} HandshakeRequest
 * @typedef {import('./schema').PartialOutgoing} PartialOutgoing
 * @typedef {import('./schema').Message} Message
 * @typedef {import('./SimpleGUN').UserGUNNode} UserGUNNode
 * @typedef {import('./schema').Chat} Chat
 * @typedef {import('./schema').ChatMessage} ChatMessage
 */

describe("onAvatar()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    const fakeGun = createMockGun();

    try {
      Events.onAvatar(() => {}, fakeGun);
    } catch (e) {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
      done();
    }
  });

  it("calls the on() prop on a gun instance holding an string value", done => {
    const initialValue = "jakdljkasd";
    const fakeGun = createMockGun({
      isAuth: true
    });

    const spy = jest.fn(() => {
      done();
    });

    fakeGun
      .get(Key.PROFILE)
      .get(Key.AVATAR)
      .put(initialValue, ack => {
        if (!ack.err) {
          Events.onAvatar(spy, fakeGun);

          expect(spy).toHaveBeenCalledWith(initialValue);
        }
      });
  });

  it("calls the on() prop on a gun instance holding a null value", done => {
    const initialValue = "jakdljkasd";
    const fakeGun = createMockGun({
      isAuth: true
    });

    const spy = jest.fn(() => {
      done();
    });

    fakeGun
      .get(Key.PROFILE)
      .get(Key.AVATAR)
      .put(initialValue, ack => {
        if (!ack.err) {
          Events.onAvatar(spy, fakeGun);

          expect(spy).toHaveBeenCalledWith(initialValue);
        }
      });
  });
});

describe("onBlacklist()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", () => {
    const mockGun = createMockGun();

    try {
      Events.onBlacklist(() => {}, mockGun);
    } catch (e) {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
    }
  });

  it("supplies the listtener with blacklisted public keys when there are", done => {
    const items = [Math.random().toString(), Math.random().toString()];
    const [first, second] = items;

    const mockGun = createMockGun({
      isAuth: true
    });

    const blacklist = mockGun.get(Key.BLACKLIST);

    blacklist.set(first, ack => {
      if (!ack.err) {
        blacklist.set(second);
      }
    });

    let calls = 0;

    /**
     * @param {any} data
     */
    const spy = data => {
      calls++;

      if (calls === 3) {
        expect(data).toEqual(items);
        done();
      }
    };

    Events.onBlacklist(spy, mockGun);
  });
});

describe("onCurrentHandshakeAddress()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    expect.assertions(1);

    const user = createMockGun({ isAuth: false });

    try {
      Events.onCurrentHandshakeAddress(() => {}, user);
    } catch (e) {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
      done();
    }
  });

  it("supplies null when the handshake node isn't assigned.", async done => {
    expect.assertions(1);

    const gun = createMockGun();

    injectSeaMockToGun(gun);

    const user = gun.user();

    await new Promise((res, rej) => {
      user.auth(Math.random().toString(), Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    Events.onCurrentHandshakeAddress(addr => {
      expect(addr).toBe(null);
      done();
    }, user);
  });

  it("supplies an address when the handshake node is assigned.", async done => {
    expect.assertions(1);

    const gun = createMockGun();

    injectSeaMockToGun(gun);

    const user = gun.user();

    await new Promise((res, rej) => {
      user.auth(Math.random().toString(), Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    await Actions.generateNewHandshakeNode(gun, user);

    let called = false;

    Events.onCurrentHandshakeAddress(addr => {
      if (called) {
        expect(typeof addr).toMatch("string");
        done();
      }

      called = true;
    }, user);
  });
});

describe("onCurrentHandshakeNode()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    const fakeGun = createMockGun();

    try {
      Events.onCurrentHandshakeNode(() => {}, fakeGun);
    } catch (e) {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
      done();
    }
  });

  it("supplies null if the gun has this edge set to null", done => {
    expect.assertions(1);

    const fakeGun = createMockGun({
      isAuth: true
    });

    fakeGun.get(Key.CURRENT_HANDSHAKE_NODE).put(null, ack => {
      if (!ack.err) {
        const spy = jest.fn(() => {
          done();
        });

        Events.onCurrentHandshakeNode(spy, fakeGun);

        expect(spy).toHaveBeenCalledWith(null);
      }
    });
  });

  it("supplies an empty object if the handshake node only contains an invalid\
      initialization item", done => {
    const fakeGun = createMockGun({
      isAuth: true
    });

    fakeGun.get(Key.CURRENT_HANDSHAKE_NODE).set(
      {
        unused: 0
      },
      ack => {
        if (!ack.err) {
          const spy = jest.fn(() => {
            done();
          });

          Events.onCurrentHandshakeNode(spy, fakeGun);

          expect(spy).toHaveBeenCalledWith({});
        }
      }
    );
  });

  it("calls the on() prop on a fake gun with valid data", done => {
    expect.assertions(1);

    /** @type {HandshakeRequest} */
    const someHandshakeRequest = {
      from: Math.random().toString(),
      response: Math.random().toString(),
      timestamp: Math.random()
    };

    const fakeGun = createMockGun({
      isAuth: true
    });

    const someHandshakeRequestNode = fakeGun
      .get(Key.CURRENT_HANDSHAKE_NODE)
      .set(someHandshakeRequest, ack => {
        if (ack.err) {
          console.error(ack.err);
        }
      });

    const key = /** @type {string} */ (someHandshakeRequestNode._.get);

    const spy = jest.fn(handshakes => {
      expect(handshakes).toEqual({
        [key]: {
          ...someHandshakeRequest,
          _: {
            "#": key
          }
        }
      });

      done();
    });

    Events.onCurrentHandshakeNode(spy, fakeGun);
  });
});

describe("onDisplayName()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    const fakeGun = createMockGun();

    try {
      Events.onDisplayName(() => {}, fakeGun);
    } catch (e) {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
      done();
    }
  });

  it("calls the on() prop on a gun instance holding an string value", done => {
    const fakeGun = createMockGun({
      isAuth: true
    });

    const initialValue = Math.random().toString();

    fakeGun
      .get(Key.PROFILE)
      .get(Key.DISPLAY_NAME)
      .put(initialValue);

    const spy = jest.fn(() => {
      done();
    });

    Events.onDisplayName(spy, fakeGun);

    expect(spy).toHaveBeenCalledWith(initialValue);
  });

  it("calls the on() prop on a gun instance holding a null value", done => {
    const fakeGun = createMockGun({
      isAuth: true
    });

    fakeGun
      .get(Key.PROFILE)
      .get(Key.DISPLAY_NAME)
      .put(null);

    const spy = jest.fn(() => {
      done();
    });

    Events.onDisplayName(spy, fakeGun);

    expect(spy).toHaveBeenCalledWith(null);
  });
});

describe("onIncomingMessages()", () => {});

describe("onOutgoing()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    const fakeGun = createMockGun();

    try {
      Events.onOutgoing(() => {}, fakeGun);
    } catch (e) {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
      done();
    }
  });

  // TODO: Find out if this test being sync can make it break further down the
  // lane if you tested it with an actual gun node (async)
  it("does NOT supply an empty object if there are no outgoings", () => {
    const fakeGun = createMockGun({
      initialData: [],
      isAuth: true
    });

    const spy = jest.fn();

    Events.onOutgoing(spy, fakeGun);

    expect(spy).toHaveBeenCalledTimes(0);
  });

  it("calls the listener when there's valid data", done => {
    const fakeOnOutgoingMessage = () => {};

    const fakeKey = Math.random().toString();

    const someOutgoings = [
      { with: Math.random().toString() },
      { with: Math.random().toString() }
    ];

    const fakeGun = createMockGun({
      isAuth: true
    });

    const outgoingsNode = fakeGun.get(Key.OUTGOINGS);

    someOutgoings.forEach(io => {
      outgoingsNode.set(io);
    });

    const spy = jest.fn(() => {
      done();
    });

    Events.onOutgoing(spy, fakeGun, fakeOnOutgoingMessage);

    const [call] = spy.mock.calls;
    // @ts-ignore
    const [data] = call;

    expect(
      // @ts-ignore
      Object.values(data).every(og =>
        someOutgoings.some(og2 => og.with === og2.with)
      )
    ).toBe(true);
  });

  it("supplies the listener with messages for an outgoing", () => {
    const gun = createMockGun({
      isAuth: true
    });

    const outgoingsNode = gun.get(Key.OUTGOINGS);

    /** @type {Message} */
    const sampleMsg = {
      body: Math.random().toString(),
      timestamp: Math.random()
    };

    /** @type {PartialOutgoing} */
    const sampleOutgoing = {
      with: Math.random().toString()
    };

    const sampleOutgoingNode = outgoingsNode.set(sampleOutgoing);

    sampleOutgoingNode.get(Key.MESSAGES).set(sampleMsg);

    Events.onOutgoing(outgoingsReceived => {
      const [outgoingReceived] = Object.values(outgoingsReceived);

      const [msgReceived] = Object.values(outgoingReceived.messages);

      expect({
        ...msgReceived,
        _: undefined
      }).toEqual(sampleMsg);
    }, gun);
  });
});

describe("onSentRequests()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    const fakeGun = createMockGun();

    try {
      Events.onSentRequests(() => {}, fakeGun);
    } catch (e) {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
      done();
    }
  });

  // TODO: Find out if this test being sync can make it break further down the
  // lane if you tested it with an actual gun node (async)
  it("does NOT supply an empty object if there are no sent requests", () => {
    const spy = jest.fn();

    Events.onSentRequests(
      spy,
      createMockGun({
        initialData: [],
        isAuth: true
      })
    );

    expect(spy).toHaveBeenCalledTimes(0);
  });

  it("calls the listener when there's valid data", done => {
    /** @type {HandshakeRequest[]} */
    const someSentRequests = [
      {
        from: Math.random().toString(),
        response: Math.random().toString(),
        timestamp: Math.random()
      },
      {
        from: Math.random().toString(),
        response: Math.random().toString(),
        timestamp: Math.random()
      }
    ];

    expect.assertions(/* fibbonaci(someSentRequests.length) */ 3);

    const spy = jest.fn(sentRequests => {
      const items = Object.values(sentRequests);

      items.forEach(item => {
        expect(someSentRequests).toContainEqual({
          ...item,
          _: undefined
        });
      });

      done();
    });

    const gun = createMockGun({
      isAuth: true
    });

    someSentRequests.forEach(r => {
      gun.get(Key.SENT_REQUESTS).set(r);
    });

    Events.onSentRequests(spy, gun);
  });
});

const setUpChats = async () => {
  const requestorPK = "REQUESTOR_PK";
  const recipientPK = "RECIPIENT_PK";
  const gun = createMockGun();

  const requestorNode = gun.get(__MOCK_USER_SUPER_NODE).get(requestorPK);
  const recipientNode = gun.get(__MOCK_USER_SUPER_NODE).get(recipientPK);

  let reqOutID = "";
  let recOutID = "";

  // We hardcode a few things that should happen in both
  // Actions.sendRequest() and Actions.acceptRequest() to avoid going
  // through all of that mess (creating a request, spinning up the
  // onAcceptedRequest job, etc). All of that should be covered in an
  // integration test.

  await new Promise((res, rej) => {
    injectSeaMockToGun(gun, () => requestorPK);

    const requestorUser = gun.user();

    requestorUser.auth(
      Math.random().toString(),
      Math.random().toString(),
      async ack => {
        if (ack.err) {
          rej(new Error(ack.err));
        } else {
          reqOutID = await Actions.__createOutgoingFeed(
            recipientPK,
            requestorUser
          );
          res();
        }
      }
    );
  });

  await new Promise((res, rej) => {
    injectSeaMockToGun(gun, () => recipientPK);

    const recipientUser = gun.user();

    recipientUser.auth(
      Math.random().toString(),
      Math.random().toString(),
      async ack => {
        if (ack.err) {
          rej(new Error(ack.err));
        } else {
          recOutID = await Actions.__createOutgoingFeed(
            requestorPK,
            recipientUser
          );
          res();
        }
      }
    );
  });

  // @ts-ignore
  gun.user = null;

  await new Promise((res, rej) => {
    requestorNode
      .get(Key.USER_TO_INCOMING)
      .get(recipientPK)
      .put(recOutID, ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
  });

  await new Promise((res, rej) => {
    recipientNode
      .get(Key.USER_TO_INCOMING)
      .get(requestorPK)
      .put(reqOutID, ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
  });

  injectSeaMockToGun(gun, () => requestorPK);

  const reqUser = gun.user();

  await new Promise((res, rej) => {
    reqUser.auth(Math.random().toString(), Math.random().toString(), ack => {
      if (ack.err) {
        rej(ack.err);
      } else {
        res();
      }
    });
  });

  return {
    gun,
    recipientNode,
    requestorNode,
    reqUser
  };
};

describe("onChats()", () => {
  it("provides no chats even though there are outgoing chats but those haven't been accepted therefore no user-to-incoming records", done => {
    expect.assertions(1);

    const gun = createMockGun();

    const requestorPK = Math.random().toString();
    const recipientPK = Math.random().toString();

    injectSeaMockToGun(gun, () => requestorPK);

    const ownUser = gun.user();

    ownUser.auth(Math.random().toString(), Math.random().toString(), ack => {
      if (ack.err) {
        return;
      }

      Actions.__createOutgoingFeed(recipientPK, ownUser)
        .then(() => {
          let calls = 0;

          Events.onChats(
            chats => {
              if (calls === 2) {
                expect(chats.length).toBe(0);
                done();
              }

              calls++;
            },
            gun,
            ownUser
          );
        })
        .catch(e => {
          console.warn(e);
        });
    });
  });

  it("provides a chat corresponding to an user-to-incoming record", async done => {
    expect.assertions(1);

    const { gun, reqUser } = await setUpChats();

    let calls = 0;

    Events.onChats(
      chats => {
        calls++;

        // third time is the charm
        if (calls === 4) {
          expect(chats.length).toBe(1);
          done();
        }
      },
      gun,
      reqUser
    );
  });

  it("provides the recipient's avatar if available", async done => {
    expect.assertions(1);

    const { gun, recipientNode, reqUser } = await setUpChats();

    let calls = 0;

    const avatar = Math.random().toString();

    await new Promise((res, rej) => {
      recipientNode
        .get(Key.PROFILE)
        .get(Key.AVATAR)
        .put(avatar, ack => {
          if (ack.err) {
            rej(ack.err);
          } else {
            res();
          }
        });
    });

    Events.onChats(
      chats => {
        calls++;

        if (calls === 5) {
          const [chat] = chats;

          expect(chat.recipientAvatar).toEqual(avatar);
          done();
        }
      },
      gun,
      reqUser
    );
  });

  it("provides the recipient's display name if available", async done => {
    expect.assertions(1);

    const { gun, recipientNode, reqUser } = await setUpChats();

    const displayName = Math.random().toString();

    await new Promise((res, rej) => {
      recipientNode
        .get(Key.PROFILE)
        .get(Key.DISPLAY_NAME)
        .put(displayName, ack => {
          if (ack.err) {
            rej(ack.err);
          } else {
            res();
          }
        });
    });

    let calls = 0;

    Events.onChats(
      chats => {
        calls++;

        if (calls === 5) {
          const [chat] = chats;

          expect(chat.recipientDisplayName).toEqual(displayName);
          done();
        }
      },
      gun,
      reqUser
    );
  });
});

describe("onSimplerSentRequests()", () => {
  it("provides sent requests that have not been accepted", async done => {
    expect.assertions(1);

    const gun = createMockGun();

    // we still need this for gun.user(pk) calls inside functions
    injectSeaMockToGun(gun);

    const requestorPK = Math.round(Math.random() * 1000000000).toString();

    const recipientPK = Math.round(Math.random() * 1000000000).toString();

    // SEA mocker can only mock one user at a time. Get around this.

    // technically wrong cast but typescript doesn't complain
    const requestorUser = /** @type {UserGUNNode} */ (gun
      .get(__MOCK_USER_SUPER_NODE)
      .get(requestorPK));

    // @ts-ignore
    requestorUser.is = {
      pub: requestorPK
    };

    // technically wrong cast but typescript doesn't complain
    const recipientUser = /** @type {UserGUNNode} */ (gun
      .get(__MOCK_USER_SUPER_NODE)
      .get(recipientPK));

    // @ts-ignore
    recipientUser.is = {
      pub: recipientPK
    };

    Jobs.onAcceptedRequests(Events.onSentRequests, requestorUser);

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    /** @type {string} */
    const recipientHandshakeAddress = await new Promise((res, rej) => {
      recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).once(handshakeNode => {
        if (typeof handshakeNode === "object" && handshakeNode !== null) {
          res(handshakeNode._["#"]);
        } else {
          rej("typeof handshakeNode === 'object' || handshakeNode === null");
        }
      });
    });

    await Actions.sendHandshakeRequest(
      recipientHandshakeAddress,
      recipientPK,
      gun,
      requestorUser
    );

    let calls = 0;

    Events.onSimplerSentRequests(
      sentRequests => {
        calls++;

        if (calls === 2) {
          try {
            expect(sentRequests.length).toBe(1);
            done();
          } catch (e) {
            console.error(e);
          }
        }
      },
      gun,
      requestorUser
    );

    //
  });

  it("does not provide sent requests that have been accepted", async done => {
    const gun = createMockGun();

    const requestorPK = Math.random().toString();

    const recipientPK = Math.random().toString();

    injectSeaMockToGun(gun);

    const recipientUser = gun.user();

    await new Promise((res, rej) => {
      recipientUser.auth(recipientPK, Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    /** @type {string} */
    const recipientHandshakeAddress = await new Promise((res, rej) => {
      recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).once(handshakeNode => {
        if (typeof handshakeNode === "object" && handshakeNode !== null) {
          res(handshakeNode._["#"]);
        } else {
          rej("typeof handshakeNode === 'object' || handshakeNode === null");
        }
      });
    });

    const requestorUser = gun.user();

    await new Promise((res, rej) => {
      requestorUser.auth(requestorPK, Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    // SEA mocker can only mock one user at a time. Get around this.

    // technically wrong cast but typescript doesn't complain
    const pseudoRequestorNode = /** @type {UserGUNNode} */ (gun
      .get(__MOCK_USER_SUPER_NODE)
      .get(requestorPK));

    // @ts-ignore
    pseudoRequestorNode.is = {
      pub: requestorPK
    };

    Jobs.onAcceptedRequests(Events.onSentRequests, pseudoRequestorNode);

    await Actions.sendHandshakeRequest(
      recipientHandshakeAddress,
      recipientPK,
      gun,
      requestorUser
    );

    const recipientUserAgain = gun.user();

    await new Promise((res, rej) => {
      recipientUserAgain.auth(recipientPK, Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    const requestID = await new Promise(res => {
      gun
        .get(__MOCK_USER_SUPER_NODE)
        .get(requestorPK)
        .get(Key.REQUEST_TO_USER)
        .once()
        .map()
        .once((_, reqID) => {
          res(reqID);
        });
    });

    await Actions.acceptRequest(requestID, recipientUserAgain);

    const requestorUserAgain = gun.user();

    await new Promise((res, rej) => {
      requestorUserAgain.auth(requestorPK, Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    let called = false;

    Events.onSimplerSentRequests(
      sentRequests => {
        // first call will always receive an empty array
        if (!called) {
          called = true;
          return;
        }

        expect(sentRequests.length).toBe(0);

        done();
      },
      gun,
      requestorUserAgain
    );

    //
  });

  it("only provides the latest request made to a single user", async done => {
    expect.assertions(1);

    const gun = createMockGun();

    // we still need this for gun.user(pk) calls inside functions
    injectSeaMockToGun(gun);

    const requestorPK = Math.round(Math.random() * 1000000000).toString();

    const recipientPK = Math.round(Math.random() * 1000000000).toString();

    // SEA mocker can only mock one user at a time. Get around this.

    // technically wrong cast but typescript doesn't complain
    const requestorUser = /** @type {UserGUNNode} */ (gun
      .get(__MOCK_USER_SUPER_NODE)
      .get(requestorPK));

    // @ts-ignore
    requestorUser.is = {
      pub: requestorPK
    };

    // technically wrong cast but typescript doesn't complain
    const recipientUser = /** @type {UserGUNNode} */ (gun
      .get(__MOCK_USER_SUPER_NODE)
      .get(recipientPK));

    // @ts-ignore
    recipientUser.is = {
      pub: recipientPK
    };

    Jobs.onAcceptedRequests(Events.onSentRequests, requestorUser);

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    /** @type {string} */
    const recipientHandshakeAddress = await new Promise((res, rej) => {
      recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).once(handshakeNode => {
        if (typeof handshakeNode === "object" && handshakeNode !== null) {
          res(handshakeNode._["#"]);
        } else {
          rej("typeof handshakeNode === 'object' || handshakeNode === null");
        }
      });
    });

    await Actions.sendHandshakeRequest(
      recipientHandshakeAddress,
      recipientPK,
      gun,
      requestorUser
    );

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    /** @type {string} */
    const secondRecipientHandshakeAddress = await new Promise((res, rej) => {
      recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).once(handshakeNode => {
        if (typeof handshakeNode === "object" && handshakeNode !== null) {
          res(handshakeNode._["#"]);
        } else {
          rej("typeof handshakeNode === 'object' || handshakeNode === null");
        }
      });
    });

    // ensure the second request doesnt have the same timestamp as the first one
    await new Promise(res => {
      setTimeout(res, 200);
    });

    await Actions.sendHandshakeRequest(
      secondRecipientHandshakeAddress,
      recipientPK,
      gun,
      requestorUser
    );

    let calls = 0;

    Events.onSimplerSentRequests(
      sentRequests => {
        calls++;

        if (calls === 4) {
          try {
            expect(sentRequests.length).toBe(1);
          } catch (e) {
            console.log(e);
          }

          done();
        }
      },
      gun,
      requestorUser
    );

    //
  });

  it("indicates when the recipient has changed the handshake address in which the request was placed", async done => {
    expect.assertions(1);

    const gun = createMockGun();

    // we still need this for gun.user(pk) calls inside functions
    injectSeaMockToGun(gun);

    const requestorPK = Math.round(Math.random() * 1000000000).toString();

    const recipientPK = Math.round(Math.random() * 1000000000).toString();

    // SEA mocker can only mock one user at a time. Get around this.

    // technically wrong cast but typescript doesn't complain
    const requestorUser = /** @type {UserGUNNode} */ (gun
      .get(__MOCK_USER_SUPER_NODE)
      .get(requestorPK));

    // @ts-ignore
    requestorUser.is = {
      pub: requestorPK
    };

    // technically wrong cast but typescript doesn't complain
    const recipientUser = /** @type {UserGUNNode} */ (gun
      .get(__MOCK_USER_SUPER_NODE)
      .get(recipientPK));

    // @ts-ignore
    recipientUser.is = {
      pub: recipientPK
    };

    Jobs.onAcceptedRequests(Events.onSentRequests, requestorUser);

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    /** @type {string} */
    const recipientHandshakeAddress = await new Promise((res, rej) => {
      recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).once(handshakeNode => {
        if (typeof handshakeNode === "object" && handshakeNode !== null) {
          res(handshakeNode._["#"]);
        } else {
          rej("typeof handshakeNode === 'object' || handshakeNode === null");
        }
      });
    });

    await Actions.sendHandshakeRequest(
      recipientHandshakeAddress,
      recipientPK,
      gun,
      requestorUser
    );

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    let calls = 0;

    Events.onSimplerSentRequests(
      sentRequests => {
        calls++;

        if (calls === 3) {
          const [request] = sentRequests;

          try {
            expect(request.recipientChangedRequestAddress).toBe(true);
            done();
          } catch (e) {
            console.error(e);
          }
        }
      },
      gun,
      requestorUser
    );

    //
  });

  it("provides the recipient's avatar", async done => {
    expect.assertions(1);

    const gun = createMockGun();

    // we still need this for gun.user(pk) calls inside functions
    injectSeaMockToGun(gun);

    const requestorPK = Math.round(Math.random() * 1000000000).toString();

    const recipientPK = Math.round(Math.random() * 1000000000).toString();

    const recipientAvatar = Math.random().toString();

    // SEA mocker can only mock one user at a time. Get around this.

    // technically wrong cast but typescript doesn't complain
    const requestorUser = /** @type {UserGUNNode} */ (gun
      .get(__MOCK_USER_SUPER_NODE)
      .get(requestorPK));

    // @ts-ignore
    requestorUser.is = {
      pub: requestorPK
    };

    // technically wrong cast but typescript doesn't complain
    const recipientUser = /** @type {UserGUNNode} */ (gun
      .get(__MOCK_USER_SUPER_NODE)
      .get(recipientPK));

    // @ts-ignore
    recipientUser.is = {
      pub: recipientPK
    };

    await new Promise(res => {
      recipientUser
        .get(Key.PROFILE)
        .get(Key.AVATAR)
        .put(recipientAvatar, ack => {
          if (!ack.err) {
            res();
          }
        });
    });

    Jobs.onAcceptedRequests(Events.onSentRequests, requestorUser);

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    /** @type {string} */
    const recipientHandshakeAddress = await new Promise((res, rej) => {
      recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).once(handshakeNode => {
        if (typeof handshakeNode === "object" && handshakeNode !== null) {
          res(handshakeNode._["#"]);
        } else {
          rej("typeof handshakeNode === 'object' || handshakeNode === null");
        }
      });
    });

    await Actions.sendHandshakeRequest(
      recipientHandshakeAddress,
      recipientPK,
      gun,
      requestorUser
    );

    let calls = 0;

    Events.onSimplerSentRequests(
      sentRequests => {
        calls++;

        if (calls === 3) {
          const [request] = sentRequests;

          try {
            expect(request.recipientAvatar).toMatch(recipientAvatar);
            done();
          } catch (e) {
            console.error(e);
          }
        }
      },
      gun,
      requestorUser
    );

    //
  });

  it("provides the recipient's display name", async done => {
    expect.assertions(1);

    const gun = createMockGun();

    // we still need this for gun.user(pk) calls inside functions
    injectSeaMockToGun(gun);

    const requestorPK = Math.round(Math.random() * 1000000000).toString();

    const recipientPK = Math.round(Math.random() * 1000000000).toString();

    const recipientDisplayName = Math.random().toString();

    // SEA mocker can only mock one user at a time. Get around this.

    // technically wrong cast but typescript doesn't complain
    const requestorUser = /** @type {UserGUNNode} */ (gun
      .get(__MOCK_USER_SUPER_NODE)
      .get(requestorPK));

    // @ts-ignore
    requestorUser.is = {
      pub: requestorPK
    };

    // technically wrong cast but typescript doesn't complain
    const recipientUser = /** @type {UserGUNNode} */ (gun
      .get(__MOCK_USER_SUPER_NODE)
      .get(recipientPK));

    // @ts-ignore
    recipientUser.is = {
      pub: recipientPK
    };

    await new Promise(res => {
      recipientUser
        .get(Key.PROFILE)
        .get(Key.DISPLAY_NAME)
        .put(recipientDisplayName, ack => {
          if (!ack.err) {
            res();
          }
        });
    });

    Jobs.onAcceptedRequests(Events.onSentRequests, requestorUser);

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    /** @type {string} */
    const recipientHandshakeAddress = await new Promise((res, rej) => {
      recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).once(handshakeNode => {
        if (typeof handshakeNode === "object" && handshakeNode !== null) {
          res(handshakeNode._["#"]);
        } else {
          rej("typeof handshakeNode === 'object' || handshakeNode === null");
        }
      });
    });

    await Actions.sendHandshakeRequest(
      recipientHandshakeAddress,
      recipientPK,
      gun,
      requestorUser
    );

    let calls = 0;

    Events.onSimplerSentRequests(
      sentRequests => {
        calls++;

        if (calls === 3) {
          const [request] = sentRequests;

          try {
            expect(request.recipientDisplayName).toMatch(recipientDisplayName);
            done();
          } catch (e) {
            console.error(e);
          }
        }
      },
      gun,
      requestorUser
    );

    //
  });
});

describe("onSimplerReceivedRequests()", () => {
  it("throws a NOT_AUTH error if the user node provided is not authenticated", () => {
    const gun = createMockGun();

    expect(() => {
      Events.onSimplerReceivedRequests(() => {}, gun, gun.user());
    }).toThrow();
  });

  it("provides received requests that have not been accepted", async done => {
    expect.assertions(4);

    const gun = createMockGun();

    injectSeaMockToGun(gun);

    const user = gun.user();

    const recipientPK = Math.random().toString();

    const requestorPK = Math.random().toString();
    const response = Math.random().toString();
    const timestamp = Date.now();

    await new Promise((res, rej) => {
      user.auth(recipientPK, Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    await Actions.generateNewHandshakeNode(gun, user);

    /** @type {HandshakeRequest} */
    const req = {
      from: requestorPK,
      response,
      timestamp
    };

    /** @type {GUNNode} */
    const reqNode = await new Promise((res, rej) => {
      const _reqNode = user.get(Key.CURRENT_HANDSHAKE_NODE).set(req, ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res(_reqNode);
        }
      });
    });

    const reqID = /** @type {string} */ (reqNode._.get);

    let calls = 0;

    Events.onSimplerReceivedRequests(
      receivedRequests => {
        if (calls === 1) {
          const [receivedReq] = receivedRequests;

          expect(receivedReq.id).toMatch(reqID);
          expect(receivedReq.requestorPK).toMatch(requestorPK);
          expect(receivedReq.response).toMatch(response);
          expect(receivedReq.timestamp).toBe(timestamp);

          done();
        }
        calls++;
      },
      gun,
      user
    );

    //
  });

  it("only provides the latest request if theres 2 requests from the same user", async done => {
    expect.assertions(2);

    const gun = createMockGun();

    injectSeaMockToGun(gun);

    const recipientUser = gun.user();

    const recipientPK = Math.random().toString();

    const requestorPK = Math.random().toString();

    await new Promise((res, rej) => {
      recipientUser.auth(recipientPK, Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    /** @type {HandshakeRequest} */
    const firstReq = {
      from: requestorPK,
      response: Math.random().toString(),
      timestamp: Date.now()
    };

    // ensure two requests have different timestamps
    await new Promise(res => setTimeout(res, 200));

    /** @type {HandshakeRequest} */
    const secondReq = {
      from: requestorPK,
      response: Math.random().toString(),
      timestamp: Date.now()
    };

    await new Promise((res, rej) => {
      recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).set(firstReq, ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    /** @type {GUNNode} */
    const secondReqNode = await new Promise((res, rej) => {
      const _reqNode = recipientUser
        .get(Key.CURRENT_HANDSHAKE_NODE)
        .set(secondReq, ack => {
          if (ack.err) {
            rej(ack.err);
          } else {
            res(_reqNode);
          }
        });
    });

    const reqID = /** @type {string} */ (secondReqNode._.get);

    let calls = 0;

    Events.onSimplerReceivedRequests(
      receivedRequests => {
        if (calls === 2) {
          expect(receivedRequests.length).toBe(1);

          const [req] = receivedRequests;

          expect(req.id).toMatch(reqID);

          done();
        }

        calls++;
      },
      gun,
      recipientUser
    );

    //
  });

  it("provides no requests that have been accepted/for which there are incoming feeds", async () => {
    expect.assertions(2);

    const gun = createMockGun();

    injectSeaMockToGun(gun);

    const recipientUser = gun.user();
    const recipientPK = Math.random().toString();

    await new Promise((res, rej) => {
      recipientUser.auth(recipientPK, Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    const requestorUser = gun.user();
    const requestorPK = Math.random().toString();

    await new Promise((res, rej) => {
      requestorUser.auth(requestorPK, Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    const handshakeAddress = await new Promise((res, rej) => {
      recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).once(node => {
        if (typeof node === "object" && node !== null) {
          res(node._["#"]);
        } else {
          rej("Current Handshake Node not an object.");
        }
      });
    });

    await Actions.sendHandshakeRequest(
      handshakeAddress,
      recipientPK,
      gun,
      requestorUser
    );
    const reqID = await new Promise((res, rej) => {
      let calls = 0;

      Events.onSimplerSentRequests(
        sentRequests => {
          if (calls === 1) {
            if (sentRequests.length > 0) {
              res(sentRequests[0].id);
            } else {
              rej("no sent requests found");
            }
          }

          calls++;
        },
        gun,
        requestorUser
      );
    });

    await new Promise(res => {
      let calls = 0;

      Events.onSimplerReceivedRequests(
        receivedRequests => {
          if (calls === 1) {
            expect(receivedRequests.length).toBe(1);
            res();
          }

          calls++;
        },
        gun,
        recipientUser
      );
    });

    await Actions.acceptRequest(reqID, recipientUser);

    return new Promise(res => {
      let calls = 0;

      Events.onSimplerReceivedRequests(
        receivedRequests => {
          if (calls === 1) {
            expect(receivedRequests.length).toBe(0);
            res();
          }

          calls++;
        },
        gun,
        recipientUser
      );
    });

    //
  });

  it("provides the requestor's avatar if it exists", async () => {
    expect.assertions(1);

    const gun = createMockGun();

    injectSeaMockToGun(gun);

    const recipientUser = gun.user();
    const recipientPK = Math.random().toString();

    await new Promise((res, rej) => {
      recipientUser.auth(recipientPK, Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    const requestorUser = gun.user();
    const requestorPK = Math.random().toString();
    const requestorAvatar = Math.random().toString();

    await new Promise((res, rej) => {
      requestorUser.auth(requestorPK, Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    await Actions.setAvatar(requestorAvatar, requestorUser);

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    const handshakeAddress = await new Promise((res, rej) => {
      recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).once(node => {
        if (typeof node === "object" && node !== null) {
          res(node._["#"]);
        } else {
          rej("Current Handshake Node not an object.");
        }
      });
    });

    await Actions.sendHandshakeRequest(
      handshakeAddress,
      recipientPK,
      gun,
      requestorUser
    );

    return new Promise(res => {
      let calls = 0;

      Events.onSimplerReceivedRequests(
        receivedRequests => {
          if (calls === 1) {
            const [req] = receivedRequests;

            expect(req.requestorAvatar).toMatch(requestorAvatar);

            res();
          }

          calls++;
        },
        gun,
        recipientUser
      );
    });

    //
  });

  it("provides the requestor's display name if it exists", async () => {
    expect.assertions(1);

    const gun = createMockGun();

    injectSeaMockToGun(gun);

    const recipientUser = gun.user();
    const recipientPK = Math.random().toString();

    await new Promise((res, rej) => {
      recipientUser.auth(recipientPK, Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    const requestorUser = gun.user();
    const requestorPK = Math.random().toString();
    const requestorDisplayName = Math.random().toString();

    await new Promise((res, rej) => {
      requestorUser.auth(requestorPK, Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    await Actions.setDisplayName(requestorDisplayName, requestorUser);

    await Actions.generateNewHandshakeNode(gun, recipientUser);

    const handshakeAddress = await new Promise((res, rej) => {
      recipientUser.get(Key.CURRENT_HANDSHAKE_NODE).once(node => {
        if (typeof node === "object" && node !== null) {
          res(node._["#"]);
        } else {
          rej("Current Handshake Node not an object.");
        }
      });
    });

    await Actions.sendHandshakeRequest(
      handshakeAddress,
      recipientPK,
      gun,
      requestorUser
    );

    return new Promise(res => {
      let calls = 0;

      Events.onSimplerReceivedRequests(
        receivedRequests => {
          if (calls === 1) {
            const [req] = receivedRequests;

            expect(req.requestorDisplayName).toMatch(requestorDisplayName);

            res();
          }
          calls++;
        },
        gun,
        recipientUser
      );
    });

    //
  });
});
