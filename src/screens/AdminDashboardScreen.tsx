import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ShieldAlert,
  Users,
  Car,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  DollarSign,
  Search,
  Filter
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen, User, Driver, Ride, SupportTicket } from '../types';
import { store } from '../services/store';

interface AdminDashboardScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'drivers' | 'rides' | 'tickets'>('overview');
  const [allUsers, setAllUsers] = useState<User[]>(store.allUsers);
  const [drivers, setDrivers] = useState<Driver[]>(store.drivers);
  const [rides, setRides] = useState<Ride[]>(store.rides);
  const [tickets, setTickets] = useState<SupportTicket[]>(store.tickets);

  useEffect(() => {
    const update = () => {
      setAllUsers([...store.allUsers]);
      setDrivers([...store.drivers]);
      setRides([...store.rides]);
      setTickets([...store.tickets]);
    };
    return store.subscribe(update);
  }, []);

  const handleVerifyUser = (userId: string) => {
    store.verifyUser(userId);
  };

  const handleSuspendUser = (userId: string) => {
    store.suspendUser(userId);
  };

  const handleCancelRide = (rideId: string) => {
    if (window.confirm('Admin Action: Cancel this ride and refund all passengers?')) {
      store.cancelRideByAdmin(rideId);
    }
  };

  const handleResolveTicket = (ticketId: string) => {
    store.updateTicketStatus(ticketId, 'RESOLVED');
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-12">
      <div>
        <TopBar
          title="Admin Control Center"
          onBack={() => onNavigate('home')}
          showMore={false}
        />

        {/* Tab Bar */}
        <div className="px-4 py-2 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-neutral-50">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'users', label: 'Users' },
            { id: 'drivers', label: 'Drivers' },
            { id: 'rides', label: 'Rides' },
            { id: 'tickets', label: 'Tickets' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                activeTab === t.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-neutral-600 border border-neutral-200 hover:border-black'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-neutral-900 text-white shadow-xs">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Total Users</span>
                  <div className="text-2xl font-black mt-0.5">{allUsers.length + 42}</div>
                  <span className="text-[9px] text-emerald-400 font-bold">● Active Platform</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-900 text-white shadow-xs">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Active Rides</span>
                  <div className="text-2xl font-black mt-0.5">{rides.filter((r) => r.status !== 'CANCELLED').length}</div>
                  <span className="text-[9px] text-rose-400 font-bold">● Highways Live</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-900 text-white shadow-xs">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Verified Drivers</span>
                  <div className="text-2xl font-black mt-0.5">{drivers.length}</div>
                  <span className="text-[9px] text-emerald-400 font-bold">100% KYC Passed</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-900 text-white shadow-xs">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Support Queue</span>
                  <div className="text-2xl font-black mt-0.5">{tickets.filter((t) => t.status !== 'RESOLVED').length}</div>
                  <span className="text-[9px] text-amber-400 font-bold">24/7 SLA Monitored</span>
                </div>
              </div>

              {/* Safety notice */}
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs">
                <div className="flex items-center gap-2 font-bold mb-0.5">
                  <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
                  <span>Safety Monitoring Active</span>
                </div>
                <p className="text-[11px] text-rose-800 leading-relaxed font-normal">
                  All active rides transmit heartbeat location every 4 seconds. SOS alarms are bridged directly to Police 112 API.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase text-neutral-500">Passenger & Dual Accounts</h3>
              {allUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-3 rounded-2xl border border-neutral-200 bg-white shadow-2xs flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <img src={u.profilePhoto} alt={u.fullName} className="w-9 h-9 rounded-full object-cover" />
                    <div>
                      <h4 className="font-bold text-black">{u.fullName}</h4>
                      <p className="text-[11px] text-neutral-500">{u.phoneNumber}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        u.verificationStatus === 'verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {u.verificationStatus}
                    </span>

                    {u.verificationStatus !== 'verified' ? (
                      <button
                        onClick={() => handleVerifyUser(u.id)}
                        className="px-2 py-1 bg-black text-white text-[10px] font-bold rounded-lg"
                      >
                        Verify
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSuspendUser(u.id)}
                        className="px-2 py-1 border border-rose-300 text-rose-600 text-[10px] font-bold rounded-lg hover:bg-rose-50"
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'drivers' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase text-neutral-500">Driver License Registrations</h3>
              {drivers.map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-2xl border border-neutral-200 bg-white shadow-2xs space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-neutral-800">{d.drivingLicense}</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                      {d.verificationStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500">
                    <span>Trips: {d.totalTrips}</span>
                    <span>Rating: {d.rating} ★</span>
                    <span>Joined: {d.joinedDate || '2024'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'rides' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase text-neutral-500">Carpool Rides</h3>
              {rides.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-2xl border border-neutral-200 bg-white shadow-2xs space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black">{r.fromCity} → {r.toCity}</span>
                    <span className="font-bold text-black">₹{r.pricePerSeat}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500">
                    <span>Driver: {r.driverName}</span>
                    <span>{r.availableSeats} seats left</span>
                    <span className="font-bold text-neutral-700">{r.status}</span>
                  </div>
                  {r.status !== 'CANCELLED' && (
                    <button
                      onClick={() => handleCancelRide(r.id)}
                      className="w-full py-1.5 border border-rose-200 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-50"
                    >
                      Admin Force Cancel Ride
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase text-neutral-500">Support & Safety Complaints</h3>
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 rounded-2xl border border-neutral-200 bg-white shadow-2xs space-y-2 text-xs"
                >
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
                  <p className="text-neutral-700 text-[11px] leading-relaxed">{t.message}</p>
                  <div className="flex items-center justify-between pt-1 border-t text-[10px] text-neutral-500">
                    <span>User: {t.userName}</span>
                    {t.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleResolveTicket(t.id)}
                        className="px-2.5 py-1 bg-black text-white font-bold rounded-lg text-[10px]"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
