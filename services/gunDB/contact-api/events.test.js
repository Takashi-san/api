/**
 * @prettier
 */
const Actions = require("./actions");
const ErrorCode = require("./errorCode");
const Events = require("./events");
const Key = require("./key");
import * as TestUtils from "./test-utils";
const { createMockGun } = require("./__mocks__/mock-gun");
// @ts-ignore
require("gun/sea");
/**
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
 * @typedef {import('./schema').HandshakeRequest} HandshakeRequest
 * @typedef {import('./schema').PartialOutgoing} PartialOutgoing
 * @typedef {import('./schema').Message} Message
 * @typedef {import('./SimpleGUN').UserGUNNode} UserGUNNode
 * @typedef {import('./schema').Chat} Chat
 * @typedef {import('./schema').ChatMessage} ChatMessage
 */

/** @type {import('./SimpleGUN').ISEA} */
// @ts-ignore
const Sea = SEA;

describe("onAvatar()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    const fakeGun = createMockGun({});

    try {
      Events.onAvatar(() => {}, fakeGun.user());
    } catch (e) {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
      done();
    }
  });

  it("calls the on() prop on a gun instance holding an string value", done => {
    const initialValue = "jakdljkasd";
    const fakeGun = createMockGun({
      isAuth: true
    }).user();

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
    }).user();

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
    const mockGun = createMockGun().user();

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
    }).user();

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

    const user = createMockGun({ isAuth: false }).user();

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
      Events.onCurrentHandshakeNode(() => {}, fakeGun.user());
    } catch (e) {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
      done();
    }
  });

  it("supplies null if the gun has this edge set to null", done => {
    expect.assertions(1);

    const gun = createMockGun({
      isAuth: true
    });

    const user = gun.user();

    user.get(Key.CURRENT_HANDSHAKE_NODE).put(null, ack => {
      if (!ack.err) {
        const spy = jest.fn(() => {
          done();
        });

        Events.onCurrentHandshakeNode(spy, user);

        expect(spy).toHaveBeenCalledWith(null);
      }
    });
  });

  it("supplies an empty object if the handshake node only contains an invalid\
      initialization item", done => {
    const gun = createMockGun({
      isAuth: true
    });

    const user = gun.user();

    user.get(Key.CURRENT_HANDSHAKE_NODE).set(
      {
        unused: 0
      },
      ack => {
        if (!ack.err) {
          const spy = jest.fn(() => {
            done();
          });

          Events.onCurrentHandshakeNode(spy, user);

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

    const gun = createMockGun({
      isAuth: true
    });

    const user = gun.user();

    const someHandshakeRequestNode = user
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

    Events.onCurrentHandshakeNode(spy, user);
  });
});

describe("onDisplayName()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    const fakeGun = createMockGun();

    try {
      Events.onDisplayName(() => {}, fakeGun.user());
    } catch (e) {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
      done();
    }
  });

  it("calls the on() prop on a gun instance holding an string value", done => {
    const fakeGun = createMockGun({
      isAuth: true
    });

    const user = fakeGun.user();

    const initialValue = Math.random().toString();

    user
      .get(Key.PROFILE)
      .get(Key.DISPLAY_NAME)
      .put(initialValue);

    const spy = jest.fn(() => {
      done();
    });

    Events.onDisplayName(spy, user);

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

    Events.onDisplayName(spy, fakeGun.user());

    expect(spy).toHaveBeenCalledWith(null);
  });
});

describe("onIncomingMessages()", () => {});

describe("onOutgoing()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", async () => {
    const fakeGun = createMockGun();
    const user = createMockGun().user();

    try {
      await Events.onOutgoing(() => {}, fakeGun, user, Sea);
    } catch (e) {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
    }
  });

  // TODO: Find out if this test being sync can make it break further down the
  // lane if you tested it with an actual gun node (async)
  it("does NOT supply an empty object if there are no outgoings", () => {
    const gun = createMockGun();
    const user = createMockGun({
      initialData: [],
      isAuth: true
    }).user();

    const spy = jest.fn();

    Events.onOutgoing(spy, gun, user, Sea);

    expect(spy).toHaveBeenCalledTimes(0);
  });

  it("supplies the listener with messages for an outgoing", async () => {
    const { gun, requestor } = await TestUtils.createWithSuccessfulHandshake();

    /** @type {Record<string, import("./schema").Outgoing>} */
    const outgoings = await new Promise(res => {
      let calls = 0;

      Events.onOutgoing(
        _outgoings => {
          if (calls === 2) {
            res(_outgoings);
          }

          calls++;
        },
        gun,
        requestor,
        Sea
      );
    });

    expect(Object.values(outgoings)).toHaveLength(1);
  });
});

