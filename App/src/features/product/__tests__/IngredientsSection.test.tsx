import { fireEvent, render, screen } from '@testing-library/react-native';
import { createTranslator } from '../../../i18n/useTranslation';
import type { Product } from '../../../types/Product';
import { IngredientsSection } from '../IngredientsSection';

const mockTranslate = jest.fn();
jest.mock('../../../infrastructure/translation/TranslationRouter', () => ({
  TranslationRouter: jest.fn().mockImplementation(() => ({
    translate: (...args: unknown[]) => mockTranslate(...args),
  })),
}));

const t = createTranslator('de');
const product = (text: string): Product => ({ ean: '1', name: 'Limo', ingredientsTextEn: text });

describe('IngredientsSection', () => {
  it('drops a translation once the ingredient text has changed', async () => {
    mockTranslate.mockResolvedValue('Wasser, Zucker');
    const { rerender } = render(
      <IngredientsSection product={product('Water, sugar')} t={t} language="de" />
    );

    fireEvent.press(screen.getByText(/^Übersetzen nach/));
    expect(await screen.findByText('Wasser, Zucker')).toBeTruthy();

    rerender(<IngredientsSection product={product('Water, salt')} t={t} language="de" />);

    expect(screen.queryByText('Wasser, Zucker')).toBeNull();
    expect(screen.getByText(/^Übersetzen nach/)).toBeTruthy();
  });
});
