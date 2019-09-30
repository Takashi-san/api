/** @format */
import * as Actions from "./actions";
import * as Events from "./events";
import { createMockGun } from "./__mocks__/mock-gun";
import * as Jobs from "./jobs";
import * as Key from "./key";
import * as Schema from "./schema";
Schema.isChatMessage; // avoid unused import tytpescript error

// @ts-ignore
require("gun/sea");

/**
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
 * @typedef {import('./SimpleGUN').UserGUNNode} UserGUNNode
 * @typedef {import('./TestUtils').RequestorAndRecipient} RequestorAndRecipient
 * @typedef {import('./TestUtils').RequestorRecipientAndHandshakeAttempt} RequestorRecipientAndHandshakeAttempt
 * @typedef {import('./TestUtils').RequestorRecipientAndSuccessfulHandshake} RequestorRecipientAndSuccessfulHandshake
 */

const TIMEOUT_MS = 2000;

/**
 * @type {import('./SimpleGUN').ISEA}
 */
// @ts-ignore
const Sea = SEA;

/**
 * @returns {Promise<RequestorAndRecipient>}
 */
export const create = async () => {
  const gun = createMockGun();

  const requestor = gun.user();
  await new Promise(res => requestor.auth("alice", "alice", res));

  const recipient = gun.user();
  await new Promise(res => recipient.auth("bob", "bob", res));

  const requestorPair = requestor._.sea;
  const { epub: requestorEpub, pub: requestorPub } = requestorPair;

  const recipientPair = recipient._.sea;
  const { epub: recipientEpub, pub: recipientPub } = recipientPair;

  const recipientSecret = await Sea.secret(recipientEpub, recipientPair);
  const requestorSecret = await Sea.secret(requestorEpub, requestorPair);

  const sharedSecret =
    Math.random() > 0.5
      ? await Sea.secret(recipientEpub, requestorPair)
      : await Sea.secret(requestorEpub, recipientPair);

  return {
    gun,
    recipient,
    giveRecipientADisplayName() {
      const newDisplayName = Math.random().toString();

      return new Promise((res, rej) => {
        recipient
          .get(Key.PROFILE)
          .get(Key.DISPLAY_NAME)
          .put(newDisplayName, ack => {
            if (ack.err) {
              rej(ack.err);
            } else {
              res(newDisplayName);
            }
          });
      });
    },
    giveRecipientAnAvatar() {
      const newAvatar = Math.random().toString();

      return new Promise((res, rej) => {
        recipient
          .get(Key.PROFILE)
          .get(Key.AVATAR)
          .put(newAvatar, ack => {
            if (ack.err) {
              rej(ack.err);
            } else {
              res(newAvatar);
            }
          });
      });
    },
    recipientEpub,
    recipientPair,
    recipientSecret,
    recipientPub,
    requestor,
    giveRequestorADisplayName() {
      const newDisplayName = Math.random().toString();

      return new Promise((res, rej) => {
        requestor
          .get(Key.PROFILE)
          .get(Key.DISPLAY_NAME)
          .put(newDisplayName, ack => {
            if (ack.err) {
              rej(ack.err);
            } else {
              res(newDisplayName);
            }
          });
      });
    },
    giveRequestorAnAvatar() {
      const newAvatar = Math.random().toString();

      return new Promise((res, rej) => {
        requestor
          .get(Key.PROFILE)
          .get(Key.AVATAR)
          .put(newAvatar, ack => {
            if (ack.err) {
              rej(ack.err);
            } else {
              res(newAvatar);
            }
          });
      });
    },
    requestorEpub,
    requestorPair,
    requestorSecret,
    requestorPub,

    sharedSecret
  };
};

/**
 * @param {UserGUNNode} recipient
 * @returns {Promise<string>}
 */
export const extractHandshakeAddress = recipient =>
  new Promise((res, rej) => {
    recipient.get(Key.CURRENT_HANDSHAKE_NODE).once(n => {
      if (typeof n === "object" && n !== null) {
        res(n._["#"]);
      } else {
        rej(new TypeError("current handshake node not a node"));
      }
    });
  });

/**
 * @param {UserGUNNode} requestorOrRecipient
 * @returns {Promise<string>}
 */
export const extractOutgoingID = requestorOrRecipient => {
  const outgoingID = new Promise(res => {
    requestorOrRecipient
      .get(Key.OUTGOINGS)
      .once()
      .map()
      .once((_, _outgoingID) => {
        res(_outgoingID);
      });
  });

  const timeout = new Promise(res => {
    setTimeout(() => {
      res(null);
    }, TIMEOUT_MS);
  });

  return Promise.race([outgoingID, timeout]).then(oid => {
    if (oid === null) {
      throw new Error("Could not find an outgoing for requestor/recipient");
    } else {
      return oid;
    }
  });
};

/**
 *
 * @param {UserGUNNode} requestor
 * @returns {Promise<string>}
 */
export const extractHandshakeRequestID = requestor => {
  const requestID = new Promise(res => {
    requestor
      .get(Key.SENT_REQUESTS)
      .once()
      .map()
      .once((_, reqID) => {
        res(reqID);
      });
  });

  const timeout = new Promise(res => {
    setTimeout(() => {
      res(null);
    }, TIMEOUT_MS);
  });

  return Promise.race([requestID, timeout]).then(reqID => {
    if (reqID === null) {
      throw new Error("Could not find a request ID for requestor");
    } else {
      return reqID;
    }
  });
};

/**
 * @returns {Promise<RequestorRecipientAndHandshakeAttempt>}
 */
export const createWithHandshakeAttempt = async () => {
  const requestorAndRecipient = await create();
  const { gun, recipient, recipientPub, requestor } = requestorAndRecipient;

  await Actions.generateNewHandshakeNode(gun, recipient);

  const recipientHandshakeAddress = await extractHandshakeAddress(recipient);

  await Actions.sendHandshakeRequest(
    recipientHandshakeAddress,
    recipientPub,
    gun,
    requestor,
    Sea
  );

  const requestorFeedID = await extractOutgoingID(requestor);
  const requestorHandshakeRequestID = await extractHandshakeRequestID(
    requestor
  );

  return {
    ...requestorAndRecipient,
    recipientHandshakeAddress,
    requestorFeedID,
    requestorHandshakeRequestID
  };
};

/**
 * Warning: This function fires up Jobs.onAcceptedRequests() for the requestor.
 * @returns {Promise<RequestorRecipientAndSuccessfulHandshake>}
 */
export const createWithSuccessfulHandshake = async () => {
  const requestorRecipientAndHandshakeAttempt = await createWithHandshakeAttempt();
  const {
    gun,
    requestor,
    recipient,
    requestorHandshakeRequestID
  } = requestorRecipientAndHandshakeAttempt;

  await Jobs.onAcceptedRequests(Events.onSentRequests, gun, requestor, Sea);

  await Actions.acceptRequest(requestorHandshakeRequestID, gun, recipient, Sea);

  const recipientFeedID = await extractOutgoingID(recipient);

  requestorRecipientAndHandshakeAttempt.requestorFeedID;

  return {
    ...requestorRecipientAndHandshakeAttempt,
    recipientFeedID: recipientFeedID
  };
};