describe("onSentRequests()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", done => {
    const fakeGun = createMockGun();

    try {
      Events.onSentRequests(() => {}, fakeGun.user());
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
      }).user()
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

    const user = createMockGun({
      isAuth: true
    }).user();

    someSentRequests.forEach(r => {
      user.get(Key.SENT_REQUESTS).set(r);
    });

    Events.onSentRequests(spy, user);
  });
});

describe("onChats()", () => {
  it("provides no chats even though there are outgoing chats but those haven't been accepted therefore no user-to-incoming records", done => {
    expect.assertions(1);

    const gun = createMockGun();

    const recipientPK = Math.random().toString();

    const ownUser = gun.user();

    ownUser.auth(Math.random().toString(), Math.random().toString(), ack => {
      if (ack.err) {
        return;
      }

      Actions.__createOutgoingFeed(recipientPK, ownUser, Sea)
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
            ownUser,
            Sea
          );
        })
        .catch(e => {
          console.warn(e);
        });
    });
  });

  it("provides the recipient's avatar if available", async done => {
    expect.assertions(1);

    const {
      gun,
      recipient,
      requestor
    } = await TestUtils.createWithSuccessfulHandshake();

    const newAvatar = Math.random().toString();

    await new Promise(res =>
      recipient
        .get(Key.PROFILE)
        .get(Key.AVATAR)
        .put(newAvatar, res)
    );

    /** @type {Chat[]} */
    const chats = await new Promise(res => {
      let calls = 0;

      Events.onChats(
        _chats => {
          if (calls === 4) {
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

    expect(chat.recipientAvatar).toBe(newAvatar);
    done();
  });

  it("provides the recipient's display name if available", async done => {
    expect.assertions(1);

    const {
      gun,
      recipient,
      requestor
    } = await TestUtils.createWithSuccessfulHandshake();

    const newDisplayName = Math.random().toString();

    await new Promise(res =>
      recipient
        .get(Key.PROFILE)
        .get(Key.DISPLAY_NAME)
        .put(newDisplayName, res)
    );

    /** @type {Chat[]} */
    const chats = await new Promise(res => {
      let calls = 0;

      Events.onChats(
        _chats => {
          if (calls === 4) {
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

    expect(chat.recipientDisplayName).toBe(newDisplayName);
    done();
  });
});

describe("onSimplerSentRequests()", () => {
  it("provides sent requests that have not been accepted", async done => {
    expect.assertions(1);

    const { gun, requestor } = await TestUtils.createWithHandshakeAttempt();

    const sentRequests = await new Promise(res => {
      let calls = 0;

      Events.onSimplerSentRequests(
        _sentRequests => {
          if (calls === 2) {
            res(_sentRequests);
          }

          calls++;
        },
        gun,
        requestor,
        Sea
      );
    });

    expect(sentRequests).toHaveLength(1);
    done();

    //
  });

  it("does not provide sent requests that have been accepted", async done => {
    expect.assertions(1);

    const { gun, requestor } = await TestUtils.createWithSuccessfulHandshake();

    const sentRequests = await new Promise(res => {
      let calls = 0;

      Events.onSimplerSentRequests(
        _sentRequests => {
          if (calls === 2) {
            res(_sentRequests);
          }

          calls++;
        },
        gun,
        requestor,
        Sea
      );
    });

    expect(sentRequests).toHaveLength(0);
    done();

    //
  });

  it("only provides the latest request made to a single user", async done => {
    expect.assertions(1);

    const {
      gun,
      requestor,
      recipientPub,
      recipientHandshakeAddress
    } = await TestUtils.createWithHandshakeAttempt();

    await Actions.sendHandshakeRequest(
      recipientHandshakeAddress,
      recipientPub,
      gun,
      requestor,
      Sea
    );

    const sentRequests = await new Promise(res => {
      let calls = 0;

      Events.onSimplerSentRequests(
        _sentRequests => {
          if (calls === 2) {
            res(_sentRequests);
          }

          calls++;
        },
        gun,
        requestor,
        Sea
      );
    });

    expect(sentRequests).toHaveLength(1);
    done();

    //
  });

  it("indicates when the recipient has changed the handshake address in which the request was placed", async done => {
    expect.assertions(1);

    const {
      gun,
      requestor,
      recipient
    } = await TestUtils.createWithHandshakeAttempt();

    await Actions.generateNewHandshakeNode(gun, recipient);

    /** @type {import("./schema").SimpleSentRequest[]} */
    const sentRequests = await new Promise(res => {
      let calls = 0;

      Events.onSimplerSentRequests(
        _sentRequests => {
          if (calls === 2) {
            res(_sentRequests);
          }

          calls++;
        },
        gun,
        requestor,
        Sea
      );
    });

    const [req] = sentRequests;

    expect(req.recipientChangedRequestAddress).toBe(true);

    done();

    //
  });

  it("provides the recipient's avatar", async done => {
    expect.assertions(1);

    const {
      gun,
      requestor,
      recipient
    } = await TestUtils.createWithHandshakeAttempt();

    const newRecipientAvatar = Math.random().toString();

    await new Promise(res =>
      recipient
        .get(Key.PROFILE)
        .get(Key.AVATAR)
        .put(newRecipientAvatar, res)
    );

    /** @type {import("./schema").SimpleSentRequest[]} */
    const sentRequests = await new Promise(res => {
      let calls = 0;

      Events.onSimplerSentRequests(
        _sentRequests => {
          if (calls === 2) {
            res(_sentRequests);
          }

          calls++;
        },
        gun,
        requestor,
        Sea
      );
    });

    const [req] = sentRequests;
    expect(req.recipientAvatar).toBe(newRecipientAvatar);
    done();

    //
  });

  it("provides the recipient's display name", async done => {
    const {
      gun,
      recipient,
      requestor
    } = await TestUtils.createWithHandshakeAttempt();

    const newDisplayName = Math.random().toString();

    await new Promise(res =>
      recipient
        .get(Key.PROFILE)
        .get(Key.DISPLAY_NAME)
        .put(newDisplayName, res)
    );

    /** @type {import("./schema").SimpleSentRequest[]} */
    const sentRequests = await new Promise(res => {
      let calls = 0;

      Events.onSimplerSentRequests(
        _sentRequests => {
          if (calls === 3) {
            res(_sentRequests);
          }

          calls++;
        },
        gun,
        requestor,
        Sea
      );
    });

    const [req] = sentRequests;

    expect(req.recipientDisplayName).toBe(newDisplayName);
    done();

    //
  });
});

describe("onSimplerReceivedRequests()", () => {
  it("throws a NOT_AUTH error if the user node provided is not authenticated", () => {
    const gun = createMockGun();

    expect(() => {
      Events.onSimplerReceivedRequests(() => {}, gun, gun.user(), Sea);
    }).toThrow();
  });

  it("only provides the latest request if theres 2 requests from the same user", async done => {
    expect.assertions(1);

    const {
      gun,
      requestor,
      recipient,
      recipientPub,
      recipientHandshakeAddress
    } = await TestUtils.createWithHandshakeAttempt();

    await Actions.sendHandshakeRequest(
      recipientHandshakeAddress,
      recipientPub,
      gun,
      requestor,
      Sea
    );

    const receivedRequests = await new Promise(res => {
      let calls = 0;

      Events.onSimplerReceivedRequests(
        _receivedRequests => {
          if (calls === 2) {
            res(_receivedRequests);
          }

          calls++;
        },
        gun,
        recipient,
        Sea
      );
    });

    expect(receivedRequests).toHaveLength(1);
    done();

    //
  });

  it("provides no requests that have been accepted/for which there are incoming feeds", async () => {
    expect.assertions(2);

    const gun = createMockGun();

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
      requestorUser,
      Sea
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
        requestorUser,
        Sea
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
        recipientUser,
        Sea
      );
    });

    await Actions.acceptRequest(reqID, gun, recipientUser, Sea);

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
        recipientUser,
        Sea
      );
    });

    //
  });

  it("provides the requestor's avatar if it exists", async () => {
    expect.assertions(1);

    const gun = createMockGun();

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
      requestorUser,
      Sea
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
        recipientUser,
        Sea
      );
    });

    //
  });

  it("provides the requestor's display name if it exists", async () => {
    expect.assertions(1);

    const {
      gun,
      recipient,
      requestor
    } = await TestUtils.createWithHandshakeAttempt();

    const requestorDisplayName = Math.random().toString();

    await Actions.setDisplayName(requestorDisplayName, requestor);

    /**
     * @type {import("./schema").SimpleReceivedRequest[]}
     */
    const receivedRequests = await new Promise(res => {
      let calls = 0;

      Events.onSimplerReceivedRequests(
        _receivedRequests => {
          if (calls === 1) {
            res(_receivedRequests);
          }

          calls++;
        },
        gun,
        recipient,
        Sea
      );
    });

    const [req] = receivedRequests;

    expect(req.requestorDisplayName).toMatch(requestorDisplayName);

    //
  });
});
