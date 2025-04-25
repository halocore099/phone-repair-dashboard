import csv

def load_device_types(device_types_file):
    """Load SKU to device type mapping"""
    sku_to_type = {}
    with open(device_types_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f, delimiter='\t')
        next(reader)  # Skip header
        for row in reader:
            if len(row) >= 2:
                sku_to_type[row[0]] = row[1]
    return sku_to_type

def process_repair_data(repair_file, sku_to_type, output_file):
    """Create CSV with device_id and device_type"""
    with open(repair_file, 'r', encoding='utf-8') as infile, \
         open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        
        writer = csv.writer(outfile)
        writer.writerow(['device_id', 'device_type'])  # Write header
        
        for line in infile:
            line = line.strip()
            if line.startswith('(') and line.endswith('),'):
                # Extract device_id and SKU from repair data
                parts = line[1:-2].split(',')
                device_id = parts[0].strip()
                sku = parts[2].strip().strip("'")
                
                # Get matching device type
                device_type = sku_to_type.get(sku, 'unknown')
                
                # Write to CSV
                writer.writerow([device_id, device_type])

if __name__ == "__main__":
    # File paths
    device_types_file = "device_types.csv"  # File with SKU to device_type mapping
    repair_file = "output.txt"             # Your existing repair data
    output_file = "device_types_final.csv" # Final CSV output
    
    print("Loading device types...")
    sku_to_type = load_device_types(device_types_file)
    
    print("Processing repair data...")
    process_repair_data(repair_file, sku_to_type, output_file)
    
    print(f"✅ Final CSV saved to {output_file}")
    print("Format: device_id,device_type")