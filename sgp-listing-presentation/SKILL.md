---
name: sgp-listing-presentation
description: Builds a Sea Glass Properties listing presentation for a seller meeting, as a branded, editable Word document. It covers the agent's own track record, the property, closed-sale comps from Flexmls, a pricing build-up that adds up to the recommended list price, the Sea Glass marketing plan (always including professional, twilight/night and drone photography), and the business terms. Use it whenever a Sea Glass agent wants a listing presentation, listing proposal, listing pitch or "pre-listing package" for a seller or owner, or says "help me win this listing", "I'm meeting the owners of ...", "make a presentation like the Granard one", or wants to revise one with the seller's notes, even if they don't say "listing presentation".
---

# Sea Glass listing presentation

A listing presentation is the document an agent hands the owners at (or before) the listing meeting. It has to do three things: make the owners trust this agent, show them the property the way a buyer will see it, and defend the list price with real closed sales. Everything in it is read by the people whose home it is, so accuracy and tone matter more than length.

The output is an editable `.docx` (owners and agents mark it up in Word with comments), built by `scripts/build_presentation.js` from a JSON spec. The script holds the Sea Glass layout and all the standard copy, so your job is the property-specific content: facts, comps, price build-up and the agent's profile.

`references/example-spec.json` is a complete, approved real example (5 & 6 Granard, Cindy Devlin, November 2026). The sellers loved it. Read it before writing a spec; match its voice and level of detail.

## 1. Gather the inputs

Ask the agent for whatever is missing, in one message, before doing anything else:

