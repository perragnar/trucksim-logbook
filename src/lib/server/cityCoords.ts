/**
 * Real-world coordinates for the namesake cities that appear in the job log.
 * ETS2 / ATS maps are fictionalised but geographically based, so plotting the
 * real cities yields a recognisable Europe / USA route map.
 *
 * Keyed by game then by the exact city name as scraped (accents included).
 * Add entries here as new cities show up; unknown cities are simply not plotted.
 */
export type LatLng = { lat: number; lng: number };

export const cityCoords: Record<string, Record<string, LatLng>> = {
	ets2: {
		'A Coruña': { lat: 43.36, lng: -8.41 },
		Ajaccio: { lat: 41.93, lng: 8.74 },
		Alta: { lat: 69.97, lng: 23.27 },
		Andenes: { lat: 69.31, lng: 16.12 },
		Berlin: { lat: 52.52, lng: 13.4 },
		Bodø: { lat: 67.28, lng: 14.4 },
		Bourges: { lat: 47.08, lng: 2.4 },
		Cagliari: { lat: 39.22, lng: 9.12 },
		Calvi: { lat: 42.57, lng: 8.76 },
		Dortmund: { lat: 51.51, lng: 7.47 },
		Durrës: { lat: 41.32, lng: 19.45 },
		Evora: { lat: 38.57, lng: -7.91 },
		Frankfurt: { lat: 50.11, lng: 8.68 },
		Genoa: { lat: 44.41, lng: 8.93 },
		Guarda: { lat: 40.54, lng: -7.27 },
		Kristiansund: { lat: 63.11, lng: 7.73 },
		'Le Mans': { lat: 48.0, lng: 0.2 },
		Lisbon: { lat: 38.72, lng: -9.14 },
		Mitilini: { lat: 39.11, lng: 26.55 },
		'Mo i Rana': { lat: 66.31, lng: 14.14 },
		Montpellier: { lat: 43.61, lng: 3.88 },
		Narvik: { lat: 68.44, lng: 17.43 },
		Porto: { lat: 41.15, lng: -8.61 },
		Setúbal: { lat: 38.52, lng: -8.89 },
		Sofia: { lat: 42.7, lng: 23.32 },
		Steinkjer: { lat: 64.01, lng: 11.49 },
		Taranto: { lat: 40.46, lng: 17.24 },
		Tromsø: { lat: 69.65, lng: 18.96 },
		Trondheim: { lat: 63.43, lng: 10.39 },
		Valencia: { lat: 39.47, lng: -0.38 },
		Växjö: { lat: 56.88, lng: 14.81 },
		İstanbul: { lat: 41.01, lng: 28.98 }
	},
	ats: {
		Alamosa: { lat: 37.47, lng: -105.87 },
		Albuquerque: { lat: 35.08, lng: -106.65 },
		Ardmore: { lat: 34.17, lng: -97.14 },
		Bakersfield: { lat: 35.37, lng: -119.02 },
		'Camp Verde': { lat: 34.56, lng: -111.85 },
		'Cape Girardeau': { lat: 37.31, lng: -89.52 },
		'Carson City': { lat: 39.16, lng: -119.77 },
		Clovis: { lat: 34.4, lng: -103.2 },
		'East St. Louis': { lat: 38.62, lng: -90.15 },
		Effingham: { lat: 39.12, lng: -88.55 },
		'El Dorado': { lat: 33.21, lng: -92.67 },
		Farmington: { lat: 36.73, lng: -108.22 },
		Hays: { lat: 38.88, lng: -99.33 },
		Kayenta: { lat: 36.73, lng: -110.25 },
		Kennewick: { lat: 46.21, lng: -119.14 },
		Lincoln: { lat: 40.81, lng: -96.7 },
		'Little Rock': { lat: 34.74, lng: -92.29 },
		'Oklahoma City': { lat: 35.47, lng: -97.52 },
		'Pine Bluff': { lat: 34.22, lng: -92.0 },
		'Santa Cruz': { lat: 36.97, lng: -122.03 },
		'Santa Fe': { lat: 35.69, lng: -105.94 },
		Socorro: { lat: 34.06, lng: -106.89 },
		'St. Louis': { lat: 38.63, lng: -90.2 },
		Stockton: { lat: 37.96, lng: -121.29 },
		Texarkana: { lat: 33.43, lng: -94.05 }
	}
};
