```markdown id="off-product-ui-minimal"
# OpenFoodFacts Product Details Integration Guide

## Goal

Build a clean and compact mobile product details screen using only the most important product data from the OpenFoodFacts API.

The implementation AI must:

- analyze the existing codebase first
- detect already implemented functionality
- improve existing UI/components instead of rebuilding everything
- reuse existing structures where possible
- extend missing functionality
- remove duplicate or unnecessary logic
- keep the UI resilient against missing API fields
- avoid overengineering
- optimize for mobile readability and fast scanning

Do NOT assume all products contain all fields.

Focus on simplicity, readability, and useful information.

---

# Product Screen Layout

Recommended order:

1. Header
2. Main Product Info
3. Nutrition Summary
4. Ingredients
5. Allergens
6. Nutrition Table
7. Product Images Gallery
8. Additional Information

---

# 1. Header

## Important API Data

- product name
- brand
- quantity
- main image
- barcode

## UI Requirements

- compact sticky header
- product image on top
- product name as main focus
- brand below product name
- quantity visible but secondary
- barcode copy button optional

## Important

- support long product names
- avoid oversized headers
- keep vertical space efficient

---

# 2. Main Product Info

## Important API Data

- categories
- nutriscore
- nova group

## UI Requirements

- compact info cards/chips
- quick readable summary
- minimal visual noise

## Example

- Nutri-Score badge
- NOVA level
- category chips

---

# 3. Nutrition Summary

## Important API Data

Main nutrients only:

- calories
- fat
- sugar
- protein
- salt

## UI Requirements

- compact summary row/cards
- easy to scan quickly
- prioritize readability
- avoid overly complex charts

## Important

This section should give the user a fast overview without opening the full nutrition table.

---

# 4. Ingredients

## Important API Data

- ingredients text
- additives
- allergens inside ingredients

## UI Requirements

- expandable section
- readable multiline text
- allergen highlighting
- additive highlighting optional
- support long ingredient lists

## Important

Ingredients are one of the most important sections.

Prioritize readability over visual effects.

---

# 5. Allergens

## Important API Data

- allergens
- traces

## UI Requirements

- clear warning section
- separate:
  - contains
  - may contain traces

- high contrast visibility
- compact warning chips/cards

## Important

This section must remain easy to notice.

---

# 6. Nutrition Table

## Important API Data

Core values only:

- energy
- fat
- saturated fat
- carbohydrates
- sugars
- fiber
- protein
- salt

Values:
- per 100g
- per serving (if available)

## UI Requirements

- simple table layout
- compact spacing
- aligned values
- no unnecessary graphics

## Important

Normalize inconsistent units and formatting before rendering.

---

# 7. Product Images Gallery

## Important API Data

- front image
- ingredients image
- nutrition image
- packaging image

## UI Requirements

- gallery near bottom of screen
- horizontally swipeable
- small preview thumbnails
- tap to fullscreen optional
- lazy loading
- placeholder for missing images

## Important

Images should NOT dominate the screen.

Keep them secondary to the actual product information.

---

# 8. Additional Information

## Important API Data

- categories
- origins
- manufacturing places
- stores
- last updated date

## UI Requirements

- compact collapsible section
- secondary visual priority
- simple rows/list layout

---

# Error Handling Requirements

The UI must gracefully handle:

- missing images
- missing nutrition values
- incomplete ingredients
- null fields
- empty arrays
- inconsistent formatting

Rules:

- never render empty sections
- never crash because of missing data
- hide unavailable information automatically
- avoid placeholder spam

---

# Mobile UX Requirements

Focus on:

- fast scrolling
- minimal clutter
- compact spacing
- one-hand usability
- readable typography
- collapsible sections
- smooth image swiping

Avoid:

- oversized cards
- excessive animations
- unnecessary charts
- too many colors
- visually noisy layouts

---

# Performance Requirements

- lazy load images
- cache product data
- minimize rerenders
- avoid rendering hidden sections
- defer low-priority content
- optimize long ingredient lists

---

# Required Implementation Tasks

## Existing Codebase Analysis

- inspect current product detail screen
- identify existing API integrations
- identify existing reusable components
- identify duplicated logic
- identify weak/inconsistent layouts
- identify hardcoded values
- improve existing implementations before adding new ones

---

# Data Layer Tasks

- map required API fields
- normalize nutrition values
- normalize ingredient formatting
- build fallback handling
- support partial/incomplete products
- centralize parsing logic

---

# UI Tasks

- improve product header
- improve nutrition summary
- improve ingredients section
- improve allergens section
- improve nutrition table
- implement compact image gallery
- improve spacing hierarchy
- improve typography consistency

---

# Final Quality Requirements

The final screen should:

- feel clean and modern
- prioritize important information
- remain compact
- avoid overwhelming the user
- scale well to incomplete data
- work smoothly on small screens
- stay visually stable while loading
- keep the most important information immediately visible
```
