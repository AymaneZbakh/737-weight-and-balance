/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, ReactNode, ChangeEvent, useEffect } from 'react';
import { 
  Plane, 
  Calculator, 
  AlertTriangle, 
  CheckCircle2, 
  Fuel, 
  Users, 
  Weight, 
  ArrowRightLeft,
  Info,
  Download,
  AlertCircle,
  TrendingUp,
  RotateCcw,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ComposedChart, 
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Scatter,
  ReferenceLine,
  Cell
} from 'recharts';

// Standard constants (kg)
const PILOT_WEIGHT = 85;
const CABIN_CREW_WEIGHT = 75;
const FUEL_DENSITY = 0.8; // kg/L for Jet A-1

// Index Variations
const INDEX_VARS = {
  NG: {
    PILOT_1ST_OBS: -1.44,
    PILOT_2ND_OBS: -1.45,
    CABIN_AFT: 1.08,
    CABIN_FWD: -1.18,
  },
  MAX: {
    PILOT_1ST_OBS: -1.44,
    PILOT_2ND_OBS: -1.45,
    CABIN_FWD: -1.16,
    CABIN_AFT: 1.10,
  }
};

// Simplified CG Index calculation constants (approximate for B737-800)
// DOI = Dry Operating Index
// CG Index = DOI + (Weight * (Arm - RefArm)) / 1000
const PAYLOAD_ARM_OFFSET = 0.05; // Index change per 1000kg of payload
const FUEL_ARM_OFFSET = -0.02;    // Index change per 1000kg of fuel

interface CalculationResults {
  dowCorrected: number;
  zfw: number;
  tow: number;
  lw: number;
  maxPayload: number;
  maxFuelWeight: number;
  flightMaxFuel: number;
  flightMaxFuelByMTOW: number;
  flightMaxFuelByMLW: number;
  doiCorrected: number;
  zfwIndex: number;
  towIndex: number;
  lwIndex: number;
  limitingFactor: 'MTOW' | 'MLW' | 'MZFW';
  limitWeights: {
    byMTOW: number;
    byMLW: number;
    byMZFW: number;
  };
  limitations: {
    zfwOk: boolean;
    towOk: boolean;
    lwOk: boolean;
    payloadOk: boolean;
    fuelOk: boolean;
    tripFuelOk: boolean;
  };
}

