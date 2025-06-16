import { Uu5Loader } from "../uu5-loader.js";

const DND_MAP = {
  "react-dnd@7.0.2": "_reactDnd7",
  "react-dnd-html5-backend@7.0.2": "_reactDnd7Html5Backend",
  "react-dnd-touch-backend@0.7.1": "_reactDnd7TouchBackend",
};

const mappedToUriMap = {};
const originalUriMap = {};
const origConfig = Uu5Loader.config;

function toModuleUri(content) {
  let blob = new Blob([content], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}

function replaceInImports(imports) {
  if (!imports) return;

  let newImports;
  for (let k in imports) {
    let [name, version] = k.split("@");
    version ||= imports[k]?.match?.(/\/(\d+\.\d+\.\d+(?:-[^/]*)?)/)?.[1];
    let mapTo = version ? DND_MAP[name + "@" + version] : undefined;
    if (mapTo) {
      if (!newImports) {
        newImports = { ...imports };
      }
      let resultItem = mappedToUriMap[mapTo];
      if (!resultItem) {
        if (!newImports["uu5dndg01"] && !origConfig()?.imports?.["uu5dndg01"]) {
          let cdnBaseUri =
            (window.uu5Environment ? window.uu5Environment.cdnBaseUri : window.UU5?.Environment?.cdnBaseUri) ||
            "https://cdn.plus4u.net/";
          if (cdnBaseUri.charAt(cdnBaseUri.length - 1) !== "/") cdnBaseUri += "/";
          newImports["uu5dndg01"] = cdnBaseUri + "uu-uu5dndg01/1.0.0/uu5dndg01.min.js";
        }
        resultItem = toModuleUri(`define(["uu5dndg01"], function(D){\nreturn D.${mapTo};\n});`);
        mappedToUriMap[mapTo] = resultItem;
      }
      originalUriMap[resultItem] = imports[k];
      newImports[k] = resultItem;
    }
  }
  return newImports;
}

// override external react-dnd* libraries to instead load adapters from uu5dndg01
Uu5Loader.config = (opts) => {
  let updatedImports = replaceInImports(opts?.imports);
  let updatedAdditiveScopes;
  if (opts?.scopes) {
    for (let [baseUri, imports] of Object.entries(opts.scopes)) {
      let newImports = replaceInImports(imports);
      if (newImports) {
        if (!updatedAdditiveScopes) updatedAdditiveScopes = {};
        updatedAdditiveScopes[baseUri] = newImports;
      }
    }
  }
  let finalOpts =
    updatedImports || updatedAdditiveScopes
      ? {
          ...opts,
          imports: updatedImports,
          scopes: { ...opts.scopes, ...updatedAdditiveScopes },
        }
      : opts;
  let result = origConfig(finalOpts);

  // make react-dnd mapping not visible for the outside, i.e. unmap react-dnd URLs from blob:... values back to original
  // (this is e.g. so that uu5g05's LibraryRegistry can compare already-configured URLs properly and figure out versions out of them)
  if (Object.keys(originalUriMap).length > 0) {
    let { imports, scopes, ...rest } = result;
    result = rest;
    if (imports) {
      imports = { ...imports };
      for (let name in imports) imports[name] = originalUriMap[imports[name]] || imports[name];
      result.imports = imports;
    }
    if (scopes) {
      scopes = { ...scopes };
      for (let baseUri in scopes) {
        let imports = scopes[baseUri];
        if (!imports) continue;
        imports = { ...imports };
        for (let name in imports) imports[name] = originalUriMap[imports[name]] || imports[name];
        scopes[baseUri] = imports;
      }
      result.scopes = scopes;
    }
  }
  return result;
};
