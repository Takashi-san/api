/**
 * @prettier
 */
/**
 * @typedef {import('../SimpleGUN').Callback} Callback
 * @typedef {import('../SimpleGUN').Data} Data
 * @typedef {import('../SimpleGUN').GUNNode} GUNNode
 * @typedef {import('../SimpleGUN').Listener} Listener
 * @typedef {import('../SimpleGUN').UserGUNNode} UserGUNNode
 * @typedef {import('../SimpleGUN').ValidDataValue} ValidDataValue
 * @typedef {import('../SimpleGUN').ListenerData} ListenerData
 * @typedef {import('../SimpleGUN').ListenerObj} ListenerObj
 * @typedef {import('../SimpleGUN').UserSoul} UserSoul
 */

/**
 * @typedef {object} Options
 * @prop {boolean=} isAuth If provided, the node will be pre-authenticated (that
 * is, the is prop will be an object, and it will have an string 'pub' prop).
 * @prop {boolean=} isChildOfRoot True if this node is a child of the root.
 * @prop {boolean=} failUserAuth
 * @prop {boolean=} failUserCreation
 * @prop {(ValidDataValue | ValidDataValue[])=} initialData If it's an array
 * Random keys will be created for each item.
 * @prop {string=} key If provided, signals that this is not a root node, will
 * also be provided to listeners.
 */

/**
 * @typedef {Record<string, MockGun | boolean | number | string | null>} ObjectGraph
 * @typedef {boolean | number | string | ObjectGraph | null | undefined | MockGun} Graph
 */

/**
 * @param {any} o
 * @returns {o is object}
 */
const isObject = o => typeof o === "object" && o !== null;

/**
 * @param {Graph} graph
 * @returns {graph is ObjectGraph}
 */
const graphIsObject = graph => typeof graph === "object" && graph !== null;

/**
 *
 * @param {any} data
 * @returns {data is ValidDataValue}
 */
const isValidGunData = data => {
  if (data === null) {
    return true;
  }

  if (typeof data === "undefined") {
    return false;
  }

  if (Array.isArray(data)) {
    return false;
  }

  if (typeof data === "bigint") {
    return false;
  }

  if (typeof data === "function") {
    return false;
  }

  if (typeof data === "symbol") {
    return false;
  }

  if (data instanceof Set) {
    return false;
  }

  if (data instanceof Map) {
    return false;
  }

  if (data instanceof WeakMap) {
    return false;
  }

  return true;
};

/**
 * @param {any} o
 * @returns {o is GUNNode}
 */
const isGunNode = o => {
  if (!isObject(o)) {
    return false;
  }

  if (typeof o.get !== "function") {
    return false;
  }

  if (typeof o.on !== "function") {
    return false;
  }

  return true;
};

export default class MockGun {
  /**
   * When set() as successfullly been called on this node, or when map() has
   * been called and the graph is undefined this property will be set to 'set'.
   * If put() has successfuly been called, this property will be set to
   * 'leaf'.
   * @type {'edge'|'leaf'|'set'|'undefined'}
   */
  nodeType = "undefined";

  /**
   * @type {Graph}
   */
  graph = undefined;

  /**
   * @type {Listener[]}
   */
  listeners = [];

  /**
   * @type {Listener[]}
   */
  setListeners = [];

  /**
   * @param {Options} opts
   */
  constructor({
    isChildOfRoot,
    failUserAuth,
    failUserCreation,
    initialData,
    key,
    isAuth
  } = {}) {
    this.key = key;

    if (key && failUserAuth) {
      throw new Error("failUserAuth is meant to be used on root nodes only");
    }

    if (key && failUserCreation) {
      throw new Error(
        "failUserCreation is meant to be used on root nodes only"
      );
    }

    if (key && isAuth) {
      throw new Error("isAuth is meant to be used on root nodes only");
    }

    this.failUserAuth = failUserAuth;
    this.failUserCreation = failUserCreation;

    this.is = isAuth
      ? {
          pub: Math.random().toString()
        }
      : undefined;

    if (Array.isArray(initialData)) {
      for (const item of initialData) {
        this.set(item);
      }
    } else if (typeof initialData !== "undefined") {
      this.put(initialData, ack => {
        if (ack.err) {
          throw new Error(ack.err);
        } else {
          // let's not assume this node will be used as a leaf type simply
          // because of initial data, there's an special case in our app where
          // we initialize an empty set via giving that set node an unused prop
          this.nodeType = "undefined";
        }
      });
    }

    this.isChildOfRoot = !!isChildOfRoot;

    //https://github.com/Microsoft/TypeScript/issues/17498#issuecomment-399439654
    /**
     * Assert that this class correctly implements UserGUNNode.
     * @type {UserGUNNode}
     */
    const instance = this;
    instance;
  }

