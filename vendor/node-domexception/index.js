// The deprecated `node-domexception` polyfill existed for Node < 17.
// Every supported Node (>= 22) ships a native DOMException, so re-export it.
export default globalThis.DOMException;
