export const CIRCULAR_CATEGORIES = [
  'Savings',
  'PLI/RPLI',
  'BD',
  'CCS',
  'Mail',
  'Finacle',
  'APT 2.0',
  'Aadhaar',
  'POSB Orders',
  'CBS Manual',
  'Rules/Regulations',
  'Guide',
  'Philately',
  'Accounting',
  'Others',
] as const;

export type CircularCategory = typeof CIRCULAR_CATEGORIES[number];
