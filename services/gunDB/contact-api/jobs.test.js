/**
 * @prettier
 */
const Actions = require("./actions");
const ErrorCode = require("./errorCode");
const Events = require("./events");
const Jobs = require("./jobs");
const Key = require("./key");
const { createMockGun } = require("./__mocks__/mock-gun");
// @ts-ignore
require("gun/sea");

/** @type {import('./SimpleGUN').ISEA} */
// @ts-ignore
const Sea = SEA;

describe("__onAcceptedRequests()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", async () => {
    expect.assertions(1);

    try {
      await Jobs.onAcceptedRequests(
        () => {},
        createMockGun(),
        createMockGun().user(),
        Sea
      );
    } catch (e) {
      expect(e.message).toBe(ErrorCode.NOT_AUTH);
    }
  });

  it("reacts to accepted requests by creating a record in the user-to-incoming map", async done => {
    expect.assertions(2);

    const gun = createMockGun();

    const requestorUser = gun.user();
    const recipientUser = gun.user();
    await new Promise(res => requestorUser.auth("a", "a", res));
    await new Promise(res => recipientUser.auth("b", "b", res));

    const { pub: requestorPub } = requestorUser._.sea;
    const { epub: recipientEpub, pub: recipientPub } = recipientUser._.sea;

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

    const requestorOutgoingID = await new Promise(res => {
      requestorUser
        .get(Key.OUTGOINGS)
        .once()
        .map()
        .once((_, feedID) => {
          res(feedID);
        });
    });

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

    recipientUser
      .get(Key.USER_TO_INCOMING)
      .once()
      .map()
      .once(async (encryptedIncomingID, encryptedUserPub) => {
        if (typeof encryptedIncomingID !== "string") {
          throw new TypeError("typeof encryptedIncomingID !== 'string'");
        }

        const incomingID = await Sea.decrypt(
          encryptedIncomingID,
          recipientSecret
        );

        const userPub = await Sea.decrypt(encryptedUserPub, recipientSecret);

        expect(incomingID).toMatch(requestorOutgoingID);
        expect(userPub).toMatch(requestorPub);
        done();
      });
  });
});
