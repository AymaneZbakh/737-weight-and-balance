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
    <div className={`min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} overflow-x-hidden`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-20 shadow-sm transition-colors duration-300 h-12 flex items-center ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="w-full max-w-[1600px] mx-auto px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-1.5 rounded-lg flex-shrink-0">
              <Plane className="text-white w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold tracking-tight leading-none leading-tight truncate">Weight & Balance B737</h1>
              <p className={`text-[8px] font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Royal air Maroc</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <AnimatePresence>
              {lastSaved > 0 && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  key={lastSaved}
                  className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-bold uppercase tracking-wider"
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Saved
                </motion.div>
              )}
            </AnimatePresence>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`flex items-center justify-center p-1.5 rounded transition-colors ${isDarkMode ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button 
              onClick={resetToDefaults}
              className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded transition-colors text-xs font-semibold ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Reset to factory defaults"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
            <button 
              onClick={exportToCSV}
              className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded transition-colors text-xs font-semibold ${isDarkMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            >
              <Download className="w-3 h-3" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1600px] mx-auto px-4 py-2">
        {/* Compact Limitation of the Day (Bottleneck) */}
        <div className={`mb-2 p-2 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-1.5 text-xs transition-colors ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-2">
            <div className="bg-red-500/10 text-red-500 p-1 rounded-lg flex-shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Limitation of the Day:</span>{" "}
              The most restrictive structural limit is <span className="text-red-500 font-bold">{results.limitingFactor}</span>. 
              Max takeoff weight capped at <span className="font-mono font-bold text-red-500">{Math.min(results.limitWeights.byMTOW, results.limitWeights.byMLW, results.limitWeights.byMZFW).toLocaleString()} kg</span>.
            </div>
          </div>
          <div className="text-[10px] text-slate-400 self-end md:self-auto italic">
            {results.limitingFactor === 'MTOW' && "Aircraft MTOW is the primary constraint."}
            {results.limitingFactor === 'MLW' && `Limited by Maximum Landing Weight (${mlw.toLocaleString()} kg) + Trip Fuel (${tripFuel.toLocaleString()} kg).`}
            {results.limitingFactor === 'MZFW' && `Limited by Maximum Zero Fuel Weight (${mzfw.toLocaleString()} kg) + Takeoff Fuel (${tof.toLocaleString()} kg).`}
          </div>
        </div>

        {/* 3-Column Compact Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          
          {/* Column 1: Operational Parameters & Fuel Planning */}
          <div className="space-y-3">
            {/* Operational Parameters */}
            <section className={`rounded-xl shadow-sm border overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`px-3.5 py-2 border-b flex items-center gap-1.5 ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                <Calculator className="w-4 h-4 text-red-600" />
                <h2 className={`font-semibold text-xs sm:text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Operational Parameters</h2>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2.5">
                <InputGroup 
                  label="DOW (2/4 Config)" 
                  value={dow} 
                  onChange={setDow} 
                  unit="kg" 
                  icon={<Weight className="w-3.5 h-3.5" />}
                  isDarkMode={isDarkMode}
                />
                <InputGroup 
                  label="Dry Operating Index (DOI)" 
                  value={doi} 
                  onChange={setDoi} 
                  unit="idx" 
                  icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                  isDarkMode={isDarkMode}
                />
                <InputGroup 
                  label="Payload" 
                  value={payload} 
                  onChange={setPayload} 
                  unit="kg" 
                  icon={<Users className="w-3.5 h-3.5" />}
                  error={!results.limitations.payloadOk}
                  errorMsg={`Max Payload: ${results.maxPayload.toFixed(0)} kg`}
                  isDarkMode={isDarkMode}
                />
                <InputGroup 
                  label="Fuel Capacity" 
                  value={fuelCapacityKg} 
                  onChange={setFuelCapacityKg} 
                  unit="kg" 
                  icon={<Fuel className="w-3.5 h-3.5" />}
                  min={1}
                  isDarkMode={isDarkMode}
                />
              </div>
            </section>

            {/* Fuel Planning */}
            <section className={`rounded-xl shadow-sm border overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`px-3.5 py-2 border-b flex items-center gap-1.5 ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                <Fuel className="w-4 h-4 text-red-600" />
                <h2 className={`font-semibold text-xs sm:text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Fuel Planning</h2>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2.5">
                <InputGroup 
                  label="Take Off Fuel (TOF)" 
                  value={tof} 
                  onChange={setTof} 
                  unit="kg" 
                  error={!results.limitations.fuelOk}
                  errorMsg={`Max Fuel: ${results.flightMaxFuel.toFixed(0)} kg`}
                  isDarkMode={isDarkMode}
                />
                <InputGroup 
                  label="Trip Fuel" 
                  value={tripFuel} 
                  onChange={setTripFuel} 
                  unit="kg" 
                  error={!results.limitations.tripFuelOk}
                  errorMsg="Exceeds TOF"
                  isDarkMode={isDarkMode}
                />
                <InputGroup 
                  label="Contingency Fuel" 
                  value={contingencyFuel} 
                  onChange={setContingencyFuel} 
                  unit="kg" 
                  description="Auto (5% of trip)"
                  disabled
                  isDarkMode={isDarkMode}
                />
                <InputGroup 
                  label="Alternate Fuel" 
                  value={alternateFuel} 
                  onChange={setAlternateFuel} 
                  unit="kg" 
                  isDarkMode={isDarkMode}
                />
              </div>
              <div className={`px-3.5 py-2 border-t flex justify-between items-center text-[10px] ${isDarkMode ? 'bg-red-950/10 border-slate-800' : 'bg-red-50/30 border-slate-100'}`}>
                <span className={`font-medium ${isDarkMode ? 'text-red-400' : 'text-red-800'}`}>Min Required Fuel (Trip+Cont+Alt)</span>
                <span className={`font-mono font-bold ${isDarkMode ? 'text-red-300' : 'text-red-900'}`}>{(tripFuel + contingencyFuel + alternateFuel).toLocaleString()} kg</span>
              </div>
            </section>
          </div>

          {/* Column 2: Crew Adjustments & Structural Limits */}
          <div className="space-y-3">
            {/* Crew Adjustments */}
            <section className={`rounded-xl shadow-sm border overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`px-3.5 py-2 border-b flex items-center gap-1.5 ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                <Users className="w-4 h-4 text-red-600" />
                <h2 className={`font-semibold text-xs sm:text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Crew Adjustments</h2>
              </div>
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Aircraft Type Toggle */}
                  <div className="space-y-1">
                    <label className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Aircraft Type</label>
                    <div className={`flex p-0.5 rounded ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
                      <button 
                        onClick={() => setAircraftType('NG')}
                        className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${aircraftType === 'NG' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >NG</button>
                      <button 
                        onClick={() => setAircraftType('MAX')}
                        className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${aircraftType === 'MAX' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >MAX</button>
                    </div>
                  </div>

                  {/* Cabin Position Toggle */}
                  <div className="space-y-1">
                    <label className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Cabin Crew Pos</label>
                    <div className={`flex p-0.5 rounded ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
                      <button 
                        onClick={() => setCabinPosition('FWD')}
                        className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${cabinPosition === 'FWD' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >FWD</button>
                      <button 
                        onClick={() => setCabinPosition('AFT')}
                        className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${cabinPosition === 'AFT' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >AFT</button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <InputGroup 
                    label="Extra Pilots" 
                    value={extraPilots} 
                    onChange={setExtraPilots} 
                    unit="pers" 
                    isDarkMode={isDarkMode}
                  />
                  <InputGroup 
                    label="Extra Cabin Crew" 
                    value={extraCabinCrew} 
                    onChange={setExtraCabinCrew} 
                    unit="pers" 
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>
              <div className={`px-3.5 py-1.5 border-t ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`text-[9px] grid grid-cols-2 gap-x-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <div>
                    <span className="font-bold">Pilots ({aircraftType}):</span> 1st: {INDEX_VARS[aircraftType].PILOT_1ST_OBS} | 2nd: {INDEX_VARS[aircraftType].PILOT_2ND_OBS}
                  </div>
                  <div>
                    <span className="font-bold">Cabin ({aircraftType}):</span> {cabinPosition}: {cabinPosition === 'FWD' ? INDEX_VARS[aircraftType].CABIN_FWD : INDEX_VARS[aircraftType].CABIN_AFT}
                  </div>
                </div>
              </div>
            </section>

            {/* Structural Limits */}
            <section className={`rounded-xl shadow-sm border overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`px-3.5 py-2 border-b flex items-center gap-1.5 ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className={`font-semibold text-xs sm:text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Structural Limits</h2>
              </div>
              <div className="p-3 grid grid-cols-3 gap-2">
                <InputGroup label="MTOW" value={mtow} onChange={setMtow} unit="kg" min={1} isDarkMode={isDarkMode} />
                <InputGroup label="MLW" value={mlw} onChange={setMlw} unit="kg" min={1} isDarkMode={isDarkMode} />
                <InputGroup label="MZFW" value={mzfw} onChange={setMzfw} unit="kg" min={1} isDarkMode={isDarkMode} />
              </div>
            </section>
          </div>

          {/* Column 3: Envelope Chart & Calculation Summary */}
          <div className="space-y-3">
            {/* Chart Section */}
            <section className={`rounded-xl shadow-sm border overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="p-4 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart layout="vertical" margin={{ top: 5, right: 10, left: 15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                    <XAxis 
                      type="number" 
                      dataKey="index" 
                      domain={[20, 100]} 
                      tick={{ fontSize: 8, fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="weight" 
                      domain={[35000, 85000]} 
                      tick={{ fontSize: 8, fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const isStatePoint = !!data.name;
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
                              case 'ZFW': return 'bg-slate-900 border-blue-950';
                              case 'TOW': return 'bg-slate-900 border-red-950';
                              case 'LW': return 'bg-slate-900 border-emerald-950';
                              default: return 'bg-slate-900 border-slate-800';
                            }
                          };
                          const bgClass = getPointBg(data.name || '');
                          return (
                            <div className={`p-2 rounded-lg shadow-xl text-[10px] border font-sans ${bgClass} ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                              <p className="font-bold underline">{data.name || 'Envelope Point'}</p>
                              <p>W: <span className="font-bold font-mono">{data.weight?.toLocaleString()} kg</span></p>
                              <p>Idx: <span className="font-bold font-mono">{(data.index || data.minIndex || data.maxIndex)?.toFixed(2)}</span></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area data={envelopeData} dataKey="maxIndex" stroke="none" fill="#ef4444" fillOpacity={0.06} baseLine={30} isAnimationActive={false} />
                    <Line data={envelopeData} dataKey="minIndex" stroke="#ef4444" strokeWidth={1} dot={false} isAnimationActive={false} />
                    <Line data={envelopeData} dataKey="maxIndex" stroke="#ef4444" strokeWidth={1} dot={false} isAnimationActive={false} />
                    <ReferenceLine y={mzfw} stroke="#64748b" strokeDasharray="3 3" />
                    <ReferenceLine y={mlw} stroke="#64748b" strokeDasharray="3 3" />
                    <ReferenceLine y={mtow} stroke="#f43f5e" strokeDasharray="3 3" />
                    <Scatter name="Current State" data={chartData}>
                      {chartData.map((entry, index) => {
                        let color = '#ef4444';
                        if (entry.name === 'ZFW') color = '#3b82f6';
                        if (entry.name === 'LW') color = '#10b981';
                        if (entry.name === 'TOW') color = '#f43f5e';
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Scatter>
                    <Line data={chartData} dataKey="weight" stroke={isDarkMode ? "#475569" : "#94a3b8"} strokeWidth={1} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className={`px-3.5 py-1.5 border-t flex gap-3 text-[9px] justify-center transition-colors duration-300 ${isDarkMode ? 'bg-slate-800/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" />ZFW</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500" />TOW</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" />LW</span>
                <span className="flex items-center gap-1"><div className="w-2.5 h-1.5 bg-red-500/10 border border-red-500/30 rounded" />Safe Envelope</span>
              </div>
            </section>

            {/* Calculation Summary */}
            <section className={`rounded-xl shadow-md overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-slate-900'}`}>
              <div className="px-3.5 py-1.5 flex items-center justify-between bg-slate-800">
                <h2 className="font-semibold text-xs text-white flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Calculation Summary
                </h2>
                <span className="text-[9px] font-mono text-slate-400">RAM B737</span>
              </div>
              
              <div className="p-3.5 space-y-3 text-white">
                {/* Main Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <ResultCard label="DOW Corr" value={results.dowCorrected} unit="kg" />
                  <ResultCard label="DOI Corr" value={results.doiCorrected.toFixed(2)} unit="" highlight />
                  <ResultCard label="Max Pld" value={results.maxPayload} unit="kg" highlight />
                </div>

                {/* Progress bars / Metrics */}
                <div className="space-y-2">
                  <MetricRow label="Zero Fuel Weight (ZFW)" value={results.zfw} limit={mzfw} ok={results.limitations.zfwOk} index={results.zfwIndex} isDarkMode={isDarkMode} />
                  <MetricRow label="Take Off Weight (TOW)" value={results.tow} limit={mtow} ok={results.limitations.towOk} index={results.towIndex} isDarkMode={isDarkMode} />
                  <MetricRow label="Landing Weight (LW)" value={results.lw} limit={mlw} ok={results.limitations.lwOk} index={results.lwIndex} isDarkMode={isDarkMode} />
                </div>

                {/* Constraint Breakdown */}
                <div className="p-2 bg-slate-950/40 rounded-lg border border-slate-800 space-y-1.5">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Fuel Constraints </p>
                  <div className="grid grid-cols-3 gap-2 text-[9px]">
                    <div>
                      <span className="text-slate-500 block">Tank Capacity</span>
                      <span className="text-slate-300 font-mono font-bold">{results.maxFuelWeight.toLocaleString()} kg</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">MTOW Bound</span>
                      <span className="text-slate-300 font-mono font-bold">{results.flightMaxFuelByMTOW.toLocaleString()} kg</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">MLW Bound</span>
                      <span className="text-slate-300 font-mono font-bold">{results.flightMaxFuelByMLW.toLocaleString()} kg</span>
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <AnimatePresence mode="wait">
                  {Object.values(results.limitations).every(v => v) ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 flex items-center gap-2 text-emerald-400 text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium">All parameters are within safe limits.</span>
                    </motion.div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5 flex items-center gap-2 text-rose-400 text-xs"
                    >
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium">Warning: Operational limits exceeded!</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>
          </div>
          
        </div>
      </main>

      <footer className={`py-2 border-t text-center transition-colors duration-300 ${isDarkMode ? 'border-slate-900 text-slate-600' : 'border-slate-200 text-slate-400'}`}>
        <p className="text-[9px] font-medium tracking-wide">
          B737 Weight & Balance • Developed by <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Aymane ZBAKH</span> • v1.1.2
        </p>
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
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className={`text-[11px] font-semibold flex items-center gap-1.5 leading-none ${error ? 'text-rose-500' : isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
          {icon && <span className={error ? 'text-rose-400' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{icon}</span>}
          {label}
        </label>
        <span className={`text-[9px] font-bold uppercase leading-none ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{unit}</span>
      </div>
      <div className="relative">
        <input 
          type="number" 
          value={value}
          onChange={handleChange}
          disabled={disabled}
          min={min}
          max={max}
          className={`w-full border rounded-lg px-2 py-1 text-xs focus:ring-1 outline-none transition-all font-mono leading-tight ${
            isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
          } ${
            error 
              ? 'border-rose-500/50 focus:ring-rose-500 text-rose-500' 
              : 'focus:ring-red-500 focus:border-red-500'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
        {error && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-rose-500">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      {error && errorMsg ? (
        <p className="text-[9px] text-rose-500 font-medium leading-none mt-0.5">{errorMsg}</p>
      ) : description ? (
        <p className={`text-[9px] leading-none mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{description}</p>
      ) : null}
    </div>
  );
}

function ResultCard({ label, value, unit, highlight }: { label: string; value: number | string; unit: string; highlight?: boolean }) {
  return (
    <div className={`p-2 rounded-xl border transition-colors duration-300 ${highlight ? 'bg-red-600 border-red-500' : 'bg-slate-800 border-slate-700'}`}>
      <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${highlight ? 'text-red-100' : 'text-slate-400'}`}>{label}</p>
      <div className="flex items-baseline gap-1 leading-none">
        <span className="text-sm font-mono font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</span>
        <span className={`text-[9px] font-medium ${highlight ? 'text-red-200' : 'text-slate-500'}`}>{unit}</span>
      </div>
    </div>
  );
}

function MetricRow({ label, value, limit, ok, index, isDarkMode }: { label: string; value: number; limit: number; ok: boolean; index: number; isDarkMode?: boolean }) {
  const percentage = Math.min(100, (value / limit) * 100);
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-end text-xs">
        <div>
          <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{label}</p>
          <div className="flex items-center gap-1.5 leading-none">
            <span className={`font-mono font-bold ${ok ? 'text-white' : 'text-rose-400'}`}>
              {value.toLocaleString()} kg
            </span>
            <span className="text-[10px] text-slate-500">/ {limit.toLocaleString()} kg</span>
          </div>
          <p className="text-[9px] text-slate-500">CG Index: <span className="text-red-400 font-bold">{index.toFixed(2)}</span></p>
        </div>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
          {ok ? 'PASS' : 'EXCEED'}
        </span>
      </div>
      <div className={`h-1 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-800'}`}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={`h-full rounded-full ${ok ? 'bg-red-500' : 'bg-rose-500'}`}
        />
      </div>
    </div>
  );
}

