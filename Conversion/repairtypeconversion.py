import json

def txt_to_json(input_file, output_file):
    repair_types = []
    
    # Define category mappings
    categories = {
        'G': 'Allgemein',
        'D': 'Display',
        'L': 'Laufwerke',
        'F': 'Festplatten',
        'R': 'RAM',
        'N': 'Netzteil',
        'Z': 'Zubehör',
        'S': 'Software',
        'A': 'Analysen',
        'O': 'Sonstige Reparaturen'
    }

    with open(input_file, 'r', encoding='utf-8') as file:
        for line in file:
            parts = line.strip().split(": ")
            if len(parts) == 2:
                code, repair_type = parts
                code = code.strip().replace('- ', '')
                repair_type = repair_type.strip()
                
                # Extract category from code prefix
                category = code[0] if code and code[0] in categories else 'O'
                category_name = categories[category]

                repair_types.append({
                    "repair_type": repair_type,
                    "code": code,
                    "category": category,
                    "category_name": category_name
                })

    json_data = {"repair_types": repair_types}

    with open(output_file, 'w', encoding='utf-8') as json_file:
        json.dump(json_data, json_file, indent=4, ensure_ascii=False)

# Example usage
input_file = 'repairtypes.txt'
output_file = 'repair_types.json'
txt_to_json(input_file, output_file)