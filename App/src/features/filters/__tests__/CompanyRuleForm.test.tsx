import { useState } from 'react';
import { ScrollView } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createTranslator } from '../../../i18n/useTranslation';
import type { CompanyData } from '../../../domain/analysis/companyRules';
import { CompanyRuleForm, NAMES_PAGE_SIZE } from '../CompanyRuleForm';

const mockCollect = jest.fn();
jest.mock('../../../services/CompanyLookupService', () => ({
  ...jest.requireActual('../../../services/CompanyLookupService'),
  collectCompanyNames: (...args: unknown[]) => mockCollect(...args),
}));

// The icon font loads asynchronously and would update outside act().
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const t = createTranslator('de');

function Harness({
  initial,
  onData,
}: {
  initial: CompanyData;
  onData?: (data: CompanyData) => void;
}) {
  const [data, setData] = useState<CompanyData | null>(initial);
  return (
    <ScrollView>
      <CompanyRuleForm
        name="Nestlé"
        data={data}
        language="de"
        t={t}
        onChange={({ companyData }) => {
          if (companyData === undefined) return;
          setData(companyData);
          if (companyData) onData?.(companyData);
        }}
        onBusyChange={() => {}}
      />
    </ScrollView>
  );
}

const manyNames = ['Nestlé', ...Array.from({ length: 249 }, (_, i) => `Marke ${i + 1}`)];

describe('CompanyRuleForm', () => {
  it('switches single names off and counts the active ones', () => {
    let latest: CompanyData | undefined;
    render(
      <Harness
        initial={{ wikidataId: 'Q160746', names: ['Nestlé', 'Maggi', 'Arpège'] }}
        onData={(data) => (latest = data)}
      />
    );
    fireEvent.press(screen.getByText('Namen anzeigen'));
    expect(screen.getByText('3 von 3 Marken aktiv')).toBeTruthy();

    fireEvent.press(screen.getByTestId('company-name-Arpège'));
    expect(screen.getByText('2 von 3 Marken aktiv')).toBeTruthy();
    expect(latest?.excluded).toEqual(['Arpège']);

    // The rule's own name cannot be switched off.
    fireEvent.press(screen.getByTestId('company-name-Nestlé'));
    expect(screen.getByText('2 von 3 Marken aktiv')).toBeTruthy();

    fireEvent.press(screen.getByTestId('company-name-Arpège'));
    expect(screen.getByText('3 von 3 Marken aktiv')).toBeTruthy();
  });

  it('pages and filters 250 names without a nested VirtualizedList', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Harness initial={{ wikidataId: 'Q160746', names: manyNames }} />);
    fireEvent.press(screen.getByText('Namen anzeigen'));

    expect(screen.getByText('250 von 250 Marken aktiv')).toBeTruthy();
    expect(screen.queryAllByTestId(/^company-name-Marke/)).toHaveLength(NAMES_PAGE_SIZE - 1);
    fireEvent.press(screen.getByTestId('company-show-more'));
    expect(screen.queryAllByTestId(/^company-name-Marke/)).toHaveLength(2 * NAMES_PAGE_SIZE - 1);

    fireEvent.changeText(screen.getByTestId('company-names-filter'), 'marke 24');
    // Marke 24 and Marke 240 to 249.
    expect(screen.queryAllByTestId(/^company-name-/)).toHaveLength(11);
    fireEvent.press(screen.getByTestId('company-name-Marke 240'));
    expect(screen.getByText('249 von 250 Marken aktiv')).toBeTruthy();

    const messages = error.mock.calls.map((call) => String(call[0]));
    expect(messages.some((message) => message.includes('VirtualizedList'))).toBe(false);
    error.mockRestore();
  });

  it('keeps exclusions of names that are still collected after a refresh', async () => {
    mockCollect.mockResolvedValue({ wikidataId: 'Q160746', names: ['Nestlé', 'Maggi', 'Lion'] });
    let latest: CompanyData | undefined;
    render(
      <Harness
        initial={{
          wikidataId: 'Q160746',
          names: ['Nestlé', 'Maggi', 'Arpège', 'Lion'],
          excluded: ['Arpège', 'Lion'],
        }}
        onData={(data) => (latest = data)}
      />
    );
    fireEvent.press(screen.getByTestId('company-refresh'));

    await waitFor(() => expect(latest?.names).toEqual(['Nestlé', 'Maggi', 'Lion']));
    expect(latest?.excluded).toEqual(['Lion']);
  });
});
