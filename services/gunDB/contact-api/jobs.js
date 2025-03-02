/**
 * @prettier
 * Taks are subscriptions to events that perform actions (write to GUN) on
 * response to certain ways events can happen. These tasks need to be fired up
 * at app launch otherwise certain features won't work as intended. Tasks should
 * ideally be idempotent, that is, if they were to be fired up after a certain
 * amount of time after app launch, everything should work as intended. For this
 * to work, special care has to be put into how these respond to events. These
 * tasks could be hardcoded inside events but then they wouldn't be easily
 * auto-testable. These tasks accept factories that are homonymous to the events
 * on the same
 */
const ErrorCode = require("./errorCode");
const Key = require("./key");
const Schema = require("./schema");
const Utils = require("./utils");

/**
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
 * @typedef {import('./SimpleGUN').ISEA} ISEA
 * @typedef {import('./SimpleGUN').UserGUNNode} UserGUNNode
 */

/**
 * @throws {Error} NOT_AUTH
 * @param {GUNNode} gun
 * @param {UserGUNNode} user
 * @param {ISEA} SEA
 * @returns {Promise<void>}
 */
const onAcceptedRequests = async (gun, user, SEA) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  const mySecret = await SEA.secret(user._.sea.epub, user._.sea);

  if (typeof mySecret !== "string") {
    console.log("Jobs.onAcceptedRequests() -> typeof mySecret !== 'string'");
    return;
  }

  user
    .get(Key.SENT_REQUESTS)
    .map()
    .on(async (sentReq, reqID) => {
      try {
        if (!Schema.isHandshakeRequest(sentReq)) {
          throw new TypeError(
            `non handshake received: ${JSON.stringify(sentReq)}`
          );
        }

        const recipientPub = await Utils.reqToRecipientPub(
          reqID,
          user,
          SEA,
          mySecret
        );

        const latestReqSentID = await Utils.recipientPubToLastReqSentID(
          recipientPub,
          user
        );

        const isStaleRequest = latestReqSentID !== reqID;

        const recipientEpub = await Utils.pubToEpub(recipientPub, gun);
        const ourSecret = await SEA.secret(recipientEpub, user._.sea);

        if (typeof ourSecret !== "string") {
          throw new TypeError("typeof ourSecret !== 'string'");
        }

        // The response can be decrypted with the same secret regardless of who
        // wrote to it last (see HandshakeRequest definition).
        // This could be our feed ID for the recipient, or the recipient's feed
        // id if he accepted the request.
        const feedID = await SEA.decrypt(sentReq.response, ourSecret);

        if (typeof feedID !== "string") {
          throw new TypeError("typeof feedID !== 'string'");
        }

        if (feedID.length < 6) {
          throw new TypeError("feedID.length < 6");
        }

        const feedIDExistsOnRecipientsOutgoings = await new Promise(res => {
          gun
            .user(recipientPub)
            .get(Key.OUTGOINGS)
            .get(feedID)
            .once(feed => {
              res(typeof feed !== "undefined");
            });
        });

        ////////////////////////////////////////////////////////////////////////

        if (await Utils.successfulHandshakeAlreadyExists(recipientPub, user)) {
          return;
        }

        if (isStaleRequest) {
          return;
        }

        if (!feedIDExistsOnRecipientsOutgoings) {
          return;
        }

        const encryptedForMeIncomingID = await SEA.encrypt(feedID, mySecret);

        user
          .get(Key.USER_TO_INCOMING)
          .get(recipientPub)
          .put(encryptedForMeIncomingID);
      } catch (err) {
        console.warn(`Jobs.onAcceptedRequests() -> ${err.message}`);
      }
    });
};

module.exports = {
  onAcceptedRequests
};
