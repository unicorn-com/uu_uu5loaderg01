/* eslint-disable uu5/import-order */
import "./systemjs-fixes/system.js";
import "./systemjs-plugins/amd.js";
import "systemjs/dist/extras/named-register.js";
import "./systemjs-plugins/meta-deps.js";
import Config from "./config/config.js";
import initUuAppUsingLibraryRegistry from "./features/init-uuapp-using-library-registry.js";
import convertResolvedDependencyMap from "./features/convert-resolved-dependency-map.js";

const KNOWN_EVENTS = new Set(["initUuAppCompleted"]);

let envGlobal = typeof self !== "undefined" ? self : global;
let SystemJS = envGlobal.System;
let cfg = (SystemJS._config = {});
let preferNonminifiedUrls;

function _getUu5Environment() {
  return envGlobal.uu5Environment || (envGlobal.UU5 || {}).Environment || {};
}

function config(opts) {
  if (!opts || typeof opts !== "object" || Object.keys(opts).length === 0) {
    return JSON.parse(JSON.stringify(cfg));
  }

  if (opts.resolvedDependencyMap) {
    // eslint-disable-next-line no-use-before-define
    opts = convertResolvedDependencyMap(opts.resolvedDependencyMap, cfg, Uu5Loader, _getUu5Environment(), {
      preferNonminifiedUrls,
    });
  }

  // don't allow overwriting of "uu5loaderg01" import URL (SystemJS uses global variable, i.e.
  // it's not possible to have 2 uu5loaderg01 loaders)
  if (opts.imports && opts.imports["uu5loaderg01"] && cfg.imports && cfg.imports["uu5loaderg01"]) {
    let { uu5loaderg01, ...restImports } = opts.imports;
    opts = { ...opts, imports: restImports };
  }

  let { dependencyMap, ...systemJsOpts } = opts;

  // update imports if they contain relative paths without "./" prefix (SystemJS resolves value "foo/bar.js"
  // as "bar.js" in package "foo" whereas we need to resolve it as relative path against document.baseURI
  // for backward compatibility with legacy SystemJS 0.19.47)
  if (systemJsOpts.imports && typeof systemJsOpts.imports === "object") {
    let updatedImports;
    for (let k in systemJsOpts.imports) {
      let value = systemJsOpts.imports[k];
      if (typeof value === "string" && value.match(/^(?![a-z\-_]+:|\.\.?\/|\/)/)) {
        if (!updatedImports) updatedImports = {};
        updatedImports[k] = "./" + value;
      }
    }
    if (updatedImports) systemJsOpts.imports = Object.assign({}, systemJsOpts.imports, updatedImports);
  }

  let scriptEl = document.createElement("script");
  scriptEl.type = "systemjs-importmap";
  document.head.appendChild(scriptEl);
  scriptEl.innerHTML = JSON.stringify(systemJsOpts);

  for (let k in opts) cfg[k] = Object.assign(cfg[k] || {}, opts[k]);
  SystemJS.prepareImport(true).finally(() => {
    if (opts.meta) {
      for (let k in opts.meta) {
        if (cfg.meta && cfg.meta[k] === opts.meta[k]) {
          // eslint-disable-next-line no-use-before-define
          let resolved = Uu5Loader.resolve(k);
          if (resolved) {
            cfg.meta[resolved] = cfg.meta[k];
            delete cfg.meta[k];
          }
        }
      }
    }
    scriptEl.parentNode.removeChild(scriptEl);

    // process dependencyMap (it needs to have keys that are resolved to absolute URLs)
    if (dependencyMap && Object.keys(dependencyMap).length > 0) {
      let depcache = {};
      for (let k in dependencyMap) {
        // eslint-disable-next-line no-use-before-define
        depcache[Uu5Loader.resolve(k) || k] = dependencyMap[k];
      }

      let scriptEl = document.createElement("script");
      scriptEl.type = "systemjs-importmap";
      document.head.appendChild(scriptEl);
      scriptEl.innerHTML = JSON.stringify({ depcache }); // "depcache" is correct for SystemJS 6.x, not depCache (as was in 0.x)

      SystemJS.prepareImport(true).finally(() => {
        scriptEl.parentNode.removeChild(scriptEl);
      });
    }
  });

  return JSON.parse(JSON.stringify(cfg));
}

let globalDefine = envGlobal.define;
if (process.env.NODE_ENV !== "test") delete envGlobal.define;

let initUuAppPromise;

