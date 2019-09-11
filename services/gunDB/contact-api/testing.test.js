/** @prettier */
import { createMockGun } from "./__mocks__/mock-gun.js";
import { __MOCK_USER_SUPER_NODE, injectSeaMockToGun } from "./testing.js";

/**
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
 * @typedef {import('./SimpleGUN').UserGUNNode} UserGUNNode
 **/

describe("injectSeaMockToGun()", () => {
  it("creates an 'user' function property on the object passed to it", () => {
    const o = {};

    // @ts-ignore
    injectSeaMockToGun(o);

    // @ts-ignore
    expect(typeof o.user === "function").toBe(true);
  });

  it("reroutes an user(publicKey) call to gun.get(__MOCK_USER_SUPER_NODE).get(publicKey)", () => {
    expect.assertions(1);

    const gun = createMockGun();

    injectSeaMockToGun(gun);

    const pk = Math.random().toString();

    const user = gun.user(pk);

    const data = {
      [Math.random().toString()]: Math.random().toString()
    };

    const subKey = Math.random().toString();

    user.get(subKey).put(data, ack => {
      if (ack.err) {
        return;
      }

      gun
        .get(__MOCK_USER_SUPER_NODE)
        .get(pk)
        .get(subKey)
        .once(dataReceived => {
          expect({
            // @ts-ignore Let it crash if not an object
            ...dataReceived,
            _: undefined
          }).toEqual(data);
        });
    });
  });

  it("throws error calling put(), set(), map(), once(), on() directly on the resulting user node", () => {
    const gun = createMockGun();

    injectSeaMockToGun(gun);

    const user = gun.user();

    expect(() => {
      user.put(3);
    }).toThrow();

    expect(() => {
      user.set({});
    }).toThrow();

    expect(() => {
      user.map();
    }).toThrow();

    expect(() => {
      user.once();
    }).toThrow();

    expect(() => {
      user.on(() => {});
    }).toThrow();
  });
});
