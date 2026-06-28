/**
 * Short codes for the "(Region)" parenthetical on a job's Origin/Destination —
 * a country for ETS2, a US state for ATS. Used to label cities in the Biggest
 * hauls widget, e.g. "London (UK)" / "Coos Bay (OR)".
 *
 * ETS2 codes follow the in-game convention where it differs from ISO (UK not GB,
 * SP not ES). Unknown regions fall back to their first two letters, uppercased.
 */
const ETS2_COUNTRY: Record<string, string> = {
	Albania: 'AL',
	Austria: 'AT',
	Belgium: 'BE',
	'Bosnia and Herzegovina': 'BA',
	Bulgaria: 'BG',
	Croatia: 'HR',
	Czechia: 'CZ',
	'Czech Republic': 'CZ',
	Denmark: 'DK',
	Estonia: 'EE',
	Finland: 'FI',
	France: 'FR',
	Germany: 'DE',
	Greece: 'GR',
	Hungary: 'HU',
	Italy: 'IT',
	Kosovo: 'XK',
	Latvia: 'LV',
	Lithuania: 'LT',
	Luxembourg: 'LU',
	Moldova: 'MD',
	Montenegro: 'ME',
	Netherlands: 'NL',
	'North Macedonia': 'MK',
	Norway: 'NO',
	Poland: 'PL',
	Portugal: 'PT',
	Romania: 'RO',
	Russia: 'RU',
	Serbia: 'RS',
	Slovakia: 'SK',
	Slovenia: 'SI',
	Spain: 'SP',
	Sweden: 'SE',
	Switzerland: 'CH',
	Turkey: 'TR',
	Ukraine: 'UA',
	'United Kingdom': 'UK'
};

const US_STATE: Record<string, string> = {
	Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
	Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
	Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
	Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
	Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO',
	Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
	'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH',
	Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
	'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
	Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
	'District of Columbia': 'DC'
};

/** Abbreviate a region for the given game; null when there's no region. */
export function regionCode(game: string, region: string | null | undefined): string | null {
	if (!region) return null;
	const map = game === 'ats' ? US_STATE : ETS2_COUNTRY;
	return map[region] ?? region.slice(0, 2).toUpperCase();
}
