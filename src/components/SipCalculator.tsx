import { useState, useMemo } from 'react';
import type { NavData } from '../types';
import { formatCurrency, parseNavDate } from '../services/mfApi';

interface SipCalculatorProps {
    navData: NavData[];
}

type InvestmentType = 'sip' | 'stepup' | 'onetime';
type CalculatorTab = 'past' | 'future';

export default function SipCalculator({ navData }: SipCalculatorProps) {
    const [activeTab, setActiveTab] = useState<CalculatorTab>('past');

    return (
        <div className="calculator-container card">
            <h3>💰 Investment Calculator</h3>

            {/* Tab Switcher */}
            <div className="calculator-tabs">
                <button
                    className={`tab-btn ${activeTab === 'past' ? 'active' : ''}`}
                    onClick={() => setActiveTab('past')}
                >
                    📊 Past Analysis
                </button>
                <button
                    className={`tab-btn ${activeTab === 'future' ? 'active' : ''}`}
                    onClick={() => setActiveTab('future')}
                >
                    🧮 SIP Calculator
                </button>
            </div>

            {activeTab === 'past' ? (
                <PastAnalysis navData={navData} />
            ) : (
                <FutureProjection />
            )}
        </div>
    );
}

// ===================== PAST ANALYSIS =====================
// Uses ACTUAL historical NAV data for calculations
function PastAnalysis({ navData }: { navData: NavData[] }) {
    const [investmentType, setInvestmentType] = useState<InvestmentType>('sip');
    const [amount, setAmount] = useState<number>(5000);
    const [stepUpPercent, setStepUpPercent] = useState<number>(10);
    const [selectedYear, setSelectedYear] = useState<number>(0);
    const [selectedMonth, setSelectedMonth] = useState<number>(1);

    // Get available years and months from NAV data
    const dateInfo = useMemo(() => {
        if (!navData.length) return { years: [], monthsByYear: new Map(), minDate: null, maxDate: null };

        const dates = navData.map(d => ({
            date: parseNavDate(d.date),
            str: d.date
        })).sort((a, b) => a.date.getTime() - b.date.getTime());

        // Group by year and get available months for each year
        const yearMonthMap = new Map<number, Set<number>>();
        for (const d of dates) {
            const year = d.date.getFullYear();
            const month = d.date.getMonth() + 1;
            if (!yearMonthMap.has(year)) {
                yearMonthMap.set(year, new Set());
            }
            yearMonthMap.get(year)!.add(month);
        }

        const years = Array.from(yearMonthMap.keys()).sort((a, b) => a - b);
        const monthsByYear = new Map<number, number[]>();
        for (const [year, months] of yearMonthMap) {
            monthsByYear.set(year, Array.from(months).sort((a, b) => a - b));
        }

        return {
            years,
            monthsByYear,
            minDate: dates[0]?.date,
            maxDate: dates[dates.length - 1]?.date
        };
    }, [navData]);

    // Set default date (3 years ago or earliest available)
    useMemo(() => {
        if (dateInfo.years.length && !selectedYear) {
            const threeYearsAgo = new Date();
            threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
            const targetYear = threeYearsAgo.getFullYear();
            const targetMonth = threeYearsAgo.getMonth() + 1;

            // Find closest available year
            let defaultYear = dateInfo.years[0];
            for (const yr of dateInfo.years) {
                if (yr <= targetYear) {
                    defaultYear = yr;
                }
            }
            setSelectedYear(defaultYear);

            // Set month for that year
            const availableMonths = dateInfo.monthsByYear.get(defaultYear) || [1];
            if (defaultYear === targetYear) {
                // Try to get exact month or closest
                const closestMonth = availableMonths.find((m: number) => m >= targetMonth) || availableMonths[availableMonths.length - 1];
                setSelectedMonth(closestMonth);
            } else {
                setSelectedMonth(availableMonths[0]);
            }
        }
    }, [dateInfo.years, selectedYear]);

    // When year changes, adjust month if needed
    const handleYearChange = (year: number) => {
        setSelectedYear(year);
        const availableMonths = dateInfo.monthsByYear.get(year) || [1];
        if (!availableMonths.includes(selectedMonth)) {
            setSelectedMonth(availableMonths[0]);
        }
    };

    // Get available months for selected year
    const availableMonths = dateInfo.monthsByYear.get(selectedYear) || [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Combined date string for calculations
    const selectedFromDate = selectedYear ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}` : '';

    // Year-wise breakdown type
    interface YearlyBreakdown {
        year: number;
        invested: number;
        cumulativeInvested: number;
        units: number;
        cumulativeUnits: number;
        value: number;
        returns: number;
        returnsPercent: number;
        endYearNav: number;
    }

    // Calculate based on actual NAV data
    const result = useMemo(() => {
        if (!amount || !selectedFromDate || !navData.length) return null;

        const [year, month] = selectedFromDate.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date();
        const currentNav = parseFloat(navData[0]?.nav || '0');

        if (investmentType === 'sip' || investmentType === 'stepup') {
            // Monthly SIP/Step-up calculation using actual NAV
            let totalUnits = 0;
            let totalInvested = 0;
            let currentDate = new Date(startDate);
            let currentAmount = amount;
            let yearCounter = 0;
            const startYear = startDate.getFullYear();

            // Track year-wise data
            const yearlyData: Map<number, { invested: number; units: number }> = new Map();

            while (currentDate <= endDate) {
                const currentYear = currentDate.getFullYear();

                // For step-up: increase amount each year
                if (investmentType === 'stepup') {
                    const yearsDiff = currentYear - startYear;
                    if (yearsDiff > yearCounter) {
                        currentAmount = amount * Math.pow(1 + stepUpPercent / 100, yearsDiff);
                        yearCounter = yearsDiff;
                    }
                }

                const navEntry = findNearestNav(navData, currentDate);
                if (navEntry) {
                    const nav = parseFloat(navEntry.nav);
                    const unitsBought = currentAmount / nav;
                    totalUnits += unitsBought;
                    totalInvested += currentAmount;

                    // Add to yearly tracking
                    if (!yearlyData.has(currentYear)) {
                        yearlyData.set(currentYear, { invested: 0, units: 0 });
                    }
                    const yd = yearlyData.get(currentYear)!;
                    yd.invested += currentAmount;
                    yd.units += unitsBought;
                }
                currentDate.setMonth(currentDate.getMonth() + 1);
            }

            const currentValue = totalUnits * currentNav;
            const returns = currentValue - totalInvested;
            const returnsPercentage = totalInvested > 0 ? (returns / totalInvested) * 100 : 0;

            // Build year-wise breakdown with value at end of each year
            const yearlyBreakdown: YearlyBreakdown[] = [];
            let cumulativeInvested = 0;
            let cumulativeUnits = 0;
            const currentYear = new Date().getFullYear();

            const sortedYears = Array.from(yearlyData.keys()).sort((a, b) => a - b);
            for (const yr of sortedYears) {
                const yd = yearlyData.get(yr)!;
                cumulativeInvested += yd.invested;
                cumulativeUnits += yd.units;

                // Get NAV at end of year (Dec 31) or current NAV if it's the current year
                let endYearNav = currentNav;
                if (yr < currentYear) {
                    const yearEndDate = new Date(yr, 11, 31); // Dec 31 of that year
                    const navEntry = findNearestNav(navData, yearEndDate);
                    if (navEntry) {
                        endYearNav = parseFloat(navEntry.nav);
                    }
                }

                const value = cumulativeUnits * endYearNav;
                const yearReturns = value - cumulativeInvested;
                const yearReturnsPercent = cumulativeInvested > 0 ? (yearReturns / cumulativeInvested) * 100 : 0;

                yearlyBreakdown.push({
                    year: yr,
                    invested: yd.invested,
                    cumulativeInvested,
                    units: yd.units,
                    cumulativeUnits,
                    value,
                    returns: yearReturns,
                    returnsPercent: yearReturnsPercent,
                    endYearNav
                });
            }

            return {
                totalInvested,
                currentValue,
                totalUnits,
                returns,
                returnsPercentage,
                isProfit: returns >= 0,
                startDate,
                yearlyBreakdown
            };
        } else {
            // One-time investment using actual NAV
            const purchaseNav = findNearestNav(navData, startDate);
            if (!purchaseNav) return null;

            const nav = parseFloat(purchaseNav.nav);
            const units = amount / nav;
            const currentValue = units * currentNav;
            const returns = currentValue - amount;
            const returnsPercentage = (returns / amount) * 100;

            // For one-time, show yearly value progression using end-of-year NAV
            const yearlyBreakdown: YearlyBreakdown[] = [];
            const startYear = startDate.getFullYear();
            const endYear = endDate.getFullYear();
            const nowYear = new Date().getFullYear();

            for (let yr = startYear; yr <= endYear; yr++) {
                // Get NAV at end of year (Dec 31) or current NAV if it's the current year
                let endYearNav = currentNav;
                if (yr < nowYear) {
                    const yearEndDate = new Date(yr, 11, 31); // Dec 31 of that year
                    const navEntry = findNearestNav(navData, yearEndDate);
                    if (navEntry) {
                        endYearNav = parseFloat(navEntry.nav);
                    }
                }

                const yearValue = units * endYearNav;
                const yearReturns = yearValue - amount;
                const yearReturnsPercent = (yearReturns / amount) * 100;

                yearlyBreakdown.push({
                    year: yr,
                    invested: yr === startYear ? amount : 0,
                    cumulativeInvested: amount,
                    units: yr === startYear ? units : 0,
                    cumulativeUnits: units,
                    value: yearValue,
                    returns: yearReturns,
                    returnsPercent: yearReturnsPercent,
                    endYearNav
                });
            }

            return {
                totalInvested: amount,
                currentValue,
                totalUnits: units,
                returns,
                returnsPercentage,
                isProfit: returns >= 0,
                buyNav: nav,
                currentNav,
                startDate,
                yearlyBreakdown
            };
        }
    }, [investmentType, amount, selectedFromDate, stepUpPercent, navData]);

    const presetAmounts = investmentType === 'onetime'
        ? [10000, 25000, 50000, 100000, 500000]
        : [1000, 2500, 5000, 10000, 25000];

    const presetStepUp = [5, 10, 15, 20, 25];

    // Set preset from years ago
    const setPresetFromYearsAgo = (yearsAgo: number) => {
        const target = new Date();
        target.setFullYear(target.getFullYear() - yearsAgo);
        const targetYear = target.getFullYear();
        const targetMonth = target.getMonth() + 1;

        // Find closest available year
        let chosenYear = dateInfo.years[0];
        for (const yr of dateInfo.years) {
            if (yr <= targetYear) {
                chosenYear = yr;
            }
        }
        setSelectedYear(chosenYear);

        // Set closest month
        const months = dateInfo.monthsByYear.get(chosenYear) || [1];
        if (chosenYear === targetYear) {
            const closestMonth = months.find((m: number) => m >= targetMonth) || months[months.length - 1];
            setSelectedMonth(closestMonth);
        } else {
            setSelectedMonth(months[months.length - 1]);
        }
    };

    return (
        <div className="past-analysis">
            {/* Investment Type Toggle */}
            <div className="type-toggle three-way">
                <button
                    className={`toggle-btn ${investmentType === 'sip' ? 'active' : ''}`}
                    onClick={() => setInvestmentType('sip')}
                >
                    Monthly SIP
                </button>
                <button
                    className={`toggle-btn ${investmentType === 'stepup' ? 'active' : ''}`}
                    onClick={() => setInvestmentType('stepup')}
                >
                    Step-up SIP
                </button>
                <button
                    className={`toggle-btn ${investmentType === 'onetime' ? 'active' : ''}`}
                    onClick={() => setInvestmentType('onetime')}
                >
                    One-time
                </button>
            </div>

            {/* Sentence Builder */}
            <div className="investment-sentence">
                <span className="sentence-text">If I had invested</span>

                <div className="inline-input amount-input">
                    <span className="currency-symbol">₹</span>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        min={100}
                        step={investmentType === 'onetime' ? 1000 : 500}
                    />
                </div>

                {investmentType !== 'onetime' && (
                    <span className="sentence-text">per month</span>
                )}

                {investmentType === 'stepup' && (
                    <>
                        <span className="sentence-text">with</span>
                        <div className="inline-input stepup-input">
                            <input
                                type="number"
                                value={stepUpPercent}
                                onChange={(e) => setStepUpPercent(Number(e.target.value))}
                                min={1}
                                max={50}
                            />
                            <span className="input-suffix">%</span>
                        </div>
                        <span className="sentence-text">yearly increase</span>
                    </>
                )}

                <span className="sentence-text">from</span>

                {/* Calendar-style Year + Month Picker */}
                <div className="date-picker-inline">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="month-select"
                    >
                        {availableMonths.map((m: number) => (
                            <option key={m} value={m}>
                                {monthNames[m - 1]}
                            </option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={(e) => handleYearChange(Number(e.target.value))}
                        className="year-select"
                    >
                        {dateInfo.years.map(yr => (
                            <option key={yr} value={yr}>
                                {yr}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Preset Pills */}
            <div className="presets-section">
                <div className="preset-group">
                    <span className="preset-label">Amount</span>
                    <div className="amount-presets">
                        {presetAmounts.map(preset => (
                            <button
                                key={preset}
                                className={`preset-pill ${amount === preset ? 'active' : ''}`}
                                onClick={() => setAmount(preset)}
                            >
                                ₹{preset >= 100000 ? `${preset / 100000}L` : preset.toLocaleString('en-IN')}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="preset-group">
                    <span className="preset-label">From (quick select)</span>
                    <div className="amount-presets">
                        {[1, 2, 3, 5, 10].map(yr => {
                            const targetYear = new Date().getFullYear() - yr;
                            const isAvailable = dateInfo.years.some(y => y === targetYear) || dateInfo.years.some(y => y <= targetYear);
                            return (
                                <button
                                    key={yr}
                                    className={`preset-pill small`}
                                    onClick={() => setPresetFromYearsAgo(yr)}
                                    disabled={!isAvailable}
                                >
                                    {yr}Y ago
                                </button>
                            );
                        })}
                    </div>
                </div>


                {investmentType === 'stepup' && (
                    <div className="preset-group">
                        <span className="preset-label">Annual Step-up</span>
                        <div className="amount-presets">
                            {presetStepUp.map(pct => (
                                <button
                                    key={pct}
                                    className={`preset-pill small ${stepUpPercent === pct ? 'active' : ''}`}
                                    onClick={() => setStepUpPercent(pct)}
                                >
                                    {pct}%
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Result - using ACTUAL data */}
            {result && (
                <div className={`investment-result ${result.isProfit ? 'profit' : 'loss'}`}>
                    <div className="result-main">
                        <span className="result-label">It would be worth</span>
                        <span className="result-value">{formatCurrency(result.currentValue)}</span>
                        <span className="result-label">today</span>
                    </div>

                    <div className="result-stats">
                        <div className="stat-card">
                            <span className="stat-label">Total Invested</span>
                            <span className="stat-value">{formatCurrency(result.totalInvested)}</span>
                        </div>
                        <div className={`stat-card ${result.isProfit ? 'profit' : 'loss'}`}>
                            <span className="stat-label">{result.isProfit ? 'Profit' : 'Loss'}</span>
                            <span className="stat-value">{result.isProfit ? '+' : ''}{formatCurrency(result.returns)}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Returns</span>
                            <span className={`stat-value ${result.isProfit ? 'text-profit' : 'text-loss'}`}>
                                {result.isProfit ? '+' : ''}{result.returnsPercentage.toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    {/* Visual Breakdown */}
                    <div className="investment-breakdown">
                        <div className="breakdown-bar">
                            <div
                                className="invested-portion"
                                style={{ width: `${Math.min((result.totalInvested / result.currentValue) * 100, 100)}%` }}
                            >
                                <span>Invested</span>
                            </div>
                            {result.isProfit && (
                                <div
                                    className="returns-portion"
                                    style={{ width: `${(result.returns / result.currentValue) * 100}%` }}
                                >
                                    <span>Returns</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Year-wise Breakdown Table */}
                    {result.yearlyBreakdown && result.yearlyBreakdown.length > 1 && (
                        <div className="yearly-breakdown">
                            <div className="breakdown-header">
                                <span className="breakdown-title">📊 Year-wise Breakdown</span>
                            </div>
                            <table className="breakdown-table">
                                <thead>
                                    <tr>
                                        <th>Year</th>
                                        <th>Invested</th>
                                        <th>Total Invested</th>
                                        <th>NAV</th>
                                        <th>Year-End Value</th>
                                        <th>Profit/Loss</th>
                                        <th>Returns %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.yearlyBreakdown.map((row) => (
                                        <tr key={row.year}>
                                            <td className="year-cell">{row.year}</td>
                                            <td>{formatCurrency(row.invested)}</td>
                                            <td>{formatCurrency(row.cumulativeInvested)}</td>
                                            <td className="nav-cell">₹{row.endYearNav.toFixed(2)}</td>
                                            <td>{formatCurrency(row.value)}</td>
                                            <td className={row.returns >= 0 ? 'text-profit' : 'text-loss'}>
                                                {row.returns >= 0 ? '+' : ''}{formatCurrency(row.returns)}
                                            </td>
                                            <td className={row.returnsPercent >= 0 ? 'text-profit' : 'text-loss'}>
                                                {row.returnsPercent >= 0 ? '+' : ''}{row.returnsPercent.toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="result-note">
                        <span className="note-icon">📈</span>
                        <span>
                            Based on actual NAV data from {result.startDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} to {parseNavDate(navData[0]?.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}


// ===================== FUTURE PROJECTION =====================
// Pure mathematical calculation - no real NAV data needed
function FutureProjection() {
    const [investmentType, setInvestmentType] = useState<InvestmentType>('sip');
    const [amount, setAmount] = useState<number>(5000);
    const [years, setYears] = useState<number>(10);
    const [expectedReturn, setExpectedReturn] = useState<number>(12);
    const [stepUpPercent, setStepUpPercent] = useState<number>(10);

    // Calculate projected returns
    const result = useMemo(() => {
        if (!amount || !years || !expectedReturn) return null;

        const monthlyRate = expectedReturn / 100 / 12;
        const months = years * 12;

        if (investmentType === 'sip') {
            // Regular SIP Formula: FV = P × ((1 + r)^n - 1) / r × (1 + r)
            const futureValue = amount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
            const totalInvested = amount * months;
            const returns = futureValue - totalInvested;
            const returnsPercentage = (returns / totalInvested) * 100;

            return {
                totalInvested,
                futureValue,
                returns,
                returnsPercentage,
                isProfit: returns >= 0
            };
        } else if (investmentType === 'stepup') {
            // Step-up SIP: Calculate year by year with increasing amounts
            let totalInvested = 0;
            let futureValue = 0;
            let currentAmount = amount;

            for (let year = 0; year < years; year++) {
                // Each year's contribution grows for remaining years
                const monthsRemaining = (years - year) * 12;

                for (let month = 0; month < 12; month++) {
                    const monthsToGrow = monthsRemaining - month;
                    const monthValue = currentAmount * Math.pow(1 + monthlyRate, monthsToGrow);
                    futureValue += monthValue;
                    totalInvested += currentAmount;
                }

                // Increase amount for next year
                currentAmount = currentAmount * (1 + stepUpPercent / 100);
            }

            const returns = futureValue - totalInvested;
            const returnsPercentage = (returns / totalInvested) * 100;

            return {
                totalInvested,
                futureValue,
                returns,
                returnsPercentage,
                isProfit: returns >= 0
            };
        } else {
            // Lumpsum Formula: FV = P × (1 + r)^n
            const futureValue = amount * Math.pow(1 + monthlyRate, months);
            const returns = futureValue - amount;
            const returnsPercentage = (returns / amount) * 100;

            return {
                totalInvested: amount,
                futureValue,
                returns,
                returnsPercentage,
                isProfit: returns >= 0
            };
        }
    }, [investmentType, amount, years, expectedReturn, stepUpPercent]);

    const presetAmounts = investmentType === 'onetime'
        ? [10000, 25000, 50000, 100000, 500000]
        : [1000, 2500, 5000, 10000, 25000];

    const presetYears = [1, 3, 5, 10, 15, 20];
    const presetReturns = [8, 10, 12, 15, 18];
    const presetStepUp = [5, 10, 15, 20, 25];

    return (
        <div className="future-projection">
            {/* Investment Type Toggle */}
            <div className="type-toggle three-way">
                <button
                    className={`toggle-btn ${investmentType === 'sip' ? 'active' : ''}`}
                    onClick={() => setInvestmentType('sip')}
                >
                    Monthly SIP
                </button>
                <button
                    className={`toggle-btn ${investmentType === 'stepup' ? 'active' : ''}`}
                    onClick={() => setInvestmentType('stepup')}
                >
                    Step-up SIP
                </button>
                <button
                    className={`toggle-btn ${investmentType === 'onetime' ? 'active' : ''}`}
                    onClick={() => setInvestmentType('onetime')}
                >
                    One-time
                </button>
            </div>

            {/* Sentence Builder */}
            <div className="investment-sentence">
                <span className="sentence-text">If I invest</span>

                <div className="inline-input amount-input">
                    <span className="currency-symbol">₹</span>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        min={100}
                        step={investmentType === 'onetime' ? 1000 : 500}
                    />
                </div>

                {investmentType !== 'onetime' && (
                    <span className="sentence-text">per month</span>
                )}

                {investmentType === 'stepup' && (
                    <>
                        <span className="sentence-text">with</span>
                        <div className="inline-input stepup-input">
                            <input
                                type="number"
                                value={stepUpPercent}
                                onChange={(e) => setStepUpPercent(Number(e.target.value))}
                                min={1}
                                max={50}
                            />
                            <span className="input-suffix">%</span>
                        </div>
                        <span className="sentence-text">yearly increase</span>
                    </>
                )}

                <span className="sentence-text">for</span>

                <div className="inline-input years-input">
                    <input
                        type="number"
                        value={years}
                        onChange={(e) => setYears(Number(e.target.value))}
                        min={1}
                        max={40}
                    />
                    <span className="input-suffix">years</span>
                </div>

                <span className="sentence-text">at</span>

                <div className="inline-input return-input">
                    <input
                        type="number"
                        value={expectedReturn}
                        onChange={(e) => setExpectedReturn(Number(e.target.value))}
                        min={1}
                        max={50}
                        step={0.5}
                    />
                    <span className="input-suffix">%</span>
                </div>

                <span className="sentence-text">return</span>
            </div>

            {/* Preset Pills */}
            <div className="presets-section">
                <div className="preset-group">
                    <span className="preset-label">Amount</span>
                    <div className="amount-presets">
                        {presetAmounts.map(preset => (
                            <button
                                key={preset}
                                className={`preset-pill ${amount === preset ? 'active' : ''}`}
                                onClick={() => setAmount(preset)}
                            >
                                ₹{preset >= 100000 ? `${preset / 100000}L` : preset.toLocaleString('en-IN')}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="preset-group">
                    <span className="preset-label">Duration</span>
                    <div className="amount-presets">
                        {presetYears.map(yr => (
                            <button
                                key={yr}
                                className={`preset-pill small ${years === yr ? 'active' : ''}`}
                                onClick={() => setYears(yr)}
                            >
                                {yr}Y
                            </button>
                        ))}
                    </div>
                </div>

                {investmentType === 'stepup' && (
                    <div className="preset-group">
                        <span className="preset-label">Annual Step-up</span>
                        <div className="amount-presets">
                            {presetStepUp.map(pct => (
                                <button
                                    key={pct}
                                    className={`preset-pill small ${stepUpPercent === pct ? 'active' : ''}`}
                                    onClick={() => setStepUpPercent(pct)}
                                >
                                    {pct}%
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="preset-group">
                    <span className="preset-label">Expected Return</span>
                    <div className="amount-presets">
                        {presetReturns.map(ret => (
                            <button
                                key={ret}
                                className={`preset-pill small ${expectedReturn === ret ? 'active' : ''}`}
                                onClick={() => setExpectedReturn(ret)}
                            >
                                {ret}%
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Result */}
            {result && (
                <div className={`investment-result ${result.isProfit ? 'profit' : 'loss'}`}>
                    <div className="result-main">
                        <span className="result-label">You could have</span>
                        <span className="result-value">{formatCurrency(result.futureValue)}</span>
                    </div>

                    <div className="result-stats">
                        <div className="stat-card">
                            <span className="stat-label">Total Invested</span>
                            <span className="stat-value">{formatCurrency(result.totalInvested)}</span>
                        </div>
                        <div className="stat-card profit">
                            <span className="stat-label">Wealth Gain</span>
                            <span className="stat-value">+{formatCurrency(result.returns)}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Returns</span>
                            <span className="stat-value text-profit">+{result.returnsPercentage.toFixed(1)}%</span>
                        </div>
                    </div>

                    {/* Visual Breakdown */}
                    <div className="investment-breakdown">
                        <div className="breakdown-bar">
                            <div
                                className="invested-portion"
                                style={{ width: `${(result.totalInvested / result.futureValue) * 100}%` }}
                            >
                                <span>Invested</span>
                            </div>
                            <div
                                className="returns-portion"
                                style={{ width: `${(result.returns / result.futureValue) * 100}%` }}
                            >
                                <span>Returns</span>
                            </div>
                        </div>
                    </div>

                    <div className="result-note">
                        <span className="note-icon">💡</span>
                        <span>
                            {investmentType === 'stepup'
                                ? `Projected with ${stepUpPercent}% annual step-up at ${expectedReturn}% growth`
                                : `Projected returns at ${expectedReturn}% annual growth`
                            }
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper function to find nearest NAV
function findNearestNav(navData: NavData[], targetDate: Date): NavData | null {
    let nearest = null;
    let minDiff = Infinity;

    for (const entry of navData) {
        const entryDate = parseNavDate(entry.date);
        const diff = Math.abs(entryDate.getTime() - targetDate.getTime());
        if (diff < minDiff) {
            minDiff = diff;
            nearest = entry;
        }
    }

    return nearest;
}
