// __mocks__/axios.js
// Enhanced manual mock for axios with minimal interceptor pipeline support

const handlers = {
  post: async () => ({ data: {} }),
  get: async () => ({ data: {} }),
  patch: async () => ({ data: {} }),
  delete: async () => ({ data: {} }),
};

const requestInterceptors = [];
const responseInterceptors = [];

function runRequestInterceptors(config) {
  return requestInterceptors.reduce((acc, { onFulfilled }) => {
    return acc.then(onFulfilled);
  }, Promise.resolve(config));
}

function runResponseFulfilledInterceptors(response) {
  return responseInterceptors.reduce((acc, { onFulfilled }) => {
    return acc.then(onFulfilled);
  }, Promise.resolve(response));
}

function runResponseRejectedInterceptors(error) {
  return responseInterceptors.reduce((acc, { onRejected }) => {
    if (!onRejected) return acc;
    return acc.catch(onRejected);
  }, Promise.reject(error));
}

function performRequest(method, url, data, config = {}) {
  const baseConfig = { method, url, data, headers: {}, ...config };
  return runRequestInterceptors(baseConfig)
    .then(finalConfig => handlers[method](finalConfig.url, finalConfig.data, finalConfig))
    .then(res => runResponseFulfilledInterceptors(res))
    .catch(err => {
      if (!err.config) err.config = baseConfig; // mimic axios error shape
      else if (!err.config.url) err.config.url = baseConfig.url; // ensure url present for interceptor logic
      return runResponseRejectedInterceptors(err);
    });
}

function instance(config) {
  // callable form: instance({ method, url, data })
  const method = (config.method || 'get').toLowerCase();
  return performRequest(method, config.url, config.data, config);
}

instance.post = (url, data, config) => performRequest('post', url, data, config);
instance.get = (url, config) => performRequest('get', url, undefined, config);
instance.patch = (url, data, config) => performRequest('patch', url, data, config);
instance.delete = (url, config) => performRequest('delete', url, undefined, config);
instance.interceptors = {
  request: {
    use: (onFulfilled, _onRejected) => {
      requestInterceptors.push({ onFulfilled: onFulfilled || ((c)=>c) });
    },
  },
  response: {
    use: (onFulfilled, onRejected) => {
      responseInterceptors.push({ onFulfilled: onFulfilled || ((r)=>r), onRejected });
    },
  },
};

module.exports = {
  __esModule: true,
  default: {
    create: () => instance,
    post: (...args) => instance.post(...args),
    get: (...args) => instance.get(...args),
    patch: (...args) => instance.patch(...args),
    delete: (...args) => instance.delete(...args),
  },
  __setPostHandler: (fn) => { handlers.post = fn; },
  __setGetHandler: (fn) => { handlers.get = fn; },
  __setPatchHandler: (fn) => { handlers.patch = fn; },
  __setDeleteHandler: (fn) => { handlers.delete = fn; },
  __getInstance: () => instance,
};
