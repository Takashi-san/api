/** @format  */
// @ts-nocheck

const PREFIX = "encrypted--";

global.SEA = {
  /**
   * @param {string} msg
   * @returns {Promise<string>}
   */
  async encrypt(msg) {
    if (msg.indexOf(PREFIX) === 0) {
      throw new Error(
        `Testing Error: You seem to be encrypting an already encrypted message: ${msg}`
      );
    }
    return PREFIX + msg;
  },
  /**
   * @param {string} msg
   * @returns {Promise<string>}
   */
  async decrypt(msg) {
    if (msg.indexOf(PREFIX) !== 0) {
      throw new Error(
        Error(
          `Testing Error: You seem to be decrypting an already decrypted message: ${msg}`
        )
      );
    }
    return msg.slice(PREFIX.length);
  },
  /**
   * @returns {Promise<string>}
   */
  secret() {
    return Promise.resolve("blah");
  }
};