  /**
   * @returns {UserSoul}
   */
  get _() {
    return {
      get: this.key,
      put:
        typeof this.graph === "object" && this.graph !== null
          ? { "#": this.key }
          : this.graph,
      sea: this.is ? Math.random().toString() : undefined
    };
  }

  _notifyListeners() {
    if (typeof this.key !== "string") {
      throw new Error(
        "Internal error: tried to notify listeners from a root node"
      );
    }

    if (typeof this.graph === "undefined") {
      return;
    }

    if (this.nodeType === "undefined" && this.graph !== null) {
      throw new Error(
        `Assertion Error: MockGun.prototype._notifyListeners() shouldn't have been called if node type is undefined and the graph is not 'null' -- node key: ${this.key}`
      );
    }

    this.listeners.forEach(cb => {
      this._graphToRegularListenerIfGraphExists(cb);
    });
  }

  /**
   * @param {Listener} listener
   * @returns {void}
   */
  _graphToRegularListenerIfGraphExists(listener) {
    if (typeof this.key === "undefined") {
      throw new Error();
    }

    if (typeof this.graph === "undefined") {
      return;
    }

    let listenerData;

    if (this.graph instanceof MockGun) {
      const edge = this.graph;

      if (typeof edge.graph === "undefined") {
        return;
      }

      listenerData = edge._getListenerData();
    } else {
      listenerData = this._getListenerData();
    }

    listener(listenerData, this.key);
  }

  /**
   * Provides the graph, expanded one layer down, to a set listener.
   * @param {Listener} listener
   * @returns {void}
   */
  _graphToSetListener(listener) {
    const graph = this.graph;

    if (!graphIsObject(graph)) {
      throw new Error("Graph is not object");
    }

    if (this.graph instanceof MockGun) {
      this.graph._graphToSetListener(listener);
      return;
    }

    for (const [key, subGraph] of Object.entries(graph)) {
      if (subGraph instanceof MockGun) {
        subGraph._graphToRegularListenerIfGraphExists(listener);
      } else {
        listener(subGraph, key);
      }
    }
  }

  /**
   * @param {any} _
   * @param {string=} key
   */
  _subNodeOn = (_, key) => {
    // we discriminate between set and leaf because we don't expect to use a
    // node as both in our app
    if (this.nodeType === "set") {
      if (typeof key !== "string") {
        throw new Error("Called _subNodeOn without a key on a set node");
      }

      this.setListeners.forEach(cb => {
        const graph = this.graph;

        if (!graphIsObject(graph)) {
          throw new Error("Assertion Error");
        }

        const subNode = graph[key];

        if (!(subNode instanceof MockGun)) {
          throw new Error("Assertion Error");
        }

        subNode._graphToRegularListenerIfGraphExists(cb);
      });
    } else {
      if (typeof this.key === "string") {
        this._notifyListeners();
      }
    }
  };

  /**
   * @returns {ListenerData}
   */
  _getListenerData() {
    const graph = this.graph;

    if (typeof graph === "undefined") {
      throw new Error();
    }

    if (graph instanceof MockGun) {
      throw new Error(
        "Called _getListenerData() on an edge node. Call the reference node's _getListenerData() instead"
      );
    }

    if (graph === null) {
      return null;
    }

    if (graphIsObject(graph)) {
      if (typeof this.key === "undefined") {
        throw new Error();
      }

      /**
       * @type {ListenerData}
       */
      const listenerData = {
        _: {
          "#": this.key
        }
      };

      for (const [k, v] of Object.entries(graph)) {
        if (isGunNode(v)) {
          const gunNodeSoul = v._.get;

          if (typeof gunNodeSoul !== "string") {
            throw new Error("Assertion Error");
          }

          listenerData[k] = {
            "#": gunNodeSoul
          };
        } else {
          listenerData[k] = v;
        }
      }

      return listenerData;
    } else {
      return graph;
    }
  }

  /**
   * @param {string} _
   * @param {string} __
   * @param {Callback=} cb
   * @returns {void}
   */
  auth(_, __, cb) {
    if (this.failUserAuth) {
      cb &&
        cb({
          err: "Failed authentication mock."
        });
    } else {
      this.is = {
        pub: Math.random().toString()
      };

      cb &&
        cb({
          err: undefined
        });
    }
  }

  /**
   * @param {string} _
   * @param {string} __
   * @param {Callback=} cb
   * @returns {void}
   */
  create(_, __, cb) {
    if (this.failUserCreation) {
      cb &&
        cb({
          err: "Failed user creation mock."
        });
    } else {
      cb &&
        cb({
          err: undefined
        });
    }
  }

