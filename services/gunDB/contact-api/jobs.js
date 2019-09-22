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
 */
exports.onAcceptedRequests = (
  onSentRequestsFactory = Events.onSentRequests,
  gun,
  user,
  SEA
) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH);
  }

  onSentRequestsFactory(sentRequests => {
    for (const [reqKey, req] of Object.entries(sentRequests)) {
      // TODO: check here if the response of the handshake request has been
      // overwritten by the recipient.
      if (req.response.indexOf("$$_TEST_") === 0) {
        user
          .get(Key.REQUEST_TO_USER)
          .get(reqKey)
          .once(async encryptedUserPubKey => {
            if (typeof encryptedUserPubKey !== "string") {
              if (typeof encryptedUserPubKey !== "undefined") {
                console.error("non string received");
              }
              return;
            }

            if (encryptedUserPubKey.length === 0) {
              console.error("empty string received");
              return;
            }

            if (!user.is) {
              console.warn("!user.is");
              return;
            }

            const userToIncoming = user.get(Key.USER_TO_INCOMING);

            userToIncoming
              .get(encryptedUserPubKey)
              .once(async encryptedIncomingID => {
                // only set it once. Also prevents attacks if an attacker
                // modifies old requests
                if (typeof encryptedIncomingID !== "undefined") {
                  return;
                }

                if (!user.is) {
                  console.warn("!user.is");
                  return;
                }

                /** @type {string} */
                const requestorEpub = await new Promise((res, rej) => {
                  gun
                    .user(req.from)
                    .get("epub")
                    .once(epub => {
                      if (typeof epub !== "string") {
                        rej(
                          new Error(
                            "Expected gun.user(pub).get(epub) to be an string."
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

                const mySecret = await SEA.secret(user._.sea.epub, user._.sea);
                const ourSecret = await SEA.secret(requestorEpub, user._.sea);

                const receivedEncryptedIncomingID = req.response;

                const receivedIncomingID = await SEA.decrypt(
                  receivedEncryptedIncomingID,
                  ourSecret
                );

                const recryptedIncomingID = await SEA.encrypt(
                  receivedIncomingID,
                  mySecret
                );

                userToIncoming
                  .get(encryptedUserPubKey)
                  .put(recryptedIncomingID);
              });
          });
      }
    }
  }, user);
};