const Uu5Loader = {
  _listenerMap: {},

  initUuAppResultState: undefined, // undefined | "success" | "fallback"
  import: (name, parentUri) => {
    // if running in a test, handle Uu5Loader.import("xyz") as if require("xyz") was used
    // (keeping it async, i.e. returning Promise)
    if (process.env.NODE_ENV === "test" && !/^https?:\/\//.test(name)) {
      let imports = Uu5Loader.config().imports;
      if (!imports || !imports[name]) {
        Uu5Loader.config({ imports: { [name]: "app:" + name + ".js" } });
        let exports;
        try {
          // TODO Suppress the build warning due to calling "require" with non-static value somehow.
          // eslint-disable-next-line no-undef
          exports = (typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : require)(name);
        } catch (e) {
          if (e?.code !== "MODULE_NOT_FOUND") throw e;
        } finally {
          SystemJS.set("app:" + name + ".js", { __useDefault: true, default: exports });
        }
      }
    }
    // have window.define be not available until 1st .import() gets called - this will ensure that demo pages
    // containing following scripts work:
    //   <script uu5loaderg01.js />
    //   <script example-config.js />         <--- this needs to be executed synchronously, even with UMD header
    //   <script demo-middleware-config.js />
    //   <script type="text/babel">import ... from ...; ...</script>
    // (note that systemjs@0.19.47 defined window.define only while import() was running)
    if (process.env.NODE_ENV !== "test" && globalDefine !== undefined && !("define" in envGlobal)) {
      envGlobal.define = globalDefine;
      globalDefine = undefined;
    }
    initUuAppPromise ??= Promise.resolve();
    return initUuAppPromise.then(() => SystemJS.import(name, parentUri)).then(postProcessExports);
  },
  config,
  resolve: (name, parentUri) => {
    try {
      let result = SystemJS.resolve(name, parentUri);
      // there is weird case where SystemJS returns the name as-is if it cannot resolve it but there exists
      // SystemJS.registerRegistry[name]
      if (result === name && name && name.indexOf(":") === -1) result = null;
      return result;
    } catch (e) {
      return null;
    }
  },
  get: (name, parentUri) => {
    let exports = SystemJS.get(Uu5Loader.resolve(name, parentUri) || name);
    if (process.env.NODE_ENV === "test" && exports == null && !/^https?:\/\//.test(name)) {
      try {
        // eslint-disable-next-line no-undef
        exports = (typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : require)(name);
      } catch (e) {
        if (e?.code !== "MODULE_NOT_FOUND") throw e;
      }
    }
    return postProcessExports(exports);
  },
  refreshCache: () => {
    let reloadPromises = [];
    let config = Uu5Loader.config();
    let urlSet = new Set(Object.values(config.imports));
    urlSet.add(Config.uri); // add Uu5Loader's own URI too
    for (let url of urlSet) {
      if (/^(https?:|\.\/|\/)/.test(url)) {
        reloadPromises.push(
          fetch(url, { cache: "reload" })
            .then((response) => response.blob())
            .catch((e) => null),
        );
      }
    }
    return Promise.all(reloadPromises);
  },
  initUuApp: (directDependencyMap, bundledConfig, bundledConfigExplicit) => {
    if (initUuAppPromise) {
      throw new Error(
        "Uu5Loader.initUuApp(...) has been already called, or an Uu5Loader.import(...) has been already called. UuApp initialization can be called only once and it must be before any other import.",
      );
    }
    const doFallbackConfig = () => {
      Uu5Loader.config(bundledConfig);
      Uu5Loader.config(bundledConfigExplicit);
    };
    let uu5Environment = _getUu5Environment();
    if (
      // TODO In future when most uuApps use devkit 6.x, change behaviour for uu5loaderg01_initUuAppDisabled,
      // i.e. when undefined then use dependency/load (currently we consider it as true, i.e. not using dependency/load).
      uu5Environment.uu5loaderg01_initUuAppDisabled === false &&
      uu5Environment.uu5g05_libraryLoadDisabled !== true &&
      uu5Environment.useLibraryRegistry !== false
    ) {
      // when developing locally, bundledConfig will contain non-minified URLs, and we want to use non-minified URLs
      // in such case even for libraries received from uuAppLibraryRegistry
      // NOTE There's especially case where react-dom is being loaded from locally-provided
      // node_modules/react-dom/ due to hot-reload functionality, and combining this non-minified locally-provided react-dom
      // with react.min.js from uuAppLibraryRegistry would cause neverending JS loop due to something in react library. uuApp
      // would be stuck at loading indication if that combination happens.
      let urls = Object.values(bundledConfig?.imports || {});
      preferNonminifiedUrls = urls.filter((it) => it.endsWith(".min.js")).length * 2 < urls.length; // prevailing URLs use non-minified URLs
      initUuAppPromise = Promise.resolve()
        .then(() =>
          initUuAppUsingLibraryRegistry(directDependencyMap, uu5Environment, Uu5Loader, preferNonminifiedUrls),
        )
        .then(
          (config) => {
            Uu5Loader.initUuAppResultState = "success";
            Uu5Loader.config(config);
            Uu5Loader.config(bundledConfigExplicit);
            Uu5Loader._triggerEvent("initUuAppCompleted");
          },
          (error) => {
            console.error(error);
            Uu5Loader.initUuAppResultState = "fallback";
            doFallbackConfig();
            Uu5Loader._triggerEvent("initUuAppCompleted");
          },
        );
    } else {
      initUuAppPromise = Promise.resolve();
      Uu5Loader.initUuAppResultState = "fallback";
      doFallbackConfig();
      Uu5Loader._triggerEvent("initUuAppCompleted");
    }
    return initUuAppPromise;
  },
  addEventListener(event, listener) {
    if (!KNOWN_EVENTS.has(event)) {
      throw new Error(`Uu5Loader event '${event}' is not supported. Supported events: ${[...KNOWN_EVENTS].join(", ")}`);
    }
    Uu5Loader._listenerMap[event] ??= new Set();
    Uu5Loader._listenerMap[event].add(listener);
    return () => Uu5Loader.removeEventListener(event, listener);
  },
  removeEventListener(event, listener) {
    let listenerSet = Uu5Loader._listenerMap[event];
    if (listenerSet) {
      listenerSet.delete(listener);
      if (listenerSet.size === 0) delete Uu5Loader._listenerMap[event];
    }
  },
  _triggerEvent(type, data) {
    let listeners = Uu5Loader._listenerMap[type];
    if (listeners) {
      let event = { type, data };
      for (let listener of listeners) {
        listener(event);
      }
    }
  },
};

function postProcessExports(exports) {
  // SystemJS 6.10.3 processes __useDefault flag only when passing exports as dependencies,
  // we want it consistently (i.e. same as it was in SystemJS 0.19.47), i.e. post-process
  // .import() and .get() calls too to respect that flag
  return exports && exports.__useDefault ? exports.default : exports;
}

export { Uu5Loader, SystemJS };
export default Uu5Loader;