- **Presenting agent.** Look them up live in the "Current Agents" tab of the SGP team roster (Google Sheet `1u_78xVR_LzZyNsuH7HAMW0qLPlagTB5kUBi0USFbOIE`, https://docs.google.com/spreadsheets/d/1u_78xVR_LzZyNsuH7HAMW0qLPlagTB5kUBi0USFbOIE/edit) through the Google Sheets connector. Never use a locally saved copy of the roster; it goes stale. Match on the `Name` column (or `First Name` + `Last Name`; trim stray spaces, the headers have them).
  - **Status gate.** Only rows whose `Status` is `Active` or `Manager` are current. A blank `Status` means that person no longer works at Sea Glass: do not use them as the presenting agent, stop, and tell the user the named agent is not on the current roster.
  - **Contact details.** Email from `SGP Email` (write it in lowercase in the spec; the sheet capitalizes some), cell from `Cell`.
  - Sea Glass does not track titles or teams. Leave `team` out of the spec. Leave `title` out too (the script prints `Realtor®`), with one exception: for Sanni Craft, set `"title": "Managing Broker"`.
- **Headshot.** Search the shared SGP agent photo folder (Google Drive folder `14aAbNJcsOpnUytokjwAAg6eOs96Uuiy_`, https://drive.google.com/drive/folders/14aAbNJcsOpnUytokjwAAg6eOs96Uuiy_) through the Google Drive connector, matching the file name to the agent's name (`'14aAbNJcsOpnUytokjwAAg6eOs96Uuiy_' in ancestors and title contains '<last name>'`, then confirm the first name). Download it into your working directory (the connector saves the file to disk, so large originals are fine), crop it to a square around the face (the cover prints it at 84 x 84 and squashes anything else; the Drive originals are tall portraits), and pass the full absolute path as `agent.headshot`. Prefer the newest photos in the folder itself over older ones in subfolders, and if the agent's photos look different from each other, ask the user to confirm which is current. If there is no match, or more than one plausible match, omit `headshot` and say so in your reply. Do not fall back to the old photos bundled in `assets/headshots/`; they are kept only so the example spec still builds.
- **The agent's own stats.** Do not ask the agent for a one-pager. Pull the agent's own closed sales from Flexmls (closed records show the agents on both sides, the same data the social media automations use) and build the stat row and notable-sales table from those records. Read "Agent closed sales" in `references/mls-query-notes.md` first: in a November 2026 test the agent email fields were **not searchable**, and leases come back as closed sales, so you have to pull and filter the records yourself.
  - Count a record when `MlsStatus` is `Closed` and the agent's SGP email (case-insensitive) is in `ListAgentEmail`, `CoListAgentEmail`, `BuyerAgentEmail` or `CoBuyerAgentEmail`. Exclude rentals always: `PropertyType` `S`, `T` and `U` are leases (closed at a month's rent), and so is any record with a rent-sized `ClosePrice`. Flag placeholder-looking prices such as $999,999 for the user to check. Count each `ListingId` once, even when the agent is on both sides.
  - Stats: sales count and total volume (sum of `ClosePrice`), plus listing-side count if it helps. State the period in `statsKicker` (for example, "Joe Caruso, Sea Glass closings since <month year of the first record>"). Do not show a rank: there is no source for one.
  - `notable`: the 3 to 6 highest or most relevant closings for this seller (property, quarter, price). `notableHeading`: "Notable listings sold" if every one is a listing-side sale; "Recent closings" if any buyer-side sale is in the table.
  - `source`: `"Sea Glass Properties MLS closed-sale records, <month year>."`
  - Never estimate or round up a sales count, volume or rank. Every figure must trace to specific closed MLS records you pulled. Keep the list of `ListingId`s behind each figure and give it to the user in your reply so the office can check it. If the agent has no Sea Glass closings yet, leave the stat row and notable table out and write the "Why [first name]" paragraphs from what the agent tells you.
- **Owners' names** exactly as they should be printed.
- **The property:** estate, plot numbers, quarter, beds/baths, sq ft, acres, water relationship, condition, features, recent work, what is included in the sale. Seller notes are gold here: use their specifics (dates of renovations, what's included, quirks) in their own terms.
- **The agent's recommended list price**, and how firm it is.
- Photos of the property, if the agent has them (phone snapshots are fine; say in Preparing for Market that professional photography will replace them, and note anything a photo shows that needs fixing before the shoot, such as an empty pool).
- Anything the agent already has: a CMA, the pricing estimator output, comps they want shown, the seller's notes or concerns.

## 2. Find the comps

Use the Flexmls MLS connector. Read `references/mls-query-notes.md` first. It warns that some tools silently ignore status, type and date filters. In a November 2026 test, `ListingsListingSearch` did honor status, `CloseDate` and custom-field filters (pool: `"General Property Description"."Pool" Eq 'Yes'`; water view: the custom `View` group, e.g. Ocean, Sea, Buck Island). Either way, check every result yourself: confirm it is closed, in the date range, and **on St. Croix** (the search returns St. Thomas sales too unless you filter on the area, e.g. `MLSAreaMinor`). Drop multi-unit properties and non-arm's-length sales unless they are the point.

- **Closed sales only**, never list prices, and say so in the document. Prefer the last 12–24 months; go older only when the market is thin, and show the sold date so the owners can see it.
- **Compare like with like.** St. Croix is small, so comps are usually island-wide. Pick the attributes that drive this property's value (water relationship, pool, size band, land vs. home) and say in the Market Overview why you chose that set.
- **Split unusual properties.** If the property is really two things (a house plus a separate buildable lot, a main house plus rental units), price each part against its own comp set and add them, as Granard did. A single blended comp set gives a misleading number.
- A plain single-home property needs one comp table; use separate tables only when the property has separate parts. Include a `Sold` (month year) column whenever comps span more than a few months.
- Aim for 5–10 comps per table. Add a short note row under a comp when the owners need to know why it matters ("Closest in size to the main house"). Write notes for the owners, not for an appraiser.
- Record MLS number, estate, quarter, the key size fields, sold month and sold price. Format money with `$` and commas, acreage with a leading decimal (`.72`), and sq ft with commas.

## 3. Build the price

The Pricing Recommendation is a table of lines that add up to the recommended price, each with a one-sentence reason tied to the comps (for example, "2,366 sq ft at $429 per sq ft, the median for recent water-view homes with pools"). End with a subtotal of supported value, then the recommended list price and why it is rounded where it is.

**If the comps and the agent's price disagree by more than about 5% in either direction, tell the agent before building the document.** Show them what the comps support and the gap, and let them decide.
- Comps support *less*: do not stretch the arithmetic to reach the number. A list price the owners can't defend to buyers costs them months on market, and an inflated build-up in Sea Glass's name is worse than an honest conversation now.
- Comps support *more*: underpricing costs the owners money, so the agent needs to see it. If they still want the lower price (a fast sale, a pricing strategy), the build-up should show the supported value honestly and then explain the list price in the agent's own reason. Don't invent that reason; ask, or leave a clearly marked placeholder and flag it in your reply.

If you can't reach the agent to ask (for example, they asked for the finished document in one go), build it, and put the price question at the top of your reply.

## 4. Write the spec

Copy the shape of `references/example-spec.json`. Fields:

| Field | What goes in it |
|---|---|
| `output` | File name: `<Property> - Listing Presentation - Prepared by <Agent> of Sea Glass Properties <Mon D, YYYY>.docx` |
| `date` | Shown on the cover, e.g. `November 2, 2026`, or `Updated November 9, 2026` for a revision |
| `preparedFor` | Owners' names |
| `agent` | `name`, `email`, `cell`, `headshot` (absolute path to the photo downloaded from the Drive folder, or omit) |
| `property` | `title` (e.g. `5 & 6 Granard`), `locality` (bay or area, quarter, `St. Croix`), optional `coverPhoto` (absolute path to the strongest view, cropped to about 2:1 so the cover stays one page) |
| `agentProfile` | `statsKicker`, `stats` (value + label), `paragraphs`, `notableHeading`, `notable` (property, quarter, price rows), `source` (`Sea Glass Properties MLS closed-sale records, <month year>.`) |
| `propertySection` | `intro`, optional `photos` (list of `{ "file": absolute path, "caption": "..." }`; the first runs full width, so lead with the strongest view, and the rest sit in pairs), `groups` (heading + bullets or paragraphs), `footnote` for anything still to be confirmed |
| `market` | `intro`, `tables` (heading, intro, columns with relative `weight`, rows; `{ "note": "..." }` and `{ "group": "..." }` rows are allowed) |
| `pricing` | `price`, `coverNote`, `intro`, `buildUp` (label, detail, amount, `style`: line/subtotal/total), `after` paragraphs, optional `closing` |
| `value` | `bullets` (strengths the comps don't capture), `buyerBullets` (opportunities a buyer may consider) |
| `preparingForMarket` | Optional. Groups for repairs, staging, showings logistics, photography timing |
| `marketingExtras` | Optional `marketing` / `events` bullets added to the standard plan, e.g. a property-specific video idea |
| `stampTax` | The stamp tax paragraph (see below) |
| `overrides` | Rarely needed: replace a standard block (`whySeaGlass`, `marketing`, `events`, `globalIntro`, `globalSites`, `compensation`, `companyStats`, `office`, `disclaimer`) |

The standard blocks already include Sea Glass's 2025 St. Croix results, the full marketing plan (professional photography with twilight and night images, drone photo and video, Giraffe, Houses Magazine, the property website and QR brochure, the e-blast, showings), global reach, compensation, office details and the disclaimer. Leave them alone unless the agent asks for a change.

**Stamp tax:** Sea Glass's own material states that for homes between $1M and $5M the stamp tax is 3%. For any other price band, ask the agent for the current rate rather than guessing, or leave the paragraph out (omit `stampTax`).

## 5. Voice and rules

These are Sea Glass brand rules and fair housing rules. The build script refuses a spec containing an em dash or an exclamation point, so fix those in the spec.

- First person from the agent to the owners ("I recommend", "your property"). Confident and plain. State facts and let the property carry the emotion. No hype adjectives, no taglines, no emoji.
- **Fair housing:** describe the property, never the buyer. No "perfect for families", "ideal for retirees", "great for a young couple", or any reference to who should live there. Describe uses ("room for a guest villa", "a guest cottage that could be a short-term rental, subject to local rules"), not people.
- Every number is sourced: comps from the MLS, agent stats from the agent's own closed MLS records, company stats from the standard block. Seller claims (a "zero electric bill") are fine in the seller's own presentation, but list them for the agent to back up.
- Facts taken from old MLS listings (acreage, frontage, zoning, bedroom counts) go in the property footnote as "to be confirmed against the deeds and survey". Where the seller and an old listing disagree, ask the agent which to print.

## 6. Build and check

```bash
node scripts/build_presentation.js spec.json
```

If `require('docx')` fails, run `npm install docx` in the scripts folder first. The script resolves the logos and headshots from this skill's `assets/` folder.

Then check the document. Convert it to PDF if you can (`soffice --headless --convert-to pdf`, or on Windows, Word through PowerShell: `New-Object -ComObject Word.Application`, open the file, `SaveAs` with format 17) and look at every page. Headings and lead-in sentences are already kept with what follows them, so problems are rare; if a table still splits awkwardly, trim the copy above it rather than adding blank lines. If you can't render, say so in your reply. Either way, re-read the spec for wrong numbers, build-up lines that don't add up, and the owners' names.

## 7. Deliver

Give the agent the `.docx`, and save the spec next to it (same name, `.json`) so the next revision is a quick edit and rebuild.

In your reply, list briefly:
- the recommended price and how the build-up gets there
- anything to confirm before the meeting (facts from old listings, seller claims, comps you had doubts about)
- whether a headshot was found
- the MLS numbers behind the agent's stats
- anything you left out and why (for example, no stat row because the agent has no Sea Glass closings yet)

## Revisions

Owners often send notes back. Update the spec rather than editing the Word file by hand: fold new facts into the property and value sections, put renovation decisions and showing logistics in Preparing for Market, change the cover date to `Updated <date>`, and rebuild. If a note would change the price, show the agent the effect on the build-up and let them decide before you change the number.
