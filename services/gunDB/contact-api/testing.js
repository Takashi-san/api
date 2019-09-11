/** @prettier */

/**
 * @typedef {import('./SimpleGUN').GUNNode} GUNNode
 * @typedef {import('./SimpleGUN').UserGUNNode} UserGUNNode
 **/

let shouldMockGun = false;
let shouldMockSea = false;
let shouldFailAuth = false;
let shouldFailCreate = false;

export const __shouldMockGun = () => {
  return shouldMockGun;
};

export const __shouldMockSea = () => {
  return shouldMockSea;
};

/**
 * Mock gun.
 */
export const mockGun = () => {
  shouldMockGun = true;
};

/**
 * Mock gun's sea module which is currently incompatible with React Native. If
 * mocking the entirety of gun itself, this switch is not necessary.
 * @throws {Error}
 */
export const mockSea = () => {
  if (__shouldMockGun()) {
    throw new Error(
      "Called mockSea() even though already mocking gun itself. This is unnecesary."
    );
  }

  shouldMockSea = true;
};

/**
 * If mocking SEA. Switching this on makes user authentication fail.
 * @throws {Error}
 */
export const failAuth = () => {
  shouldFailAuth = true;
};

/**
 * If mocking SEA. Switching this on makes user creation fail.
 * @throws {Error}
 */
export const failCreate = () => {
  shouldFailCreate = true;
};

export const __MOCK_USER_SUPER_NODE = "$$_MOCK_USER_SUPER_NODE";

/**
 * Function which when called will provide an unique public key for the user
 * being authenticated. The default is to simply use the user's alias. This can
 * be enough for testing, for testing when running on  react native, provide the
 * GUID.
 * @param {GUNNode} gun
 * @param {(alias: string, pass: string) => string} userPublicKeyProvider
 * @returns {void}
 */
export const injectSeaMockToGun = (
  gun,
  userPublicKeyProvider = alias => alias
) => {
  /** @type {null|string} */
  let storedPublicKey = null;

  /**
   * @param {string=} publicKey
   */
  // @ts-ignore
  gun.user = publicKey => {
    if (publicKey) {
      const node = gun.get(__MOCK_USER_SUPER_NODE).get(publicKey);

      node.put = () => {
        throw new Error();
      };

      node.set = () => {
        throw new Error();
      };

      node.map = () => {
        throw new Error();
      };

      node.once = () => {
        throw new Error();
      };

      node.on = () => {
        throw new Error();
      };

      return node;
    }

    /** @type {UserGUNNode} */
    const surrogate = {
      get _() {
        return {
          get: undefined,
          sea: storedPublicKey === null ? undefined : storedPublicKey,
          put: undefined
        };
      },
      auth(alias, pass, cb) {
        if (shouldFailAuth) {
          cb({ err: "failAuth() called" });
        } else {
          // get GUID and store it here
          storedPublicKey = userPublicKeyProvider(alias, pass);

          cb({ err: undefined });
        }
      },
      create(_, __, cb) {
        if (shouldFailCreate) {
          cb({ err: "failCreate() called" });
        } else {
          cb({ err: undefined });
        }
      },
      get(key) {
        if (storedPublicKey === null) {
          throw new Error("Tried to call get() without authenticating first.");
        }

        return gun
          .get(__MOCK_USER_SUPER_NODE)
          .get(storedPublicKey)
          .get(key);
      },
      get is() {
        if (storedPublicKey) {
          return {
            pub: storedPublicKey
          };
        }

        return undefined;
      },
      leave() {
        storedPublicKey = null;
      },
      map() {
        throw new Error("Shouldn't call map() directly on user node.");
      },
      off() {
        throw new Error("Shouldn't call off() directly on user node.");
      },
      on() {
        throw new Error("Shouldn't call on() directly on user node.");
      },
      once() {
        throw new Error("Shouldn't call once() directly on user node.");
      },
      put() {
        throw new Error("Shouldn't call put() directly on user node.");
      },
      set() {
        throw new Error("Shouldn't call off() directly on user node.");
      },
      // @ts-ignore
      user: undefined
    };

    return surrogate;
  };
};
