---
"@clemsrec/next": minor
---

Harden `collectHandler` and give it a way to actually do something with events.

- A malformed JSON body now returns `400` instead of throwing an unhandled
  exception out of the route handler.
- Added a body size limit (`maxBodyBytes`, 64 KB by default), checked against
  both the declared `content-length` and the real byte length, returning `413`.
- Event payloads are validated against the supported event types, and both the
  `{ event }` envelope sent by the browser SDK and a bare event object are
  accepted.
- New `onEvent` config hook, called once per accepted event, so consumers can
  persist or forward events without cloning and re-parsing the request. A
  throwing handler produces a `500` instead of an unhandled rejection.
- Added test coverage for the handler, which previously had none.
