# Customer maps

Nearby opens in list mode. The user can choose Show map after selecting a meeting point. Map viewing sends the viewed area to the map provider, which the screen explains before opening it. The list remains usable without maps.

The web implementation uses Leaflet and OpenStreetMap tiles, with visible attribution. Vendor circles use the backend's coarse coordinates and uncertainty radius; they do not represent exact positions. Popup business names use `textContent` rather than HTML. Zoom controls have 48-pixel touch areas. The map removes its listeners and tile work when hidden or unmounted.

During an accepted/approaching/arrived visit, the customer can open a separate tracking map. It uses only a fresh, authorized REST location and disappears when the visit becomes terminal, permission is revoked or the point becomes stale. The location cache is cancelled and removed when tracking ends. Public discovery and private tracking remain separate queries.

Native iOS uses the default Apple map provider. Native Android requires a configured Google Maps SDK key. The optional `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` enters the Android build through the `react-native-maps` config plugin. It is public build configuration and must be restricted to the application identifier/signing certificate in the provider console. Without configuration, Android shows a clear unavailable state and keeps the list available. A changed key requires rebuilding the native application.

Current evidence: five browser workflow cases passed in 29.8 seconds with map integration, including removal of the tracking map at visit completion. A separate live-tile case passed in 12.6 seconds and its rendered OpenStreetMap preview was visually inspected. Strict Customer TypeScript and web export passed. This does not verify a native map build or its signing/provider setup.

Implementation follows the [Expo map configuration guide](https://docs.expo.dev/versions/v58.0.0/sdk/map-view/) and [Leaflet reference](https://leafletjs.com/reference).
