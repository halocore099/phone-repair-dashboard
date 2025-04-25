import re
from collections import defaultdict

def clean_sql_file(input_file, output_file):
    seen_pairs = set()
    cleaned_lines = []
    duplicate_count = 0
    current_table = None
    insert_started = False

    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            # Track current table
            if 'INSERT INTO' in line:
                current_table = line.split('INSERT INTO ')[1].split(' ')[0].strip()
                insert_started = True
                cleaned_lines.append(line)
                continue
            
            if current_table == 'device_repairs' and insert_started:
                # Handle lines with incomplete value groups
                if line.strip() == ',':
                    continue  # Skip empty lines with just commas
                
                # Extract all complete value groups
                value_groups = re.findall(r'\(([^)]+)\)', line)
                
                # Handle cases where closing ) is missing
                if '(' in line and ')' not in line:
                    # Try to extract the values anyway
                    partial_group = line[line.find('(')+1:].strip()
                    if partial_group:
                        value_groups.append(partial_group)
                
                for group in value_groups:
                    parts = [x.strip().strip("'\"") for x in group.split(',') if x.strip()]
                    if len(parts) < 4:  # Skip incomplete entries
                        continue
                        
                    try:
                        device_id = int(parts[0])
                        repair_id = int(parts[1])
                        pair_key = (device_id, repair_id)
                        
                        if pair_key not in seen_pairs:
                            seen_pairs.add(pair_key)
                            # Reconstruct properly formatted value group
                            formatted_values = []
                            for i, part in enumerate(parts[:4]):  # Only take first 4 values
                                if i in (0, 1):  # device_id and repair_id
                                    formatted_values.append(part)
                                elif i == 3:  # price (ensure it's numeric)
                                    try:
                                        price = float(part.replace("'", ""))
                                        formatted_values.append(f"{price:.2f}")
                                    except ValueError:
                                        formatted_values.append("0.00")
                                else:  # sku
                                    formatted_values.append(f"'{part}'" if not part.startswith("'") else part)
                            
                            cleaned_lines.append(f"({','.join(formatted_values)})")
                        else:
                            duplicate_count += 1
                    except (ValueError, IndexError) as e:
                        print(f"⚠️ Bad format in group: {group} - Error: {str(e)}")
                
                # Handle line endings
                if line.strip().endswith(';'):
                    insert_started = False
                    if cleaned_lines and not cleaned_lines[-1].endswith(')'):
                        cleaned_lines[-1] = cleaned_lines[-1] + ')'
                    cleaned_lines[-1] = cleaned_lines[-1] + ';\n'
                elif cleaned_lines and not cleaned_lines[-1].endswith((')', ',')):
                    cleaned_lines[-1] = cleaned_lines[-1] + ',\n'
                continue
            
            cleaned_lines.append(line)

    # Reconstruct the SQL with proper formatting
    final_output = []
    i = 0
    while i < len(cleaned_lines):
        line = cleaned_lines[i]
        if 'INSERT INTO device_repairs' in line:
            # Find all subsequent value lines
            values = []
            i += 1
            while i < len(cleaned_lines) and not cleaned_lines[i].strip().startswith('INSERT INTO'):
                val = cleaned_lines[i].strip()
                if val.endswith((')', ');', '),')):
                    values.append(val)
                i += 1
            
            # Rebuild the INSERT statement with proper formatting
            final_output.append(line)
            if values:
                final_output.append("VALUES\n")
                # Ensure proper comma separation
                formatted_values = []
                for val in values:
                    if val.endswith(');'):
                        formatted_values.append(val[:-2] + ')')
                    elif val.endswith('),'):
                        formatted_values.append(val[:-1])
                    else:
                        formatted_values.append(val)
                final_output.append(",\n".join(formatted_values) + ";\n")
            continue
        
        final_output.append(line)
        i += 1

    # Write output with proper line endings
    with open(output_file, 'w', encoding='utf-8', newline='\n') as f:
        f.write(''.join(final_output))

    print(f"Removed {duplicate_count} duplicates")
    print(f"Final unique pairs: {len(seen_pairs)}")
    print(f"Clean file saved to: {output_file}")

if __name__ == "__main__":
    clean_sql_file("mismatched_repairs.log", "output_clean.log")