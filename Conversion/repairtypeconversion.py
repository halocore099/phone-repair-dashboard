import json

# Function to convert txt to json with UTF-8 handling
def txt_to_json(input_file, output_file):
    repair_types = []

    # Open and read the txt file with UTF-8 encoding
    with open(input_file, 'r', encoding='utf-8') as file:
        for line in file:
                    # Split the line into code and repair type
                    parts = line.strip().split(": ")
                    if len(parts) == 2:
                        code, repair_type = parts
                        code = code.strip().replace('- ', '')  # Remove '- ' from the code part
                        repair_type = repair_type.strip()
                        repair_types.append({"repair_type": repair_type, "code": code})

    # Create the JSON data
    json_data = {"repair_types": repair_types}

    # Write the data to a JSON file with UTF-8 encoding
    with open(output_file, 'w', encoding='utf-8') as json_file:
        json.dump(json_data, json_file, indent=4, ensure_ascii=False)

# Example usage
input_file = 'repairtypes.txt'  # Input txt file name
output_file = 'repair_types.json'  # Output json file name
txt_to_json(input_file, output_file)    