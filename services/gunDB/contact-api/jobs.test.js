/**
 * @prettier
 */
import * as Events from "./events.js";
import * as Jobs from "./jobs.js";
import * as Key from "./key.js";
import * as Testing from "./testing.js";
import { createMockGun } from "./__mocks__/mock-gun.js";

describe("__onAcceptedRequests()", () => {
  it("throws a NOT_AUTH error if supplied with a non authenticated node", () => {
    expect(() => {
      Jobs.onAcceptedRequests(() => {}, createMockGun());
    }).toThrow();
  });

  it("reacts to accepted requests by creating a record in the user-to-incoming map", async done => {
    expect.assertions(2);

    const requestorPK = Math.random().toString();
    const recipientPK = Math.random().toString();
    const fakeIncomingIDSuffix = Math.random().toString();

    const gun = createMockGun();

    /**
     * @type {import('./schema').HandshakeRequest}
     */
    const fakeRequest = {
      from: requestorPK,
      response: Math.random().toString(),
      timestamp: Math.random()
    };

    Testing.injectSeaMockToGun(gun);

    const user = gun.user();

    await new Promise((res, rej) => {
      user.auth(requestorPK, Math.random().toString(), ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res();
        }
      });
    });

    // the next 2 steps mimic what Actions.sendRequest does except for creating
    // an outgoing feed

    /** @type {string} */
    const requestID = await new Promise((res, rej) => {
      const reqID = user.get(Key.SENT_REQUESTS).set(fakeRequest, ack => {
        if (ack.err) {
          rej(ack.err);
        } else {
          res(reqID);
        }
      })._.get;
    });

    await new Promise((res, rej) => {
      user
        .get(Key.REQUEST_TO_USER)
        .get(requestID)
        .put(recipientPK, ack => {
          if (ack.err) {
            rej(ack.err);
          } else {
            res();
          }
        });
    });

    Jobs.onAcceptedRequests(Events.onSentRequests, user);

    await new Promise((res, rej) => {
      user
        .get(Key.SENT_REQUESTS)
        .get(requestID)
        .put(
          {
            response: "$$_TEST_" + fakeIncomingIDSuffix
          },
          ack => {
            if (ack.err) {
              rej(ack.err);
            } else {
              res();
            }
          }
        );
    });

    // After putting the test response to the request, acceptedRequest should
    user
      .get(Key.USER_TO_INCOMING)
      .once()
      .map()
      .once((outgoingID, userPK) => {
        expect(outgoingID).toMatch("$$_TEST_" + fakeIncomingIDSuffix);
        expect(userPK).toMatch(recipientPK);
        done();
      });
  });
});
