import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { UserPlus, Trash2, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen, SafetyContact } from '../types';
import { store } from '../services/store';
import { auth } from '../lib/firebase';

interface TrustedContactsScreenProps {
  onNavigate: (screen: AppScreen) => void;
}


export const TrustedContactsScreen: React.FC<TrustedContactsScreenProps> = ({ onNavigate }) => {
  const [contacts, setContacts] = useState<SafetyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRel, setNewRel] = useState('Family');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getAuthHeader = async (): Promise<Record<string, string>> => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Not authenticated');
    const token = await firebaseUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  };

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeader();
      const res = await fetch('/api/trusted-contacts', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load contacts');
      const loaded: SafetyContact[] = (data.contacts || []).map((c: any) => ({
        id: c.id,
        userId: c.userId,
        contactName: c.contactName,
        phoneNumber: c.phoneNumber,
        relationship: c.relationship
      }));
      setContacts(loaded);
      // Also keep store.safetyContacts in sync for other screens (ShareLocationModal uses store)
      store.safetyContacts = loaded;
      store['notify']();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      const headers = await getAuthHeader();
      const res = await fetch('/api/trusted-contacts', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactName: newName.trim(), phoneNumber: newPhone.trim(), relationship: newRel })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add contact');
      const newContact: SafetyContact = {
        id: data.contact.id,
        userId: data.contact.userId,
        contactName: data.contact.contactName,
        phoneNumber: data.contact.phoneNumber,
        relationship: data.contact.relationship
      };
      const updated = [...contacts, newContact];
      setContacts(updated);
      store.safetyContacts = updated;
      store['notify']();
      setNewName('');
      setNewPhone('');
      setShowAddModal(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this trusted contact?')) return;
    setDeletingId(id);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/trusted-contacts/${id}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      const updated = contacts.filter((c) => c.id !== id);
      setContacts(updated);
      store.safetyContacts = updated;
      store['notify']();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete contact');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-8">
      <div>
        <TopBar
          title="Trusted Contacts"
          onBack={() => onNavigate('safety')}
          showMore={true}
        />

        <div className="px-5 pt-2 space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80">
            <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider mb-1">
              Automated Safety Alerts
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed font-normal">
              These contacts will automatically receive your live location link via SMS whenever you trigger the Share Live Location feature.
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
              <span className="text-sm text-neutral-500">Loading contacts…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-rose-700">Could not load contacts</p>
                <p className="text-xs text-rose-500 mt-0.5">{error}</p>
                <button onClick={() => void loadContacts()} className="mt-2 text-xs font-bold text-rose-600 underline">
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Contacts List */}
          {!loading && !error && (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="p-4 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-50 text-[#EF4444] border border-rose-100 flex items-center justify-center font-bold text-sm">
                      {contact.contactName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-black flex items-center gap-1.5">
                        <span>{contact.contactName}</span>
                        <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-medium">
                          {contact.relationship}
                        </span>
                      </h4>
                      <p className="text-xs text-neutral-500 mt-0.5">{contact.phoneNumber}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => void handleDelete(contact.id)}
                    disabled={deletingId === contact.id}
                    className="p-2 text-neutral-400 hover:text-rose-500 transition-colors disabled:opacity-50"
                    aria-label="Delete contact"
                  >
                    {deletingId === contact.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && (
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full border-2 border-dashed border-neutral-300 hover:border-black rounded-2xl p-4 flex items-center justify-center gap-2 text-xs font-bold text-neutral-700 hover:text-black transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New Trusted Contact</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void handleAdd(e)}
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-3"
          >
            <h3 className="text-base font-bold text-black">Add Trusted Contact</h3>
            <div>
              <label className="text-xs text-neutral-500 block mb-1 font-semibold">Full Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Ramesh Sharma"
                className="w-full border rounded-xl px-3 py-2 text-sm outline-hidden"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1 font-semibold">Phone Number</label>
              <input
                type="tel"
                required
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+91 98450 XXXXX"
                className="w-full border rounded-xl px-3 py-2 text-sm outline-hidden"
              />
              <p className="text-[11px] text-neutral-400 mt-1">Include country code, e.g. +91XXXXXXXXXX</p>
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1 font-semibold">Relationship</label>
              <select
                value={newRel}
                onChange={(e) => setNewRel(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm outline-hidden bg-white"
              >
                <option value="Family">Family</option>
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Sibling">Sibling</option>
                <option value="Spouse">Spouse</option>
                <option value="Friend">Friend</option>
                <option value="Colleague">Colleague</option>
              </select>
            </div>
            {saveError && (
              <p className="text-xs text-rose-600 bg-rose-50 rounded-xl px-3 py-2 border border-rose-200">{saveError}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setSaveError(''); }}
                className="flex-1 border py-2.5 rounded-xl text-xs font-semibold text-neutral-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-black text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save Contact'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

