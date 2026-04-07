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
  RotateCcw
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
  ReferenceLine
} from 'recharts';

// Standard constants (kg)
const PILOT_WEIGHT = 85;
const CABIN_CREW_WEIGHT = 75;
const FUEL_DENSITY = 0.8; // kg/L for Jet A-1

// Index Variations from provided image
const INDEX_VAR_PILOT_1ST_OBS = -1.44;
const INDEX_VAR_PILOT_2ND_OBS = -1.45;
const INDEX_VAR_CABIN_EXTRA = 1.08; // Assuming extra crew sit in Aft jumpseats (+1.08)

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

// B737-800 Approximate Envelope Data (Weight vs CG Index)
const ENVELOPE_DATA = [
  { weight: 40000, minIndex: 30, maxIndex: 70 },
  { weight: 50000, minIndex: 32, maxIndex: 72 },
  { weight: 60000, minIndex: 35, maxIndex: 75 },
  { weight: 62731, minIndex: 38, maxIndex: 78 }, // MZFW
  { weight: 66349, minIndex: 40, maxIndex: 80 }, // MLW
  { weight: 79010, minIndex: 45, maxIndex: 85 }, // MTOW
];

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
    fuelCapacityKg: 20816
  };

  // Helper to load from localStorage
  const loadSaved = (key: keyof typeof DEFAULTS) => {
    try {
      const saved = localStorage.getItem(`b737_wb_${key}`);
      if (saved === null) return DEFAULTS[key];
      const num = Number(saved);
      return isNaN(num) ? DEFAULTS[key] : num;
    } catch (e) {
      console.warn('LocalStorage access failed:', e);
      return DEFAULTS[key];
    }
  };

  // Inputs
  const [dow, setDow] = useState<number>(() => loadSaved('dow'));
  const [doi, setDoi] = useState<number>(() => loadSaved('doi'));
  const [mtow, setMtow] = useState<number>(() => loadSaved('mtow'));
  const [mlw, setMlw] = useState<number>(() => loadSaved('mlw'));
  const [mzfw, setMzfw] = useState<number>(() => loadSaved('mzfw'));
  const [payload, setPayload] = useState<number>(() => loadSaved('payload'));
  const [tof, setTof] = useState<number>(() => loadSaved('tof'));
  const [tripFuel, setTripFuel] = useState<number>(() => loadSaved('tripFuel'));
  const [contingencyFuel, setContingencyFuel] = useState<number>(() => loadSaved('contingencyFuel'));
  const [alternateFuel, setAlternateFuel] = useState<number>(() => loadSaved('alternateFuel'));
  const [extraPilots, setExtraPilots] = useState<number>(() => loadSaved('extraPilots'));
  const [extraCabinCrew, setExtraCabinCrew] = useState<number>(() => loadSaved('extraCabinCrew'));
  const [fuelCapacityKg, setFuelCapacityKg] = useState<number>(() => loadSaved('fuelCapacityKg'));

  // Save to localStorage whenever values change
  useEffect(() => {
    const state = { dow, doi, mtow, mlw, mzfw, payload, tof, tripFuel, contingencyFuel, alternateFuel, extraPilots, extraCabinCrew, fuelCapacityKg };
    Object.entries(state).forEach(([key, value]) => {
      localStorage.setItem(`b737_wb_${key}`, value.toString());
    });
  }, [dow, doi, mtow, mlw, mzfw, payload, tof, tripFuel, contingencyFuel, alternateFuel, extraPilots, extraCabinCrew, fuelCapacityKg]);

  // Auto-calculate contingency fuel (5% of trip fuel)
  useEffect(() => {
    setContingencyFuel(Math.round(tripFuel * 0.05));
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
  };

  const results = useMemo((): CalculationResults => {
    const dowCorrected = dow + (extraPilots * PILOT_WEIGHT) + (extraCabinCrew * CABIN_CREW_WEIGHT);
    
    // Calculate Corrected DOI based on extra crew positions
    // 1st extra pilot = 1st Observer (-1.44)
    // 2nd extra pilot = 2nd Observer (-1.45)
    // Extra cabin crew = Aft jumpseats (+1.08)
    const pilotIndexVar = (extraPilots >= 1 ? INDEX_VAR_PILOT_1ST_OBS : 0) + (extraPilots >= 2 ? INDEX_VAR_PILOT_2ND_OBS : 0);
    const cabinIndexVar = extraCabinCrew * INDEX_VAR_CABIN_EXTRA;
    const doiCorrected = doi + pilotIndexVar + cabinIndexVar;

    const zfw = dowCorrected + payload;
    const tow = zfw + tof;
    const lw = tow - tripFuel;
    
    const maxFuelWeight = fuelCapacityKg;

    // Max Fuel we can carry on this specific flight (Flight-Specific Max Fuel)
    // Limited by:
    // 1. Structural capacity
    // 2. MTOW - ZFW
    // 3. MLW + Trip Fuel - ZFW
    const flightMaxFuelByMTOW = mtow - zfw;
    const flightMaxFuelByMLW = mlw + tripFuel - zfw;
    const flightMaxFuel = Math.max(0, Math.min(maxFuelWeight, flightMaxFuelByMTOW, flightMaxFuelByMLW));

    // CG Index Calculations (Simplified)
    const zfwIndex = doiCorrected + (payload / 1000 * PAYLOAD_ARM_OFFSET);
    const towIndex = zfwIndex + (tof / 1000 * FUEL_ARM_OFFSET);
    const lwIndex = towIndex - (tripFuel / 1000 * FUEL_ARM_OFFSET);

    // Determine Limiting Factor for Takeoff
    // The most restrictive TOW is the minimum of:
    // 1. MTOW
    // 2. MLW + Trip Fuel (Can't land heavier than MLW)
    // 3. MZFW + TOF (Can't have ZFW heavier than MZFW)
    const limitByMTOW = mtow;
    const limitByMLW = mlw + tripFuel;
    const limitByMZFW = mzfw + tof;

    let limitingFactor: 'MTOW' | 'MLW' | 'MZFW' = 'MTOW';
    const minLimit = Math.min(limitByMTOW, limitByMLW, limitByMZFW);

    if (minLimit === limitByMLW) limitingFactor = 'MLW';
    else if (minLimit === limitByMZFW) limitingFactor = 'MZFW';

    const maxPayload = minLimit - dowCorrected - tof;

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
        zfwOk: zfw <= mzfw && zfw > 0,
        towOk: tow <= mtow && tow > 0,
        lwOk: lw <= mlw && lw > 0,
        payloadOk: payload <= (minLimit - dowCorrected - tof) && payload >= 0,
        fuelOk: tof <= maxFuelWeight && tof >= 0,
        tripFuelOk: tripFuel <= tof && tripFuel >= 0,
      }
    };
  }, [dow, doi, extraPilots, extraCabinCrew, payload, tof, tripFuel, mzfw, mtow, mlw, fuelCapacityKg]);

  const chartData = useMemo(() => {
    return [
      { name: 'ZFW', weight: results.zfw, index: results.zfwIndex },
      { name: 'TOW', weight: results.tow, index: results.towIndex },
      { name: 'LW', weight: results.lw, index: results.lwIndex },
    ];
  }, [results]);

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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-2 rounded-lg flex-shrink-0">
              <Plane className="text-white w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold tracking-tight leading-tight truncate sm:whitespace-normal">Weight And Balance B737</h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium uppercase tracking-wider">Royal air Maroc</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={resetToDefaults}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 text-slate-600 px-3 sm:px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors text-xs sm:text-sm font-medium"
              title="Reset to factory defaults"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Reset
            </button>
            <button 
              onClick={exportToCSV}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors text-xs sm:text-sm font-medium"
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
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-red-600" />
                <h2 className="font-semibold">Operational Parameters</h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup 
                  label="Dry Operating Weight (DOW)" 
                  value={dow} 
                  onChange={setDow} 
                  unit="kg" 
                  icon={<Weight className="w-4 h-4" />}
                  description="2/4 Configuration base weight"
                  min={35000}
                  max={55000}
                />
                <InputGroup 
                  label="Dry Operating Index (DOI)" 
                  value={doi} 
                  onChange={setDoi} 
                  unit="idx" 
                  icon={<ArrowRightLeft className="w-4 h-4" />}
                  min={0}
                  max={100}
                />
                <InputGroup 
                  label="Payload" 
                  value={payload} 
                  onChange={setPayload} 
                  unit="kg" 
                  icon={<Users className="w-4 h-4" />}
                  error={!results.limitations.payloadOk}
                  errorMsg={`Max Payload: ${results.maxPayload.toFixed(0)} kg`}
                />
                <InputGroup 
                  label="Fuel Capacity" 
                  value={fuelCapacityKg} 
                  onChange={setFuelCapacityKg} 
                  unit="kg" 
                  icon={<Fuel className="w-4 h-4" />}
                  min={1}
                />
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <Fuel className="w-5 h-5 text-red-600" />
                <h2 className="font-semibold">Fuel Planning</h2>
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
                />
                <InputGroup 
                  label="Trip Fuel" 
                  value={tripFuel} 
                  onChange={setTripFuel} 
                  unit="kg" 
                  error={!results.limitations.tripFuelOk}
                  errorMsg="Cannot exceed TOF"
                  description="Fuel required for the flight"
                />
                <InputGroup 
                  label="Contingency Fuel" 
                  value={contingencyFuel} 
                  onChange={setContingencyFuel} 
                  unit="kg" 
                  description="Auto-calculated (5% of trip fuel)"
                  disabled
                />
                <InputGroup 
                  label="Alternate Fuel" 
                  value={alternateFuel} 
                  onChange={setAlternateFuel} 
                  unit="kg" 
                  description="Fuel to reach alternate airport"
                />
              </div>
              <div className="px-6 py-3 bg-red-50/50 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-red-800">Min Required Fuel (Trip + Cont + Alt)</span>
                  <span className="text-sm font-mono font-bold text-red-900">{(tripFuel + contingencyFuel + alternateFuel).toLocaleString()} kg</span>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <Users className="w-5 h-5 text-red-600" />
                <h2 className="font-semibold">Crew Adjustments</h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup 
                  label="Extra Pilots" 
                  value={extraPilots} 
                  onChange={setExtraPilots} 
                  unit="pers" 
                  description="Above 2 pilots"
                  min={0}
                />
                <InputGroup 
                  label="Extra Cabin Crew" 
                  value={extraCabinCrew} 
                  onChange={setExtraCabinCrew} 
                  unit="pers" 
                  description="Above 4 crew"
                  min={0}
                />
              </div>
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
                <div className="text-[10px] text-slate-500 grid grid-cols-2 gap-x-4">
                  <div>
                    <span className="font-bold uppercase">Pilot Variations:</span>
                    <ul className="list-disc list-inside ml-1">
                      <li>1st Obs: {INDEX_VAR_PILOT_1ST_OBS}</li>
                      <li>2nd Obs: {INDEX_VAR_PILOT_2ND_OBS}</li>
                    </ul>
                  </div>
                  <div>
                    <span className="font-bold uppercase">Cabin Variations:</span>
                    <ul className="list-disc list-inside ml-1">
                      <li>Extra Crew: +{INDEX_VAR_CABIN_EXTRA} (Aft)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="font-semibold">Structural Limits</h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <InputGroup label="MTOW" value={mtow} onChange={setMtow} unit="kg" min={1} />
                <InputGroup label="MLW" value={mlw} onChange={setMlw} unit="kg" min={1} />
                <InputGroup label="MZFW" value={mzfw} onChange={setMzfw} unit="kg" min={1} />
              </div>
            </section>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-5 space-y-6">
            <div className="sticky top-24">
              
              {/* Chart Section */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-red-600" />
                    <h2 className="font-semibold">Weight & Balance Envelope</h2>
                  </div>
                </div>
                <div className="p-4 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis 
                        type="number" 
                        dataKey="index" 
                        domain={[20, 100]} 
                        label={{ value: 'CG Index', position: 'insideBottom', offset: -10, fontSize: 10 }}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="weight" 
                        domain={[35000, 85000]} 
                        label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft', offset: -30, fontSize: 10 }}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white p-2 rounded shadow-lg text-[10px]">
                                <p className="font-bold">{payload[0].payload.name || 'Envelope'}</p>
                                <p>Weight: {payload[0].payload.weight?.toLocaleString()} kg</p>
                                <p>Index: {payload[0].payload.index?.toFixed(2) || payload[0].value?.toFixed(2)}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      
                      {/* Envelope Area */}
                      <Area 
                        data={ENVELOPE_DATA} 
                        dataKey="maxIndex" 
                        stroke="none" 
                        fill="#ef4444" 
                        fillOpacity={0.1} 
                        baseLine={30}
                        isAnimationActive={false}
                      />
                      <Line 
                        data={ENVELOPE_DATA} 
                        dataKey="minIndex" 
                        stroke="#ef4444" 
                        strokeWidth={1} 
                        dot={false} 
                        isAnimationActive={false}
                      />
                      <Line 
                        data={ENVELOPE_DATA} 
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
                        fill="#ef4444"
                      >
                        {chartData.map((entry, index) => (
                          <motion.circle 
                            key={`dot-${index}`}
                            cx={0} cy={0} r={4} 
                            fill={entry.name === 'TOW' ? '#f43f5e' : '#ef4444'}
                          />
                        ))}
                      </Scatter>
                      <Line 
                        data={chartData} 
                        dataKey="weight" 
                        stroke="#ef4444" 
                        strokeWidth={2} 
                        dot={true}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex gap-4 text-[10px] text-slate-500">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span>ZFW / LW</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>TOW</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500/20 border border-red-500/40 rounded" />
                    <span>Safe Envelope</span>
                  </div>
                </div>
              </section>

              <section className="bg-slate-900 text-white rounded-2xl shadow-xl overflow-hidden">
                <div className="px-6 py-4 bg-slate-800 flex items-center justify-between">
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
                    <MetricRow label="Zero Fuel Weight (ZFW)" value={results.zfw} limit={mzfw} ok={results.limitations.zfwOk} index={results.zfwIndex} />
                    <MetricRow label="Take Off Weight (TOW)" value={results.tow} limit={mtow} ok={results.limitations.towOk} index={results.towIndex} />
                    <MetricRow label="Landing Weight (LW)" value={results.lw} limit={mlw} ok={results.limitations.lwOk} index={results.lwIndex} />
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

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-100">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="h-px w-12 bg-slate-200" />
            <Plane className="w-4 h-4 text-red-600" />
            <div className="h-px w-12 bg-slate-200" />
          </div>
          
          <div className="text-center space-y-1">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">
              Developed by
            </p>
            <h2 className="text-slate-900 text-lg font-bold tracking-tight">
              Aymane ZBAKH
            </h2>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span className="text-[10px] font-mono tracking-wider px-2 py-1 bg-slate-50 rounded border border-slate-100">B737-800 OPS</span>
            <div className="w-1 h-1 bg-slate-300 rounded-full" />
            <span className="text-[10px] font-mono tracking-wider px-2 py-1 bg-slate-50 rounded border border-slate-100">v1.0.2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function InputGroup({ label, value, onChange, unit, icon, description, error, errorMsg, min, max, disabled }: { 
  label: string; 
  value: number; 
  onChange: (val: number) => void; 
  unit: string;
  icon?: ReactNode;
  description?: string;
  error?: boolean;
  errorMsg?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const val = Number(e.target.value);
    if (isNaN(val)) return;
    onChange(val);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className={`text-sm font-medium flex items-center gap-2 ${error ? 'text-rose-600' : 'text-slate-700'}`}>
          {icon && <span className={error ? 'text-rose-400' : 'text-slate-400'}>{icon}</span>}
          {label}
        </label>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>
      </div>
      <div className="relative">
        <input 
          type="number" 
          value={value}
          onChange={handleChange}
          disabled={disabled}
          min={min}
          max={max}
          className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm focus:ring-2 outline-none transition-all font-mono ${
            error 
              ? 'border-rose-300 focus:ring-rose-500 text-rose-900' 
              : 'border-slate-200 focus:ring-red-500 focus:border-red-500'
          } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
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
        <p className="text-[10px] text-slate-400">{description}</p>
      ) : null}
    </div>
  );
}

function ResultCard({ label, value, unit, highlight }: { label: string; value: number; unit: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border ${highlight ? 'bg-red-600 border-red-500' : 'bg-slate-800 border-slate-700'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${highlight ? 'text-red-100' : 'text-slate-400'}`}>{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-mono font-bold">{value.toLocaleString()}</span>
        <span className={`text-[10px] font-medium ${highlight ? 'text-red-200' : 'text-slate-500'}`}>{unit}</span>
      </div>
    </div>
  );
}

function MetricRow({ label, value, limit, ok, index }: { label: string; value: number; limit: number; ok: boolean; index: number }) {
  const percentage = Math.min(100, (value / limit) * 100);
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">{label}</p>
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
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={`h-full rounded-full ${ok ? 'bg-red-500' : 'bg-rose-500'}`}
        />
      </div>
    </div>
  );
}
