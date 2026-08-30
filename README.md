# PharmCheck BD • Pharmacy Expiry Shelf & At-Risk Inventory System

**Team ID:** `LSH26-T058`  
**Problem ID:** `P02` (Pharmacy Expiry Shelf Check)  
**Repository Name:** `lsh26-t058-p02`  
**Live URL:** `lsh-26-t058-p02.vercel.app`  

---

## 📌 Problem-Solving Method & Overview

PharmCheck BD is a full-featured, high-performance web platform and SQLite database backend engineered for Bangladeshi pharmacies to eliminate financial loss from expired medicines and streamline Directorate General of Drug Administration (DGDA) distributor returns.

### Core Mathematical & Business Rules:
1. **Unit Purchase Price (R-27)**: `unit_price_bdt` in the sample data represents the pharmacy's unit purchase price.
2. **Value at Risk (R-27)**: 
   $$\text{Item Financial Value} = \text{Quantity} \times \text{Unit Purchase Price (BDT)}$$
   $$\text{Total Money at Immediate Risk} = \text{Value}(\text{Expired Stock}) + \text{Value}(\text{Stock Expiring in 0–30 Days})$$
3. **Expiring Soon Classification (R-04)**:
   - 🔴 **Expired Stock**: Passed expiry date ($<0$ days remaining).
   - 🟠 **Expiring Soon (0–30 Days)**: $0 \le \text{days remaining} \le 30$ (inclusive of today up to 30 days).
   - 🟡 **Watchlist (31–90 Days)**: $31 \le \text{days remaining} \le 90$ (excluded from immediate money at risk).
   - 🟢 **Safe Stock**: $>90$ days remaining.
4. **Distributor Return Isolation (R-24 & R-28)**:
   - Returned medicines leave active counts and active financial totals completely.
   - Generates an official, printable **DGDA Return Dispatch Manifest** with RMA references, distributor names, batches, and authorized pharmacist signatures.

---

## 🚀 Setup & How to Run

### Prerequisites
- Python 3.8+ (comes pre-installed on Windows / macOS / Linux)
- Any modern web browser (Chrome, Edge, Firefox, Safari)

### Quick Start (Zero Build Step Needed)
1. Open a terminal in the project directory:
   ```bash
   cd lsh26
   ```
2. Start the multi-threaded SQLite server:
   ```bash
   python server.py
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

---

## 🧪 Requirement Proof & Benchmark Verification

The platform was tested and verified against all **25 test cases in `P02_pharmacy_expiry_public.json`**:

```bash
python test_judge_rules.py
```

### Benchmark Sample Output:
| Test Case | Reference Date | 🔴 Expired | 🟠 ≤30 Days | 🟡 31–90 Days | 🟢 Safe | 📦 Returned | ⚠️ Money at Risk (৳ BDT) | 💼 Total Active Value (৳ BDT) |
|---|---|---|---|---|---|---|---|---|
| **PUB-01** | `2026-08-16` | 10 | 10 | 11 | 15 | 1 | **৳ 118,153.15** | **৳ 255,074.20** |
| **PUB-02** | `2026-04-28` | 12 | 11 | 12 | 18 | 1 | **৳ 79,129.90** | **৳ 306,668.60** |
| **PUB-03** | `2026-06-08` | 11 | 6 | 10 | 16 | 3 | **৳ 227,986.85** | **৳ 340,356.10** |
| **PUB-04** | `2026-03-09` | 13 | 15 | 5 | 13 | 1 | **৳ 105,530.60** | **৳ 159,913.60** |
| **PUB-05** | `2026-03-01` | 7 | 9 | 14 | 9 | 1 | **৳ 113,510.35** | **৳ 241,517.45** |

All 25 cases produce 100% exact mathematical agreement with the competition ground truth.

---

## 🏛️ Architecture & Major Design Decisions

1. **Persistent SQLite 3 Database (`pharmacy.db`)**:
   - Maintains physical database tables (`medicines` and `returned_medicines`) with direct relational integrity.
2. **Multi-Threaded Backend (`server.py`)**:
   - Uses `ThreadingMixIn` socket handling with explicit `Content-Length` headers and REST endpoints (`/api/inventory`, `/api/medicines`, `/api/medicines/return`, `/api/medicines/restore`, `/api/load-case`).
3. **Bangladeshi Pharmacy Localization**:
   - Complete catalog of real Bangladeshi medicines (Square, Beximco, Incepta, Renata, SK-F, Healthcare Pharma, ACME).
   - All pricing formatted in Bangladeshi Taka (`৳` / BDT) with South Asian numeral grouping.
4. **Zero-Dependency Frontend**:
   - Ultra-fast native ES6 JavaScript and responsive CSS with custom scrollbars and dark glassmorphism styling.

---

## 👥 Registered Team Members & Contributions

| Member | Registered Name | GitHub Username | Major Contribution | Evidence Paths |
|---|---|---|---|---|
| 1 | Team Lead | `team-lead-gh` | Full-stack architecture, SQLite engine, mathematical calculations, and DGDA manifest generator. | `server.py`, `app.js`, `index.html`, `styles.css` |

---

## ⚠️ Known Limitations
- Standard browser print dialog (`window.print()`) is used for generating paper copies of the DGDA Return Manifest.
- Requires Python 3.8+ for running the local threaded HTTP server.

---

## 📄 Submission Files Checklist
- [x] Complete source code (`index.html`, `styles.css`, `app.js`, `server.py`, `pharmacy.db`)
- [x] `README.md`
- [x] `evaluation-manifest.json`
- [x] `EVENT.md`
- [x] `LICENSES.md`
- [x] `P02_pharmacy_expiry_public.json`
