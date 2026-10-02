import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AppScreen, Ride, Booking } from './types';
import { store } from './services/store';
import { PhoneFrame } from './components/PhoneFrame';
import { BottomNav } from './components/BottomNav';
import { SplashScreen } from './screens/SplashScreen';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PlanTripScreen } from './screens/PlanTripScreen';
import { AvailableRidesScreen } from './screens/AvailableRidesScreen';
import { RideDetailsScreen } from './screens/RideDetailsScreen';
import { SelectSeatScreen } from './screens/SelectSeatScreen';
import { PaymentScreen } from './screens/PaymentScreen';
import { BookingConfirmationScreen } from './screens/BookingConfirmationScreen';
import { RideTrackingScreen } from './screens/RideTrackingScreen';
import { SafetyScreen } from './screens/SafetyScreen';
import { TrustedContactsScreen } from './screens/TrustedContactsScreen';
import { MyTripsScreen } from './screens/MyTripsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { DriverDashboardScreen } from './screens/DriverDashboardScreen';
import { CreateRideScreen } from './screens/CreateRideScreen';
import { DriverVerificationScreen } from './screens/DriverVerificationScreen';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen';
import { SupportScreen } from './screens/SupportScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { CityRideScreen } from './screens/CityRideScreen';
import { LuggageTransferScreen } from './screens/LuggageTransferScreen';
import { ScheduleRideScreen } from './screens/ScheduleRideScreen';
import { ChatScreen } from './screens/ChatScreen';

export function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('splash');

  const [tripParams, setTripParams] = useState({
    fromCity: '',
    toCity: '',
    date: '',
    passengers: 1,
    luggage: false
  });

  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);

  const [lastBooking, setLastBooking] = useState<Booking | null>(null);

  const handleNavigate = (screen: AppScreen) => {
    setCurrentScreen(screen);
  };

  const handleSelectRecentTrip = (from: string, to: string) => {
    setTripParams((prev) => ({
      ...prev,
      fromCity: from,
      toCity: to
    }));
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return <SplashScreen onNavigate={handleNavigate} />;
      case 'login':
        return (
          <LoginScreen
            onNavigate={handleNavigate}
          />
        );
      case 'home':
        return (
          <HomeScreen
            onNavigate={handleNavigate}
            onSelectRecentTrip={handleSelectRecentTrip}
          />
        );
      case 'city_ride':
        return (
          <CityRideScreen
            onNavigate={handleNavigate}
            onSearchRides={(params) => setTripParams(params)}
          />
        );
      case 'luggage_transfer':
        return (
          <LuggageTransferScreen
            onNavigate={handleNavigate}
            onSearchRides={(params) => setTripParams(params)}
          />
        );
      case 'schedule_ride':
        return <ScheduleRideScreen onNavigate={handleNavigate} />;
      case 'plan_trip':
        return (
          <PlanTripScreen
            tripParams={tripParams}
            onUpdateParams={(p) => setTripParams(p)}
            onNavigate={handleNavigate}
          />
        );
      case 'available_rides':
        return (
          <AvailableRidesScreen
            tripParams={tripParams}
            onSelectRide={(r) => setSelectedRide(r)}
            onNavigate={handleNavigate}
          />
        );
      case 'ride_details':
        return selectedRide ? (
          <RideDetailsScreen
            ride={selectedRide}
            passengersCount={tripParams.passengers}
            onNavigate={handleNavigate}
          />
        ) : <HomeScreen onNavigate={handleNavigate} onSelectRecentTrip={handleSelectRecentTrip} />;
      case 'select_seat':
        return selectedRide ? (
          <SelectSeatScreen
            ride={selectedRide}
            selectedSeats={selectedSeats}
            onSelectSeats={(seats) => setSelectedSeats(seats)}
            onNavigate={handleNavigate}
          />
        ) : <HomeScreen onNavigate={handleNavigate} onSelectRecentTrip={handleSelectRecentTrip} />;
      case 'payment':
        return selectedRide ? (
          <PaymentScreen
            ride={selectedRide}
            selectedSeats={selectedSeats}
            onNavigate={handleNavigate}
            onBookingSuccess={(b) => setLastBooking(b)}
          />
        ) : <HomeScreen onNavigate={handleNavigate} onSelectRecentTrip={handleSelectRecentTrip} />;
      case 'booking_confirmation':
        return lastBooking ? (
          <BookingConfirmationScreen
            booking={lastBooking}
            onNavigate={handleNavigate}
          />
        ) : <MyTripsScreen onNavigate={handleNavigate} />;
      case 'ride_tracking':
        return <RideTrackingScreen onNavigate={handleNavigate} />;
      case 'safety':
        return (
          <SafetyScreen
            onNavigate={handleNavigate}
          />
        );
      case 'trusted_contacts':
        return <TrustedContactsScreen onNavigate={handleNavigate} />;
      case 'my_trips':
        return <MyTripsScreen onNavigate={handleNavigate} />;
      case 'chat':
        return <ChatScreen onNavigate={handleNavigate} />;
      case 'profile':
        return <ProfileScreen onNavigate={handleNavigate} />;
      case 'driver_dashboard':
        return <DriverDashboardScreen onNavigate={handleNavigate} />;
      case 'create_ride':
        return <CreateRideScreen onNavigate={handleNavigate} />;
      case 'driver_verification':
        return <DriverVerificationScreen onNavigate={handleNavigate} />;
      case 'admin_dashboard':
        return <AdminDashboardScreen onNavigate={handleNavigate} />;
      case 'support':
        return <SupportScreen onNavigate={handleNavigate} />;
      case 'notifications':
        return <NotificationsScreen onNavigate={handleNavigate} />;
      default:
        return (
          <HomeScreen
            onNavigate={handleNavigate}
            onSelectRecentTrip={handleSelectRecentTrip}
          />
        );
    }
  };

  return (
    <PhoneFrame currentScreen={currentScreen} onNavigate={handleNavigate}>
      {/* Animated Screen Flow Transition */}
      <div className="w-full flex-1 flex flex-col relative overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, y: 8, filter: 'blur(1px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(1px)' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex-1 flex flex-col"
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Persistent Bottom Navigation for main tabs */}
      <BottomNav
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
      />
    </PhoneFrame>
  );
}

export default App;
