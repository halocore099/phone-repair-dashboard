import csv
from collections import defaultdict

REPAIR_NAME_MAPPING = {
    # Displays
    "display standard": "Austausch Display-LCD/LED-Einheit",
    "display premium": "Austausch Premium-Display",
    "display replacement": "Austausch Display-LCD/LED-Einheit",
    
    # Batteries
    "akku": "Austausch Akku",
    "battery replacement": "Austausch Akku",

    "touch ic konnektor": "Austausch Touch IC",
    "kamera ic konnektor": "Austausch Kamera IC",
    
    # Other common repairs
    "tastatur": "Austausch Tastatur",
    "lüfter": "Austausch Lüfter",
    "mainboard": "Austausch Mainboard",
    "ssd 240gb": "Austausch SSD 240GB",
    "ssd 500gb": "Austausch SSD 500GB",
    "festplatte": "Austausch Festplatte",
    "trackpad": "Austausch Trackpad",

    # New mappings from your list
    'analyse': "kostenpflichtige Analyse",
    'schalter': "Austausch Ein/Aus-Schalter",
    'lasereinheit': "Austausch Lasereinheit",
    "festplatte 2,5/r 1tb": "Einbau Festplatte 2,5'' 1TB",
    'ssd 1tb': "Einbau SSD 1TB",
    'ssd 120gb': "Einbau SSD 120GB",
    'netzteil': "Austausch Netzteil",
    'speichererweiterung auf 128gb': "Speichererweiterung auf 128GB (neu)",
    'speichererweiterung auf 256gb': "Speichererweiterung auf 256GB (neu)",
    'backcover': "Austausch Backcover",
    'kamera': "Austausch Kamera",
    'kameraglas': "Austausch Kameraglas",
    'audio': "Austausch Audiobuchse",
    'ladeelektronik': "Austausch Ladeelektronik",
    'backlight ic': "Austausch Backlight IC",
    'audio ic': "Austausch Audio IC",
    'powermanagement ic': "Austausch Powermanagement IC",
    'tristar/u2 ic': "Austausch Tristar/U2 IC",
    'baseband ic': "Austausch Baseband IC",
    'nand': "Austausch NAND",
    'speichererweiterung auf 64gb': "Speichererweiterung auf 64GB (neu)",
    'weiterer komponente': "Einbau weiterer Komponente",
    'iflash msata ssd': "Einbau iFlash mSATA SSD",
    "hdd 1,8/r": "Einbau HDD 1,8''",
    "iflash sdhc 1,8/r": "Einbau iFlash SDHC 1,8''",
    'topcase': "Austausch Topcase",
    'bottomcase': "Austausch Bottomcase",
    'grafikchip': "Austausch Grafikchip",
    'diverser mainboardkomponenten': "Austausch diverser Mainboardkomponenten",
    'northbridgechip': "Austausch Northbridgechip",
    'bios-chip inkl. flashing': "Austausch BIOS-Chip inkl. Flashing",
    'chip-level-reparatur': "Chip-Level-Recparatur",
    'displaykonnektor': "Austausch Displaykonnektor",
    'tastaturkonnektor': "Austausch Tastaturkonnektor",
    '2gb ddr2': "Einbau 2GB DDR2",
    'festplattenkabel': "Austausch Festplattenkabel",
    '8gb ddr3': "Einbau 8GB DDR3",
    '16gb ddr3': "Einbau 16GB DDR3",
    '4gb ddr3': "Einbau 4GB DDR3",
    "festplatte 2,5/r 500gb": "Einbau Festplatte 2,5'' 500GB",
    'c-mos batterie': "Austausch C-MOS Batterie",
    '4gb ddr4': "Einbau 4GB DDR4",
    '8gb ddr4': "Einbau 8GB DDR4",
    '16gb ddr4': "Einbau 16GB DDR4",
    '32gb ddr4': "Einbau 32GB DDR4",
    'windows 10 pro lizenzschlüssel': "Windows 10 Pro Lizenz",
    'dvd-laufwerk': "Austausch DVD-Laufwerk",
    'ssd 2tb': "Einbau SSD 2TB (neu)",
    'msata ssd 128gb': "Einbau mSata SSD 128GB",
    'msata ssd 256gb': "Einbau mSata SSD 256GB",
    'msata ssd 512gb': "Einbau mSata SSD 512GB",
    'msata ssd 1tb': "Einbau mSata SSD 1TB",
    'm.2 ssd 64gb': "Einbau M.2 SSD 64GB (neu)",
    'm.2 ssd 120gb': "Einbau M.2 SSD 120GB (neu)",
    'm.2 ssd 250gb': "Einbau M.2 SSD 250GB (neu)",
    'm.2 ssd 500gb': "Einbau M.2 SSD 500GB (neu)",
    'm.2 ssd 1tb': "Einbau M.2 SSD 1TB (neu)",
    'm.2 ssd 2tb': "Einbau M.2 SSD 2TB (neu)",
    'akku original': "Austausch Akku Original",
    'display original': "Austausch Original Displayeinheit",
    'original display': "Austausch Original Displayeinheit",
    'original mainboard': "Austausch Original Mainboard",
    'original topcase mit tastatur und akku': "Austausch Original Topcase inkl. Tastatur und Akku",
    'original bottomcase': "Austausch Original Bottomcase",
    's-mobilgeräteschutz selbstbehalt': "Selbstbehalt S-Mobilgeräte",
    'rücksystem original': "Austausch Rücksystem Original"
}

