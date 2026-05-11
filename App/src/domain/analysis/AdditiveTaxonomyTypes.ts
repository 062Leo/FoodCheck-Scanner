export type AdditiveFunctionClass =
  | 'Farbstoff'
  | 'Konservierungsstoff'
  | 'Antioxidationsmittel'
  | 'Säuerungsmittel'
  | 'Verdickungsmittel'
  | 'Emulgator'
  | 'Stabilisator'
  | 'Geschmacksverstärker'
  | 'Süßungsmittel'
  | 'Treibgas'
  | 'Feuchthaltemittel'
  | 'Trennmittel'
  | 'Schaumverhüter'
  | 'Mehlbehandlungsmittel'
  | 'Festigungsmittel'
  | 'Gelier- und Bindemittel'
  | 'Backtriebmittel'
  | 'Zuckeraustauschstoff'
  | 'Überzugsmittel'
  | 'Füllstoff'
  | 'Konservierungs- und Antioxidationsmittel';

export type AdditiveRiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface AdditiveInfo {
  eNumber: string;
  name: string;
  functionClass: AdditiveFunctionClass;
  riskLevel: AdditiveRiskLevel;
  aliases: string[];
}

export const isHighRisk = (a: AdditiveInfo): boolean => a.riskLevel === 'high';
export const isMediumRisk = (a: AdditiveInfo): boolean => a.riskLevel === 'medium';
export const isLowRisk = (a: AdditiveInfo): boolean => a.riskLevel === 'low';
export const isSafe = (a: AdditiveInfo): boolean => a.riskLevel === 'none';
