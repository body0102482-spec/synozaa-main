import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stethoscope, FileText, BarChart3, ClipboardList } from 'lucide-react';
import api from '../lib/api';
import { DashboardLayout } from '../components/DashboardLayout';

type Tab = 'overview' | 'cases' | 'results';

export default function DoctorPortal() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('overview');
  const [cases, setCases] = useState<Record<string, unknown>[]>([]);
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (tab === 'overview' || tab === 'cases') api.get('/doctor/cases').then((r) => setCases(r.data.cases));
    if (tab === 'overview' || tab === 'results') api.get('/doctor/student-results').then((r) => setResults(r.data.results));
    if (tab === 'overview') api.get('/doctor/analytics').then((r) => setAnalytics(r.data.analytics));
  }, [tab]);

  const navItems = [
    { id: 'overview', label: t('statistics'), icon: BarChart3 },
    { id: 'cases', label: t('cases'), icon: FileText },
    { id: 'results', label: t('results'), icon: ClipboardList },
  ];

  return (
    <DashboardLayout
      title={t('doctorPortal')}
      subtitle="Review cases and student performance"
      navItems={navItems}
      activeId={tab}
      onNavChange={(id) => setTab(id as Tab)}
      homeLink="/doctor"
    >
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: t('cases'), value: analytics.caseCount as number || 0, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-500' },
              { label: t('completedStations'), value: analytics.sessionCount as number || 0, icon: Stethoscope, color: 'text-emerald-600', bg: 'bg-emerald-500' },
              { label: t('avgScore'), value: `${Math.round((analytics.averageScore as number || 0) * 10) / 10}%`, icon: BarChart3, color: 'text-violet-600', bg: 'bg-violet-500' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="stat-card">
                <div className={`absolute top-0 right-0 w-20 h-20 ${bg} rounded-full opacity-10 -translate-y-1/3 translate-x-1/3`} />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                    <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{value}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-800 ${color}`}>
                    <Icon size={22} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'cases' && (
        <div className="grid gap-3">
          {cases.map((c) => (
            <div key={c.id as string} className="card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <FileText className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{c.titleEn as string}</p>
                <p className="text-sm text-slate-500">{c.patientName as string}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'results' && (
        <div className="card overflow-hidden">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Case</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const session = r.session as Record<string, unknown>;
                const user = session.user as Record<string, string>;
                const caseData = session.case as Record<string, string>;
                return (
                  <tr key={r.id as string}>
                    <td className="font-medium">{user.firstName} {user.lastName}</td>
                    <td>{caseData.titleEn}</td>
                    <td className="font-bold text-primary">{r.totalScore as number}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
