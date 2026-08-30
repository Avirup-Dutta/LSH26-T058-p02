import json
from datetime import datetime

def calculate_case(case):
    case_id = case['case_id']
    today_str = case['today']
    today = datetime.strptime(today_str, '%Y-%m-%d')
    
    items = case.get('items', [])
    mark_returned = set(case.get('mark_returned', []))
    
    expired = []
    within_30 = []
    within_90 = []
    safe = []
    returned = []
    
    expired_val = 0.0
    within_30_val = 0.0
    within_90_val = 0.0
    safe_val = 0.0
    returned_val = 0.0
    
    for item in items:
        item_id = item['id']
        qty = int(item['quantity'])
        price = float(item['unit_price_bdt'])
        val = qty * price
        exp_date = datetime.strptime(item['expiry'], '%Y-%m-%d')
        days = (exp_date - today).days
        
        if item_id in mark_returned:
            returned.append(item)
            returned_val += val
            continue
            
        if days < 0:
            expired.append(item)
            expired_val += val
        elif 0 <= days <= 30:
            within_30.append(item)
            within_30_val += val
        elif 31 <= days <= 90:
            within_90.append(item)
            within_90_val += val
        else:
            safe.append(item)
            safe_val += val
            
    money_at_risk = expired_val + within_30_val
    total_active_val = expired_val + within_30_val + within_90_val + safe_val
    
    return {
        'case_id': case_id,
        'today': today_str,
        'counts': {
            'total_items': len(items),
            'active_items': len(items) - len(returned),
            'expired': len(expired),
            'within_30': len(within_30),
            'within_90': len(within_90),
            'safe': len(safe),
            'returned': len(returned)
        },
        'values_bdt': {
            'expired': round(expired_val, 2),
            'within_30': round(within_30_val, 2),
            'within_90': round(within_90_val, 2),
            'safe': round(safe_val, 2),
            'money_at_risk': round(money_at_risk, 2),
            'total_active': round(total_active_val, 2),
            'returned': round(returned_val, 2)
        }
    }

with open('P02_pharmacy_expiry_public.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"{'Case':<8} | {'Today':<10} | {'Exp':<4} {'30d':<4} {'90d':<4} {'Safe':<5} {'Ret':<4} | {'Risk BDT':<12} | {'Active Total BDT':<15}")
print("-" * 75)
for case in data['cases'][:10]:
    res = calculate_case(case)
    c = res['counts']
    v = res['values_bdt']
    print(f"{res['case_id']:<8} | {res['today']:<10} | {c['expired']:<4} {c['within_30']:<4} {c['within_90']:<4} {c['safe']:<5} {c['returned']:<4} | Tk {v['money_at_risk']:<10.2f} | Tk {v['total_active']:<13.2f}")
