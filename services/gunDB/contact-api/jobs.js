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
import * as ErrorCode from "./errorCode.js";
import * as Events from "./events.js";
import * as Key from "./key.js";
import { user as userGun } from "./gun.js";
/**
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
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
 * @param {UserGUNNode=} user Pass only for testing purposes.
 */
export const onAcceptedRequests = (
  onSentRequestsFactory = Events.onSentRequests,
  user = userGun
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
          .once(userPubKey => {
            if (typeof userPubKey !== "string") {
              if (typeof userPubKey !== "undefined") {
                console.error("non string received");
              }
              return;
            }

            if (userPubKey.length === 0) {
              console.error("empty string received");
              return;
            }

            const userToIncoming = user.get(Key.USER_TO_INCOMING);

            userToIncoming.get(userPubKey).once(outgoingID => {
              const receivedOutgoingID = req.response;

              // only set it once. Also prevents attacks if an attacker
              // modifies old requests
              if (typeof outgoingID === "undefined") {
                userToIncoming.get(userPubKey).put(receivedOutgoingID);

                return;
              }

              if (typeof outgoingID !== "string") {
                console.error("non string received");
                return;
              }

              if (outgoingID.length === 0) {
                console.error("empty string received");
                return;
              }
            });
          });
      }
    }
  }, user);
};
