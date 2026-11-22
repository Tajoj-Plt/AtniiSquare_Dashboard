/**
 * Countries, as ISO 3166-1 alpha-2 codes.
 *
 * Only the codes are stored here. Their names come from `Intl.DisplayNames`, which the
 * browser already ships in every locale the dashboard supports — so "السودان" and "Sudan"
 * are the same row, and adding a language never means translating 250 country names by
 * hand. The list is ordered with Sudan and its neighbours first, then the countries the
 * diaspora actually lives in, then everything else alphabetically by code; a picker that
 * opens on Sudan saves the typical operator the search entirely.
 */

const PRIORITY = [
  'SD', 'SS', 'EG', 'ER', 'ET', 'TD', 'LY', 'CF', 'KE', 'UG',
  'SA', 'AE', 'QA', 'KW', 'OM', 'BH', 'JO', 'TR', 'GB', 'US', 'CA', 'DE', 'FR', 'MY',
];

const REST = [
  'AD', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CC', 'CD', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO',
  'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EH',
  'ES', 'FI', 'FJ', 'FK', 'FM', 'FO', 'GA', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM',
  'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU',
  'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JP', 'KG', 'KH',
  'KI', 'KM', 'KN', 'KP', 'KR', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT',
  'LU', 'LV', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP',
  'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI',
  'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN',
  'PR', 'PS', 'PT', 'PW', 'PY', 'RE', 'RO', 'RS', 'RU', 'RW', 'SB', 'SC', 'SE', 'SG', 'SH',
  'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TG',
  'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UM', 'UY', 'UZ',
  'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
];

export const COUNTRY_CODES = [...PRIORITY, ...REST];

/** Codes that should sit at the top of a picker, before the alphabetical remainder. */
export const COUNTRY_PRIORITY_COUNT = PRIORITY.length;

const cache = new Map<string, Intl.DisplayNames>();

/**
 * The country's name in the reader's language, falling back to the code itself.
 *
 * `Intl.DisplayNames` throws on a malformed code rather than returning undefined, and the
 * database can hold anything two letters long, so the lookup is guarded — an unrecognised
 * code should render as a code, not take the page down.
 */
export function countryName(code: string | null | undefined, lang = 'en'): string {
  if (!code) return '';
  try {
    let names = cache.get(lang);
    if (!names) {
      names = new Intl.DisplayNames([lang], { type: 'region' });
      cache.set(lang, names);
    }
    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/**
 * The flag emoji for a country, built from regional indicator symbols.
 *
 * Cheap visual anchoring in a list of 250 near-identical rows. Platforms that do not draw
 * flags render the two letters instead, which is still the right answer.
 */
export function countryFlag(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/**
 * A language's name in the reader's language, from `Intl.DisplayNames` — "الفرنسية" and
 * "French" without a translation table. `other` has no ISO code, so its label is passed in.
 */
export function languageName(code: string | null | undefined, lang = 'en', otherLabel = 'Other'): string {
  if (!code) return '';
  if (code === 'other') return otherLabel;
  try {
    return new Intl.DisplayNames([lang], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}