export default function App() {
  // Default Values
  const DEFAULTS = {
    dow: 41500,
    doi: 50.5,
    mtow: 79010,
    mlw: 66349,
    mzfw: 62731,
    payload: 15000,
    tof: 10000,
    tripFuel: 6000,
    contingencyFuel: 500,
    alternateFuel: 1500,
    extraPilots: 0,
    extraCabinCrew: 0,
    fuelCapacityKg: 20816,
    aircraftType: 'NG' as 'NG' | 'MAX',
    cabinPosition: 'AFT' as 'FWD' | 'AFT'
  };

  // Helper to load from localStorage
  const loadSaved = (key: keyof typeof DEFAULTS): any => {
    try {
      // Try new unified state first
      const unified = localStorage.getItem('b737_wb_state_v2');
      if (unified) {
        const parsed = JSON.parse(unified);
        if (parsed[key] !== undefined) return parsed[key];
      }

      // Fallback to old individual keys
      const saved = localStorage.getItem(`b737_wb_${key}`);
      if (saved === null) return DEFAULTS[key];
      if (saved === '') return '';
      
      // Handle numeric values
      if (typeof DEFAULTS[key] === 'number') {
        const num = Number(saved);
        return isNaN(num) ? DEFAULTS[key] : num;
      }
      
      return saved;
    } catch (e) {
      console.warn('LocalStorage access failed:', e);
      return DEFAULTS[key];
    }
  };

  // Inputs
  const [dow, setDow] = useState<number | ''>(() => loadSaved('dow'));
  const [doi, setDoi] = useState<number | ''>(() => loadSaved('doi'));
  const [mtow, setMtow] = useState<number | ''>(() => loadSaved('mtow'));
  const [mlw, setMlw] = useState<number | ''>(() => loadSaved('mlw'));
  const [mzfw, setMzfw] = useState<number | ''>(() => loadSaved('mzfw'));
  const [payload, setPayload] = useState<number | ''>(() => loadSaved('payload'));
  const [tof, setTof] = useState<number | ''>(() => loadSaved('tof'));
  const [tripFuel, setTripFuel] = useState<number | ''>(() => loadSaved('tripFuel'));
  const [contingencyFuel, setContingencyFuel] = useState<number | ''>(() => loadSaved('contingencyFuel'));
  const [alternateFuel, setAlternateFuel] = useState<number | ''>(() => loadSaved('alternateFuel'));
  const [extraPilots, setExtraPilots] = useState<number | ''>(() => loadSaved('extraPilots'));
  const [extraCabinCrew, setExtraCabinCrew] = useState<number | ''>(() => loadSaved('extraCabinCrew'));
  const [fuelCapacityKg, setFuelCapacityKg] = useState<number | ''>(() => loadSaved('fuelCapacityKg'));
  const [aircraftType, setAircraftType] = useState<'NG' | 'MAX'>(() => loadSaved('aircraftType'));
  const [cabinPosition, setCabinPosition] = useState<'FWD' | 'AFT'>(() => loadSaved('cabinPosition'));
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('b737_wb_darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [lastSaved, setLastSaved] = useState<number>(0);

  // Apply dark mode class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('b737_wb_darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  // Save to localStorage whenever values change
  useEffect(() => {
    try {
      const state = { dow, doi, mtow, mlw, mzfw, payload, tof, tripFuel, contingencyFuel, alternateFuel, extraPilots, extraCabinCrew, fuelCapacityKg, aircraftType, cabinPosition };
      localStorage.setItem('b737_wb_state_v2', JSON.stringify(state));
      
      // Update last saved timestamp to show indicator
      setLastSaved(Date.now());
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }, [dow, doi, mtow, mlw, mzfw, payload, tof, tripFuel, contingencyFuel, alternateFuel, extraPilots, extraCabinCrew, fuelCapacityKg, aircraftType, cabinPosition]);

  // Auto-calculate contingency fuel (5% of trip fuel)
  useEffect(() => {
    const nTripFuel = Number(tripFuel) || 0;
    setContingencyFuel(Math.round(nTripFuel * 0.05));
  }, [tripFuel]);

  const resetToDefaults = () => {
    setDow(DEFAULTS.dow);
    setDoi(DEFAULTS.doi);
    setMtow(DEFAULTS.mtow);
    setMlw(DEFAULTS.mlw);
    setMzfw(DEFAULTS.mzfw);
    setPayload(DEFAULTS.payload);
    setTof(DEFAULTS.tof);
    setTripFuel(DEFAULTS.tripFuel);
    setContingencyFuel(DEFAULTS.contingencyFuel);
    setAlternateFuel(DEFAULTS.alternateFuel);
    setExtraPilots(DEFAULTS.extraPilots);
    setExtraCabinCrew(DEFAULTS.extraCabinCrew);
    setFuelCapacityKg(DEFAULTS.fuelCapacityKg);
    setAircraftType(DEFAULTS.aircraftType);
    setCabinPosition(DEFAULTS.cabinPosition);
  };

  const results = useMemo((): CalculationResults => {
    const nDow = Number(dow) || 0;
    const nDoi = Number(doi) || 0;
    const nMtow = Number(mtow) || 0;
    const nMlw = Number(mlw) || 0;
    const nMzfw = Number(mzfw) || 0;
    const nPayload = Number(payload) || 0;
    const nTof = Number(tof) || 0;
    const nTripFuel = Number(tripFuel) || 0;
    const nExtraPilots = Number(extraPilots) || 0;
    const nExtraCabinCrew = Number(extraCabinCrew) || 0;
    const nFuelCapacity = Number(fuelCapacityKg) || 0;

    const dowCorrected = nDow + (nExtraPilots * PILOT_WEIGHT) + (nExtraCabinCrew * CABIN_CREW_WEIGHT);
    
    // Calculate Corrected DOI based on aircraft type and crew positions
    const vars = INDEX_VARS[aircraftType];
    const pilotIndexVar = (nExtraPilots >= 1 ? vars.PILOT_1ST_OBS : 0) + (nExtraPilots >= 2 ? vars.PILOT_2ND_OBS : 0);
    
    const cabinVar = cabinPosition === 'FWD' ? vars.CABIN_FWD : vars.CABIN_AFT;
    const cabinIndexVar = nExtraCabinCrew * cabinVar;
    
    const doiCorrected = nDoi + pilotIndexVar + cabinIndexVar;

    const zfw = dowCorrected + nPayload;
    const tow = zfw + nTof;
    const lw = tow - nTripFuel;
    
    const maxFuelWeight = nFuelCapacity;

    // Max Fuel we can carry on this specific flight (Flight-Specific Max Fuel)
    const flightMaxFuelByMTOW = nMtow - zfw;
    const flightMaxFuelByMLW = nMlw + nTripFuel - zfw;
    const flightMaxFuel = Math.max(0, Math.min(maxFuelWeight, flightMaxFuelByMTOW, flightMaxFuelByMLW));

    // CG Index Calculations (Simplified)
    const zfwIndex = doiCorrected + (nPayload / 1000 * PAYLOAD_ARM_OFFSET);
    const towIndex = zfwIndex + (nTof / 1000 * FUEL_ARM_OFFSET);
    const lwIndex = towIndex - (nTripFuel / 1000 * FUEL_ARM_OFFSET);

    // Determine Limiting Factor for Takeoff
    const limitByMTOW = nMtow;
    const limitByMLW = nMlw + nTripFuel;
    const limitByMZFW = nMzfw + nTof;

    let limitingFactor: 'MTOW' | 'MLW' | 'MZFW' = 'MTOW';
    const minLimit = Math.min(limitByMTOW, limitByMLW, limitByMZFW);

    if (minLimit === limitByMLW) limitingFactor = 'MLW';
    else if (minLimit === limitByMZFW) limitingFactor = 'MZFW';

    const maxPayload = minLimit - dowCorrected - nTof;

    return {
      dowCorrected,
      zfw,
      tow,
      lw,
      maxPayload: Math.max(0, maxPayload),
      maxFuelWeight,
      flightMaxFuel,
      flightMaxFuelByMTOW,
      flightMaxFuelByMLW,
      doiCorrected,
      zfwIndex,
      towIndex,
      lwIndex,
      limitingFactor,
      limitWeights: {
        byMTOW: limitByMTOW,
        byMLW: limitByMLW,
        byMZFW: limitByMZFW,
      },
      limitations: {
        zfwOk: zfw <= nMzfw && zfw > 0,
        towOk: tow <= nMtow && tow > 0,
        lwOk: lw <= nMlw && lw > 0,
        payloadOk: nPayload <= (minLimit - dowCorrected - nTof) && nPayload >= 0,
        fuelOk: nTof <= maxFuelWeight && nTof >= 0,
        tripFuelOk: nTripFuel <= nTof && nTripFuel >= 0,
      }
    };
  }, [dow, doi, extraPilots, extraCabinCrew, payload, tof, tripFuel, mzfw, mtow, mlw, fuelCapacityKg]);

  const envelopeData = useMemo(() => {
    const nMzfw = Number(mzfw) || 0;
    const nMlw = Number(mlw) || 0;
    const nMtow = Number(mtow) || 0;

    // Basic envelope points
    const basePoints = [
      { weight: 40000, minIndex: 30, maxIndex: 70, label: 'Basic Envelope' },
      { weight: 50000, minIndex: 32, maxIndex: 72, label: 'Basic Envelope' },
      { weight: 60000, minIndex: 35, maxIndex: 75, label: 'Basic Envelope' },
    ];
    
    // Structural limit points (dynamic)
    const limitPoints = [
      { weight: nMzfw, minIndex: 38, maxIndex: 78, label: 'MZFW Limit' },
      { weight: nMlw, minIndex: 40, maxIndex: 80, label: 'MLW Limit' },
      { weight: nMtow, minIndex: 45, maxIndex: 85, label: 'MTOW Limit' },
    ];

    // Combine and sort by weight for correct chart rendering
    return [...basePoints, ...limitPoints].sort((a, b) => a.weight - b.weight);
  }, [mzfw, mlw, mtow]);

  const chartData = useMemo(() => {
    const nMzfw = Number(mzfw) || 0;
    const nMlw = Number(mlw) || 0;
    const nMtow = Number(mtow) || 0;

    return [
      { name: 'ZFW', weight: results.zfw, index: results.zfwIndex, ok: results.limitations.zfwOk, limit: nMzfw },
      { name: 'TOW', weight: results.tow, index: results.towIndex, ok: results.limitations.towOk, limit: nMtow },
      { name: 'LW', weight: results.lw, index: results.lwIndex, ok: results.limitations.lwOk, limit: nMlw },
    ];
  }, [results, mzfw, mtow, mlw]);

  const exportToCSV = () => {
    const data = [
      ['Weight And Balance B737 - Royal air Maroc Report'],
      ['Date', new Date().toLocaleString()],
      ['Limitation of the Day (Bottleneck)', results.limitingFactor],
      [''],
      ['INPUTS'],
      ['DOW (2/4 Config)', `${dow} kg`],
      ['DOI', doi],
      ['Extra Pilots', extraPilots],
      ['Extra Cabin Crew', extraCabinCrew],
      ['Payload', `${payload} kg`],
      ['Take Off Fuel (TOF)', `${tof} kg`],
      ['Trip Fuel', `${tripFuel} kg`],
      ['Contingency Fuel', `${contingencyFuel} kg`],
      ['Alternate Fuel', `${alternateFuel} kg`],
      ['MTOW', `${mtow} kg`],
      ['MLW', `${mlw} kg`],
      ['MZFW', `${mzfw} kg`],
      [''],
      ['OUTPUTS'],
      ['DOW Corrected', `${results.dowCorrected} kg`],
      ['DOI Corrected', results.doiCorrected.toFixed(2)],
      ['Zero Fuel Weight (ZFW)', `${results.zfw} kg`],
      ['ZFW Index', results.zfwIndex.toFixed(2)],
      ['Take Off Weight (TOW)', `${results.tow} kg`],
      ['TOW Index', results.towIndex.toFixed(2)],
      ['Landing Weight (LW)', `${results.lw} kg`],
      ['LW Index', results.lwIndex.toFixed(2)],
      ['Max Payload Available', `${results.maxPayload} kg`],
      ['Structural Max Fuel', `${results.maxFuelWeight.toFixed(0)} kg`],
      ['Flight Max Fuel (Limited)', `${results.flightMaxFuel.toFixed(0)} kg`],
      [''],
      ['LIMITATIONS'],
      ['ZFW Limit Check', results.limitations.zfwOk ? 'PASS' : 'FAIL'],
      ['TOW Limit Check', results.limitations.towOk ? 'PASS' : 'FAIL'],
      ['LW Limit Check', results.limitations.lwOk ? 'PASS' : 'FAIL'],
      ['Payload Valid', results.limitations.payloadOk ? 'YES' : 'NO'],
      ['Fuel Valid', results.limitations.fuelOk ? 'YES' : 'NO'],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + data.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "b737_weight_balance_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-20 shadow-sm transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-2 rounded-lg flex-shrink-0">
              <Plane className="text-white w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold tracking-tight leading-tight truncate sm:whitespace-normal">Weight And Balance B737</h1>
              <p className={`text-[10px] sm:text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Royal air Maroc</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <AnimatePresence>
              {lastSaved > 0 && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  key={lastSaved}
                  className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Saved
                </motion.div>
              )}
            </AnimatePresence>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`flex items-center justify-center p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            <button 
              onClick={resetToDefaults}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Reset to factory defaults"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Reset
            </button>
            <button 
              onClick={exportToCSV}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium ${isDarkMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Limitation of the Day (Bottleneck) */}
        <div className="mb-8">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between overflow-hidden relative">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-red-500 p-2 rounded-lg">
                  <AlertCircle className="text-white w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">Limitation of the Day</h2>
              </div>
              <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                The most restrictive structural limit for this flight is <span className="text-red-400 font-bold">{results.limitingFactor}</span>. 
                Your maximum takeoff weight is capped at <span className="text-white font-mono font-bold">{Math.min(results.limitWeights.byMTOW, results.limitWeights.byMLW, results.limitWeights.byMZFW).toLocaleString()} kg</span>.
              </p>
              <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10 max-w-2xl">
                <p className="text-xs text-slate-300 leading-relaxed">
                  {results.limitingFactor === 'MTOW' && (
                    <>
                      <span className="text-red-400 font-bold">MTOW Bottleneck:</span> The structural Maximum Takeoff Weight of <span className="text-white font-medium">{mtow.toLocaleString()} kg</span> is your primary constraint. No other structural or landing limits are more restrictive for this specific flight profile.
                    </>
                  )}
                  {results.limitingFactor === 'MLW' && (
                    <>
                      <span className="text-red-400 font-bold">MLW Bottleneck:</span> Your takeoff weight is limited by your <span className="text-white font-medium">Maximum Landing Weight ({mlw.toLocaleString()} kg)</span> plus your <span className="text-white font-medium">Trip Fuel ({tripFuel.toLocaleString()} kg)</span>. Taking off heavier than <span className="text-white font-medium">{(mlw + tripFuel).toLocaleString()} kg</span> would result in an overweight landing at your destination.
                    </>
                  )}
                  {results.limitingFactor === 'MZFW' && (
                    <>
                      <span className="text-red-400 font-bold">MZFW Bottleneck:</span> Your takeoff weight is limited by your <span className="text-white font-medium">Maximum Zero Fuel Weight ({mzfw.toLocaleString()} kg)</span> plus your <span className="text-white font-medium">Takeoff Fuel ({tof.toLocaleString()} kg)</span>. This ensures the fuselage and wing structure are not overstressed by payload before fuel is added.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="hidden md:block relative z-10 text-right">
              <div className="text-4xl font-black text-red-500/20 mb-1">{results.limitingFactor}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Bottleneck Detected</div>
            </div>
            {/* Background Accent */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-red-600/10 rounded-full blur-3xl" />
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Input Section */}
          <div className="lg:col-span-7 space-y-6">
            <section className={`rounded-2xl shadow-sm border overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`px-6 py-4 border-b flex items-center gap-2 ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                <Calculator className="w-5 h-5 text-red-600" />
                <h2 className={`font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Operational Parameters</h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup 
                  label="Dry Operating Weight (DOW)" 
                  value={dow} 
                  onChange={setDow} 
                  unit="kg" 
                  icon={<Weight className="w-4 h-4" />}
                  description="2/4 Configuration base weight"
                  isDarkMode={isDarkMode}
                />
                <InputGroup 
                  label="Dry Operating Index (DOI)" 
                  value={doi} 
                  onChange={setDoi} 
                  unit="idx" 
                  icon={<ArrowRightLeft className="w-4 h-4" />}
                  isDarkMode={isDarkMode}
                />
                <InputGroup 
                  label="Payload" 
                  value={payload} 
                  onChange={setPayload} 
                  unit="kg" 
                  icon={<Users className="w-4 h-4" />}
                  error={!results.limitations.payloadOk}
                  errorMsg={`Max Payload: ${results.maxPayload.toFixed(0)} kg`}
                  isDarkMode={isDarkMode}
                />
                <InputGroup 
                  label="Fuel Capacity" 
                  value={fuelCapacityKg} 
                  onChange={setFuelCapacityKg} 
                  unit="kg" 
                  icon={<Fuel className="w-4 h-4" />}
                  min={1}
                  isDarkMode={isDarkMode}
                />
              </div>
            </section>

            <section className={`rounded-2xl shadow-sm border overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`px-6 py-4 border-b flex items-center gap-2 ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                <Fuel className="w-5 h-5 text-red-600" />
                <h2 className={`font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Fuel Planning</h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup 
                  label="Take Off Fuel (TOF)" 
                  value={tof} 
                  onChange={setTof} 
                  unit="kg" 
                  error={!results.limitations.fuelOk}
                  errorMsg={`Max Fuel: ${results.flightMaxFuel.toFixed(0)} kg`}
                  description="Total fuel at brakes release"
                  isDarkMode={isDarkMode}
                />
                <InputGroup 
                  label="Trip Fuel" 
                  value={tripFuel} 
                  onChange={setTripFuel} 
                  unit="kg" 
                  error={!results.limitations.tripFuelOk}
                  errorMsg="Cannot exceed TOF"
                  description="Fuel required for the flight"
                  isDarkMode={isDarkMode}
                />
                <InputGroup 
                  label="Contingency Fuel" 
                  value={contingencyFuel} 
                  onChange={setContingencyFuel} 
                  unit="kg" 
                  description="Auto-calculated (5% of trip fuel)"
                  disabled
                  isDarkMode={isDarkMode}
                />
                <InputGroup 
                  label="Alternate Fuel" 
                  value={alternateFuel} 
                  onChange={setAlternateFuel} 
                  unit="kg" 
                  description="Fuel to reach alternate airport"
                  isDarkMode={isDarkMode}
                />
              </div>
              <div className={`px-6 py-3 border-t ${isDarkMode ? 'bg-red-950/20 border-slate-800' : 'bg-red-50/50 border-slate-100'}`}>
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-red-400' : 'text-red-800'}`}>Min Required Fuel (Trip + Cont + Alt)</span>
                  <span className={`text-sm font-mono font-bold ${isDarkMode ? 'text-red-300' : 'text-red-900'}`}>{(tripFuel + contingencyFuel + alternateFuel).toLocaleString()} kg</span>
                </div>
              </div>
            </section>

            <section className={`rounded-2xl shadow-sm border overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`px-6 py-4 border-b flex items-center gap-2 ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                <Users className="w-5 h-5 text-red-600" />
                <h2 className={`font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Crew Adjustments</h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Aircraft Type Toggle */}
                  <div className="space-y-2">
                    <label className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Aircraft Type</label>
                    <div className={`flex p-1 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <button 
                        onClick={() => setAircraftType('NG')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${aircraftType === 'NG' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >NG</button>
                      <button 
                        onClick={() => setAircraftType('MAX')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${aircraftType === 'MAX' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >MAX</button>
                    </div>
                  </div>

                  {/* Cabin Position Toggle */}
                  <div className="space-y-2">
                    <label className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Cabin Crew Position</label>
                    <div className={`flex p-1 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <button 
                        onClick={() => setCabinPosition('FWD')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${cabinPosition === 'FWD' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >FWD</button>
                      <button 
                        onClick={() => setCabinPosition('AFT')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${cabinPosition === 'AFT' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >AFT</button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputGroup 
                    label="Extra Pilots" 
                    value={extraPilots} 
                    onChange={setExtraPilots} 
                    unit="pers" 
                    description="Above 2 pilots"
                    isDarkMode={isDarkMode}
                  />
                  <InputGroup 
                    label="Extra Cabin Crew" 
                    value={extraCabinCrew} 
                    onChange={setExtraCabinCrew} 
                    unit="pers" 
                    description="Above 4 crew"
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>
              <div className={`px-6 py-3 border-t ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`text-[10px] grid grid-cols-2 gap-x-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <div>
                    <span className={`font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Pilot Variations ({aircraftType}):</span>
                    <ul className="list-disc list-inside ml-1">
                      <li>1st Obs: {INDEX_VARS[aircraftType].PILOT_1ST_OBS}</li>
                      <li>2nd Obs: {INDEX_VARS[aircraftType].PILOT_2ND_OBS}</li>
                    </ul>
                  </div>
                  <div>
                    <span className={`font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Cabin Variations ({aircraftType}):</span>
                    <ul className="list-disc list-inside ml-1">
                      <li>{cabinPosition} Position: {cabinPosition === 'FWD' ? INDEX_VARS[aircraftType].CABIN_FWD : INDEX_VARS[aircraftType].CABIN_AFT}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className={`rounded-2xl shadow-sm border overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`px-6 py-4 border-b flex items-center gap-2 ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className={`font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Structural Limits</h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <InputGroup label="MTOW" value={mtow} onChange={setMtow} unit="kg" min={1} isDarkMode={isDarkMode} />
                <InputGroup label="MLW" value={mlw} onChange={setMlw} unit="kg" min={1} isDarkMode={isDarkMode} />
                <InputGroup label="MZFW" value={mzfw} onChange={setMzfw} unit="kg" min={1} isDarkMode={isDarkMode} />
              </div>
            </section>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-5 space-y-6">
            <div className="sticky top-24">
              
              {/* Chart Section */}
              <section className={`rounded-2xl shadow-sm border overflow-hidden mb-6 transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`px-6 py-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-red-600" />
                    <h2 className={`font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Weight & Balance Envelope</h2>
                  </div>
                </div>
                <div className="p-4 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                      <XAxis 
                        type="number" 
                        dataKey="index" 
                        domain={[20, 100]} 
                        label={{ value: 'CG Index', position: 'insideBottom', offset: -10, fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                        tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="weight" 
                        domain={[35000, 85000]} 
                        label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft', offset: -30, fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                        tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const isStatePoint = !!data.name; // ZFW, TOW, LW have names
                            
                            // Define colors for each point type
                            const getPointColor = (name: string) => {
                              switch (name) {
                                case 'ZFW': return 'text-blue-500 border-blue-500/30';
                                case 'TOW': return 'text-red-500 border-red-500/30';
                                case 'LW': return 'text-emerald-500 border-emerald-500/30';
                                default: return 'text-red-600 border-red-600/30';
                              }
                            };

                            const getPointBg = (name: string) => {
                              if (!isDarkMode) {
                                switch (name) {
                                  case 'ZFW': return 'bg-blue-50 border-blue-100';
                                  case 'TOW': return 'bg-red-50 border-red-100';
                                  case 'LW': return 'bg-emerald-50 border-emerald-100';
                                  default: return 'bg-white border-slate-200';
                                }
                              }
                              switch (name) {
                                case 'ZFW': return 'bg-slate-900 border-blue-900/50';
                                case 'TOW': return 'bg-slate-900 border-red-900/50';
                                case 'LW': return 'bg-slate-900 border-emerald-900/50';
                                default: return 'bg-slate-900 border-slate-700';
                              }
                            };

                            const pointColorClass = getPointColor(data.name || '');
                            const pointBgClass = getPointBg(data.name || '');
                            
                            return (
                              <div className={`p-3 rounded-xl shadow-2xl text-xs border transition-all duration-300 ${pointBgClass} ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                                <div className="flex items-center justify-between gap-4 mb-2">
                                  <span className={`font-bold text-sm uppercase tracking-tight ${isStatePoint ? pointColorClass.split(' ')[0] : ''}`}>
                                    {data.name || data.label || 'Envelope Point'}
                                  </span>
                                  {isStatePoint && (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${data.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                      {data.ok ? 'PASS' : 'EXCEED'}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="space-y-1 font-mono">
                                  <div className="flex justify-between gap-8">
                                    <span className="text-slate-500">Weight:</span>
                                    <span className="font-bold">{data.weight?.toLocaleString()} kg</span>
                                  </div>
                                  <div className="flex justify-between gap-8">
                                    <span className="text-slate-500">CG Index:</span>
                                    <span className="font-bold">{(data.index || data.minIndex || data.maxIndex)?.toFixed(2)}</span>
                                  </div>
                                  {isStatePoint && data.limit && (
                                    <div className={`flex justify-between gap-8 pt-1 border-t mt-1 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                      <span className="text-slate-500">Limit:</span>
                                      <span className="font-bold">{data.limit.toLocaleString()} kg</span>
                                    </div>
                                  )}
                                  {!isStatePoint && data.label && (
                                    <div className={`pt-1 border-t mt-1 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                      <span className="text-red-400 font-medium">{data.label}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      
                      {/* Envelope Area */}
                      <Area 
                        data={envelopeData} 
                        dataKey="maxIndex" 
                        stroke="none" 
                        fill="#ef4444" 
                        fillOpacity={0.1} 
                        baseLine={30}
                        isAnimationActive={false}
                      />
                      <Line 
                        data={envelopeData} 
                        dataKey="minIndex" 
                        stroke="#ef4444" 
                        strokeWidth={1} 
                        dot={false} 
                        isAnimationActive={false}
                      />
                      <Line 
                        data={envelopeData} 
                        dataKey="maxIndex" 
                        stroke="#ef4444" 
                        strokeWidth={1} 
                        dot={false} 
                        isAnimationActive={false}
                      />

                      {/* Structural Limit Lines */}
                      <ReferenceLine y={mzfw} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'MZFW', position: 'right', fontSize: 8, fill: '#94a3b8' }} />
                      <ReferenceLine y={mlw} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'MLW', position: 'right', fontSize: 8, fill: '#94a3b8' }} />
                      <ReferenceLine y={mtow} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'MTOW', position: 'right', fontSize: 8, fill: '#f43f5e' }} />

                      {/* Current State Points */}
                      <Scatter 
                        name="Current State" 
                        data={chartData} 
                      >
                        {chartData.map((entry, index) => {
                          let color = '#ef4444'; // Default Red
                          if (entry.name === 'ZFW') color = '#3b82f6'; // Blue
                          if (entry.name === 'LW') color = '#10b981'; // Emerald
                          if (entry.name === 'TOW') color = '#f43f5e'; // Rose/Red
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Scatter>
                      <Line 
                        data={chartData} 
                        dataKey="weight" 
                        stroke={isDarkMode ? "#475569" : "#94a3b8"} 
                        strokeWidth={1} 
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className={`px-6 py-3 border-t flex flex-wrap gap-4 text-[10px] transition-colors duration-300 ${isDarkMode ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>ZFW</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>TOW</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>LW</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500/20 border border-red-500/40 rounded" />
                    <span>Safe Envelope</span>
                  </div>
                </div>
              </section>

              <section className={`rounded-2xl shadow-xl overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 text-white border border-slate-800' : 'bg-slate-900 text-white'}`}>
                <div className={`px-6 py-4 flex items-center justify-between ${isDarkMode ? 'bg-slate-800' : 'bg-slate-800'}`}>
                  <h2 className="font-semibold flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Calculation Summary
                  </h2>
                  <span className="text-xs font-mono text-slate-400">v1.1.0</span>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Main Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <ResultCard 
                      label="DOW Corrected" 
                      value={results.dowCorrected} 
                      unit="kg" 
                    />
                    <ResultCard 
                      label="DOI Corrected" 
                      value={results.doiCorrected.toFixed(2)} 
                      unit="" 
                      highlight
                    />
                    <ResultCard 
                      label="Max Payload" 
                      value={results.maxPayload} 
                      unit="kg" 
                      highlight
                    />
                  </div>

                  <div className="space-y-3">
                    <MetricRow label="Zero Fuel Weight (ZFW)" value={results.zfw} limit={mzfw} ok={results.limitations.zfwOk} index={results.zfwIndex} isDarkMode={isDarkMode} />
                    <MetricRow label="Take Off Weight (TOW)" value={results.tow} limit={mtow} ok={results.limitations.towOk} index={results.towIndex} isDarkMode={isDarkMode} />
                    <MetricRow label="Landing Weight (LW)" value={results.lw} limit={mlw} ok={results.limitations.lwOk} index={results.lwIndex} isDarkMode={isDarkMode} />
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Flight Max Fuel (Limited)</span>
                      <div className="text-right">
                        <span className="font-mono font-bold text-red-400 block">{results.flightMaxFuel.toFixed(0)} kg</span>
                        <span className="text-[10px] text-slate-500 italic">
                          *Limited by {results.flightMaxFuel === results.maxFuelWeight ? 'Tank Capacity' : results.flightMaxFuel === results.flightMaxFuelByMTOW ? 'MTOW' : 'MLW'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 space-y-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Constraint Breakdown</p>
                      
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500">Structural Tank Capacity</span>
                          <span className="text-slate-300 font-mono">{results.maxFuelWeight.toLocaleString()} kg</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500">MTOW Constraint (MTOW - ZFW)</span>
                          <div className="text-right">
                            <span className={`font-mono ${results.flightMaxFuelByMTOW <= results.maxFuelWeight ? 'text-red-400' : 'text-slate-300'}`}>
                              {results.flightMaxFuelByMTOW.toLocaleString()} kg
                            </span>
                            <p className="text-[8px] text-slate-600 leading-none mt-0.5">({mtow.toLocaleString()} - {results.zfw.toLocaleString()})</p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500">MLW Constraint (MLW + Trip - ZFW)</span>
                          <div className="text-right">
                            <span className={`font-mono ${results.flightMaxFuelByMLW <= results.maxFuelWeight ? 'text-red-400' : 'text-slate-300'}`}>
                              {results.flightMaxFuelByMLW.toLocaleString()} kg
                            </span>
                            <p className="text-[8px] text-slate-600 leading-none mt-0.5">({mlw.toLocaleString()} + {tripFuel.toLocaleString()} - {results.zfw.toLocaleString()})</p>
                          </div>
                        </div>
                      </div>

                      <p className="text-[9px] text-slate-500 leading-relaxed mt-2 pt-2 border-t border-slate-700/50">
                        The current payload of <span className="text-slate-300">{payload.toLocaleString()} kg</span> results in a ZFW of <span className="text-slate-300">{results.zfw.toLocaleString()} kg</span>. 
                        This leaves <span className="text-red-400 font-bold">{results.flightMaxFuel.toFixed(0)} kg</span> of available weight for fuel before hitting the most restrictive limit.
                      </p>
                    </div>
                  </div>

                  {/* Status Banner */}
                  <AnimatePresence mode="wait">
                    {Object.values(results.limitations).every(v => v) ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 text-emerald-400"
                      >
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium">All parameters are within safe operating limits.</span>
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3 text-rose-400"
                      >
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium">Warning: Operational limits exceeded! Check inputs.</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>

              {/* Quick Info */}
          </div>
        </div>
      </div>
      </main>

      <footer className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t transition-colors duration-300 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-4">
            <div className={`h-px w-12 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <Plane className="w-4 h-4 text-red-600" />
            <div className={`h-px w-12 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
          </div>
          
          <div className="text-center space-y-1">
            <p className={`text-[10px] font-bold uppercase tracking-[0.3em] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Developed by
            </p>
            <h2 className={`text-lg font-bold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              Aymane ZBAKH
            </h2>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span className={`text-[10px] font-mono tracking-wider px-2 py-1 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>B737-800 OPS</span>
            <div className={`w-1 h-1 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`} />
            <span className={`text-[10px] font-mono tracking-wider px-2 py-1 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>v1.0.2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function InputGroup({ label, value, onChange, unit, icon, description, error, errorMsg, min, max, disabled, isDarkMode }: { 
  label: string; 
  value: number | ''; 
  onChange: (val: number | '') => void; 
  unit: string;
  icon?: ReactNode;
  description?: string;
  error?: boolean;
  errorMsg?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  isDarkMode?: boolean;
}) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const rawValue = e.target.value;
    if (rawValue === '') {
      onChange('');
      return;
    }
    const val = Number(rawValue);
    if (isNaN(val)) return;
    onChange(val);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className={`text-sm font-medium flex items-center gap-2 ${error ? 'text-rose-600' : isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
          {icon && <span className={error ? 'text-rose-400' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{icon}</span>}
          {label}
        </label>
        <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{unit}</span>
      </div>
      <div className="relative">
        <input 
          type="number" 
          value={value}
          onChange={handleChange}
          disabled={disabled}
          min={min}
          max={max}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 outline-none transition-all font-mono ${
            isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
          } ${
            error 
              ? 'border-rose-300 focus:ring-rose-500 text-rose-900 dark:text-rose-400 dark:border-rose-900/50' 
              : 'focus:ring-red-500 focus:border-red-500'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
        {error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500">
            <AlertCircle className="w-4 h-4" />
          </div>
        )}
      </div>
      {error && errorMsg ? (
        <p className="text-[10px] text-rose-500 font-medium">{errorMsg}</p>
      ) : description ? (
        <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{description}</p>
      ) : null}
    </div>
  );
}

function ResultCard({ label, value, unit, highlight }: { label: string; value: number | string; unit: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border transition-colors duration-300 ${highlight ? 'bg-red-600 border-red-500' : 'bg-slate-800 border-slate-700'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${highlight ? 'text-red-100' : 'text-slate-400'}`}>{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-mono font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</span>
        <span className={`text-[10px] font-medium ${highlight ? 'text-red-200' : 'text-slate-500'}`}>{unit}</span>
      </div>
    </div>
  );
}

function MetricRow({ label, value, limit, ok, index, isDarkMode }: { label: string; value: number; limit: number; ok: boolean; index: number; isDarkMode?: boolean }) {
  const percentage = Math.min(100, (value / limit) * 100);
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <div>
          <p className={`text-xs mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{label}</p>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-mono font-bold ${ok ? 'text-white' : 'text-rose-400'}`}>
              {value.toLocaleString()} kg
            </span>
            <span className="text-[10px] text-slate-500">/ {limit.toLocaleString()} kg</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">CG Index: <span className="text-red-400">{index.toFixed(2)}</span></p>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
          {ok ? 'PASS' : 'EXCEED'}
        </span>
      </div>
      <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-800'}`}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={`h-full rounded-full ${ok ? 'bg-red-500' : 'bg-rose-500'}`}
        />
      </div>
    </div>
  );
}
