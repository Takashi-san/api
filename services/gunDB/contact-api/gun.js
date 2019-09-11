/** @prettier */
import * as Testing from "./testing.js";

import Gun from "gun/gun.js";

// @ts-ignore
const runningInJest = process.env.JEST_WORKER_ID !== undefined;

if (runningInJest) {
  Testing.mockGun();
}

/**
 * @type {import('./SimpleGUN').GUNNode}
 */
export let gun;

/**
 * @type {import('./SimpleGUN').UserGUNNode}
 */
export let user;

export const setupGun = () => {
  if (Testing.__shouldMockGun()) {
    // @ts-ignore Let it crash if actually trying to access fow
    gun = null;
    // in the future mock the whole thing
  } else {
    // @ts-ignore module does not exist error?
    gun = Gun();

    if (Testing.__shouldMockSea()) {
      Testing.injectSeaMockToGun(gun);
    }

    user = gun.user();
  }
};
