import Gun from "gun";
import "gun/sea.js";
import * as Config from "../config.js";
import uuidv1 from "uuid/v1.js";

/**
 * @typedef {import('../contact-api/SimpleGUN').GUNNode} GunNode
 * @typedef {import('../contact-api/SimpleGUN').UserGUNNode} UserGUNNode
 */

/**
 * @returns {GunNode}
 */
export const createGun = () =>
  // @ts-ignore
  Gun({
    file: Config.DATA_FILE_NAME,
    peers: Config.PEERS
  });

/**
 * @type {Record<string, string>}
 */
const tokenToAlias = {};

/**
 * @type {Record<string, UserGUNNode>}
 */
const aliasToUser = {};

/**
 * @param {string} alias
 * @returns {string|null}
 */
export const getTokenForAlias = alias => {
  const maybeTokenAliasPair = Object.entries(tokenToAlias).find(
    ([_, al]) => al === alias
  );

  if (maybeTokenAliasPair) {
    const [token] = maybeTokenAliasPair;

    return token;
  }

  return null;
};

/**
 * @param {string} alias
 * @returns {UserGUNNode}
 */
export const getUserForAlias = alias => {
  if (!aliasToUser[alias]) {
    aliasToUser[alias] = createGun().user();

    const userNode = aliasToUser[alias];

    const oldAuth = userNode.auth.bind(userNode);

    userNode.auth = (alias, pass, cb) => {
      oldAuth(alias, pass, ack => {
        if (!ack.err) {
          const token = uuidv1();

          tokenToAlias[token] = alias;

          setTimeout(() => {
            userNode.leave();

            delete tokenToAlias[token];

            console.log(`token: ${token} just expired`);
          }, Config.MS_TO_TOKEN_EXPIRATION);
        }

        cb(ack);
      });
    };

    const oldLeave = userNode.leave.bind(userNode);

    userNode.leave = () => {
      oldLeave();

      const token = getTokenForAlias(alias);

      if (token === null) {
        throw new TypeError();
      }

      delete tokenToAlias[token];
    };
  }

  return aliasToUser[alias];
};

/**
 * Returns null if the token has expired.
 * @param {string} token
 * @throws {ReferenceError}
 * @returns {UserGUNNode|null} Returns null if the token has expired.
 */
export const getUserForToken = token => {
  if (!tokenToAlias[token]) {
    return null;
  }

  const alias = tokenToAlias[token];

  return getUserForAlias(alias);
};
