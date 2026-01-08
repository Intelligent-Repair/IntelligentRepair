/**
 * Towing companies configuration for Israel
 * Note: Keep logoFallback for accessibility when images fail to load
 */

export interface TowingCompany {
    name: string;
    number: string;         // Actual phone number for tel: link
    displayNumber: string;  // RTL-friendly display
    color: string;          // Tailwind gradient classes
    logo: string;           // Path to logo image
}

export const towingCompanies: TowingCompany[] = [
    {
        name: "שגריר",
        number: "*8888",
        displayNumber: "8888*",
        color: "from-red-600 to-red-700",
        logo: "/towing/shagrir.jpg"
    },
    {
        name: "דרכים",
        number: "*2008",
        displayNumber: "2008*",
        color: "from-orange-500 to-orange-600",
        logo: "/towing/Drachim.png"
    },
    {
        name: "ממסי שירותי גרירה",
        number: "*5202",
        displayNumber: "5202*",
        color: "from-slate-800 to-slate-900",
        logo: "/towing/Memsi.png"
    },
];

/**
 * Format phone number for tel: link
 * Handles Israeli special numbers like *8888
 */
export function formatTelLink(number: string): string {
    // Israeli star numbers need proper encoding
    return `tel:${encodeURIComponent(number)}`;
}
