import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import { Results } from './pages/Results'; // garde si tu veux l'ancienne page
import { Booking } from './pages/Booking';
import CreateRide from './pages/CreateRide';
import { RideDetail } from './pages/RideDetail';

export default function App(){
  return (
    <BrowserRouter>
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-sky-600 font-black text-xl">KariGo</Link>
          <nav className="flex items-center gap-6 text-sm text-slate-700">
            <Link to="/" className="hover:text-sky-600">Rechercher</Link>
            <Link to="/create" className="btn-primary px-4 py-2">Publier un trajet</Link>
          </nav>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home/>}/>
          <Route path="/results" element={<Results/>}/>
          <Route path="/booking/:rideId" element={<Booking/>}/>
          <Route path="/ride/:rideId" element={<RideDetail/>}/>
          <Route path="/create" element={<CreateRide/>}/>
        </Routes>
      </main>
    </BrowserRouter>
  );
}
