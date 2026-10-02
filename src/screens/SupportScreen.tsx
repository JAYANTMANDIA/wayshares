import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Headphones, Send, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen, SupportTicket } from '../types';
import { store } from '../services/store';

interface SupportScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const SupportScreen: React.FC<SupportScreenProps> = ({ onNavigate }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>(store.tickets);
  const [category, setCategory] = useState('Ride Experience & Safety');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const update = () => setTickets([...store.tickets]);
    return store.subscribe(update);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    store.createSupportTicket(category, message.trim());
    setMessage('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-12">
      <div>
        <TopBar
          title="24/7 Support Desk"
          onBack={() => onNavigate('home')}
          showMore={false}
        />

        <div className="px-5 pt-1 space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-900 text-white shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-rose-400">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">UberX Highway Assistance</h3>
                <p className="text-[11px] text-neutral-300">Average response time: &lt; 3 mins</p>
              </div>
            </div>
          </div>

          {/* New Ticket Form */}
          <form onSubmit={handleSubmit} className="p-4 rounded-2xl border border-neutral-200 bg-white shadow-2xs space-y-3">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Create New Support Request
            </h4>

            <div>
              <label className="text-[11px] font-bold text-neutral-700 block mb-1">Issue Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-xs font-semibold outline-hidden bg-white"
              >
                <option value="Ride Experience & Safety">Ride Experience & Safety</option>
                <option value="Payment & Fare Inquiry">Payment & Fare Inquiry</option>
                <option value="Luggage & Cargo Question">Luggage & Cargo Question</option>
                <option value="Driver Conduct & Punctuality">Driver Conduct & Punctuality</option>
                <option value="Account & Profile Verification">Account & Profile Verification</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-neutral-700 block mb-1">Describe Your Issue</label>
              <textarea
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Explain what happened or what you need assistance with..."
                className="w-full border rounded-xl p-3 text-xs outline-hidden"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-black text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Ticket</span>
            </button>

            {submitted && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Ticket submitted! Support officer assigned.</span>
              </div>
            )}
          </form>

          {/* Existing Tickets History */}
          <div>
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Your Recent Tickets
            </h4>

            <div className="space-y-2.5">
              {tickets.map((t) => (
                <div key={t.id} className="p-3 rounded-2xl border border-neutral-200 bg-white text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black">{t.category}</span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        t.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="text-neutral-600 text-[11px]">{t.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
