/**
 * File download helpers.
 */

/**
 * PUBLIC_INTERFACE
 * Download a JS object as a pretty-printed JSON file.
 * @param {Object} params
 * @param {any} params.data
 * @param {string} params.filename
 */
export function downloadJson({ data, filename }) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

