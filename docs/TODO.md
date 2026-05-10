# Development Tasks

## Task 0: Audit Current OpenFoodFacts API Integration

**Status:** Not Started

**Description:**
Investigate and document how the OpenFoodFacts API is currently integrated in the codebase, if at all. This includes identifying existing API client code, current endpoints being used, authentication methods, error handling, and any missing functionality.

**Scope:**
- [ ] Search for all OpenFoodFacts API client code in `App/src/infrastructure/api/` and related directories
- [ ] Document what API endpoints are currently being called
- [ ] List any existing helper functions or utilities related to OFF integration
- [ ] Note current authentication mechanism (if any)
- [ ] Identify error handling strategies currently in place
- [ ] Document which endpoints are missing but needed based on Task 1 requirements
- [ ] Create a summary document of findings

**Output:**
A brief report (e.g., `docs/CURRENT_API_STATUS.md`) documenting the current state so subsequent tasks can build upon or replace existing code appropriately.

---

## Task 1: OpenFoodFacts API Integration

**Status:** Not Started

**Description:**
Properly integrate the OpenFoodFacts API and verify functionality through comprehensive tests.

**Reference Documentation:**
- [OpenFoodFacts API Reference](openfoodfacts_api_reference.md) — Complete technical reference for all API endpoints, authentication, rate limits, and error handling
- [TODO_OFF.md](TODO_OFF.md) — Step-by-step implementation guide with acceptance criteria for each phase (Setup → Production Go-Live)
- Start with Task 0 findings to understand what needs to be replaced or improved

---

## Task 2: Remove Upload-to-OFF Prompt After Contributing Missing Ingredients


**Description:**
After a user manually adds missing ingredients to a scanned product and completes the contribution form, the application currently displays a button prompting the user to upload the product to the OpenFoodFacts database. This prompt should be removed.

**Current Behavior:**
1. User scans a product with missing ingredients
2. User is prompted to take a photo and add missing ingredients
3. User completes the contribution form
4. A button appears asking: "Do you want to upload to OpenFoodFacts?"

**Expected Behavior:**
- After completing the ingredient contribution form, only a "Save Locally" button should appear
- The product is saved to the local database only
- Uploading to OpenFoodFacts should occur at a different location in the user flow (out of scope for this task)

**Acceptance Criteria:**
- [ ] Remove the "Upload to OFF" button from the post-contribution screen
- [ ] Display only the "Save Locally" button
- [ ] Product data is correctly saved to the local SQLite database
- [ ] Tests verify that no upload-related code is executed after ingredient contribution

---

## Task 3: Fix Product Data Persistence and Add Local vs. OFF Data Source Toggle


**Description:**
When a user adds missing ingredients and other product information locally, the application should recognize that all required information is now available. Currently, when viewing a previously contributed product in the catalog, the app incorrectly reports that ingredients are still missing, prompting the user to add them again despite the local contribution.

### Subtask 3A: Fix Missing Ingredient Recognition

**Current Behavior:**
1. User scans a product with missing ingredients (e.g., name, brand, category, nutrition facts, ingredients)
2. User photographs and enters missing ingredients
3. User enters additional product information (brand, category, nutrition facts)
4. Product is saved locally with complete information
5. User opens the product from the catalog
6. App displays error: "Missing ingredients" and prompts to re-enter data

**Expected Behavior:**
- App correctly recognizes that ingredients and other information have been added locally
- No re-entry prompt is displayed for products with complete local data

**Acceptance Criteria:**
- [ ] Local product repository correctly identifies when all required fields are present
- [ ] ResultScreen/CatalogScreen checks local data before requesting missing information
- [ ] Product details are loaded from the local database without re-entry prompts
- [ ] Tests verify correct detection of missing vs. complete product data

### Subtask 3B: Implement Data Source Toggle

**Description:**
Add a toggle switch to allow users to switch between viewing:
- **Option A:** Product information from the OpenFoodFacts database
- **Option B:** Product information from the local device database

**Expected Behavior:**
- A toggle switch appears in the product view (e.g., in ResultScreen or CatalogScreen)
- Toggle displays: "OFF Database" ↔ "Local Database"
- Selecting a data source loads and displays product information from that source
- The active data source is visually indicated

**Acceptance Criteria:**
- [ ] Toggle component is implemented and visible in product detail views
- [ ] Selecting "OFF Database" loads product data from OpenFoodFacts API
- [ ] Selecting "Local Database" loads product data from SQLite repository
- [ ] UI clearly indicates which data source is currently active
- [ ] Both data sources can be accessed without re-scanning the product
- [ ] Tests verify that data is correctly loaded from the selected source

### Subtask 3C: Enable Data Merging and Synchronization (Optional Enhancement)

**Description:**
Allow users to merge data from both sources and choose which values to keep (e.g., title from OFF, but nutrition facts from local database).

**Note:** This is an enhancement feature. Prioritize 3A and 3B first.

**Possible Future Behavior:**
- User can select which fields to merge (e.g., "Use OFF title + local nutrition facts")
- Merged data can be pushed to both local and OFF databases
- Synchronization creates a unified product record

**Acceptance Criteria (Future):**
- [ ] UI provides a way to select fields from each source
- [ ] Merged data is saved correctly to both databases (when applicable)
- [ ] Synchronization does not overwrite unmodified data 

