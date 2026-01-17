// Car Brand Logos Data
// Source: https://github.com/filippofilip95/car-logos-dataset

export interface CarBrand {
    id: string;           // lowercase identifier (e.g., "toyota", "volkswagen")
    name: string;         // Display name (e.g., "Toyota", "Volkswagen")
    nameHe?: string;      // Hebrew name (optional)
    logoUrl: string;      // URL to logo image
}

// GitHub raw URL base for car logos
const LOGO_BASE_URL = 'https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized';

/**
 * Complete list of car brands with logos
 */
export const CAR_BRANDS: CarBrand[] = [
    // Popular in Israel
    { id: 'toyota', name: 'Toyota', nameHe: 'טויוטה', logoUrl: `${LOGO_BASE_URL}/toyota.png` },
    { id: 'hyundai', name: 'Hyundai', nameHe: 'יונדאי', logoUrl: `${LOGO_BASE_URL}/hyundai.png` },
    { id: 'kia', name: 'Kia', nameHe: 'קיה', logoUrl: `${LOGO_BASE_URL}/kia.png` },
    { id: 'mazda', name: 'Mazda', nameHe: 'מאזדה', logoUrl: `${LOGO_BASE_URL}/mazda.png` },
    { id: 'honda', name: 'Honda', nameHe: 'הונדה', logoUrl: `${LOGO_BASE_URL}/honda.png` },
    { id: 'nissan', name: 'Nissan', nameHe: 'ניסאן', logoUrl: `${LOGO_BASE_URL}/nissan.png` },
    { id: 'mitsubishi', name: 'Mitsubishi', nameHe: 'מיצובישי', logoUrl: `${LOGO_BASE_URL}/mitsubishi.png` },
    { id: 'suzuki', name: 'Suzuki', nameHe: 'סוזוקי', logoUrl: `${LOGO_BASE_URL}/suzuki.png` },
    { id: 'subaru', name: 'Subaru', nameHe: 'סובארו', logoUrl: `${LOGO_BASE_URL}/subaru.png` },

    // European - German
    { id: 'volkswagen', name: 'Volkswagen', nameHe: 'פולקסווגן', logoUrl: `${LOGO_BASE_URL}/volkswagen.png` },
    { id: 'bmw', name: 'BMW', nameHe: 'ב.מ.וו', logoUrl: `${LOGO_BASE_URL}/bmw.png` },
    { id: 'mercedes', name: 'Mercedes', nameHe: 'מרצדס', logoUrl: `${LOGO_BASE_URL}/mercedes-benz.png` },
    { id: 'audi', name: 'Audi', nameHe: 'אאודי', logoUrl: `${LOGO_BASE_URL}/audi.png` },
    { id: 'porsche', name: 'Porsche', nameHe: 'פורשה', logoUrl: `${LOGO_BASE_URL}/porsche.png` },
    { id: 'opel', name: 'Opel', nameHe: 'אופל', logoUrl: `${LOGO_BASE_URL}/opel.png` },
    { id: 'mini', name: 'Mini', nameHe: 'מיני', logoUrl: `${LOGO_BASE_URL}/mini.png` },

    // European - French
    { id: 'peugeot', name: 'Peugeot', nameHe: 'פיג\'ו', logoUrl: `${LOGO_BASE_URL}/peugeot.png` },
    { id: 'renault', name: 'Renault', nameHe: 'רנו', logoUrl: `${LOGO_BASE_URL}/renault.png` },
    { id: 'citroen', name: 'Citroen', nameHe: 'סיטרואן', logoUrl: `${LOGO_BASE_URL}/citroen.png` },

    // European - Italian
    { id: 'fiat', name: 'Fiat', nameHe: 'פיאט', logoUrl: `${LOGO_BASE_URL}/fiat.png` },
    { id: 'alfa-romeo', name: 'Alfa Romeo', nameHe: 'אלפא רומיאו', logoUrl: `${LOGO_BASE_URL}/alfa-romeo.png` },
    { id: 'ferrari', name: 'Ferrari', nameHe: 'פרארי', logoUrl: `${LOGO_BASE_URL}/ferrari.png` },
    { id: 'lamborghini', name: 'Lamborghini', nameHe: 'למבורגיני', logoUrl: `${LOGO_BASE_URL}/lamborghini.png` },
    { id: 'maserati', name: 'Maserati', nameHe: 'מזראטי', logoUrl: `${LOGO_BASE_URL}/maserati.png` },
    { id: 'abarth', name: 'Abarth', nameHe: 'אבארת', logoUrl: `${LOGO_BASE_URL}/abarth.png` },

    // European - Other
    { id: 'volvo', name: 'Volvo', nameHe: 'וולבו', logoUrl: `${LOGO_BASE_URL}/volvo.png` },
    { id: 'skoda', name: 'Skoda', nameHe: 'סקודה', logoUrl: `${LOGO_BASE_URL}/skoda.png` },
    { id: 'seat', name: 'Seat', nameHe: 'סיאט', logoUrl: `${LOGO_BASE_URL}/seat.png` },
    { id: 'jaguar', name: 'Jaguar', nameHe: 'יגואר', logoUrl: `${LOGO_BASE_URL}/jaguar.png` },
    { id: 'land-rover', name: 'Land Rover', nameHe: 'לנד רובר', logoUrl: `${LOGO_BASE_URL}/land-rover.png` },
    { id: 'bentley', name: 'Bentley', nameHe: 'בנטלי', logoUrl: `${LOGO_BASE_URL}/bentley.png` },
    { id: 'rolls-royce', name: 'Rolls Royce', nameHe: 'רולס רויס', logoUrl: `${LOGO_BASE_URL}/rolls-royce.png` },
    { id: 'aston-martin', name: 'Aston Martin', nameHe: 'אסטון מרטין', logoUrl: `${LOGO_BASE_URL}/aston-martin.png` },
    { id: 'mclaren', name: 'McLaren', nameHe: 'מקלארן', logoUrl: `${LOGO_BASE_URL}/mclaren.png` },

    // American
    { id: 'ford', name: 'Ford', nameHe: 'פורד', logoUrl: `${LOGO_BASE_URL}/ford.png` },
    { id: 'chevrolet', name: 'Chevrolet', nameHe: 'שברולט', logoUrl: `${LOGO_BASE_URL}/chevrolet.png` },
    { id: 'jeep', name: 'Jeep', nameHe: 'ג\'יפ', logoUrl: `${LOGO_BASE_URL}/jeep.png` },
    { id: 'dodge', name: 'Dodge', nameHe: 'דודג\'', logoUrl: `${LOGO_BASE_URL}/dodge.png` },
    { id: 'chrysler', name: 'Chrysler', nameHe: 'קרייזלר', logoUrl: `${LOGO_BASE_URL}/chrysler.png` },
    { id: 'cadillac', name: 'Cadillac', nameHe: 'קדילק', logoUrl: `${LOGO_BASE_URL}/cadillac.png` },
    { id: 'buick', name: 'Buick', nameHe: 'ביואיק', logoUrl: `${LOGO_BASE_URL}/buick.png` },
    { id: 'gmc', name: 'GMC', nameHe: 'ג\'י.אם.סי', logoUrl: `${LOGO_BASE_URL}/gmc.png` },
    { id: 'lincoln', name: 'Lincoln', nameHe: 'לינקולן', logoUrl: `${LOGO_BASE_URL}/lincoln.png` },
    { id: 'ram', name: 'RAM', nameHe: 'ראם', logoUrl: `${LOGO_BASE_URL}/ram.png` },
    { id: 'tesla', name: 'Tesla', nameHe: 'טסלה', logoUrl: `${LOGO_BASE_URL}/tesla.png` },

    // Japanese - Luxury
    { id: 'lexus', name: 'Lexus', nameHe: 'לקסוס', logoUrl: `${LOGO_BASE_URL}/lexus.png` },
    { id: 'infiniti', name: 'Infiniti', nameHe: 'אינפיניטי', logoUrl: `${LOGO_BASE_URL}/infiniti.png` },
    { id: 'acura', name: 'Acura', nameHe: 'אקורה', logoUrl: `${LOGO_BASE_URL}/acura.png` },

    // Korean - Luxury
    { id: 'genesis', name: 'Genesis', nameHe: 'ג\'נסיס', logoUrl: `${LOGO_BASE_URL}/genesis.png` },

    // Exotic
    { id: 'bugatti', name: 'Bugatti', nameHe: 'בוגאטי', logoUrl: `${LOGO_BASE_URL}/bugatti.png` },
];

