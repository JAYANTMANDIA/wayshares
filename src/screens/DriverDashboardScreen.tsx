import React, { useState, useEffect } from 'react';
import { Plus, Car, Calendar, DollarSign, Users, ChevronRight, Shield, ArrowRight, XCircle } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen, Ride, RideStatus } from '../types';
import { store } from '../services/store';

interface DriverDashboardScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const DriverDashboardScreen: React.FC<DriverDashboardScreenProps> = ({ onNavigate }) => {
  const [rides, setRides] = useState<Ride[]>(store.rides);
  const [canProvideRide, setCanProvideRide] = useState(store.canProvideRide());
  const [updatingRideId, setUpdatingRideId] = useState('');
  const [actionError, setActionError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const update = () => {
      setRides([...store.rides]);
      setCanProvideRide(store.canProvideRide());
    };
    const unsubscribe = store.subscribe(update);
    void store.syncWithBackend().finally(() => setIsLoading(false));
    return unsubscribe;
  }, []);

  // Filter rides published by current user / driver
  const myPublishedRides = rides.filter((ride) => ride.driverId === store.user.id);
  const earnings = myPublishedRides.reduce((total, ride) => {
    const bookedSeats = Math.max(0, ride.totalSeats - ride.availableSeats);
    return total + bookedSeats * ride.pricePerSeat;
  }, 0);

  const handleRideStatus = async (rideId: string, status: RideStatus) => {
    setUpdatingRideId(rideId);
    setActionError('');
    try {
      await store.updateRideStatus(rideId, status);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update ride');
    } finally {
      setUpdatingRideId('');
    }
  };

  const handlePublishClick = () => {
    if (!store.canProvideRide()) {
      onNavigate('profile');
      return;
    }
    onNavigate('create_ride');
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-12">
      <div>
        <TopBar
          title="Driver Mode"
          onBack={() => {
            store.setActiveRole('passenger');
            onNavigate('home');
          }}
          showMore={true}
        />

        <div className="px-5 pt-1 space-y-4">
          {/* Missing RC Warning Banner */}
          {!canProvideRide && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs font-bold">Vehicle RC Required</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                You can only take rides as a passenger right now. To provide rides and accept passengers, please upload your Vehicle Registration Certificate (RC).
              </p>
              <button
                onClick={() => onNavigate('profile')}
                className="mt-1 text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-xl hover:bg-amber-700 active:scale-95 transition-all"
              >
                Upload RC in Profile
              </button>
            </div>
          )}

          {/* Driver Earnings & Stats Card */}
          <div className="p-5 rounded-3xl bg-neutral-900 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-neutral-400 font-medium uppercase tracking-wider block">
                  Booked seat earnings
                </span>
                <span className="text-3xl font-black tracking-tight text-white mt-0.5 block">
                  ₹{earnings.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-neutral-800 text-center">
              <div>
                <span className="text-sm font-bold block">{myPublishedRides.length}</span>
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Active Rides</span>
              </div>
              <div>
                <span className="text-sm font-bold text-rose-400 block">{store.user.rating ? `${store.user.rating} ★` : '—'}</span>
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Rating</span>
              </div>
              <div>
                <span className="text-sm font-bold text-emerald-400 block">{store.user.totalTrips || 0}</span>
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Trips</span>
              </div>
            </div>
          </div>

          {/* Quick Action: Publish Ride Button */}
          <button
            onClick={handlePublishClick}
            id="driver-publish-ride-button"
            className={`w-full font-bold py-3.5 px-4 rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
              canProvideRide
                ? 'bg-[#EF4444] hover:bg-rose-600 active:scale-[0.98] text-white'
                : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
            }`}
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>{canProvideRide ? 'Publish New Ride' : 'Upload RC to Publish Rides'}</span>
          </button>

          <div className="grid grid-cols-2 gap-3" aria-label="Driver ride options">
            <button
              onClick={() => onNavigate('plan_trip')}
              id="driver-plan-a-ride"
              className="min-h-[112px] rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-left flex flex-col justify-between hover:border-orange-400 hover:bg-orange-50/30 active:scale-[0.98] transition-all"
            >
              <span className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-800">
                <Users className="w-4 h-4" />
              </span>
              <span>
                <span className="block text-sm font-bold text-black">Plan a Ride</span>
                <span className="block text-[11px] text-neutral-500 mt-0.5">Give a ride · Offer seats</span>
              </span>
            </button>
            <button
              onClick={() => onNavigate('schedule_ride')}
              id="driver-schedule-ride"
              className="min-h-[112px] rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-left flex flex-col justify-between hover:border-orange-400 hover:bg-orange-50/30 active:scale-[0.98] transition-all"
            >
              <span className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-800">
                <Calendar className="w-4 h-4" />
              </span>
              <span>
                <span className="block text-sm font-bold text-black">Schedule Ride</span>
                <span className="block text-[11px] text-neutral-500 mt-0.5">Book for a future date</span>
              </span>
            </button>
          </div>

          {/* KYC / Verification Banner */}
          <div
            onClick={() => onNavigate('profile')}
            className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer ${
              canProvideRide
                ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50'
                : 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Shield className={`w-5 h-5 ${canProvideRide ? 'text-emerald-600' : 'text-amber-600'}`} />
              <div>
                <h4 className={`text-xs font-bold ${canProvideRide ? 'text-emerald-950' : 'text-amber-950'}`}>
                  {canProvideRide ? 'Driving Documents Verified' : 'Aadhaar & PAN Verified (RC Missing)'}
                </h4>
                <p className={`text-[10px] ${canProvideRide ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {canProvideRide ? 'Aadhaar, PAN & Vehicle RC active' : 'Upload RC to unlock ride publishing'}
                </p>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 ${canProvideRide ? 'text-emerald-600' : 'text-amber-600'}`} />
          </div>

          {/* My Published Rides List */}
          <div>
            <h3 className="text-sm font-bold text-black tracking-tight mb-2.5">
              My Scheduled Rides
            </h3>
            {actionError && <p role="alert" className="mb-2 text-xs font-medium text-rose-700">{actionError}</p>}

            {isLoading ? (
              <p className="text-center py-8 text-xs font-semibold text-neutral-500">Loading your rides from the database…</p>
            ) : myPublishedRides.length === 0 ? (
              <div className="text-center py-8 px-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                <Car className="w-8 h-8 text-neutral-400 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-neutral-800">No published rides in the database</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Publish a trip from your city to start earning from co-passengers.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myPublishedRides.map((ride) => (
                  <div
                    key={ride.id}
                    className="p-4 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-black">
                          {ride.fromCity} → {ride.toCity}
                        </h4>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {ride.departureDate} • {ride.departureTime}
                        </p>
                      </div>
                      <span className="text-sm font-extrabold text-black">
                        ₹{ride.pricePerSeat} / seat
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-100">
                      <span className="text-neutral-500 font-medium">
                        Seats Left: <span className="font-bold text-black">{ride.availableSeats}</span> / {ride.totalSeats}
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold text-[10px]">
                        {ride.status}
                      </span>
                    </div>
                    {ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED' && (
                      <div className="flex gap-2 pt-1">
                        {ride.status !== 'STARTED' && (
                          <button
                            type="button"
                            disabled={updatingRideId === ride.id}
                            onClick={() => handleRideStatus(ride.id, 'CANCELLED')}
                            className="border border-neutral-300 px-3 py-2 rounded-lg text-[11px] font-semibold text-neutral-700 disabled:opacity-50"
                          >
                            <XCircle className="inline w-3.5 h-3.5 mr-1" />Cancel
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={updatingRideId === ride.id}
                          onClick={() => handleRideStatus(ride.id, ({
                            UPCOMING: 'DRIVER_ON_WAY',
                            DRIVER_ON_WAY: 'ARRIVING',
                            ARRIVING: 'STARTED',
                            STARTED: 'COMPLETED'
                          } as Partial<Record<RideStatus, RideStatus>>)[ride.status]!)}
                          className="ml-auto bg-neutral-900 px-3 py-2 rounded-lg text-[11px] font-semibold text-white disabled:opacity-50"
                        >
                          {updatingRideId === ride.id ? 'Updating...' : ride.status === 'STARTED' ? 'Complete ride' : 'Advance status'}
                          <ArrowRight className="inline w-3.5 h-3.5 ml-1" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
