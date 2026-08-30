"""
PharmCheck BD - Multi-threaded Local SQLite Backend Server
Fast concurrent HTTP request handling with standard library sqlite3 and socketserver.
"""

import os
import json
import sqlite3
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse
from datetime import datetime, timedelta

PORT = 8080
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pharmacy.db')

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

def get_db():
    conn = sqlite3.connect(DB_FILE, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn

def get_date_offset(days):
    d = datetime.now() + timedelta(days=days)
    return d.strftime('%Y-%m-%d')

def init_db(force_reseed=False):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS medicines (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            batch TEXT NOT NULL,
            category TEXT,
            distributor TEXT,
            qty INTEGER NOT NULL,
            price REAL NOT NULL,
            expiry TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS returned_medicines (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            batch TEXT NOT NULL,
            category TEXT,
            distributor TEXT,
            qty INTEGER NOT NULL,
            price REAL NOT NULL,
            expiry TEXT NOT NULL,
            returned_date TEXT,
            return_reason TEXT,
            return_ref TEXT,
            return_notes TEXT
        )
    ''')
    
    cursor.execute('SELECT COUNT(*) as cnt FROM medicines')
    count = cursor.fetchone()['cnt']
    
    if count == 0 or force_reseed:
        cursor.execute('DELETE FROM medicines')
        cursor.execute('DELETE FROM returned_medicines')
        seed_sample_medicines(cursor)
        conn.commit()
        print(f"[*] Seeded 44 authentic Bangladeshi medicines into database.")
    else:
        print(f"[*] Database ready ({count} active medicines).")
        
    conn.close()

def seed_sample_medicines(cursor):
    bangladeshi_medicines = [
        # 🔴 Expired Stock (< 0 days)
        ('MED-101', 'Napa Extra 500mg/65mg (Paracetamol + Caffeine)', 'SQ-NP-8819', 'Analgesics / Pain', 'Square Pharmaceuticals PLC', 150, 3.00, get_date_offset(-45)),
        ('MED-102', 'Seclo 20mg Capsule (Omeprazole)', 'SQ-SC-4412', 'Gastrointestinal', 'Square Pharmaceuticals PLC', 90, 7.00, get_date_offset(-20)),
        ('MED-103', 'Cef-3 200mg Capsule (Cefixime)', 'IN-CF-9011', 'Antibiotics', 'Incepta Pharmaceuticals Ltd', 40, 35.00, get_date_offset(-12)),
        ('MED-104', 'Maxpro 20mg Tablet (Esomeprazole)', 'RN-MP-7721', 'Gastrointestinal', 'Renata Limited', 80, 8.00, get_date_offset(-8)),
        ('MED-105', 'Losectil 20mg Capsule (Omeprazole)', 'SK-LS-3301', 'Gastrointestinal', 'Eskayef Pharmaceuticals (SK-F)', 100, 6.50, get_date_offset(-3)),
        ('MED-106', 'Tofen 1mg Tablet (Ketotifen)', 'SQ-TF-5520', 'Respiratory', 'Square Pharmaceuticals PLC', 60, 3.50, get_date_offset(-35)),
        ('MED-107', 'Comet 850mg Tablet (Metformin HCl)', 'SQ-CM-1109', 'Antidiabetic', 'Square Pharmaceuticals PLC', 120, 4.00, get_date_offset(-1)),
        ('MED-108', 'Dermasol 0.05% Ointment 15g', 'SQ-DS-8821', 'Dermatology', 'Square Pharmaceuticals PLC', 35, 45.00, get_date_offset(-60)),

        # 🟠 Within 30 Days (0 to 30 days remaining - Urgent Return)
        ('MED-201', 'Zimax 500mg Tablet (Azithromycin)', 'IN-ZX-4491', 'Antibiotics', 'Incepta Pharmaceuticals Ltd', 50, 35.00, get_date_offset(4)),
        ('MED-202', 'Insulatard Penfill 100 IU/ml (Insulin)', 'NOVO-IN-09', 'Antidiabetic', 'Novo Nordisk / Transcom Dist.', 25, 460.00, get_date_offset(8)),
        ('MED-203', 'Anclog 75mg Tablet (Clopidogrel)', 'SQ-AC-6120', 'Cardiovascular', 'Square Pharmaceuticals PLC', 70, 15.00, get_date_offset(13)),
        ('MED-204', 'Ciprocin 500mg Tablet (Ciprofloxacin)', 'SQ-CP-3319', 'Antibiotics', 'Square Pharmaceuticals PLC', 60, 15.00, get_date_offset(17)),
        ('MED-205', 'Ace Plus Tablet (Paracetamol + Caffeine)', 'BX-AP-9901', 'Analgesics / Pain', 'Beximco Pharmaceuticals Ltd', 200, 3.00, get_date_offset(21)),
        ('MED-206', 'Monas 10mg Tablet (Montelukast)', 'SQ-MN-5014', 'Respiratory', 'Square Pharmaceuticals PLC', 60, 17.50, get_date_offset(24)),
        ('MED-207', 'Cardizem 30mg Tablet (Diltiazem HCl)', 'BX-CD-1278', 'Cardiovascular', 'Beximco Pharmaceuticals Ltd', 80, 5.00, get_date_offset(27)),
        ('MED-208', 'Ceftron 1g IV/IM Injection (Ceftriaxone)', 'POP-CT-4089', 'Antibiotics', 'Popular Pharmaceuticals Ltd', 30, 195.00, get_date_offset(2)),
        ('MED-209', 'Anset 8mg Tablet (Ondansetron)', 'SQ-AS-6632', 'Gastrointestinal', 'Square Pharmaceuticals PLC', 55, 10.00, get_date_offset(11)),

        # 🟡 Within 90 Days (31 to 90 days remaining - Watchlist)
        ('MED-301', 'Moxacil 500mg Capsule (Amoxicillin)', 'SQ-MX-1092', 'Antibiotics', 'Square Pharmaceuticals PLC', 90, 7.50, get_date_offset(35)),
        ('MED-302', 'Osartil 50mg Tablet (Losartan Potassium)', 'IN-OS-7721', 'Cardiovascular', 'Incepta Pharmaceuticals Ltd', 110, 10.00, get_date_offset(42)),
        ('MED-303', 'Pantonix 40mg IV Injection (Pantoprazole)', 'IN-PX-9943', 'Gastrointestinal', 'Incepta Pharmaceuticals Ltd', 40, 85.00, get_date_offset(49)),
        ('MED-304', 'Thyrox 50mcg Tablet (Levothyroxine)', 'RN-TX-3021', 'Antidiabetic', 'Renata Limited', 130, 2.50, get_date_offset(57)),
        ('MED-305', 'Clofenac 50mg Tablet (Diclofenac Sodium)', 'SQ-CF-8812', 'Analgesics / Pain', 'Square Pharmaceuticals PLC', 85, 4.50, get_date_offset(64)),
        ('MED-306', 'Bexitrol-F 100 Inhaler (Fluticasone+Salmeterol)', 'BX-BF-4410', 'Respiratory', 'Beximco Pharmaceuticals Ltd', 30, 360.00, get_date_offset(72)),
        ('MED-307', 'Alatrol 10mg Tablet (Cetirizine Di-HCl)', 'SQ-AL-2289', 'Respiratory', 'Square Pharmaceuticals PLC', 150, 3.50, get_date_offset(80)),
        ('MED-308', 'Burnsil 1% Cream 25g (Silver Sulfadiazine)', 'AC-BS-7341', 'Dermatology', 'ACME Laboratories Ltd', 40, 65.00, get_date_offset(86)),
        ('MED-309', 'Neogab 300mg Capsule (Gabapentin)', 'IN-NG-5532', 'Analgesics / Pain', 'Incepta Pharmaceuticals Ltd', 50, 18.00, get_date_offset(78)),

        # 🟢 Safe (> 90 days remaining)
        ('MED-401', 'Rosuva 10mg Tablet (Rosuvastatin)', 'IN-RS-3310', 'Cardiovascular', 'Incepta Pharmaceuticals Ltd', 120, 20.00, get_date_offset(120)),
        ('MED-402', 'Camlodin 5mg Tablet (Amlodipine Besylate)', 'SQ-CL-8824', 'Cardiovascular', 'Square Pharmaceuticals PLC', 140, 6.00, get_date_offset(150)),
        ('MED-403', 'Linaglip 5mg Tablet (Linagliptin)', 'IN-LG-9912', 'Antidiabetic', 'Incepta Pharmaceuticals Ltd', 75, 22.00, get_date_offset(180)),
        ('MED-404', 'Gluconor 2mg Tablet (Glimepiride)', 'BX-GN-4411', 'Antidiabetic', 'Beximco Pharmaceuticals Ltd', 90, 8.00, get_date_offset(210)),
        ('MED-405', 'Doxicap 100mg Capsule (Doxycycline)', 'RN-DC-7740', 'Antibiotics', 'Renata Limited', 100, 3.00, get_date_offset(240)),
        ('MED-406', 'Sergel 20mg Capsule (Esomeprazole)', 'HC-SG-2231', 'Gastrointestinal', 'Healthcare Pharmaceuticals Ltd', 160, 8.00, get_date_offset(270)),
        ('MED-407', 'D-Rise 20,000 IU Capsule (Vitamin D3)', 'RN-DR-8834', 'Vitamins / Supplements', 'Renata Limited', 100, 45.00, get_date_offset(300)),
        ('MED-408', 'Calbo-D Forte Tablet (Calcium + Vit D3)', 'SQ-CD-5510', 'Vitamins / Supplements', 'Square Pharmaceuticals PLC', 180, 8.00, get_date_offset(365)),
        ('MED-409', 'Flixonase Aqueous Nasal Spray (Fluticasone)', 'GSK-BD-1198', 'Respiratory', 'GlaxoSmithKline Bangladesh', 45, 320.00, get_date_offset(400)),
        ('MED-410', 'Fucicort Lipid Cream 15g', 'LEO-FC-3490', 'Dermatology', 'Healthcare Pharma / LEO Dist.', 50, 180.00, get_date_offset(450)),
        ('MED-411', 'Levoking 500mg Tablet (Levofloxacin)', 'IN-LK-8819', 'Antibiotics', 'Incepta Pharmaceuticals Ltd', 80, 16.00, get_date_offset(500)),
        ('MED-412', 'Gaba-P 75mg Capsule (Pregabalin)', 'SQ-GP-9002', 'Analgesics / Pain', 'Square Pharmaceuticals PLC', 60, 20.00, get_date_offset(540)),
        ('MED-413', 'Rolac 10mg Tablet (Ketorolac Tromethamine)', 'RN-RL-4421', 'Analgesics / Pain', 'Renata Limited', 90, 12.00, get_date_offset(600)),
        ('MED-414', 'Bizoran 5/20 Tablet (Amlodipine + Olmesartan)', 'IN-BZ-6612', 'Cardiovascular', 'Incepta Pharmaceuticals Ltd', 85, 14.00, get_date_offset(660)),
        ('MED-415', '0.9% Normal Saline IV 500ml Infusion', 'BX-NS-500', 'Emergency / Critical', 'Beximco Pharma Infusion Unit', 120, 75.00, get_date_offset(700)),
        ('MED-416', 'Hartmans Solution (Ringer Lactate) 500ml', 'OR-RL-500', 'Emergency / Critical', 'Orion Infusion Ltd', 100, 85.00, get_date_offset(720)),
        ('MED-417', 'Epinephrine (Adrenaline) 1mg/1ml Ampoule', 'GN-AD-100', 'Emergency / Critical', 'Gonoshasthaya Pharmaceuticals', 40, 30.00, get_date_offset(390)),
        ('MED-418', 'Filwel Gold Multivitamin & Minerals', 'SQ-FG-9912', 'Vitamins / Supplements', 'Square Pharmaceuticals PLC', 130, 8.50, get_date_offset(480))
    ]
    cursor.executemany('''
        INSERT OR REPLACE INTO medicines (id, name, batch, category, distributor, qty, price, expiry)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', bangladeshi_medicines)

class PharmacyRequestHandler(SimpleHTTPRequestHandler):
    def _send_json(self, data, status=200):
        encoded = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(encoded)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        
        # API: Get all medicines and returned items
        if path == '/api/inventory':
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM medicines ORDER BY expiry ASC')
            medicines = [dict(row) for row in cursor.fetchall()]
            cursor.execute('SELECT * FROM returned_medicines ORDER BY returned_date DESC')
            returned = [dict(row) for row in cursor.fetchall()]
            conn.close()
            self._send_json({
                'status': 'success',
                'currency': 'BDT',
                'activeMedicines': medicines,
                'returnedMedicines': returned
            })
            return

        # API: Get available test cases from P02_pharmacy_expiry_public.json
        elif path == '/api/test-cases':
            json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'P02_pharmacy_expiry_public.json')
            if os.path.exists(json_path):
                with open(json_path, 'r', encoding='utf-8') as f:
                    cases_data = json.load(f)
                self._send_json({
                    'status': 'success',
                    'cases': [{
                        'case_id': c['case_id'],
                        'today': c.get('today'),
                        'item_count': len(c.get('items', [])),
                        'returned_count': len(c.get('mark_returned', []))
                    } for c in cases_data.get('cases', [])]
                })
            else:
                self._send_json({'status': 'error', 'message': 'File not found'}, 404)
            return

        # API: Database diagnostics
        elif path == '/api/db/status':
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) as active_cnt FROM medicines')
            active_cnt = cursor.fetchone()['active_cnt']
            cursor.execute('SELECT COUNT(*) as returned_cnt FROM returned_medicines')
            returned_cnt = cursor.fetchone()['returned_cnt']
            conn.close()

            file_size_kb = os.path.getsize(DB_FILE) / 1024 if os.path.exists(DB_FILE) else 0

            self._send_json({
                'status': 'connected',
                'file_size_kb': round(file_size_kb, 2),
                'active_count': active_cnt,
                'returned_count': returned_cnt
            })
            return

        # Static files fallback (index.html, styles.css, app.js)
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8') if length > 0 else '{}'
        
        try:
            data = json.loads(body)
        except Exception:
            data = {}

        # API: Load Specific Benchmark Test Case from JSON file
        if path == '/api/load-case':
            case_id = data.get('case_id', 'PUB-01')
            json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'P02_pharmacy_expiry_public.json')
            if not os.path.exists(json_path):
                self._send_json({'error': 'JSON file not found'}, 404)
                return
            with open(json_path, 'r', encoding='utf-8') as f:
                cases_data = json.load(f)
            target_case = None
            for c in cases_data.get('cases', []):
                if c['case_id'] == case_id:
                    target_case = c
                    break
            if not target_case:
                self._send_json({'error': 'Case not found'}, 404)
                return

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('DELETE FROM medicines')
            cursor.execute('DELETE FROM returned_medicines')

            mark_returned = set(target_case.get('mark_returned', []))
            active_list = []
            returned_list = []

            for it in target_case.get('items', []):
                m_id = it['id']
                name = it['name']
                dist = it.get('company', 'General')
                batch = it.get('batch', 'B-100')
                qty = int(it.get('quantity', 1))
                price = float(it.get('unit_price_bdt', 0.0))
                expiry = it.get('expiry')
                cat = 'General'
                # Auto-assign clinical category
                lname = name.lower()
                if any(x in lname for x in ['napa', 'ace', 'clofenac', 'rolac', 'pain', 'paracetamol', 'fexo']):
                    cat = 'Analgesics / Pain'
                elif any(x in lname for x in ['seclo', 'maxpro', 'losectil', 'pantonix', 'sergel', 'omeprazole']):
                    cat = 'Gastrointestinal'
                elif any(x in lname for x in ['cef', 'zimax', 'ciprocin', 'moxacil', 'doxicap', 'levoking', 'azithromycin']):
                    cat = 'Antibiotics'
                elif any(x in lname for x in ['monas', 'tofen', 'bexitrol', 'alatrol', 'flixonase', 'inhaler']):
                    cat = 'Respiratory'
                elif any(x in lname for x in ['comet', 'insulatard', 'linaglip', 'gluconor', 'thyrox', 'insulin', 'metformin']):
                    cat = 'Antidiabetic'
                elif any(x in lname for x in ['anclog', 'cardizem', 'osartil', 'rosuva', 'camlodin', 'bizoran', 'lipitor']):
                    cat = 'Cardiovascular'
                elif any(x in lname for x in ['dermasol', 'burnsil', 'fucicort', 'cream', 'ointment']):
                    cat = 'Dermatology'
                elif any(x in lname for x in ['saline', 'hartman', 'epinephrine', 'adrenaline', 'infusion']):
                    cat = 'Emergency / Critical'
                elif any(x in lname for x in ['calbo', 'd-rise', 'filwel', 'vitamin']):
                    cat = 'Vitamins / Supplements'

                if m_id in mark_returned:
                    cursor.execute('''
                        INSERT INTO returned_medicines 
                        (id, name, batch, category, distributor, qty, price, expiry, returned_date, return_reason, return_ref, return_notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (m_id, name, batch, cat, dist, qty, price, expiry, datetime.now().isoformat(), 'Distributor Expiry Return', f'RMA-{case_id}', 'Benchmarked returned item'))
                    returned_list.append(it)
                else:
                    cursor.execute('''
                        INSERT INTO medicines (id, name, batch, category, distributor, qty, price, expiry)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (m_id, name, batch, cat, dist, qty, price, expiry))
                    active_list.append(it)

            conn.commit()
            conn.close()

            self._send_json({
                'status': 'case_loaded',
                'case_id': case_id,
                'today': target_case.get('today'),
                'active_count': len(active_list),
                'returned_count': len(returned_list)
            })
            return

        # API: Add Medicine
        elif path == '/api/medicines':
            conn = get_db()
            cursor = conn.cursor()
            med_id = data.get('id') or f"MED-{int(datetime.now().timestamp()*1000) % 100000}"
            cursor.execute('''
                INSERT INTO medicines (id, name, batch, category, distributor, qty, price, expiry)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                med_id,
                data.get('name'),
                data.get('batch'),
                data.get('category'),
                data.get('distributor', 'Square Pharmaceuticals PLC'),
                int(data.get('qty', 1)),
                float(data.get('price', 0.0)),
                data.get('expiry')
            ))
            conn.commit()
            conn.close()
            self._send_json({'status': 'created', 'id': med_id})
            return

        # API: Return Medicine to Distributor
        elif path == '/api/medicines/return':
            med_id = data.get('id')
            conn = get_db()
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM medicines WHERE id = ?', (med_id,))
            row = cursor.fetchone()
            
            if row:
                m = dict(row)
                cursor.execute('DELETE FROM medicines WHERE id = ?', (med_id,))
                cursor.execute('''
                    INSERT INTO returned_medicines 
                    (id, name, batch, category, distributor, qty, price, expiry, returned_date, return_reason, return_ref, return_notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    m['id'], m['name'], m['batch'], m['category'], m['distributor'], m['qty'], m['price'], m['expiry'],
                    datetime.now().isoformat(),
                    data.get('returnReason', 'Expiry Return (DGDA Protocol)'),
                    data.get('returnRef', 'RET-DHAKA-AUTO'),
                    data.get('returnNotes', '')
                ))
                conn.commit()
                conn.close()
                self._send_json({'status': 'returned', 'id': med_id})
            else:
                conn.close()
                self._send_json({'error': 'Medicine not found'}, 404)
            return

        # API: Restore Returned Medicine
        elif path == '/api/medicines/restore':
            med_id = data.get('id')
            conn = get_db()
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM returned_medicines WHERE id = ?', (med_id,))
            row = cursor.fetchone()
            
            if row:
                m = dict(row)
                cursor.execute('DELETE FROM returned_medicines WHERE id = ?', (med_id,))
                cursor.execute('''
                    INSERT INTO medicines (id, name, batch, category, distributor, qty, price, expiry)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (m['id'], m['name'], m['batch'], m['category'], m['distributor'], m['qty'], m['price'], m['expiry']))
                conn.commit()
                conn.close()
                self._send_json({'status': 'restored', 'id': med_id})
            else:
                conn.close()
                self._send_json({'error': 'Item not found'}, 404)
            return

        # API: Reset Sample Data
        elif path == '/api/reset':
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('DELETE FROM medicines')
            cursor.execute('DELETE FROM returned_medicines')
            seed_sample_medicines(cursor)
            conn.commit()
            conn.close()
            self._send_json({'status': 'reset_complete'})
            return

        # API: Delete Medicine
        elif path == '/api/medicines/delete':
            med_id = data.get('id')
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('DELETE FROM medicines WHERE id = ?', (med_id,))
            conn.commit()
            conn.close()
            self._send_json({'status': 'deleted', 'id': med_id})
            return

        self._send_json({'error': 'Not found'}, 404)

if __name__ == '__main__':
    init_db(force_reseed=True)
    server_address = ('', PORT)
    httpd = ThreadedHTTPServer(server_address, PharmacyRequestHandler)
    print(f"==========================================================")
    print(f" PharmCheck BD Server running on http://localhost:{PORT}")
    print(f" Database: {DB_FILE}")
    print(f"==========================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Server stopped.")
