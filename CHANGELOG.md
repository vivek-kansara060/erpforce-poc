# ERPForce POC: What We Changed and Why

This is a plain-language log of every change made to the ERPForce POC (the Heavy Equipment Rental design POC). It is written so anyone can open it and understand what changed, why it changed, and how it affects the rest of the system. It only covers this POC. The real `erp-fe` and `erp-be` code has not been touched.

**How to read it.** Changes are grouped by screen. Inside each screen the newest change comes first. Every entry has a date and time in IST, like "1 Oct, 11:39 AM". A time marked "around" means the time was not written down when the work was done, so it is an estimate.

**Where the "why" comes from.** The requirement document (`ERPForce_Heavy_Equipment_Rental_Module.md`), the description of what the existing ERP already does (`docs/baseline/inventory-fa.md`), and the two calls with Ajin on 25 and 30 September.

**Current state in one paragraph.** The POC's Inventory module has a Heavy Equipment Fixed Asset type and a Heavy Equipment Pricing screen (both renamed to match Ajin's wording), and a Physical Stock Verification screen that can count both stock items and individual heavy equipment assets, with a proper approve or reject step.

---

## Physical Stock Verification

This screen is where someone counts what is physically in a place and compares it with what the system believes is there. Most of today's work was here.

### 1 Oct, 12:44 PM: Counts now use each location's own stock, record who confirmed them, and feed the report live

Three gaps were left after the earlier work. All three are closed here.

**1. A count now compares against what that location actually holds.**
*The problem.* Every item had one stock number shared by the whole company. Counting Oil Filters at Jebel Ali showed 14, and counting them at Sharjah also showed 14. Worse, approving a correction at one yard overwrote the single number, which silently changed the figure for every other yard.
*What we did.* Each item now has a stock quantity per location (for example Oil Filter: Jebel Ali 14, Sharjah 6, Abu Dhabi Mussafah 4, total 24). The Start Count form loads the quantities for the chosen location only, so Jebel Ali, Sharjah and the fuel depot each show their own figures. When a stock adjustment is approved, only that location's quantity is set to the counted figure. The item's total then moves by the same difference, so total and locations always agree.
*Connected change.* The item's view page (Inventory tab) now has a **Location wise stock** table under the total, and the total is labelled "Stock on Hand (all locations)". The existing ERP already shows stock by location on item pages, so this is not a new idea, it just makes the new numbers visible.
*Be aware.* Totals on the Items screen are now the sum of the locations, so some totals look larger than before (Oil Filter went from 14 to 24). Jebel Ali keeps the old figures, so the earlier sample counts still line up. Items with a system quantity of zero at a location are still not listed for counting.

**2. A count can now record who confirmed it.**
*The problem.* The form only had "Counted By", the person who did the counting. The requirement document's role table says the Fleet / Asset Manager confirms physical stock counts, which is a separate step: the counter reports the numbers and a manager accepts them as valid.
*What we did.* Added a **Confirmed By** field on the Start Count Session form. It is required to complete the count, and it shows on the count's view page next to Counted By. The sample counts have a confirmer filled in.
*Be aware.* The document does not spell out exactly how confirmation works, so the field carries a visible note: "exact rule to be confirmed with client". It is a simple field for now, not a separate approval step.

**3. The Physical Stock Variance Report now reflects real activity.**
*The problem.* The report was built from fixed sample data, so creating, approving or rejecting a count changed nothing in it.
*What we did.* The report now reads the same list of counts that the Stock Count screens use, each time it is opened. A count you complete, approve or reject appears in the report straight away, with the right status. If the Stock Count screens have not been opened yet, it shows the sample counts.

**How we checked.** The item totals equal the sum of their locations, each location loads different quantities, the older sample counts still match Jebel Ali, and replacing the list of counts changes the report's rows.

### 1 Oct, 12:12 PM: Heavy equipment can now be counted, unit by unit

**The problem.** The count could only handle stock quantities (for example 14 oil filters). Heavy equipment was left out completely, because each generator or truck is a single, individually tracked asset. Saying "we have 6 of them" is not useful when every unit has its own record, status and history. So none of the fleet was ever being verified.

**What we did.** The start form now has a **Count Type** choice: *Stock Items* or *Fixed Assets*. When you choose Fixed Assets and a location, the screen lists the units that the system expects to be at that location. "Expected" means the latest entry in the unit's Movement History says it is there. Units out on hire at a client are not listed, because they are not supposed to be in the yard, and units already disposed of are not listed either.

