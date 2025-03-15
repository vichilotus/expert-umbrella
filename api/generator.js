const fs = require("node:fs");
const path = require("node:path");

// Read nft_metadata.json
const nftMetadataPath = path.join(__dirname, "nft_metadata.json");
const nftMetadata = JSON.parse(fs.readFileSync(nftMetadataPath, "utf8"));

// Function to generate data
function generateData(numClones) {
  const generatedData = [];

  // Step 1: Clone each name numClones times and randomize the order
  const clonedNames = [];
  for (const meta of nftMetadata) {
    const { tokenId, ...rest } = meta;
    for (let i = 1; i <= numClones; i++) {
      clonedNames.push({
        ...rest,
        name: `${rest.name} #${String(i).padStart(4, "0")}`
      });
    }
  }
  clonedNames.sort(() => Math.random() - 0.5);

  // Step 2: For each entry, randomly choose a name from the cloned names
  for (let i = 1; i <= clonedNames.length; i++) {
    let item;
    while (!item) {
      const randomIndex = Math.floor(Math.random() * clonedNames.length);
      item = clonedNames[randomIndex];
      if (item) {
        clonedNames.splice(randomIndex, 1); // Remove the chosen item
      }
    }
    generatedData.push({ id: i, ...item });
  }

  return generatedData;
}

// Save generated data to db.json
function saveToDb(data) {
  const dbPath = path.join(__dirname, "..", "db.json");

  // Clear db.json before saving new data
  const db = { api: [] };

  // Save each entry without the index
  for (const item of data) {
    db.api.push(item);
  }

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
}

// Generate and save data
const numClones = 1234; // Set the number of clones as a parameter
const generatedData = generateData(numClones);
saveToDb(generatedData);

console.log(`Data generated and saved to db.json. Number of entries: ${generatedData.length}`);
