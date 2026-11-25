# Flexmls (FLEX_MLS) Query Notes

Hard-won behavior of this MLS's API, learned by trial and error. Read before writing any
listing or market-stats query, the tool arguments do not all behave the way their
descriptions imply.

## The big one: filter arguments are not reliable

`ListingsMyListings` accepts `status_values`, `property_type_codes`, and `_filter` date
clauses, but **the results come back unfiltered**. Asking for `status_values: ["Active"]`
still returns Closed, Cancelled, and Expired listings mixed in, and listings from agents at
other brokerages. Do not trust these arguments to narrow anything.

**What does work:** `_orderby`. Sorting is applied correctly (verified on `ExpirationDate`
and `-ModificationTimestamp`). So the reliable pattern is:

1. Sort by a meaningful date field.
2. Page through results with `_limit` / `_page`.
3. Read `MlsStatus` and `ListAgentEmail` off each record and filter them yourself.

Slower and more calls, but it produces correct data. Server-side filtering silently does not.

`ListingsListingSearch` returned 0 results for queries that `ListingsMyListings` answered
fine. Prefer `ListingsMyListings`.

## Date field behavior

- `ExpirationDate` is populated **only for Active and Pending** listings. Closed, Expired,
  and Cancelled records omit the field entirely.
- Because of that, you **cannot** find recently expired listings by expiration date. Sort by
  `-ModificationTimestamp` instead, a status change bumps that timestamp.
- Sorting `ExpirationDate` ascending puts all the null (non-active) records first. With
  ~1,100 total listings at `_limit: 25`, real expiration dates don't start appearing until
  around page 34 of 45. Jump ahead rather than paging from page 1.

## Finding listings, two recipes

**Listings expiring soon** (for "renew your listing" agent reminders):
sort `ExpirationDate` ascending, jump to ~page 34, scan forward. Keep records where
`MlsStatus` is `Active` and `ListAgentEmail` ends in `seaglassproperties.com` and the date
falls in your window. Exclude `Pending`, those are under contract and don't need a renewal
nudge.

**Recently expired ("hot sheet")**: sort `-ModificationTimestamp`, scan the first few pages
for `MlsStatus: Expired`.

## Owner / seller contact info does not exist here

There are no owner or seller name/phone/email fields in this MLS.
`SemanticSearchListingMetadata` returns nothing for "owner name" or "contact information".
Only **listing agent** contact info is available. Owner details have to come from the CRM,
BoldTrail, or the transaction file, never from the MLS.

## Market statistics tools

`MarketStatisticsInventory` / `Price` / `DaysOnMarket` / `Absorption` / `Ratio` / `Volume`:

- **Property type code: `A1`.** Plain `A` is rejected as invalid despite being listed in the
  error message's own set of valid codes.
- **Omit `LocationField` / `LocationValue` entirely.** Passing St. Croix (via `City`,
  `MLSAreaMinor`, or `MLSAreaMajor`) returns all-zero or all-null series. Leaving location
  off returns MLS-wide numbers, and this MLS is St. Croix in practice, so MLS-wide is the
  usable figure.
- Data lags by a month: the most recent **complete** month is the newest data point, the
  current month is absent. Compare that month against the one before it.
- `AbsorptionRate` comes back as a bare number (~11-13). Report it as the share of inventory
  selling per month. Do not restate it as "months of supply", the units aren't documented,
  and CLAUDE.md rule 7 forbids asserting what the source doesn't literally support.

## Weekly market digest

Template: `brand/output/weekly-market-digest-example.html` (with rendered `.pdf` / `.png`).

- Data: the four market-statistics tools above, latest complete month vs. prior month.
- Wording is deliberately jargon-free ("Homes for sale right now", "Average time to sell")
  with one plain-language "What This Means" takeaway. Agents use it to open conversations
  with buyers and sellers.
- When a figure swings hard (e.g. median sale price dropping sharply), attribute it to the
  mix of what sold rather than framing it as a market-wide value change, unless the data
  actually supports the stronger claim.
- Render: headless Chromium, `--screenshot` for the PNG and `--print-to-pdf` for the PDF.
  `@page { size: 850px 1100px; margin: 0 }` keeps it to a single page. Pass the file as a
  `file://` URL, a bare path silently loads the browser home page instead.
- Playfair Display loads from the Google Fonts CDN. In a sandbox without network access it
  silently falls back to a system serif, the PDF still renders, just not in brand type.

## Agent closed sales (for the listing presentation's agent stats)

Tested November 2026:

- **Agent fields are not searchable.** `ListAgentEmail`, `BuyerAgentEmail`, `ListAgentName`,
  `BuyerAgentName` and `CoListAgentName` in `_filter` come back as "The specified field is
  not searchable" and the clause is dropped. You cannot ask the MLS for "this agent's sales".
- **`ListingsMyListings` returns the whole Sea Glass office**, about 1,240 records,
  buyer-side sales included, and sorts by `-CloseDate` correctly. Pull it with
  `_orderby: -CloseDate,+ListingId`, `_limit: 25`, and
  `_select: ListingId,UnparsedAddress,MlsStatus,PropertyType,ClosePrice,CloseDate,ListAgentEmail,CoListAgentEmail,BuyerAgentEmail,CoBuyerAgentEmail`,
  page until `CloseDate` is older than the period you are reporting, and filter yourself:
  `MlsStatus` is `Closed` and the agent's email appears in any of the four email fields.
- **Leases look like sales.** `PropertyType` `S`, `T` and `U` records are rentals: `MlsStatus`
  `Closed` with a `ClosePrice` of a month's rent ($875 to $7,500). Always drop them or the
  sales count is inflated. Sales types seen: `A1` residential, `B1` condo, `C1` land.
- **Paging is unstable on ties.** Records sharing a `CloseDate` shift between pages, so some
  get skipped and others repeated. Sort `-CloseDate,+ListingId` to fix the order.
- Every closed record sits on roughly the first 33 pages (back to 2021); after that the
  records have no `CloseDate`. Some prices look like placeholders ($999,999); flag them.
- **Email case is inconsistent** (`Caryn@BlueSkyVI.com`, and the roster has
  `Elizabeth@seaglassproperties.com`). Compare lowercased.
- `ListAgentEmail` alone finds listing-side sales only. Buyer-side sales are in
  `BuyerAgentEmail` / `CoBuyerAgentEmail`.
- Records from before the agent joined Sea Glass under another brokerage email will not
  match. That is correct for a "Sea Glass Properties MLS closed-sale records" source note;
  do not go hunting for them.
