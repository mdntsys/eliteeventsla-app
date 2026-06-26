# QuickBooks Online integration — setup + plan

**Decided architecture (2026-06-26):** ONE QuickBooks Online **Plus** company.
Legal entity = **Elite Services Los Angeles** (single EIN; the brands are DBAs).
The three brands are **Classes**; each **event** is a **Project**. Data flows
**one-way: this app → QuickBooks** (the app stays the cockpit; QBO is the books).

> Do NOT also enable Stripe's native "Connect to QuickBooks" app — if both Stripe
> and this app push to QBO, every payment double-books. This app is the only pipe.

---

## Part A — what YOU do in QuickBooks (unblocks the build)

### A1. Subscribe
- [ ] QuickBooks Online **Plus** (lowest tier with Classes + Projects; don't let a rep upsell Advanced).
- [ ] Company **legal name = Elite Services Los Angeles**.

### A2. Turn on the features (gear ⚙ → Account and settings → Advanced)
- [ ] **Categories → Track classes = ON**, "Assign classes: One to entire transaction," warn-if-no-class ON.
- [ ] **Projects = ON** (on by default in Plus).
- [ ] **Taxes → Sales tax → set up Automated Sales Tax** (CA). Have your CPA confirm taxability of *rentals vs. services* — they differ in CA.

### A3. Classes (the 3 brands) — Sales → All Lists → Classes
- [ ] `Elite Events LA`
- [ ] `EliteMgmt LA` (no revenue yet — fine, leave it ready)
- [ ] `SCV Photo Booth Rentals` (can be a sub-class of Elite Events LA later if you prefer; flat is fine for now)

### A4. Chart of Accounts — Accounting → Chart of accounts → New
Add these on top of QBO's defaults (account **type** in parentheses):

**Income** (type: *Income*)
- [ ] Rental Income — booths, backdrops, equipment, tables/chairs
- [ ] Labor & Services Income — attendants, on-site labor, coordination
- [ ] Delivery & Setup Income — delivery, setup, teardown, travel
- [ ] Add-ons & Prints Income — props, prints, extra hours, upgrades
- [ ] *(later)* Management Income — for EliteMgmt when it has revenue

**Cost of Goods Sold** (type: *Cost of Goods Sold*)
- [ ] Subcontractor Costs — outside vendors (catering, entertainment, etc.)
- [ ] Equipment Repairs & Maintenance
- [ ] Event Supplies — consumables, print media, props

**Expenses** (type: *Expenses*)
- [ ] Merchant Processing Fees — Stripe

**Money-movement accounts**
- [ ] `Stripe Clearing` (type: *Bank*) — holds card funds between charge and payout
- [ ] `Undeposited Funds` already exists (type: *Other Current Asset*) — cash/checks awaiting deposit
- [ ] Connect the **Wells Fargo operating** account (Banking → Link account) when ready

### A5. Products & Services (Items) — Sales → Products & services → New → **Service**
Each Item points at an **Income account** — this is the auto-categorization lever.

| Item | Income account |
|---|---|
| Photo Booth Rental | Rental Income |
| Backdrop / Decor Rental | Rental Income |
| Equipment Rental (tables, chairs, etc.) | Rental Income |
| On-site Attendant / Labor | Labor & Services Income |
| Delivery & Setup | Delivery & Setup Income |
| Prints & Add-ons | Add-ons & Prints Income |
| **Sales — General** (default/fallback) | Rental Income |

### A6. How payments will land (for reference — the app handles it)
| App payment method | QBO treatment |
|---|---|
| Stripe (card) | Payment → deposit to **Stripe Clearing**; fee → **Merchant Processing Fees**; payout → transfer Clearing → Wells Fargo |
| Cash | Payment → **Undeposited Funds** → bank deposit |
| Check | Payment → **Undeposited Funds** |
| Zelle / Wire | Payment → deposit to **Wells Fargo** (hits the bank directly) |

---

## Part B — API access (Intuit Developer) → gets me the keys

1. [ ] Go to **developer.intuit.com** → sign in (use the Intuit login that admins the QBO company).
2. [ ] **Create an app** → "QuickBooks Online and Payments."
3. [ ] Scope: **Accounting** (`com.intuit.quickbooks.accounting`).
4. [ ] **Keys & OAuth**: get the **Development** keys (free Intuit *sandbox* company for building/testing), then click **Get production keys** and fill the basic app info (name, host domain `app.eliteeventsla.com`, privacy/EULA URLs).
5. [ ] **Redirect URIs** — add both:
   - `https://app.eliteeventsla.com/api/quickbooks/callback`
   - `http://localhost:3000/api/quickbooks/callback`
6. [ ] **Send me** the **Production Client ID + Client Secret** (server-side secrets, handled like the Stripe keys — never committed).

---

## Part C — what I build once I have the keys (one-way app → QBO)

**Phase 1 — core money flow** (the big bang)
- "Connect QuickBooks" button in `/admin` → OAuth → store `realm_id` + tokens in a new **service-role-only** table with auto-refresh (QBO access tokens expire hourly; refresh tokens rotate).
- On invoice **sent** and on **payment**: ensure the **Customer** + **Items** exist, create/update the **Invoice** (tagged with its **Class** = brand and **Project** = event), and record the **Payment**. Idempotent via QBO ids stored on our rows.
- Schema: add a `brand` field to events/invoices and `qbo_*_id` columns to contacts/companies/invoices/payments.

**Phase 2 — clean books:** Stripe fee + payout reconciliation, refunds → Refund Receipts.

**Phase 3 — profitability:** vendor costs → Bills (job costing); confirm events → Projects margins.

**Phase 4 — precision:** a small **service catalog** in the app (each service pre-mapped to a QBO Item) so line items categorize exactly instead of mapping free-text → "Sales — General."

---

## Open decisions (pick when we build)
- **Line items:** free-text (map to closest Item / default to "Sales — General") to start, or build the Phase-4 catalog early for exact categorization.
- **Stripe reconciliation depth:** simple "net deposit" to start, or full gross/fee/payout (accountant-grade) — recommend start simple, tighten later.
- **Brand routing:** events/invoices get a brand tag → QBO **Class** (this single-file setup). If an entity ever splits to its own EIN, the same tag can route to a separate QBO company instead.
