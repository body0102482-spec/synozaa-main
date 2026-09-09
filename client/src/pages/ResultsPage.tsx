import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';

interface Result {
  id: string;
  totalScore: number;
  createdAt: string;
  session: {
    id: string;
    case: { titleEn: string; titleAr: string; specialty: { nameEn: string } };
  };
}

export default function ResultsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/results').then((res) => setResults(res.data.results)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t('myResults')}</h1>
          <Link to="/student" className="btn-secondary text-sm">{t('dashboard')}</Link>
        </div>

        {loading ? (
          <p>{t('loading')}</p>
        ) : results.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">{t('noResults')}</div>
        ) : (
          <div className="space-y-3">
            {results.map((r) => (
              <Link key={r.id} to={`/simulation/${r.session.id}`} className="card p-5 flex items-center justify-between hover:shadow-md transition-shadow block">
                <div>
                  <h3 className="font-semibold">{isAr ? r.session.case.titleAr : r.session.case.titleEn}</h3>
                  <p className="text-sm text-slate-500">{r.session.case.specialty.nameEn} • {new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{r.totalScore}%</p>
                  <p className="text-xs text-slate-400">{t('totalScore')}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
    </div>
  );
}
