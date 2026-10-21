/** Legend/search metadata from the retained regional keyboard tables. */
export interface KeyLabel {
  label: string;
  label2?: string;
  shortLabel?: string;
  shortLabel2?: string;
  fnLabel?: string;
  fnLabel2?: string;
  fnLabel3?: string;
  fontSize?: number;
  activationKeyText: string;
  keyTerms: string[];
  remapPrefix?: string;
}
export type KeyLabelRecord = Partial<Record<number, KeyLabel>>;
