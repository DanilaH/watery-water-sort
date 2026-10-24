# Public preview signing fixture

`public-test.p12` is an intentionally public, disposable development signing identity. Alias: `water-preview`; store/key password: `android`. It signs only `debug`, with applicationId `com.danilah.waterywatersort.preview3`.

It is not a private production credential and must never sign store releases. Anyone can sign preview packages with it; that is acceptable only for this separately named development app. Release signing remains unconfigured.

A checked-in test identity avoids dependence on runner home/cache paths and preserves the certificate for future preview updates. The old 0.2 ephemeral identity is unavailable; this fixture cannot update `.preview` in place. Keep the two installations separate rather than uninstalling the old app and destroying its progress.