/**
 * Map for quick lookup by brand ID or name
 */
const brandMapById = new Map<string, CarBrand>();
const brandMapByName = new Map<string, CarBrand>();

// Initialize maps
CAR_BRANDS.forEach(brand => {
    brandMapById.set(brand.id.toLowerCase(), brand);
    brandMapByName.set(brand.name.toLowerCase(), brand);
    if (brand.nameHe) {
        brandMapByName.set(brand.nameHe, brand);
    }
});

/**
 * Get a car brand by ID or name (case-insensitive)
 * @param identifier - Brand ID (e.g., "toyota") or name (e.g., "Toyota", "טויוטה")
 * @returns CarBrand object or undefined if not found
 */
export function getCarBrand(identifier: string): CarBrand | undefined {
    const normalized = identifier.toLowerCase().trim();

    // Try by ID first
    let brand = brandMapById.get(normalized);
    if (brand) return brand;

    // Try by name
    brand = brandMapByName.get(normalized);
    if (brand) return brand;

    // Try partial match (for cases like "Mercedes-Benz" matching "Mercedes")
    for (const [key, value] of brandMapByName) {
        if (key.includes(normalized) || normalized.includes(key)) {
            return value;
        }
    }

    return undefined;
}

/**
 * Get the logo URL for a car brand
 * @param identifier - Brand ID or name
 * @returns Logo URL or undefined if not found
 */
export function getCarBrandLogo(identifier: string): string | undefined {
    return getCarBrand(identifier)?.logoUrl;
}

/**
 * Get all car brands
 * @returns Array of all car brands
 */
export function getAllCarBrands(): CarBrand[] {
    return CAR_BRANDS;
}

/**
 * Default placeholder logo for unknown brands
 */
export const DEFAULT_CAR_LOGO = 'https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/generic.png';
