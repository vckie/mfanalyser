import { useMemo, useState } from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';
import type { NavData } from '../types';
import { parseNavDate } from '../services/mfApi';

interface NavChartProps {
    data: NavData[];
}

type TimePeriod = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL';

const TIME_PERIODS: { key: TimePeriod; label: string; months: number | null }[] = [
    { key: '1M', label: '1M', months: 1 },
    { key: '3M', label: '3M', months: 3 },
    { key: '6M', label: '6M', months: 6 },
    { key: '1Y', label: '1Y', months: 12 },
    { key: '3Y', label: '3Y', months: 36 },
    { key: '5Y', label: '5Y', months: 60 },
    { key: 'ALL', label: 'ALL', months: null },
];

export default function NavChart({ data }: NavChartProps) {
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1Y');

    // Filter data based on selected period
    const filteredData = useMemo(() => {
        if (!data.length) return [];

        const period = TIME_PERIODS.find(p => p.key === selectedPeriod);
        if (!period || period.months === null) {
            // Return all data
            return data;
        }

        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - period.months);

        return data.filter(item => {
            const itemDate = parseNavDate(item.date);
            return itemDate >= cutoffDate;
        });
    }, [data, selectedPeriod]);

    // Prepare chart data
    const chartData = useMemo(() => {
        // Reverse to show oldest first
        const reversed = [...filteredData].reverse();

        // If too many points, sample them
        let sampled = reversed;
        if (reversed.length > 365) {
            const step = Math.ceil(reversed.length / 365);
            sampled = reversed.filter((_, i) => i % step === 0);
        }

        return sampled.map(item => ({
            date: item.date,
            nav: parseFloat(item.nav),
            fullDate: parseNavDate(item.date).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            })
        }));
    }, [filteredData]);

    // Calculate percentage change for each period
    const periodReturns = useMemo(() => {
        const results: Record<TimePeriod, { change: number; isPositive: boolean } | null> = {
            '1M': null, '3M': null, '6M': null, '1Y': null, '3Y': null, '5Y': null, 'ALL': null
        };

        if (!data.length) return results;

        const latestNav = parseFloat(data[0].nav);

        TIME_PERIODS.forEach(period => {
            let startNav: number | null = null;

            if (period.months === null) {
                // All time - get the oldest NAV
                const oldest = data[data.length - 1];
                if (oldest) startNav = parseFloat(oldest.nav);
            } else {
                // Find NAV from N months ago
                const cutoffDate = new Date();
                cutoffDate.setMonth(cutoffDate.getMonth() - period.months);

                // Find the closest NAV to the cutoff date
                let closest: NavData | null = null;
                let minDiff = Infinity;

                for (const item of data) {
                    const itemDate = parseNavDate(item.date);
                    const diff = Math.abs(itemDate.getTime() - cutoffDate.getTime());
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = item;
                    }
                }

                if (closest) startNav = parseFloat(closest.nav);
            }

            if (startNav !== null && startNav > 0) {
                const change = ((latestNav - startNav) / startNav) * 100;
                results[period.key] = { change, isPositive: change >= 0 };
            }
        });

        return results;
    }, [data]);

    const currentReturn = periodReturns[selectedPeriod];

    const minNav = chartData.length ? Math.min(...chartData.map(d => d.nav)) * 0.98 : 0;
    const maxNav = chartData.length ? Math.max(...chartData.map(d => d.nav)) * 1.02 : 100;

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
                    background: 'rgba(20, 20, 35, 0.95)',
                    border: '1px solid rgba(100, 116, 139, 0.3)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
                }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '4px' }}>
                        {payload[0].payload.fullDate}
                    </p>
                    <p style={{ color: '#6366f1', fontSize: '1.1rem', fontWeight: '600' }}>
                        ₹{payload[0].value.toFixed(4)}
                    </p>
                </div>
            );
        }
        return null;
    };

    // Determine chart color based on returns
    const chartColor = currentReturn?.isPositive !== false ? '#10b981' : '#ef4444';

    return (
        <div className="chart-container">
            <div className="chart-header">
                <h3>📈 NAV History</h3>
                {currentReturn && (
                    <div className={`period-return ${currentReturn.isPositive ? 'positive' : 'negative'}`}>
                        <span className="return-arrow">{currentReturn.isPositive ? '▲' : '▼'}</span>
                        <span className="return-value">{currentReturn.isPositive ? '+' : ''}{currentReturn.change.toFixed(2)}%</span>
                    </div>
                )}
            </div>

            {/* Period Selector */}
            <div className="period-selector">
                {TIME_PERIODS.map(period => {
                    const ret = periodReturns[period.key];
                    return (
                        <button
                            key={period.key}
                            className={`period-btn ${selectedPeriod === period.key ? 'active' : ''}`}
                            onClick={() => setSelectedPeriod(period.key)}
                        >
                            <span className="period-label">{period.label}</span>
                            {ret && (
                                <span className={`period-change ${ret.isPositive ? 'positive' : 'negative'}`}>
                                    {ret.isPositive ? '+' : ''}{ret.change.toFixed(1)}%
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.15)" />
                        <XAxis
                            dataKey="date"
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickLine={{ stroke: '#64748b' }}
                            axisLine={{ stroke: 'rgba(100, 116, 139, 0.2)' }}
                            tickFormatter={(value) => {
                                const parts = value.split('-');
                                return `${parts[1]}/${parts[2]?.slice(2)}`;
                            }}
                            interval="preserveStartEnd"
                            minTickGap={50}
                        />
                        <YAxis
                            domain={[minNav, maxNav]}
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickLine={{ stroke: '#64748b' }}
                            axisLine={{ stroke: 'rgba(100, 116, 139, 0.2)' }}
                            tickFormatter={(value) => `₹${value.toFixed(0)}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="nav"
                            stroke={chartColor}
                            strokeWidth={2}
                            fill="url(#navGradient)"
                            dot={false}
                            activeDot={{ r: 6, stroke: chartColor, strokeWidth: 2, fill: '#0a0a0f' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <div className="no-data">No data available for this period</div>
            )}
        </div>
    );
}
