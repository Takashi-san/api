/** @prettier */
const Testing = require("./testing");

const Gun = require("gun/gun");

// @ts-ignore
const runningInJest = process.env.JEST_WORKER_ID !== undefined;

if (runningInJest) {
  Testing.mockGun();
}

/**
 * @type {import('./SimpleGUN').GUNNode}
 */
exports.gun = null;

/**
 * @type {import('./SimpleGUN').UserGUNNode}
 */
exports.user = null;

exports.setupGun = () => {
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
