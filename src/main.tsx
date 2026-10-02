import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LiveLocationPage } from './screens/LiveLocationPage.tsx';
import './index.css';

// Route /live/:sessionToken to the public live location page (no auth required)
const liveMatch = window.location.pathname.match(/^\/live\/([a-z0-9]{32,64})$/);
const Root = liveMatch
  ? () => <LiveLocationPage sessionToken={liveMatch[1]} />
  : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
