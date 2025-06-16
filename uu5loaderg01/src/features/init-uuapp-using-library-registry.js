import Config from "../config/config.js";
import convertResolvedDependencyMap from "./convert-resolved-dependency-map.js";

function initUuAppUsingLibraryRegistry(directDependencyMap, uu5Environment, Uu5Loader, preferNonminifiedUrls = false) {
  let libRegBaseUri =
    uu5Environment.uu5g05_libraryRegistryBaseUri ||
    (uu5Environment.COMPONENT_REGISTRY_URL || "").replace(/library\/load.*/, "") ||
    "https://uuapp.plus4u.net/uu-applibraryregistry-maing01/fe96c133c895434bbd4d5b24831483f3";
  let cdnBaseUri = uu5Environment.cdnBaseUri;
  if (cdnBaseUri && !cdnBaseUri.endsWith("/")) cdnBaseUri += "/";
  let dependencyLoadUri = libRegBaseUri.replace(/\/*$/, "/") + "dependency/load";
  let resolveDependenciesPromise =
    !directDependencyMap || Object.keys(directDependencyMap).length === 0
      ? Promise.resolve()
      : fetch(dependencyLoadUri, {
          method: "post",
          body: JSON.stringify({ dependencyMap: directDependencyMap }),
          headers: { "Content-Type": "application/json", Accept: "application/json" },
        }).then((response) =>
          response.ok ? response.json() : Promise.reject(new Error("Failed to resolve uuApp dependencies.")),
        );
  return resolveDependenciesPromise.then((data) => {
    let { resolvedDependencyMap = {}, uuAppErrorMap } = data || {};
    if (uuAppErrorMap && Object.keys(uuAppErrorMap).length > 0) {
      console.warn(
        "Resolving uuApp dependencies ended with warnings:",
        uuAppErrorMap,
        "\nResolution result:",
        resolvedDependencyMap,
      );
    }

    let modifiedResolvedDependencyMap = {};
    for (let [name, slotList] of Object.entries(resolvedDependencyMap)) {
      // order slotList so that 1st processed slot is the one that uuApp wants
      // (i.e. if uuApp wants uu5tilesg02@1.x and result contains more versions such as 1.2.3 and 2.0.1,
      // the final configuration must contain "uu5tilesg02" mapped into uu5tilesg02/1.2.3/... URL; and others
      // are the ones that will have version in their keys, like "uu5tilesg02@2.0.1": .../uu5tilesg02/2.0.1/...)
      let orderedSlotList = slotList;
      let versionSpecifier = directDependencyMap[name];
      if (Array.isArray(versionSpecifier)) versionSpecifier = versionSpecifier[0];
      if (directDependencyMap[name]) {
        let matchedSlotIndex = _findIndexByVersionSpecifier(slotList, versionSpecifier, name);
        if (matchedSlotIndex > 0) {
          orderedSlotList = [...slotList];
          orderedSlotList.splice(matchedSlotIndex, 1);
          orderedSlotList.unshift(slotList[matchedSlotIndex]);
        }
      }
      modifiedResolvedDependencyMap[name] = orderedSlotList;
    }

    let config = convertResolvedDependencyMap(
      modifiedResolvedDependencyMap,
      Uu5Loader.config(),
      Uu5Loader,
      uu5Environment,
      {
        preferNonminifiedUrls,
      },
    );

    // if uuApp is using uu5loaderg01 and the version we got is newer than our own, force our own refresh
    // bypassing HTTP-cache (we have likely been linked into HTML using .../uu5loaderg01/1.0.0/uu5loader.min.js
    // which now has older version in HTTP cache)
    if (config.imports["uu5loaderg01"] && directDependencyMap["uu5loaderg01"]) {
      let slotList = resolvedDependencyMap["uu5loaderg01"];
      let slotIndex = _findIndexByVersionSpecifier(slotList, directDependencyMap["uu5loaderg01"], "uu5loaderg01");
      if (slotIndex > -1) {
        let availableVersion = slotList[slotIndex].version;
        // TODO Use import.meta.url when devkit is fixed (it currently contains exact version in URL instead of real).
        if (availableVersion !== process.env.VERSION && /^https?:/.test(Config.uri)) {
          fetch(Config.uri, { cache: "reload" });
        }
      }
    }

    return config;
  });
}

function _findIndexByVersionSpecifier(slotList, versionSpecifier, name) {
  if (slotList.length === 1) return 0; // dependency/load always returns slot for requested version
  if (slotList.length < 1) return -1; // should never happen (dependency/load always returns slot for requested version)

  let remainingSlotList = slotList;
  let simpleVersionRange = _versionSpecifierToSimpleVersionRange(versionSpecifier); // exact version or <d>.x or <d>.<d>.x
  if (!simpleVersionRange) {
    console.warn(
      `Uu5Loader - uuApp requested unrecognized version specifier '${versionSpecifier}' for '${name}'. Will use version '${slotList[0].version}'.`,
    );
    return 0;
  }
  let copied;
  let i = 0;
  while (i < remainingSlotList.length) {
    let { version, mergedInto } = remainingSlotList[i];
    if (_satisfiesSimpleVersionRange(version, simpleVersionRange)) {
      if (!mergedInto) return i;
      if (!copied) {
        copied = true;
        remainingSlotList = [...remainingSlotList];
      }
      remainingSlotList.splice(i, 1);
      simpleVersionRange = mergedInto;
      i = 0;
      continue;
    }
    i++;
  }
  return -1; // should never happen (dependency/load always returns slot for requested version
}
function _versionSpecifierToSimpleVersionRange(versionSpecifier) {
  // versionSpecifier e.g. 1.2.3, 1.2.3-beta.1, 1.x, 0.1.x, ^1.3.0 (more complex are not supported)
  let match = versionSpecifier.match(/(\d+\.x)$|(\d+\.\d+\.x)$|(\d+\.\d+\.\d+)/);
  if (!match) return;
  let simpleVersionRange = match[1] || match[2] || match[3];
  return simpleVersionRange;
}
function _satisfiesSimpleVersionRange(version, versionRange) {
  if (version === versionRange) return true;
  if (versionRange.endsWith("x")) return version.startsWith(versionRange.slice(0, -1));
  return false;
}

export default initUuAppUsingLibraryRegistry;
