// src/pages/EDAPage.jsx
// Uses real data from /api/insights (Flask endpoint) + eda_statistics.json fallback

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';
import './EdaPage.css';

const FLASK_URL = import.meta.env.VITE_FLASK_URL || 'http://localhost:5001';

// Fallback data (same as eda_statistics.json)
const FALLBACK_DATA = {
  overview: { total_drugs: 1254, total_expired: 61, total_active: 1193, percent_expired: 4.9, percent_active: 95.1 },
  by_category: { Oral: 688, Injectable: 278, Other: 120, Topical: 61, Respiratory: 54, "Eye Care": 53 },
  category_expired_counts: { Oral: 30, Injectable: 11, Other: 8, "Eye Care": 6, Respiratory: 5, Topical: 1 },
  expiry_timeline: { "2024": 15, "2025": 208, "2026": 157, "2027": 132, "2028": 111, "2029": 110, "2030": 74, "2031": 68, "2032": 47, "2033": 57, "2034": 41, "2035": 48, "2036": 48, "2037": 31, "2038": 26, "2039": 28, "2040": 14, "2041": 26, "2042": 5, "2043": 2, "2044": 5, "2045": 1 },
  approval_year_distribution: { "2006": 29, "2007": 16, "2008": 28, "2009": 36, "2010": 35, "2011": 37, "2012": 48, "2013": 54, "2014": 70, "2015": 61, "2016": 62, "2017": 79, "2018": 84, "2019": 73, "2020": 89, "2021": 95, "2022": 69, "2023": 95, "2024": 69, "2025": 72 },
  model_performance: { binary_classifier_accuracy: 1.0, prediction_model_mae_years: 2.83, prediction_model_r2: 0.37 }
};

const PIE_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa'];

const StatCard = ({ icon, label, value, sub, accent }) => (
  <div className="eda-stat-card" style={{ '--accent': accent }}>
    <div className="eda-stat-icon">{icon}</div>
    <div className="eda-stat-value">{value}</div>
    <div className="eda-stat-label">{label}</div>
    {sub && <div className="eda-stat-sub">{sub}</div>}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="eda-tooltip">
        <p className="eda-tooltip-label">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
        ))}
      </div>
    );
  }
  return null;
};

