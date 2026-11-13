import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../api';
import type { SettingsResponse } from '../types';

interface SettingsViewProps {
  onSettingsUpdated: () => void;
}

export function SettingsView({ onSettingsUpdated }: SettingsViewProps) {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerRole, setReviewerRole] = useState('');
  const [signature, setSignature] = useState('');
  const [aiMode, setAiMode] = useState<'auto' | 'deterministic'>('auto');
  const [highThresh, setHighThresh] = useState(70);
  const [medThresh, setMedThresh] = useState(40);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((res) => {
      setData(res);
      setReviewerName(res.settings.reviewer_name);
      setReviewerRole(res.settings.reviewer_role);
      setSignature(res.settings.company_signature);
      setAiMode(res.settings.preferred_ai_mode);
      setHighThresh(res.settings.high_priority_threshold);
      setMedThresh(res.settings.medium_priority_threshold);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    try {
      const updated = await api.updateSettings({
        reviewer_name: reviewerName,
        reviewer_role: reviewerRole,
        company_signature: signature,
        preferred_ai_mode: aiMode,
        high_priority_threshold: highThresh,
        medium_priority_threshold: medThresh,
      });
      setData(updated);
      onSettingsUpdated();
      setSavedMsg('Workspace settings saved.');
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  if (!data) {
    return <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Runtime Environment Summary */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Runtime &amp; Security Status</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            API keys are managed strictly via server-side environment variables and are never
            exposed or editable in browser storage.
          </p>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Active Processing Mode</dt>
            <dd className="font-medium text-slate-900 mt-0.5">
              {data.environment.active_processing_mode === 'openai_llm'
                ? `OpenAI LLM (${data.environment.openai_model})`
                : 'Deterministic Fallback + TF-IDF Engine'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">OPENAI_API_KEY Status</dt>
            <dd className="font-medium text-slate-900 mt-0.5">
              {data.environment.openai_configured
                ? 'Configured in server environment'
                : 'Not configured (using transparent deterministic fallback)'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">Persistence Layer</dt>
            <dd className="font-medium text-slate-900 mt-0.5">{data.environment.database_engine}</dd>
          </div>
        </dl>
      </section>

      {/* Editable Preferences */}
      <form
        onSubmit={handleSave}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="pb-3 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            Reviewer Identity &amp; Scoring Governance
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure email draft signature details and deterministic lead scoring thresholds.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
            {error}
          </div>
        )}
        {savedMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
            {savedMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              BDM Reviewer Name
            </label>
            <input
              type="text"
              required
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Reviewer Role</label>
            <input
              type="text"
              required
              value={reviewerRole}
              onChange={(e) => setReviewerRole(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Company Email Signature Line
            </label>
            <input
              type="text"
              required
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Preferred Pipeline Mode
            </label>
            <select
              value={aiMode}
              onChange={(e) => setAiMode(e.target.value as 'auto' | 'deterministic')}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="auto">Auto (Use OpenAI if key configured, else Fallback)</option>
              <option value="deterministic">Force Deterministic Fallback Mode</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                High Threshold (pts)
              </label>
              <input
                type="number"
                min={50}
                max={95}
                value={highThresh}
                onChange={(e) => setHighThresh(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono-nums border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Medium Threshold (pts)
              </label>
              <input
                type="number"
                min={15}
                max={65}
                value={medThresh}
                onChange={(e) => setMedThresh(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono-nums border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end border-t border-slate-100">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}
