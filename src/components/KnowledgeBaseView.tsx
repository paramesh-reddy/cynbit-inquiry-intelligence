import { useEffect, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { api } from '../api';
import type { KnowledgeItem, KnowledgeMatch } from '../types';

export function KnowledgeBaseView() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [matches, setMatches] = useState<KnowledgeMatch[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (q?: string) => {
    setLoading(true);
    try {
      const res = await api.getKnowledgeBase(q);
      setItems(res.items);
      setMatches(res.matches);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleTestRetrieval = (e: React.FormEvent) => {
    e.preventDefault();
    load(query);
  };

  return (
    <div className="space-y-6">
      {/* Live Retrieval Tester */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Cynbit Public Knowledge Base &amp; TF-IDF Retrieval Tester
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Grounded strictly in publicly documented services and SaaS products from{' '}
            <span className="font-medium text-slate-700">cynbit.in</span>. Enter sample client
            requirements to inspect cosine similarity ranking.
          </p>
        </div>

        <form onSubmit={handleTestRetrieval} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Test query e.g. 'bilingual voice agent for clinic booking and CRM sync'"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
          >
            Test Similarity Retrieval
          </button>
        </form>

        {matches.length > 0 && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="text-xs font-medium text-slate-700">Top Retrieved Matches</div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {matches.map((m) => (
                <div key={m.id} className="p-3.5 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{m.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {m.service_category} · {m.offering_type}
                      {m.matched_terms.length > 0 && ` · Terms: ${m.matched_terms.join(', ')}`}
                    </div>
                  </div>
                  <span className="text-xs font-mono-nums font-semibold text-blue-700 shrink-0">
                    {m.similarity_score.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Catalog Grid */}
      {loading ? (
        <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((item) => (
            <article
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {item.offering_type} · {item.service_category}
                  </div>
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline shrink-0"
                  >
                    <span>Source</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
                <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{item.summary}</p>
                <ul className="text-xs text-slate-700 space-y-1 list-disc pl-4 pt-1">
                  {item.capabilities.map((cap, idx) => (
                    <li key={idx}>{cap}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                <span className="font-medium text-slate-700">Typical Stack:</span>{' '}
                {item.typical_stack.join(', ')}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
