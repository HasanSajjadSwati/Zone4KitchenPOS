import compression from 'compression';

// Gzip API and app responses for clients that accept it (every browser does). Large JSON
// responses such as reports and order lists shrink about 10x, which shortens the window in
// which a flaky till connection can cut a transfer off. It also changes how a cut-off transfer
// fails: browsers enforce the length of a compressed body, so the till sees a network error it
// can retry instead of being handed truncated JSON ("Invalid JSON response").
// compression is the Express team's middleware, MIT licensed.
export function responseCompression() {
  return compression({ threshold: 1024 });
}