  /**
   * @param {string} key
   * @returns {GUNNode}
   */
  get(key) {
    if (typeof key !== "string") {
      throw new TypeError();
    }

    if (
      typeof this.graph === "boolean" ||
      typeof this.graph === "number" ||
      typeof this.graph === "string" ||
      this.graph === null
    ) {
      throw new Error("Tried to get a subkey of a primitive graph node");
    }

    if (this.graph instanceof MockGun) {
      return this.graph.get(key);
    }

    if (typeof this.graph === "undefined") {
      this.graph = {};
    }

    const subGraph = this.graph[key];

    if (subGraph instanceof MockGun) {
      return subGraph;
    } else {
      // accessing a non existing key must belong to leaf behaviour
      this.nodeType = "leaf";

      const isRoot = typeof this.key === "undefined";
      const isUserGraph = typeof this.is !== "undefined";

      const newNode = new MockGun({
        initialData: subGraph,
        isChildOfRoot: isRoot && !isUserGraph,
        key
      });

      newNode.on(this._subNodeOn);

      this.graph[key] = newNode;

      return newNode;
    }
  }

  leave() {
    this.is = undefined;
  }

  /**
   * @returns {GUNNode}
   */
  map() {
    if (typeof this.key === "undefined") {
      throw new Error();
    }

    if (this.nodeType === "leaf") {
      console.warn(
        "Tried to call map() on a node already determined to be used as a leaf node. Ignore this warning if using this node as a map"
      );
    }

    if (this.graph instanceof MockGun) {
      return this.graph.map();
    }

    if (isObject(this.graph) || typeof this.graph === "undefined") {
      this.nodeType = "set";

      const surrogate = {
        /** @type {GUNNode['on']} */
        on: cb => {
          if (typeof this.graph !== "undefined") {
            this._graphToSetListener(cb);
          }

          this.setListeners.push(cb);
        }
      };

      // we ignore the typings, let other code fail/crash if it tries to access
      // missing functions which shouldn't actually been accessed after calling
      // map() on a node.
      // @ts-ignore
      return surrogate;
    } else {
      throw new Error();
    }
  }

  /**
   * @returns {void}
   */
  off() {
    if (typeof this.key === "undefined") {
      throw new Error();
    }

    this.listeners.splice(0, this.listeners.length);
  }

  /**
   * @param {Listener} cb
   * @returns {void}
   */
  on(cb) {
    if (typeof this.key === "undefined") {
      throw new Error();
    }

    this._graphToRegularListenerIfGraphExists(cb);

    this.listeners.push(cb);
  }

  /**
   * @param {Listener=} cb
   * @returns {GUNNode}
   */
  once(cb) {
    if (typeof this.key === "undefined") {
      throw new Error();
    }

    if (cb) {
      if (typeof this.graph === "undefined") {
        cb(undefined, this.key);

        // @ts-ignore
        return {};
      }

      this._graphToRegularListenerIfGraphExists(cb);

      // @ts-ignore
      return {};
    } else {
      if (this.graph instanceof MockGun) {
        return this.graph.once();
      }

      if (this.nodeType === "leaf") {
        console.warn(
          "Tried to call once() without a cb on a leaf node, calling once() without a cb is most commonly used on set nodes. Ignore this warning if using this node as a map."
        );
      }

      // this behaviour conforms to this node being used as a set
      this.nodeType === "set";

      // we ignore the typings, let other code fail/crash if it tries to access
      // missing functions which shouldn't actually been accessed when using the
      // return value of once() without a callback on our app
      // @ts-ignore
      return {
        // @ts-ignore
        map: () => {
          return {
            // once().map().once(cb) gets the items list once, gets each of
            // those items only once (not added ones).
            once: cb => {
              if (typeof this.graph === "undefined") {
                return;
              }

              if (cb) {
                this._graphToSetListener(cb);
              } else {
                throw new ReferenceError(
                  "A callback should be provided when calling once().map().once()"
                );
              }
            }
          };
        }
      };
    }
  }

