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
const Events = require("./events");
const Key = require("./key");

/**
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
 * @typedef {import('./SimpleGUN').ISEA} ISEA
 * @typedef {import('./schema').HandshakeRequest} HandshakeRequest
 * @typedef {import('./SimpleGUN').UserGUNNode} UserGUNNode
 */

/**
 * @typedef {(sentRequests: Record<string, HandshakeRequest>) => void} OnSentRequest
 */

/**
 * @param {((osr: OnSentRequest, user: UserGUNNode) => void)=} onSentRequestsFactory
 * Pass only for testing purposes.
 * @throws {Error} NOT_AUTH
 * @param {GUNNode} gun
 * @param {UserGUNNode} user Pass only for testing purposes.
 * @param {ISEA} SEA
 * @returns {Promise<void>}
 */
exports.onAcceptedRequests = async (
  onSentRequestsFactory = Events.onSentRequests,
  gun,
  user,
  SEA
) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  // Used only for decrypting request-to-user-map
  const mySecret = await SEA.secret(user._.sea.epub, user._.sea);

  onSentRequestsFactory(async sentRequests => {
    for (const [reqKey, req] of Object.entries(sentRequests)) {
      try {
        /** @type {string|undefined} */
        const recipientPub = await new Promise((res, rej) => {
          user
            .get(Key.REQUEST_TO_USER)
            .get(reqKey)
            .once(async userPub => {
              if (typeof userPub === "undefined") {
                res(undefined);
                return;
              }

              if (typeof userPub !== "string") {
                rej(
                  new TypeError(
                    "typeof userPub !== 'string' && typeof userPub !== 'undefined'"
                  )
                );
                return;
              }

              if (userPub.length === 0) {
                rej(new TypeError("userPub.length === 0"));
                return;
              }

              res(await SEA.decrypt(userPub, mySecret));
            });
        });

        if (typeof recipientPub === "undefined") {
          throw new TypeError("typeof recipientEpub === 'undefined'");
        }

        /** @type {string} */
        const recipientEpub = await new Promise((res, rej) => {
          gun
            .user(recipientPub)
            .get("epub")
            .once(epub => {
              if (typeof epub !== "string") {
                rej(
                  new TypeError(
                    "Expected gun.user(pub).get(epub) to be an string."
                  )
                );
              } else {
                if (epub.length === 0) {
                  rej(
                    new TypeError(
                      "Expected gun.user(pub).get(epub) to be a populated string."
                    )
                  );
                }

                res(epub);
              }
            });
        });

        // The response can be decrypted with the same secret regardless of who
        // wrote to it last (see HandshakeRequest definition).
        const ourSecret = await SEA.secret(recipientEpub, user._.sea);

        // This could be our feed ID for the recipient, or the recipient's feed
        // id if he accepted the request.
        const feedID = await SEA.decrypt(req.response, ourSecret);

        // Check that this feed exists on the recipient's outgoing feeds
        const wasAccepted = await new Promise(res => {
          gun
            .user(recipientPub)
            .get(Key.OUTGOINGS)
            .get(feedID)
            .once(feed => {
              res(typeof feed !== "undefined");
            });
        });

        if (!wasAccepted) {
          return;
        }

        const encryptedUserPub = await SEA.encrypt(recipientPub, mySecret);
        const requestToUserRecord = user.get(Key.REQUEST_TO_USER).get(reqKey);
        const userToIncomingRecord = user
          .get(Key.USER_TO_INCOMING)
          .get(encryptedUserPub);

        const alreadyExists = await new Promise(res => {
          userToIncomingRecord.once(feedIDRecord => {
            res(typeof feedIDRecord !== "undefined");
          });
        });

        // only set it once. Also prevents attacks if an attacker
        // modifies old requests
        if (alreadyExists) {
          return;
        }

        requestToUserRecord.put(encryptedUserPub);
      } catch (e) {
        console.warn(`Error inside Jobs.onAcceptedRequests: ${e.message}`);
      }
    }
  }, user);
};
