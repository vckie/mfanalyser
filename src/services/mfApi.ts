// MF API Service
import type { FundBasic, FundDetails } from '../types';

const BASE_URL = 'https://api.mfapi.in/mf';

export async function getAllFunds(): Promise<FundBasic[]> {
    const response = await fetch(BASE_URL);
    if (!response.ok) {
        throw new Error('Failed to fetch funds list');
    }
    return response.json();
}

export async function getFundDetails(schemeCode: number): Promise<FundDetails> {
    const response = await fetch(`${BASE_URL}/${schemeCode}`);
    if (!response.ok) {
        throw new Error('Failed to fetch fund details');
    }
    return response.json();
}

// Parse date from DD-MM-YYYY format
export function parseNavDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// Format date for display
export function formatDate(date: Date): string {
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// Format currency
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// Calculate SIP returns
export function calculateSipReturns(
    navHistory: { date: string; nav: string }[],
    monthlyAmount: number,
    startDate: Date,
    endDate: Date
) {
    // Sort NAV data by date (oldest first)
    const sortedNav = [...navHistory].sort((a, b) => {
        return parseNavDate(a.date).getTime() - parseNavDate(b.date).getTime();
    });

    let totalUnits = 0;
    let totalInvested = 0;
    let currentDate = new Date(startDate);

    // Iterate month by month
    while (currentDate <= endDate) {
        // Find the nearest NAV for this date
        const navEntry = findNearestNav(sortedNav, currentDate);
        if (navEntry) {
            const nav = parseFloat(navEntry.nav);
            const units = monthlyAmount / nav;
            totalUnits += units;
            totalInvested += monthlyAmount;
        }
        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Get latest NAV for current value
    const latestNav = parseFloat(navHistory[0]?.nav || '0');
    const currentValue = totalUnits * latestNav;
    const returns = currentValue - totalInvested;
    const returnsPercentage = totalInvested > 0 ? (returns / totalInvested) * 100 : 0;

    return {
        totalInvested,
        currentValue,
        totalUnits,
        returns,
        returnsPercentage,
        isProfit: returns >= 0
    };
}

function findNearestNav(
    sortedNav: { date: string; nav: string }[],
    targetDate: Date
): { date: string; nav: string } | null {
    const targetTime = targetDate.getTime();
    let nearest = null;
    let minDiff = Infinity;

    for (const entry of sortedNav) {
        const entryDate = parseNavDate(entry.date);
        const diff = Math.abs(entryDate.getTime() - targetTime);
        if (diff < minDiff) {
            minDiff = diff;
            nearest = entry;
        }
        // If we've passed the target date and found something close, break
        if (entryDate.getTime() > targetTime && nearest) {
            break;
        }
    }

    return nearest;
}
