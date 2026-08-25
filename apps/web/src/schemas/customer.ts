export const PersonType = {
  FISICA: "FISICA",
  JURIDICA: "JURIDICA",
} as const;

export type PersonType = (typeof PersonType)[keyof typeof PersonType];

// constants/labels.ts
export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  [PersonType.FISICA]: "Pessoa Física",
  [PersonType.JURIDICA]: "Pessoa Jurídica",
};

// Mapeamento inverso
export const PERSON_TYPE_VALUES: Record<string, PersonType> = {
  "Pessoa Física": PersonType.FISICA,
  "Pessoa Jurídica": PersonType.JURIDICA,
};

export const PERSON_TYPE_OPTIONS = Object.values(PersonType).map((value) => ({
  value,
  label: PERSON_TYPE_LABELS[value],
}));
