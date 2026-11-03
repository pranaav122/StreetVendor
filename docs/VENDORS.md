# Vendor profiles and staff review

Vendor accounts create one business profile, select active English/Tamil categories and submit a short review note. The MVP stores no government documents or public evidence URLs. Staff review the note through authenticated admin routes; a decision records its actor and reason in the same transaction as the changed profile. Self-review is rejected even if the owner later becomes an operator.

Seed the local catalogue after applying migrations:

```powershell
docker compose --env-file .env -f infrastructure/compose.yaml run --rm api alembic upgrade head
docker compose --env-file .env -f infrastructure/compose.yaml run --rm api python -m app.cli seed-categories
```

The seed is safe to repeat and preserves retired categories. Create an operator using [the interactive command](AUTHENTICATION.md#create-an-operator). The administration interface is a later part of the current build; the routes are available through `/docs` now.

Going online requires a verified business, explicit sharing consent and a usable first GPS fix. The API validates the entire input before committing availability and the PostGIS point together. A pending or suspended vendor cannot go online. Going offline removes the exact point and disables both availability and sharing in one transaction. Suspension and account deletion also remove the point; deletion erases the public business name and review note.

Staff can return a suspended business to review with `POST /api/v1/admin/vendors/{vendor_id}/reinstatement` and a reason. It returns to `PENDING`, stays offline and needs a separate approval. Restore a suspended owner account first. Deleted owners are absent from the pending queue, and an inactive target produces a conflict rather than invalidating the staff member's session.

`GET /api/v1/admin/summary` gives staff operational counts. `GET /api/v1/vendors/me/summary` gives the vendor active/pending visits and completed visits today. The explicit pilot-day timezone is `Asia/Kolkata`. These counters describe visits; they record no sales or revenue.

Every sharing write locks the account, then its vendor profile, then location state. This order prevents a waiting online write from bypassing a later offline operation. The database independently enforces that an available profile is verified and sharing. [GeoAlchemy2 Geography](https://github.com/geoalchemy/geoalchemy2/blob/main/doc/types.rst) maps the `geography(Point,4326)` column; its explicitly named GiST index supports the upcoming metre-based discovery query. A location contains longitude first in PostGIS, while JSON uses named latitude/longitude fields.

The local area is the synthetic rectangle latitude 13.00–13.20, longitude 80.15–80.35. This is a test boundary chosen for development. Production requires an approved GeoJSON service area; a missing area disables location operations. Public customer/vendor business routes also require email confirmation in production. Locally bootstrapped operators retain access to staff tools.

For debugging, inspect the safe own-profile response first, then the approval queue and audit rows. Use PostgreSQL to check whether a location row exists without printing its coordinates. Avoid putting real GPS, evidence notes, email addresses or tokens into shared logs. `/health` proves database/PostGIS readiness; migration and business checks establish the rest.