export default function EDAPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const res = await fetch(`${FLASK_URL}/api/insights`);
      if (!res.ok) throw new Error('Flask not reachable');
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      console.warn('Flask unreachable, using fallback data:', err.message);
      setData(FALLBACK_DATA);
      setError('Using offline data (Flask backend not connected)');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="eda-page">
      <Header />
      <div className="eda-loading">
        <div className="eda-spinner" />
        <p>Loading analytics...</p>
      </div>
      <Footer />
    </div>
  );

  // Transform data for charts
  const timelineData = Object.entries(data.expiry_timeline)
    .map(([year, count]) => ({ year, count }))
    .filter(d => parseInt(d.year) >= 2024);

  const categoryData = Object.entries(data.by_category).map(([name, total]) => ({
    name,
    total,
    expired: data.category_expired_counts[name] || 0,
    active: total - (data.category_expired_counts[name] || 0)
  }));

  const approvalData = Object.entries(data.approval_year_distribution)
    .filter(([y]) => parseInt(y) >= 2006)
    .map(([year, count]) => ({ year, count }));

  const pieData = Object.entries(data.by_category).map(([name, value]) => ({ name, value }));

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'timeline', label: '📅 Expiry Timeline' },
    { id: 'categories', label: '💊 Categories' },
    { id: 'approvals', label: '📈 Approvals' },
    { id: 'model', label: '🤖 ML Model' },
  ];

  return (
    <div className="eda-page">
      <Header />

      <main className="eda-main">
        <div className="eda-hero">
          <div className="eda-hero-badge">FDA Orange Book Data</div>
          <h1 className="eda-title">Patent Analytics Dashboard</h1>
          <p className="eda-subtitle">
            Exploratory data analysis of <strong>{data.overview.total_drugs.toLocaleString()}</strong> pharmaceutical patents
          </p>
          {error && <div className="eda-offline-banner">⚠️ {error}</div>}
        </div>

        {/* Stat Cards */}
        <div className="eda-stats-grid">
          <StatCard icon="💊" label="Total Drugs Tracked" value={data.overview.total_drugs.toLocaleString()} accent="#6366f1" />
          <StatCard icon="✅" label="Active Patents" value={data.overview.total_active.toLocaleString()} sub={`${data.overview.percent_active}% of database`} accent="#10b981" />
          <StatCard icon="⏰" label="Expired Patents" value={data.overview.total_expired.toLocaleString()} sub={`${data.overview.percent_expired}% expired`} accent="#f43f5e" />
          <StatCard icon="📅" label="Expiring in 2025" value={data.expiry_timeline['2025'] || 0} sub="High-impact year" accent="#f59e0b" />
          <StatCard icon="🔮" label="Expiring 2026" value={data.expiry_timeline['2026'] || 0} sub="Upcoming cliff" accent="#a78bfa" />
          <StatCard icon="💰" label="Patient Savings Potential" value="$50B+" sub="Annual if generics adopted" accent="#22d3ee" />
        </div>

        {/* Tabs */}
        <div className="eda-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`eda-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="eda-content">

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="eda-charts-grid">
              <div className="eda-chart-card wide">
                <h3>Patent Expiry Timeline (2024–2035)</h3>
                <p className="chart-desc">Number of drug patents expiring each year — when generics can enter the market</p>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={timelineData.slice(0, 12)}>
                    <defs>
                      <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="count" name="Patents Expiring" stroke="#6366f1" fill="url(#timelineGrad)" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="eda-chart-card">
                <h3>Drugs by Delivery Category</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="eda-chart-card">
                <h3>Key Insight</h3>
                <div className="eda-insight-box">
                  <div className="insight-row">
                    <span className="insight-dot" style={{ background: '#f59e0b' }} />
                    <span><strong>2025</strong> is the biggest cliff year with <strong>{data.expiry_timeline['2025']}</strong> expirations</span>
                  </div>
                  <div className="insight-row">
                    <span className="insight-dot" style={{ background: '#6366f1' }} />
                    <span><strong>Oral drugs</strong> dominate at {Math.round(data.by_category.Oral / data.overview.total_drugs * 100)}% of all patents</span>
                  </div>
                  <div className="insight-row">
                    <span className="insight-dot" style={{ background: '#10b981' }} />
                    <span>Only <strong>{data.overview.percent_expired}%</strong> of patents currently expired</span>
                  </div>
                  <div className="insight-row">
                    <span className="insight-dot" style={{ background: '#f43f5e' }} />
                    <span>Generics arrive ~<strong>6 months</strong> after patent expiry on average</span>
                  </div>
                  <div className="insight-row">
                    <span className="insight-dot" style={{ background: '#22d3ee' }} />
                    <span>Patients can save <strong>20–90%</strong> switching to generics</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TIMELINE TAB */}
          {activeTab === 'timeline' && (
            <div className="eda-charts-grid">
              <div className="eda-chart-card wide">
                <h3>Full Patent Expiry Timeline (2024–2045)</h3>
                <p className="chart-desc">Complete view of all patent expirations in the FDA database</p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Patents Expiring" fill="#6366f1" radius={[4, 4, 0, 0]}>
                      {timelineData.map((entry, i) => (
                        <Cell key={i} fill={parseInt(entry.year) <= 2027 ? '#f43f5e' : parseInt(entry.year) <= 2030 ? '#f59e0b' : '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="chart-legend">
                  <span><span className="legend-dot" style={{ background: '#f43f5e' }} />High urgency (2024–2027)</span>
                  <span><span className="legend-dot" style={{ background: '#f59e0b' }} />Medium (2028–2030)</span>
                  <span><span className="legend-dot" style={{ background: '#6366f1' }} />Future (2031+)</span>
                </div>
              </div>

              <div className="eda-chart-card wide">
                <h3>Near-Term Patent Cliff Summary</h3>
                <div className="cliff-table">
                  <div className="cliff-header">
                    <span>Year</span><span>Expirations</span><span>Cumulative</span><span>Impact Level</span>
                  </div>
                  {timelineData.slice(0, 8).reduce((acc, row, i) => {
                    const cumulative = timelineData.slice(0, i + 1).reduce((s, r) => s + r.count, 0);
                    const impact = row.count > 150 ? 'CRITICAL' : row.count > 100 ? 'HIGH' : row.count > 60 ? 'MEDIUM' : 'LOW';
                    const color = row.count > 150 ? '#f43f5e' : row.count > 100 ? '#f59e0b' : row.count > 60 ? '#6366f1' : '#10b981';
                    acc.push(
                      <div className="cliff-row" key={row.year}>
                        <span className="cliff-year">{row.year}</span>
                        <span className="cliff-count">{row.count}</span>
                        <span>{cumulative}</span>
                        <span className="cliff-badge" style={{ background: color + '22', color }}>{impact}</span>
                      </div>
                    );
                    return acc;
                  }, [])}
                </div>
              </div>
            </div>
          )}

          {/* CATEGORIES TAB */}
          {activeTab === 'categories' && (
            <div className="eda-charts-grid">
              <div className="eda-chart-card wide">
                <h3>Active vs Expired Patents by Drug Category</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 13 }} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="active" name="Active" fill="#10b981" radius={[0, 4, 4, 0]} stackId="a" />
                    <Bar dataKey="expired" name="Expired" fill="#f43f5e" radius={[0, 4, 4, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="eda-chart-card">
                <h3>Category Breakdown</h3>
                <div className="category-list">
                  {categoryData.map((cat, i) => (
                    <div className="category-item" key={cat.name}>
                      <div className="category-header">
                        <span className="cat-dot" style={{ background: PIE_COLORS[i] }} />
                        <span className="cat-name">{cat.name}</span>
                        <span className="cat-total">{cat.total}</span>
                      </div>
                      <div className="cat-bar-bg">
                        <div className="cat-bar-fill" style={{ width: `${(cat.total / data.overview.total_drugs * 100)}%`, background: PIE_COLORS[i] }} />
                      </div>
                      <div className="cat-meta">
                        <span className="cat-active">{cat.active} active</span>
                        <span className="cat-expired">{cat.expired} expired</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="eda-chart-card">
                <h3>Expired Patents by Category</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={categoryData.filter(c => c.expired > 0).map(c => ({ name: c.name, value: c.expired }))}
                      cx="50%" cy="50%" outerRadius={85} dataKey="value" nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}>
                      {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* APPROVALS TAB */}
          {activeTab === 'approvals' && (
            <div className="eda-charts-grid">
              <div className="eda-chart-card wide">
                <h3>FDA Drug Approvals by Year (2006–2025)</h3>
                <p className="chart-desc">More approvals today means more patents expiring 10–20 years from now</p>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={approvalData}>
                    <defs>
                      <linearGradient id="approvalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="count" name="Approvals" stroke="#22d3ee" fill="url(#approvalGrad)" strokeWidth={2} dot={{ fill: '#22d3ee', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="eda-chart-card wide">
                <h3>Key Approval Trends</h3>
                <div className="trend-cards">
                  <div className="trend-card">
                    <div className="trend-num" style={{ color: '#6366f1' }}>95</div>
                    <div>Peak approvals in <strong>2021 & 2023</strong></div>
                  </div>
                  <div className="trend-card">
                    <div className="trend-num" style={{ color: '#22d3ee' }}>+227%</div>
                    <div>Approval growth from 2006 to 2021</div>
                  </div>
                  <div className="trend-card">
                    <div className="trend-num" style={{ color: '#10b981' }}>72</div>
                    <div>Drugs approved in <strong>2025</strong> so far</div>
                  </div>
                  <div className="trend-card">
                    <div className="trend-num" style={{ color: '#f59e0b' }}>~20yr</div>
                    <div>Average patent lifetime from approval</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ML MODEL TAB */}
          {activeTab === 'model' && (
            <div className="eda-charts-grid">
              <div className="eda-chart-card">
                <h3>Binary Classifier Performance</h3>
                <div className="model-metric">
                  <div className="metric-circle" style={{ '--pct': data.model_performance.binary_classifier_accuracy * 100, '--color': '#10b981' }}>
                    <span>{(data.model_performance.binary_classifier_accuracy * 100).toFixed(0)}%</span>
                  </div>
                  <p>Accuracy — Classifies whether a patent is Active or Expired</p>
                  <div className="model-badge good">Gradient Boosting Classifier</div>
                </div>
              </div>

              <div className="eda-chart-card">
                <h3>Lifetime Predictor Performance</h3>
                <div className="model-stats-list">
                  <div className="model-stat-row">
                    <span>Mean Absolute Error</span>
                    <strong>{data.model_performance.prediction_model_mae_years} years</strong>
                  </div>
                  <div className="model-stat-row">
                    <span>R² Score</span>
                    <strong>{data.model_performance.prediction_model_r2}</strong>
                  </div>
                  <div className="model-stat-row">
                    <span>Model Type</span>
                    <strong>Random Forest Regressor</strong>
                  </div>
                  <div className="model-stat-row">
                    <span>Confidence Interval</span>
                    <strong>±1032 days</strong>
                  </div>
                  <div className="model-stat-row">
                    <span>Training Data</span>
                    <strong>{data.overview.total_drugs} patents</strong>
                  </div>
                </div>
                <div className="model-badge warn">Regression Model</div>
              </div>

              <div className="eda-chart-card wide">
                <h3>Feature Inputs Used by the Model</h3>
                <div className="feature-grid">
                  {['Approval Year', 'Approval Month', 'App Type (New/Generic)', 'Category: Injectable', 'Category: Oral', 'Category: Other', 'Category: Respiratory', 'Category: Topical'].map((f, i) => (
                    <div className="feature-chip" key={i}>
                      <span className="feature-num">{i + 1}</span>
                      {f}
                    </div>
                  ))}
                </div>
                <div className="model-note">
                  💡 The classifier uses 5 features (expiry date, lifetime days, days from today). The regressor predicts lifetime from approval metadata.
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
