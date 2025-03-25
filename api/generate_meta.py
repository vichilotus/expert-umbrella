import json
import os

# Filepath for the input metadata file
input_filepath = r"c:\Users\Honey\Documents\vscode\expert-umbrella\api\nft_metadata.json"

# Directory for the output JSON files
output_dir = r"c:\Users\Honey\Documents\vscode\expert-umbrella\api\creatures"

# Ensure the output directory exists
os.makedirs(output_dir, exist_ok=True)

# Load the original metadata
with open(input_filepath, "r") as file:
    metadata = json.load(file)

all_clones = {}

# Generate and save clones for each creature
for entry in metadata:
    token_id = entry["tokenId"]
    group_key = f"{int(token_id):03d}"  # Pad the tokenId to a three-digit string
    clones = []

    # Create 1024 clones for the current creature
    for i in range(1024):
        clone = entry.copy()
        clone["id"] = str(i)  # Save id as a string
        clone["name"] = f"{entry['name']} #{i + 1}"
        del clone["tokenId"]  # Remove the original tokenId field

        # Move "id" to the first position
        clone = {"id": clone.pop("id"), **clone}

        clones.append(clone)

    all_clones[group_key] = clones

# Split the clones into two files
keys = list(all_clones.keys())
mid_index = len(keys) // 2
clones_part1 = {key: all_clones[key] for key in keys[:mid_index]}
clones_part2 = {key: all_clones[key] for key in keys[mid_index:]}

# Save the clones to two separate JSON files
output_file1 = os.path.join(output_dir, "clones_part1.json")
output_file2 = os.path.join(output_dir, "clones_part2.json")

with open(output_file1, "w") as file:
    json.dump(clones_part1, file, indent=4)

with open(output_file2, "w") as file:
    json.dump(clones_part2, file, indent=4)

print(f"Clones saved to {output_file1} and {output_file2}")