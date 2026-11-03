# Location updates and nearby discovery

The API stores one exact point per sharing vendor. It accepts timezone-aware fixes at most 90 seconds old, at most 30 seconds into the future and at most 100 metres in reported accuracy. Coordinate and accuracy fields reject nonfinite numbers. Duplicate and older timestamps return `LOCATION_OUT_OF_ORDER`. Every update rechecks the active account, staff approval, availability and sharing consent while holding the same locks as offline/suspension.

Public discovery uses a stable 0.01-degree grid, approximately a one-kilometre region in the development area. Both the search origin and vendor position use this grid for membership, ordering and distance bands. This prevents repeated small changes to origin or radius from exposing a hidden exact-distance cutoff. Results can include a vendor whose actual GPS is outside a small requested radius because the radius applies to the coarse region. The applications must label the result as approximate.

The query first uses the exact-point GiST index with a 1,000-metre padding, then applies the coarse distance predicate. That padding exceeds the displacement between a point and its grid centre, so it does not remove a result that the coarse predicate would accept. [PostGIS documents metre-based geography distance and index-assisted `ST_DWithin`](https://postgis.net/docs/ST_DWithin.html); [grid snapping](https://postgis.net/docs/ST_SnapToGrid.html) defines the public regions. A synthetic 4,097-point planner test selected the `ix_vendor_position` bitmap index without disabling sequential scans.

Discovery requires a customer account and filters active accounts, approved profiles, sharing, availability, accurate fresh fixes and active categories in PostgreSQL. Pages use distance then vendor ID for stable ties. Cursors expire in five minutes and are signed and bound to the acting account and original search fields. A changed query needs a new first page. The current abuse limits permit 60 searches and ten distinct coarse origins per account per 15-minute bucket. The abuse keys are hashed; they do not store a coordinate history.

Production needs an owner-approved GeoJSON Polygon or MultiPolygon in `SERVICE_AREA_GEOJSON`. JSON format and finite numbers are checked in settings; PostGIS checks validity before containment. Missing or invalid configuration returns a service error. The development rectangle remains latitude 13.00–13.20, longitude 80.15–80.35.

## Run a synthetic route

Create a vendor, its profile and a staff-approved verification first. Then run from the project root:

```powershell
.\.venv\Scripts\python.exe backend/scripts/simulate_gps.py --email vendor@example.com --share --steps 4 --interval 5
```

Replace the example address with the synthetic vendor you created. The script asks for its password, sends the Chennai fixture route through protected HTTP routes and stops sharing in `finally`, including after an HTTP failure or interruption. It warns when the server cannot confirm cleanup. Routes are bounded to eight minutes so they fit the access-token lifetime. This simulator exercises API logic; it does not prove a phone's GPS, background delivery or real-world arrival accuracy.

For debugging, distinguish `LOCATION_SHARING_DISABLED`, `VENDOR_NOT_VERIFIED`, invalid/stale fixes, service-area errors and cursor errors. Inspect `/vendors/me` before sending another fix. Avoid saving access tokens or real precise points in shell history or shared logs. Exact customer tracking is added with visit authorization; discovery never supplies it.