def preprocess_repair_name(repair_name):
    """Convert /r in mappings to '' and standardize input"""
    if not isinstance(repair_name, str):
        return ""
    # Convert /r to '' in both mappings and input
    return repair_name.lower().strip().replace("/r", "''")


def load_devices(devices_file):
    """Load devices while handling duplicates"""
    devices = {}
    duplicates = defaultdict(int)
    max_id = 0
    
    with open(devices_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            original_id = int(row['device_id'])
            
            # Track max ID for reassignment
            max_id = max(max_id, original_id)
            
            # Handle duplicates
            if original_id in devices:
                duplicates[original_id] += 1
                new_id = max_id + duplicates[original_id]
                print(f"⚠️ Duplicate device_id {original_id} - Assigning new ID: {new_id}")
                device_id = new_id
            else:
                device_id = original_id
            
            devices[device_id] = {
                'model': row['device_name'].strip(),
                'brand': row['brand'].strip()
            }
    
    if duplicates:
        print(f"\n⚠️ Found {len(duplicates)} duplicate device IDs")
        print("Assigned new IDs to maintain uniqueness")
    
    return devices

def load_repair_types(repairtypes_file):
    repairs = {}
    with open(repairtypes_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            repairs[int(row['repair_type_id'])] = row['repair_type'].strip()
    return repairs

def find_device_id(devices, brand, model):
    """Exact match for devices"""
    brand_lower = brand.lower().strip()
    model_lower = model.lower().strip()
    for device_id, data in devices.items():
        if (data['brand'].lower() == brand_lower 
            and data['model'].lower() == model_lower):
            return device_id
    print(f"⚠️ No device match: {brand} {model}")
    return None


def find_repair_id(repairs, repair_name):
    """Improved matching with category handling"""
    if not repair_name:
        return None
        
    processed_input = preprocess_repair_name(repair_name)
    print(f"Matching: '{repair_name}' → processed: '{processed_input}'")

    # 1. Check if this is a category that needs sub-mapping
    for category, sub_mappings in REPAIR_NAME_MAPPING.items():
        if isinstance(sub_mappings, dict):
            processed_category = preprocess_repair_name(category)
            if processed_category in processed_input:
                print(f"Found category '{category}' in repair name")
                
                # Try to find which specific sub-type is mentioned
                for sub_key, sub_value in sub_mappings.items():
                    processed_sub = preprocess_repair_name(sub_key)
                    if processed_sub in processed_input:
                        print(f"Found sub-category: '{sub_key}' → '{sub_value}'")
                        # Find matching repair ID
                        target_value = preprocess_repair_name(sub_value)
                        for repair_id, name in repairs.items():
                            if preprocess_repair_name(name) == target_value:
                                return repair_id
                
                # If no sub-type found, show available options
                print(f"⚠️ Need to specify sub-type for '{category}'. Options are:")
                for sub_key in sub_mappings.keys():
                    print(f" - {sub_key}")
                return None
    
    # 2. Direct mapping check (for non-category repairs)
    for map_key, map_value in REPAIR_NAME_MAPPING.items():
        if not isinstance(map_value, dict):  # Skip categories
            processed_key = preprocess_repair_name(map_key)
            if processed_input == processed_key:
                print(f"Exact match: '{map_key}' → '{map_value}'")
                # Find the repair ID for the mapped value
                target_value = preprocess_repair_name(map_value)
                for repair_id, name in repairs.items():
                    if preprocess_repair_name(name) == target_value:
                        return repair_id
    
    # 3. Substring matching as fallback
    for repair_id, name in repairs.items():
        processed_name = preprocess_repair_name(name)
        if processed_input in processed_name or processed_name in processed_input:
            print(f"Substring match: '{repair_name}' ≈ '{name}'")
            return repair_id
    
    print(f"⚠️ No match for: '{repair_name}'")
    return None

def process_repairs(repairs_file, devices, repair_types):
    """Process repairs data and return tuples of (device_id, repair_type_id, sku, price)"""
    repair_data = []
    
    with open(repairs_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                sku = row['Artikelnummer'].strip()
                repair_name = row['Name'].strip()
                
                # Handle German-style decimal numbers (comma as decimal separator)
                price_str = row['Regulärer Preis'].strip().replace('.', '').replace(',', '.')
                price = float(price_str)
                
                brand = row['Brand'].strip()
                model = row['Model'].strip()
                
                device_id = find_device_id(devices, brand, model)
                repair_type_id = find_repair_id(repair_types, repair_name)
                
                if device_id and repair_type_id:
                    repair_data.append((device_id, repair_type_id, sku, price))
                else:
                    print(f"⚠️ Skipping repair (SKU: {sku}) due to missing device or repair type match")
            
            except ValueError as e:
                print(f"⚠️ Could not process price for SKU {sku}: {e}")
            except KeyError as e:
                print(f"⚠️ Missing expected column in CSV for row: {row}")
    
    return repair_data

def generate_output(repair_data, output_file):
    """Generate the final output file with the required format"""
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in repair_data:
            device_id, repair_type_id, sku, price = item
            f.write(f"({device_id},{repair_type_id},'{sku}',{price:.2f}),\n")

if __name__ == "__main__":
    # Clear the mismatch log file at start
    open("mismatched_repairs.log", "w").close()
    
    # Load all data
    devices = load_devices("devices.csv")
    repair_types = load_repair_types("repairtypes.csv")
    
    # Process repairs and generate output
    repair_data = process_repairs("repairs.csv", devices, repair_types)
    generate_output(repair_data, "output.txt")
    
    print(f"✅ Successfully processed {len(repair_data)} repairs")
    print("Output format: (device_id, repair_type_id, sku, price)")