/**
 * Verifies Task 2 acceptance criteria:
 * No OFF upload code is executed after ingredient contribution.
 */
describe('ContributeScreen: no OFF upload', () => {
  it('should not import OpenFoodFactsWriteClient', () => {
    // Dynamically import the module and check it doesn't reference the write client
    const fs = require('fs');
    const path = require('path');
    const contributePath = path.resolve(__dirname, '../ContributeScreen.tsx');
    const source = fs.readFileSync(contributePath, 'utf-8');

    expect(source).not.toContain('OpenFoodFactsWriteClient');
    expect(source).not.toContain('uploadProduct');
    expect(source).toContain('handleSaveLocally');
  });
});
