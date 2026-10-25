/**
 * WebAssembly Loader for C++ Transformation Engine
 */
let wasmModuleInstance = null;
let loadPromise = null;

export async function loadWasmEngine() {
  if (wasmModuleInstance) return wasmModuleInstance;
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // Check if script already loaded
    if (typeof window.createTransformationEngine === 'function') {
      window.createTransformationEngine({
        locateFile: (file) => `/wasm/${file}`
      }).then(mod => {
        wasmModuleInstance = mod;
        resolve(mod);
      }).catch(reject);
      return;
    }

    const script = document.createElement('script');
    script.src = '/wasm/transformation_engine.js';
    script.async = true;

    script.onload = () => {
      if (typeof window.createTransformationEngine === 'function') {
        window.createTransformationEngine({
          locateFile: (file) => `/wasm/${file}`
        }).then(mod => {
          wasmModuleInstance = mod;
          resolve(mod);
        }).catch(reject);
      } else {
        reject(new Error("createTransformationEngine not found on window"));
      }
    };

    script.onerror = (err) => {
      reject(new Error("Failed to load /wasm/transformation_engine.js: " + err));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

export function getWasmModule() {
  return wasmModuleInstance;
}