  /**
   * @param {ValidDataValue|MockGun} newData
   * @param {(Callback|undefined)=} cb
   * @returns {void}
   */
  put(newData, cb) {
    // TODO; Data saved to the root level of the graph must be a node (an
    // object), not a string of "{ a: 4 }"!
    const isRootNode = typeof this.key === "undefined";
    if (isRootNode) {
      throw new Error("Tried to put to root node");
    }

    if (this.nodeType === "set") {
      throw new Error("Tried to put to a set node");
    }

    const isUserNode = typeof this.is !== "undefined";
    const isChildOfRoot = this.isChildOfRoot;

    if (newData instanceof MockGun) {
      if (!isUserNode && isChildOfRoot) {
        throw new Error(`Error: Invalid graph!`);
      }

      const edge = newData;

      if (this.nodeType === "leaf") {
        throw new Error("Tried to edge put to a leaf node");
      }

      if (this.graph === edge) {
        throw new Error("Trying to put same edge on a node");
      }

      this.graph = edge;
      this.nodeType = "edge";

      // We keep track of the edge being assigned to this node. If in the future
      // this assignment is nulled out or switched for another edge we don't
      // listen to it anymore. We don't call off() on the edge as that would
      // remove all listeners including those set from elsewhere
      edge.on(data => {
        if (edge === this.graph) {
          this._subNodeOn(data);
        }
      });

      cb && cb({ err: undefined });

      return;
    }

    if (this.nodeType === "edge") {
      if (newData !== null) {
        throw new Error("Tried to put a primitive or object to an edge node");
      }

      this.graph = null;

      this._notifyListeners();
    }

    if (!isValidGunData(newData)) {
      throw new TypeError();
    }

    // TODO: coallesce sub-graph puts/ roll backs

    if (isObject(newData)) {
      const data = /** @type {Data} */ (newData);
      const numPuts = Object.keys(data).length;

      if (!isObject(this.graph)) {
        this.graph = {};
      }

      const graph = /** @type {ObjectGraph} */ (this.graph);

      /** @type {string|undefined} */
      let err;
      let completedSubPuts = 0;

      if (Object.keys(data).length === 0) {
        throw new Error();
      }

      this.nodeType = "leaf";

      for (const [k, subData] of Object.entries(data)) {
        const subGraph = graph[k];

        if (isGunNode(subGraph)) {
          subGraph.put(subData, ack => {
            if (ack.err) {
              console.error(ack);
            }

            completedSubPuts++;
            if (completedSubPuts === numPuts) {
              // Warning: gun behaviour is to call listeners before the callback
              this._notifyListeners();
              cb && cb({ err });
            }
          });
        } else {
          if (isObject(subData)) {
            const subNode = new MockGun({
              initialData: subData,
              key: k
            });

            subNode.on(this._subNodeOn);

            graph[k] = subNode;
          } else {
            graph[k] = subData;
          }

          completedSubPuts++;

          if (completedSubPuts === numPuts) {
            // Warning: gun behaviour is to call listeners before the callback
            this._notifyListeners();
            cb && cb({ err });
          }
        }
      }
    } else {
      if (!isUserNode && isChildOfRoot) {
        throw new Error(
          `Data saved to the root level of the graph must be a node (an object), not a ${typeof newData} of "${newData}"!`
        );
      }

      this.graph = newData;
      // we might be seeing a null being put to a node intended to be used as an
      // edge, which can accept null too.
      if (newData !== null) {
        this.nodeType = "leaf";
      }
      // Warning: gun behaviour is to call listeners before the callback
      this._notifyListeners();
      cb && cb({ err: undefined });
    }
  }

  /**
   * @param {ValidDataValue|MockGun} newItem
   * @param {Callback=} cb
   * @returns {GUNNode}
   */
  set(newItem, cb) {
    if (typeof this.key === "undefined") {
      throw new Error();
    }

    if (!isValidGunData(newItem)) {
      throw new TypeError();
    }

    if (typeof this.graph === "undefined") {
      this.graph = {};
    }

    const graph = this.graph;

    if (graph instanceof MockGun) {
      return graph.set(newItem, cb);
    }

    if (this.nodeType === "leaf") {
      console.warn(
        "Tried to call set on a node already determined to be used as a leaf node"
      );
    }

    if (graphIsObject(graph)) {
      const key =
        newItem instanceof MockGun
          ? /** @type {string} */ (newItem.key)
          : Math.random().toString();

      const newSubNode = new MockGun({
        initialData: newItem instanceof MockGun ? undefined : newItem,
        key
      });

      if (newItem instanceof MockGun) {
        newSubNode.put(newItem, ack => {
          if (ack.err) {
            console.warn(ack.err);
          }
        });
      }

      graph[key] = newSubNode;

      this.nodeType = "set";

      // Warning: gun behaviour is to call listeners before the callback
      newSubNode.on(this._subNodeOn);
      // allow for the return value to be defined before calling the callback
      // as per gun behaviour
      setImmediate(() => {
        cb && cb({ err: undefined });
      });

      return newSubNode;
    } else {
      console.warn("Tried to call set() on a primitive-graph node");
    }
  }

  /**
   * @returns {UserGUNNode}
   */
  user() {
    return this;
  }
}

/**
 * @param {Options=} opts (Optional)
 * @returns {UserGUNNode}
 */
export const createMockGun = (opts = {}) => new MockGun(opts);
