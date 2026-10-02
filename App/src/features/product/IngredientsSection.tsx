import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Product } from '../../types/Product';
import type { TranslateFn } from '../../i18n/useTranslation';
import type { SupportedLanguage } from '../../i18n/translations';
import { languageLabel } from '../../i18n/languageLabel';
import { TranslationRouter } from '../../infrastructure/translation/TranslationRouter';
import { Button, Card, Chip, SectionTitle } from '../../ui/components';
import { colors, spacing, typography } from '../../ui/theme';

const UNKNOWN_LANGUAGE = '?';
const translationRouter = new TranslationRouter();

/** Ingredient texts by language code, UI language first. */
export function ingredientsByLanguage(
  product: Product,
  uiLanguage: SupportedLanguage
): [string, string][] {
  const map = new Map<string, string>();
  const add = (lang: string, text: string | undefined) => {
    if (text?.trim() && !map.has(lang)) map.set(lang, text.trim());
  };
  add('de', product.ingredientsTextDe);
  add('en', product.ingredientsTextEn);
  for (const [lang, text] of Object.entries(product.ingredientsTextByLang ?? {})) add(lang, text);
  if (map.size === 0) add(UNKNOWN_LANGUAGE, product.ingredientsText);

  return [...map.entries()].sort(([a], [b]) => {
    if (a === uiLanguage) return -1;
    if (b === uiLanguage) return 1;
    return 0;
  });
}

export function IngredientsSection({
  product,
  t,
  language,
}: {
  product: Product;
  t: TranslateFn;
  language: SupportedLanguage;
}) {
  const entries = useMemo(() => ingredientsByLanguage(product, language), [product, language]);
  const [selected, setSelected] = useState(0);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);

  if (entries.length === 0) return null;
  const [lang, text] = entries[Math.min(selected, entries.length - 1)];
  const target: SupportedLanguage = language;
  const canTranslate = lang !== target;
  // Keyed by the text too, so an edited ingredient list never shows the old translation.
  const translationKey = `${lang}>${target}>${text}`;
  const translation = translations[translationKey];

  const translate = async () => {
    setTranslating(true);
    setTranslationFailed(false);
    try {
      const translated = await translationRouter.translate(text, target);
      if (translated && translated !== text) {
        setTranslations((previous) => ({ ...previous, [translationKey]: translated }));
      } else {
        setTranslationFailed(true);
      }
    } catch {
      setTranslationFailed(true);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <View>
      <SectionTitle>{t('product.ingredients')}</SectionTitle>
      {entries.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {entries.map(([code], index) => (
            <Chip
              key={code}
              label={languageLabel(code, t)}
              selected={index === selected}
              onPress={() => {
                setSelected(index);
                setTranslationFailed(false);
              }}
            />
          ))}
        </ScrollView>
      )}
      <Card>
        <Text style={styles.text} selectable>
          {text}
        </Text>
        {translation ? (
          <View style={styles.translation}>
            <Text style={styles.translationLabel}>
              {t('product.translated', { lang: languageLabel(target, t) })}
            </Text>
            <Text style={styles.text} selectable>
              {translation}
            </Text>
          </View>
        ) : canTranslate ? (
          <Button
            title={t('a11y.translateTo', { lang: languageLabel(target, t) })}
            icon="language-outline"
            variant="ghost"
            loading={translating}
            onPress={() => void translate()}
            style={styles.translateButton}
          />
        ) : null}
        {translationFailed && <Text style={styles.error}>{t('product.translationFailed')}</Text>}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing.sm, paddingBottom: spacing.sm },
  text: { ...typography.body, color: colors.textSecondary },
  translation: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  translationLabel: { ...typography.label, color: colors.accent },
  translateButton: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingHorizontal: 0 },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
});
