// Countries a client can pick as where they live (GRIZZ 2026-11-19). Tap
// only: a few common ones as buttons, the rest by first letter. Saved as the
// two-letter ISO code (clients.residence_country, 0227).

export const COUNTRIES: [code: string, name: string][] = [
  ["AF", "Afghanistan"], ["AL", "Albania"], ["DZ", "Algeria"], ["AD", "Andorra"], ["AO", "Angola"],
  ["AG", "Antigua and Barbuda"], ["AR", "Argentina"], ["AM", "Armenia"], ["AU", "Australia"], ["AT", "Austria"],
  ["AZ", "Azerbaijan"], ["BS", "Bahamas"], ["BH", "Bahrain"], ["BD", "Bangladesh"], ["BB", "Barbados"],
  ["BY", "Belarus"], ["BE", "Belgium"], ["BZ", "Belize"], ["BJ", "Benin"], ["BT", "Bhutan"],
  ["BO", "Bolivia"], ["BA", "Bosnia and Herzegovina"], ["BW", "Botswana"], ["BR", "Brazil"], ["BN", "Brunei"],
  ["BG", "Bulgaria"], ["BF", "Burkina Faso"], ["BI", "Burundi"], ["CV", "Cabo Verde"], ["KH", "Cambodia"],
  ["CM", "Cameroon"], ["CA", "Canada"], ["CF", "Central African Republic"], ["TD", "Chad"], ["CL", "Chile"],
  ["CN", "China"], ["CO", "Colombia"], ["KM", "Comoros"], ["CG", "Congo"], ["CD", "Congo (DRC)"],
  ["CR", "Costa Rica"], ["CI", "Côte d'Ivoire"], ["HR", "Croatia"], ["CU", "Cuba"], ["CY", "Cyprus"],
  ["CZ", "Czechia"], ["DK", "Denmark"], ["DJ", "Djibouti"], ["DM", "Dominica"], ["DO", "Dominican Republic"],
  ["EC", "Ecuador"], ["EG", "Egypt"], ["SV", "El Salvador"], ["GQ", "Equatorial Guinea"], ["ER", "Eritrea"],
  ["EE", "Estonia"], ["SZ", "Eswatini"], ["ET", "Ethiopia"], ["FJ", "Fiji"], ["FI", "Finland"],
  ["FR", "France"], ["GA", "Gabon"], ["GM", "Gambia"], ["GE", "Georgia"], ["DE", "Germany"],
  ["GH", "Ghana"], ["GR", "Greece"], ["GD", "Grenada"], ["GT", "Guatemala"], ["GN", "Guinea"],
  ["GW", "Guinea-Bissau"], ["GY", "Guyana"], ["HT", "Haiti"], ["HN", "Honduras"], ["HK", "Hong Kong"],
  ["HU", "Hungary"], ["IS", "Iceland"], ["IN", "India"], ["ID", "Indonesia"], ["IR", "Iran"],
  ["IQ", "Iraq"], ["IE", "Ireland"], ["IL", "Israel"], ["IT", "Italy"], ["JM", "Jamaica"],
  ["JP", "Japan"], ["JO", "Jordan"], ["KZ", "Kazakhstan"], ["KE", "Kenya"], ["KI", "Kiribati"],
  ["KW", "Kuwait"], ["KG", "Kyrgyzstan"], ["LA", "Laos"], ["LV", "Latvia"], ["LB", "Lebanon"],
  ["LS", "Lesotho"], ["LR", "Liberia"], ["LY", "Libya"], ["LI", "Liechtenstein"], ["LT", "Lithuania"],
  ["LU", "Luxembourg"], ["MO", "Macao"], ["MG", "Madagascar"], ["MW", "Malawi"], ["MY", "Malaysia"],
  ["MV", "Maldives"], ["ML", "Mali"], ["MT", "Malta"], ["MH", "Marshall Islands"], ["MR", "Mauritania"],
  ["MU", "Mauritius"], ["MX", "Mexico"], ["FM", "Micronesia"], ["MD", "Moldova"], ["MC", "Monaco"],
  ["MN", "Mongolia"], ["ME", "Montenegro"], ["MA", "Morocco"], ["MZ", "Mozambique"], ["MM", "Myanmar"],
  ["NA", "Namibia"], ["NR", "Nauru"], ["NP", "Nepal"], ["NL", "Netherlands"], ["NZ", "New Zealand"],
  ["NI", "Nicaragua"], ["NE", "Niger"], ["NG", "Nigeria"], ["KP", "North Korea"], ["MK", "North Macedonia"],
  ["NO", "Norway"], ["OM", "Oman"], ["PK", "Pakistan"], ["PW", "Palau"], ["PS", "Palestine"],
  ["PA", "Panama"], ["PG", "Papua New Guinea"], ["PY", "Paraguay"], ["PE", "Peru"], ["PH", "Philippines"],
  ["PL", "Poland"], ["PT", "Portugal"], ["PR", "Puerto Rico"], ["QA", "Qatar"], ["RE", "Réunion"],
  ["RO", "Romania"], ["RU", "Russia"], ["RW", "Rwanda"], ["KN", "Saint Kitts and Nevis"], ["LC", "Saint Lucia"],
  ["VC", "Saint Vincent and the Grenadines"], ["WS", "Samoa"], ["SM", "San Marino"], ["ST", "São Tomé and Príncipe"], ["SA", "Saudi Arabia"],
  ["SN", "Senegal"], ["RS", "Serbia"], ["SC", "Seychelles"], ["SL", "Sierra Leone"], ["SG", "Singapore"],
  ["SK", "Slovakia"], ["SI", "Slovenia"], ["SB", "Solomon Islands"], ["SO", "Somalia"], ["ZA", "South Africa"],
  ["KR", "South Korea"], ["SS", "South Sudan"], ["ES", "Spain"], ["LK", "Sri Lanka"], ["SD", "Sudan"],
  ["SR", "Suriname"], ["SE", "Sweden"], ["CH", "Switzerland"], ["SY", "Syria"], ["TW", "Taiwan"],
  ["TJ", "Tajikistan"], ["TZ", "Tanzania"], ["TH", "Thailand"], ["TL", "Timor-Leste"], ["TG", "Togo"],
  ["TO", "Tonga"], ["TT", "Trinidad and Tobago"], ["TN", "Tunisia"], ["TR", "Türkiye"], ["TM", "Turkmenistan"],
  ["TV", "Tuvalu"], ["UG", "Uganda"], ["UA", "Ukraine"], ["AE", "United Arab Emirates"], ["GB", "United Kingdom"],
  ["US", "United States"], ["UY", "Uruguay"], ["UZ", "Uzbekistan"], ["VU", "Vanuatu"], ["VA", "Vatican City"],
  ["VE", "Venezuela"], ["VN", "Vietnam"], ["YE", "Yemen"], ["ZM", "Zambia"], ["ZW", "Zimbabwe"],
];

/** The handful shown as buttons straight away. */
export const COMMON_COUNTRIES = ["ZA", "GB", "US", "AU", "NZ", "CA", "IE", "AE"];

const NAMES = new Map(COUNTRIES);

export function countryName(code: string | null | undefined): string | null {
  return code ? NAMES.get(code.toUpperCase()) ?? code.toUpperCase() : null;
}

/** 🇿🇦 from "ZA" (regional indicator letters). */
export function countryFlag(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** "🇬🇧 United Kingdom", or null when unknown. */
export function countryLabel(code: string | null | undefined): string | null {
  const name = countryName(code);
  return name ? `${countryFlag(code)} ${name}`.trim() : null;
}

/** First letters that have countries, A to Z. */
export function countryLetters(): string[] {
  return [...new Set(COUNTRIES.map(([, n]) => n[0].toUpperCase()))].sort();
}

export function countriesStartingWith(letter: string): [string, string][] {
  return COUNTRIES.filter(([, n]) => n[0].toUpperCase() === letter);
}
