/**
 * Calculates a hash over the provided string value (str).
 * Hash is calculated over utf8-encoded byte-stream of the string.
 * The code is taken from the MDN-example, see:
 * https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
 */

if ("undefined" === typeof(Hash)) {
  var Hash = new function() {

    var hex = function(buffer) {
      const hashArray = Array.from(new Uint8Array(buffer));
      const hashHex = hashArray.map(b => ("00" + b.toString(16)).slice(-2)).join("");
      return hashHex
    };

    var calculateSha256 = function(str) {
      const buffer = new TextEncoder("utf-8").encode(str);
      return crypto.subtle.digest("SHA-256", buffer).then(function (hash) {
        return hex(hash);
      });
    };

    this.calculate = function(str) {
      return calculateSha256(str);
    };
  };
};