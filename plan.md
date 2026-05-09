OCR Post-Processing (SymSpell + Entity Extraction)
Input:
Raw text string from Google ML Kit Text Recognition V2.

Objective:
Build a modular processing class to clean the raw string using a dual-layer approach.

Step 1: Entity Extraction (ML Kit)

Use ML Kit Entity Extraction to identify and segment specific entities (Dates, Quantities, or custom patterns) from the raw OCR string.

Use this to structure the messy "wall of text" into logical segments before spell-checking.

Step 2: Fuzzy Correction (SymSpell)

Take the segmented text/tokens and run them through SymSpell.

Use a local ingredients.txt (Open Food Facts) as the dictionary.

Fix typos (e.g., "VWater" -> "Water", "orargetuice" -> "orange juice").

Requirements:

Language: Handle German and English.

Offline: 100% on-device.

Modular: Create a standalone "TextProcessor" class that takes a string and returns the cleaned/corrected version.

Performance: Optimized for near-instant execution.

Task:
Provide the implementation logic for this hybrid pipeline (Entity Extraction -> SymSpell) as a reusable module.