For each unit the counter picks one of three results:
- **Found**: it is where the system says it is.
- **Not Found**: it is not there.
- **Found elsewhere**: it is somewhere else, and the counter says where.

The count cannot be completed until every unit has a result, and a "Found elsewhere" unit must have the place it was found.

**What happens after approval.** This is where the count connects to the rest of the system:
- A **Found elsewhere** unit gets a new correcting entry in its **Movement History** (an Internal Transfer from the counted location to where it was found, pointing back to the count session). The asset's Current Location then updates by itself, because the location is always read from the latest movement. The old entries are never edited, only added to.
- A **Not Found** unit only gets a note in its audit trail saying it was missing in the count and needs follow-up. Its **Asset Status is not changed**. The requirement document says the system must never dispose of an asset by itself, and a disposal needs its own approved request, so a missing asset must go through a Disposal Request before it can be marked Disposed.
- A **rejected** count changes nothing on any asset.
- **Safety check.** If a unit has moved since the count was done (for example it was delivered to a client in the meantime), approving the count skips that unit instead of overwriting its newer history. The approval history says how many units were skipped.

**Also changed.** The sessions list has a new Count Type column, and the Items Covered and Lines with Variance columns count assets for asset counts. The Physical Stock Variance Report now includes asset counts: a unit that was not at the counted place shows as system 1, counted 0, variance minus 1, with where it was found if known. A sample asset count (`SCS-26-00005`, Jebel Ali Main Yard, one unit found elsewhere, one not found, waiting for approval) was added so the approval can be demonstrated.

**Be aware.** The requirement document does not define how individual assets are counted. This is our reading of it, and the screen says so with a visible note ("Rule to be confirmed with client"). Things deliberately left out: adding an unexpected asset found during a count, a "Lost" or "Missing" asset status, a "Lost" reason on disposal requests, and automatically raising a Disposal Request.

### 1 Oct, around 12:00 PM: The count now has the approval steps the rest of the POC already has

**The problem.** When a count found a difference, a Stock Adjustment could be raised, but it only had an Approve button. The requirement document says the adjustment must follow "the same approval framework used elsewhere" and that the system quantity must never be silently overwritten. The Asset Disposal Request screen in this POC already works that way, with Approve, Reject and a history of who did what.

**What we did.**
- Added a **Reject** button, with a confirmation, next to Approve. Rejecting leaves the system quantity untouched.
- Added an **Approval History** panel showing, in order, when the adjustment was raised and who approved or rejected it.
- Added a **Rejected** status. It shows in red in the sessions list and in the Physical Stock Variance Report, using the colours the POC already uses for rejected items.
- Added a short on-screen note saying that what happens to a rejected difference (for example whether it can be raised again) still needs to be confirmed with the client. Today a rejected adjustment cannot be raised again.

**Header fields.** The requirement document says a count is a header record that is auto-generated and covers a date, a location and the items covered. The start form now shows a read-only **Stock Count Session** field ("Auto-generated", then the real number once saved) and an **Items Covered** field. The view page also shows Items Covered.

**Sample data.** To make every state visible, we added a rejected sample count (`SCS-26-00004`, Sharjah Yard) and approval history to the two existing sample counts.

**Be aware.** At this point the Physical Stock Variance Report was still built from the built-in sample sessions. That was fixed at 12:44 PM (see the first entry).

### Still open for this screen
Not yet decided or built: a reason for each difference, and listing items whose system quantity at a location is zero.

---

## Items: Heavy Equipment Fixed Asset

### 1 Oct, 11:39 AM: Renamed from "Heavy Equipment"

On the 30 September call Ajin made it clear that this is the fixed asset form brought across from accounting, not a general "heavy equipment" item. The item type is now called **Heavy Equipment Fixed Asset** everywhere users can see it: the type chip and filter on the Items list, the Add button, the page headings, messages, and the small requirement badges used in review mode. Internal links and storage names were left as they were, so nothing broke.

---

## Heavy Equipment Pricing

### 1 Oct, 11:39 AM: Renamed from "Pricing Master"

Also following the 30 September call, where Ajin called it "Heavy equipment pricing". The new name is used in the sidebar, the page title, the add and edit headings and the change register.

**Be aware.** It is still a sidebar item. Ajin talked about it living in the Items type dropdown instead. That has not been changed and is an open point.
