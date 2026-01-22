import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Train, Map as MapIcon, Armchair, Coffee, Battery, Wifi, ArrowRight, Pause, Play, X, Navigation, Monitor, Plus, Minus, RotateCcw, Check, CloudRain, VolumeX, Waves, Speaker, Home, LogOut, Clock, MapPin, History, Calendar } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, serverTimestamp } from 'firebase/firestore';

/* --- Firebase Setup --- */
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

/* --- Sound Engine (Web Audio API) --- */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.nodes = {};
    this.volume = 0.5;
    this.currentType = 'none';
    this.isBlocked = false; 
    this.timers = [];
  }

  init() {
    if (this.isBlocked) return;
    try {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
      }
    } catch (e) {
      console.warn("AudioContext not supported or blocked:", e);
      this.isBlocked = true;
    }
  }

  async resume() {
    if (this.isBlocked) return;
    this.init();
    try {
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
    } catch (e) {}
  }

  setVolume(val) {
    if (this.isBlocked || !this.ctx) return;
    this.volume = val;
    try {
      if (this.nodes.masterGain) {
        this.nodes.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
      }
    } catch (e) {}
  }

  stop() {
    if (this.isBlocked) return;
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
    try {
      Object.values(this.nodes).forEach(node => {
        if (node && typeof node.stop === 'function') node.stop();
        if (node && typeof node.disconnect === 'function') node.disconnect();
      });
    } catch (e) {}
    this.nodes = {};
    this.currentType = 'none';
  }

  playTick() {
    if (this.isBlocked) return;
    try {
        this.init();
        if (!this.ctx) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.03);

        gain.gain.setValueAtTime(0.1 * this.volume, t); 
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

        osc.start(t);
        osc.stop(t + 0.04);

        setTimeout(() => {
            try { osc.disconnect(); gain.disconnect(); } catch(e){}
        }, 100);

    } catch(e) {}
  }

  playClick() {
    if (this.isBlocked) return;
    try {
      this.init();
      if (!this.ctx) return;

      const trigger = () => {
        try {
          const t = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.frequency.setValueAtTime(600, t);
          osc.frequency.exponentialRampToValueAtTime(150, t + 0.05);
          
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.5 * this.volume, t + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

          osc.start(t);
          osc.stop(t + 0.1);
          
          setTimeout(() => {
            try { osc.disconnect(); gain.disconnect(); } catch(e){}
          }, 150);
        } catch (e) {}
      };

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(trigger).catch(() => {});
      } else {
        trigger();
      }
    } catch (e) {
      this.isBlocked = true;
    }
  }

  playDroplet() {
    if (!this.ctx || this.currentType !== 'rain') return;
    try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.nodes.masterGain);
        osc.frequency.setValueAtTime(800 + Math.random() * 400, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.02);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.05, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.start(t);
        osc.stop(t + 0.05);
        const nextTime = Math.random() * 200 + 50;
        const timer = setTimeout(() => this.playDroplet(), nextTime);
        this.timers.push(timer);
    } catch(e) {}
  }

  async play(type) {
    if (this.isBlocked) return;
    await this.resume();
    if (this.currentType === type) return;
    this.stop();
    this.currentType = type;
    if (type === 'none') return;

    try {
        const masterGain = this.ctx.createGain();
        masterGain.gain.value = this.volume;
        masterGain.connect(this.ctx.destination);
        this.nodes.masterGain = masterGain;

        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        let b0, b1, b2, b3, b4, b5, b6;
        b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          output[i] *= 0.11; 
          b6 = white * 0.115926;
        }

        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        noiseSrc.loop = true;

        if (type === 'waves') {
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            const lfo = this.ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.15;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 0.3;
            const variableGain = this.ctx.createGain();
            variableGain.gain.value = 0.5;
            noiseSrc.connect(filter);
            filter.connect(variableGain);
            lfo.connect(lfoGain);
            lfoGain.connect(variableGain.gain);
            variableGain.connect(masterGain);
            noiseSrc.start();
            lfo.start();
            this.nodes.source = noiseSrc;
            this.nodes.lfo = lfo;
            this.nodes.variableGain = variableGain;
            this.nodes.lfoGain = lfoGain;

        } else if (type === 'rain') {
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 600;
            const rainGain = this.ctx.createGain();
            rainGain.gain.value = 0.6;
            noiseSrc.connect(filter);
            filter.connect(rainGain);
            rainGain.connect(masterGain);
            noiseSrc.start();
            this.nodes.source = noiseSrc;
            this.playDroplet();
            this.playDroplet();
            
        } else if (type === 'train') {
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 250;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 4;
            const oscGain = this.ctx.createGain();
            oscGain.gain.value = 0.15;
            osc.connect(oscGain);
            oscGain.connect(masterGain.gain);
            osc.start();
            noiseSrc.connect(filter);
            filter.connect(masterGain);
            noiseSrc.start();
            this.nodes.source = noiseSrc;
            this.nodes.osc = osc;
        }
    } catch (e) {}
  }
}

const soundEngine = new SoundEngine();

/* --- Tile Engine Utils --- */
const TILE_SIZE = 256;
const deg2rad = (deg) => deg * (Math.PI / 180);

const latLngToPoint = (lat, lng, zoom) => {
  const x = (lng + 180) / 360 * Math.pow(2, zoom);
  const y = (1 - Math.log(Math.tan(deg2rad(lat)) + 1 / Math.cos(deg2rad(lat))) / Math.PI) / 2 * Math.pow(2, zoom);
  return { x: x * TILE_SIZE, y: y * TILE_SIZE };
};

const pointToLatLng = (x, y, zoom) => {
  const n = Math.PI - 2 * Math.PI * y / TILE_SIZE / Math.pow(2, zoom);
  const lng = x / TILE_SIZE / Math.pow(2, zoom) * 360 - 180;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
};

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  var R = 6371; 
  var dLat = deg2rad(lat2-lat1); 
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; 
  return d;
}

const InfoItem = ({ label, value }) => (
  <div>
    <p className="text-[8px] uppercase tracking-widest font-bold mb-1 opacity-40">{label}</p>
    <p className="text-xs font-bold text-zinc-200">{value}</p>
  </div>
);

// --- Minimalist RulerTimePicker ---
const RulerTimePicker = ({ min = 10, max = 240, step = 5, value, onChange }) => {
    const scrollRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startScrollLeft, setStartScrollLeft] = useState(0);
    const lastTick = useRef(value);

    // 간격을 넓혀서 더 시원하게 (15px)
    const TICK_WIDTH = 15;
    
    const totalTicks = (max - min) / step;

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setStartScrollLeft(scrollRef.current.scrollLeft);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 1.5; 
        scrollRef.current.scrollLeft = startScrollLeft - walk;
    };

    const handleScroll = () => {
        if (scrollRef.current) {
            const scrollLeft = scrollRef.current.scrollLeft;
            const tickIndex = scrollLeft / TICK_WIDTH;
            let newValue = min + (tickIndex * step);
            
            newValue = Math.max(min, Math.min(max, newValue));
            
            const roundedVal = Math.round(newValue / step) * step;
            
            if (roundedVal !== lastTick.current) {
                if (navigator.vibrate) navigator.vibrate(2);
                soundEngine.playTick(); 
                lastTick.current = roundedVal;
                onChange(roundedVal);
            }
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            const initialTickIndex = (value - min) / step;
            scrollRef.current.scrollLeft = initialTickIndex * TICK_WIDTH;
        }
    }, []);

    return (
        <div className="relative w-full h-10 select-none flex items-center justify-center overflow-hidden">
             {/* Simple Glowing Indicator */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-4 bg-white z-20 pointer-events-none rounded-full shadow-[0_0_12px_rgba(255,255,255,0.8)]"></div>
            
            {/* Soft Gradient Mask */}
            <div className="absolute inset-0 pointer-events-none z-10" 
                 style={{ maskImage: 'linear-gradient(to right, transparent, black 25%, black 75%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 25%, black 75%, transparent)' }}>
            </div>

            {/* Scroll Container */}
            <div 
                ref={scrollRef}
                onScroll={handleScroll}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className={`w-full h-full flex items-center overflow-x-auto overflow-y-hidden no-scrollbar pl-[50%] pr-[50%] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ scrollBehavior: isDragging ? 'auto' : 'smooth' }} 
            >
                <div className="flex items-center h-full space-x-[15px]"> 
                    {Array.from({ length: totalTicks + 1 }).map((_, i) => {
                        const val = min + i * step;
                        const isMajor = val % 30 === 0; 
                        
                        return (
                            <div key={val} className="flex flex-col items-center justify-center shrink-0 w-0 relative">
                                <div 
                                    className={`rounded-full transition-all duration-300 ${
                                        isMajor 
                                        ? 'w-[2px] h-2 bg-white/50' 
                                        : 'w-[2px] h-[2px] bg-white/20'
                                    }`} 
                                />
                                {isMajor && (
                                    <span className="absolute mt-4 text-[7px] font-medium text-zinc-400 font-mono tracking-tighter opacity-70 select-none pointer-events-none whitespace-nowrap">
                                        {val}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// MapView
const MapView = React.memo(({ center, zoom, stations = [], departure, arrival, onStationSelect, trainPosition, showRoute = false, onCenterChange, onZoomChange, dimmed = false, radiusKm = 0, radiusLabel = '' }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const isActualDrag = useRef(false);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const centerPoint = useMemo(() => latLngToPoint(center.lat, center.lng, zoom), [center, zoom]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    isActualDrag.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isActualDrag.current = true;
    setDragOffset({ x: dx, y: dy });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const newCenterX = centerPoint.x - dragOffset.x;
    const newCenterY = centerPoint.y - dragOffset.y;
    const newLatLng = pointToLatLng(newCenterX, newCenterY, zoom);
    setDragOffset({ x: 0, y: 0 });
    if (isActualDrag.current && onCenterChange) onCenterChange(newLatLng);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    isActualDrag.current = false;
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.current.x;
    const dy = e.touches[0].clientY - dragStart.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isActualDrag.current = true;
    setDragOffset({ x: dx, y: dy });
  };
  const handleTouchEnd = () => handleMouseUp();

  const getVisibleTiles = () => {
    if (dimensions.width === 0) return [];
    const visualCenterX = centerPoint.x - dragOffset.x;
    const visualCenterY = centerPoint.y - dragOffset.y;
    const cols = Math.ceil(dimensions.width / TILE_SIZE) + 2;
    const rows = Math.ceil(dimensions.height / TILE_SIZE) + 2;
    const startCol = Math.floor((visualCenterX - dimensions.width / 2) / TILE_SIZE);
    const startRow = Math.floor((visualCenterY - dimensions.height / 2) / TILE_SIZE);

    const tiles = [];
    for (let i = -1; i < cols; i++) {
      for (let j = -1; j < rows; j++) {
        tiles.push({ x: startCol + i, y: startRow + j });
      }
    }
    return tiles;
  };

  const renderRadius = () => {
      if (!departure || radiusKm <= 0 || dimensions.width === 0) return null;
      
      const startPt = latLngToPoint(departure.lat, departure.lng, zoom);
      const cx = startPt.x - centerPoint.x + dimensions.width / 2 + dragOffset.x;
      const cy = startPt.y - centerPoint.y + dimensions.height / 2 + dragOffset.y;

      const metersPerPixel = 156543.03392 * Math.cos(departure.lat * Math.PI / 180) / Math.pow(2, zoom);
      const pixelRadius = (radiusKm * 1000) / metersPerPixel;

      return (
          <div 
            className="absolute rounded-full border border-white/30 bg-white/5 pointer-events-none z-10"
            style={{ 
                left: cx, 
                top: cy, 
                width: pixelRadius * 2, 
                height: pixelRadius * 2, 
                transform: 'translate(-50%, -50%)',
                transition: 'width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), height 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }}
          >
              <div className="absolute top-1/2 left-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute top-1/2 left-1/2 w-[1px] h-full bg-gradient-to-b from-transparent via-white/20 to-transparent -translate-x-1/2 -translate-y-1/2"></div>
              
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-[9px] font-medium text-zinc-200 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm mb-1 whitespace-nowrap border border-white/10">
                 {radiusLabel || `${Math.round(radiusKm)}km`}
              </div>
          </div>
      );
  };

  const renderMarkers = () => {
    if (dimensions.width === 0) return null;
    return stations.map(station => {
      const point = latLngToPoint(station.lat, station.lng, zoom);
      const x = point.x - centerPoint.x + dimensions.width / 2 + dragOffset.x;
      const y = point.y - centerPoint.y + dimensions.height / 2 + dragOffset.y;

      if (x < -100 || x > dimensions.width + 100 || y < -100 || y > dimensions.height + 100) return null;
      
      const isDeparture = departure?.id === station.id;
      const isArrival = arrival?.id === station.id;
      
      let isReachable = true;
      let dist = 0;
      if (departure && radiusKm > 0) {
          dist = getDistanceFromLatLonInKm(departure.lat, departure.lng, station.lat, station.lng);
          isReachable = dist <= radiusKm;
      } else if (departure && !arrival) {
          if (station.id !== departure.id && radiusKm === 0) isReachable = false; 
      }
      
      if (!departure) isReachable = true;
      if (isDeparture) isReachable = true;

      const isSelected = isDeparture || isArrival;

      return (
        <div
          key={station.id}
          className={`absolute transform -translate-x-1/2 -translate-y-1/2
            ${isSelected ? 'z-30 scale-110' : 'z-20'} 
            ${!isReachable ? 'opacity-20 grayscale scale-90' : 'opacity-100'}
            ${dimmed ? 'opacity-40 grayscale' : ''}`}
          style={{ left: x, top: y }}
        >
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (!isActualDrag.current) {
                  if (!departure) {
                      onStationSelect(station);
                  } else if (radiusKm > 0 && isReachable) {
                      onStationSelect(station);
                  }
              }
            }}
            className={`flex flex-col items-center group cursor-pointer active:scale-95 transition-transform ${!isReachable ? 'cursor-not-allowed' : ''}`}
            disabled={!!departure && !isReachable}
          >
            <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold mb-1 shadow-lg backdrop-blur-md border transition-all ${
              isDeparture ? 'bg-zinc-200 border-white text-zinc-900' : 
              isArrival ? 'bg-zinc-700 border-zinc-500 text-white' : 
              'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:border-zinc-500'
            }`}>
              {station.name}
            </div>
            <div className={`w-3 h-3 rounded-full border-2 shadow-xl transition-all ${
              isDeparture ? 'bg-white border-zinc-900 ring-2 ring-white/20' :
              isArrival ? 'bg-zinc-400 border-white ring-2 ring-zinc-400/20' :
              'bg-zinc-800 border-zinc-600'
            }`}></div>
          </button>
        </div>
      );
    });
  };

  const renderRoute = () => {
     if (dimensions.width === 0 || !departure || !arrival || !showRoute) return null;
     const startPt = latLngToPoint(departure.lat, departure.lng, zoom);
     const startX = startPt.x - centerPoint.x + dimensions.width / 2 + dragOffset.x;
     const startY = startPt.y - centerPoint.y + dimensions.height / 2 + dragOffset.y;
     const endPt = latLngToPoint(arrival.lat, arrival.lng, zoom);
     const endX = endPt.x - centerPoint.x + dimensions.width / 2 + dragOffset.x;
     const endY = endPt.y - centerPoint.y + dimensions.height / 2 + dragOffset.y;
     let trainX = startX;
     let trainY = startY;
     let angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;

     if (trainPosition) {
        const tPt = latLngToPoint(trainPosition.lat, trainPosition.lng, zoom);
        trainX = tPt.x - centerPoint.x + dimensions.width / 2 + dragOffset.x;
        trainY = tPt.y - centerPoint.y + dimensions.height / 2 + dragOffset.y;
     }

     return (
       <>
         <svg className={`absolute top-0 left-0 w-full h-full pointer-events-none z-10 ${dimmed ? 'opacity-30' : ''}`}>
            <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="#52525b" strokeWidth="1.5" strokeDasharray="5 5" className="opacity-40" />
            {trainPosition && <line x1={startX} y1={startY} x2={trainX} y2={trainY} stroke="#ffffff" strokeWidth="2.5" className="opacity-80" />}
         </svg>
         {trainPosition && (
            <div 
                className="absolute z-40 transition-transform duration-300 ease-linear pointer-events-none"
                style={{ left: trainX, top: trainY, transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
            >
                <div className="relative w-16 h-5 filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">
                   <div className="absolute top-1/2 left-full -translate-y-1/2 w-32 h-24 bg-gradient-to-r from-yellow-100/30 via-yellow-100/5 to-transparent -ml-4 blur-xl"
                        style={{ clipPath: 'polygon(0 30%, 100% 0, 100% 100%, 0 70%)' }}>
                   </div>
                   
                   <div className="absolute top-1/2 right-full w-20 h-full bg-gradient-to-l from-white/10 to-transparent -translate-y-1/2 blur-sm rounded-full"></div>
                   <div className="w-full h-full bg-zinc-100 rounded-l-sm rounded-r-[100%] border border-zinc-300 relative overflow-hidden flex items-center shadow-inner">
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-2.5 bg-zinc-800 rounded-r-full skew-x-12 opacity-90 border-l border-zinc-600"></div>
                      <div className="flex gap-1 ml-2">
                        <div className="w-2 h-1 bg-zinc-800 rounded-full opacity-60"></div>
                        <div className="w-2 h-1 bg-zinc-800 rounded-full opacity-60"></div>
                        <div className="w-2 h-1 bg-zinc-800 rounded-full opacity-60"></div>
                      </div>
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-zinc-300"></div>
                   </div>
                   <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-3 bg-white/40 blur-md rounded-full"></div>
                </div>
            </div>
         )}
       </>
     );
  };

  return (
    <div 
      ref={containerRef} 
      className={`w-full h-full relative overflow-hidden bg-[#09090b] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {dimensions.width > 0 && getVisibleTiles().map(tile => {
         const maxTiles = Math.pow(2, zoom);
         const normalizedX = ((tile.x % maxTiles) + maxTiles) % maxTiles;
         if (tile.y < 0 || tile.y >= maxTiles) return null;
         const url = `https://a.basemaps.cartocdn.com/dark_all/${zoom}/${normalizedX}/${tile.y}@2x.png`;
         const left = (tile.x * TILE_SIZE) - centerPoint.x + dimensions.width / 2 + dragOffset.x;
         const top = (tile.y * TILE_SIZE) - centerPoint.y + dimensions.height / 2 + dragOffset.y;
         return (
           <img 
             key={`${tile.x}-${tile.y}`}
             src={url}
             alt=""
             className={`absolute w-[256px] h-[256px] select-none pointer-events-none grayscale brightness-75 contrast-[1.1] transition-opacity duration-500 ${dimmed ? 'opacity-50' : ''}`}
             style={{ left, top }}
             draggable={false}
           />
         );
      })}
      {renderRadius()}
      {renderRoute()}
      {renderMarkers()}
      <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-auto">
         <button onClick={(e) => { e.stopPropagation(); onZoomChange(zoom + 1); }} className="p-2.5 bg-zinc-900/50 text-zinc-300 border border-white/5 rounded-lg hover:bg-zinc-800/80 backdrop-blur-md shadow-xl transition-all active:scale-90 hover:text-white"><Plus className="w-4 h-4" /></button>
         <button onClick={(e) => { e.stopPropagation(); onZoomChange(zoom - 1); }} className="p-2.5 bg-zinc-900/50 text-zinc-300 border border-white/5 rounded-lg hover:bg-zinc-800/80 backdrop-blur-md shadow-xl transition-all active:scale-90 hover:text-white"><Minus className="w-4 h-4" /></button>
      </div>
    </div>
  );
});

const BookingScreen = ({ mapCenter, zoom, stations, departure, arrival, onStationSelect, setMapCenter, setZoom, resetSelection, setAppState, setRadiusKm, radiusKm, setSelectedTime, selectedTime, journeyDurationMinutes, setArrival }) => {
    
    const AVG_SPEED_KMH = 150;
    
    const handleTimeChange = (minutes) => {
        setSelectedTime(minutes);
        const km = (minutes / 60) * AVG_SPEED_KMH;
        setRadiusKm(km);
    };

    const reachableStations = useMemo(() => {
        if (!departure || radiusKm <= 0) return [];
        return stations.filter(s => {
            if (s.id === departure.id) return false;
            const dist = getDistanceFromLatLonInKm(departure.lat, departure.lng, s.lat, s.lng);
            return dist <= radiusKm;
        }).map(s => {
            const dist = getDistanceFromLatLonInKm(departure.lat, departure.lng, s.lat, s.lng);
            const time = Math.round((dist / AVG_SPEED_KMH) * 60);
            return { ...s, dist, estimatedTime: time };
        }).sort((a, b) => a.dist - b.dist);
    }, [departure, radiusKm, stations]);

    return (
    <div className="w-full h-full relative flex flex-col">
      <div className="absolute inset-0 z-0">
        <MapView 
          center={mapCenter} zoom={zoom} stations={stations}
          departure={departure} arrival={arrival}
          onStationSelect={onStationSelect}
          onCenterChange={setMapCenter}
          onZoomChange={(val) => { soundEngine.playClick(); setZoom(Math.min(Math.max(val, 6), 14)); }}
          showRoute={!!departure && !!arrival}
          radiusKm={radiusKm} 
          radiusLabel={selectedTime ? `${selectedTime} min` : ''} 
        />
      </div>
      
      {/* Top Left Panel */}
      <div className="relative z-[100] p-4 md:p-5 flex justify-between items-start pointer-events-none">
        <div className="bg-black/20 backdrop-blur-md px-4 py-3 rounded-full border border-white/5 shadow-lg pointer-events-auto transition-all">
          <h1 className="text-sm font-bold text-white flex items-center gap-2 mb-0">
            <Train className="w-4 h-4 text-white/80" /> 
            <span className="tracking-wide">Focus Rail</span>
            {(departure || arrival) && (
             <button onClick={(e) => { e.stopPropagation(); resetSelection(); }} className="ml-2 flex items-center justify-center w-5 h-5 bg-white/10 hover:bg-white/20 rounded-full text-zinc-300 hover:text-white transition-colors cursor-pointer">
               <RotateCcw className="w-3 h-3" />
             </button>
            )}
          </h1>
        </div>
        <button 
            onClick={(e) => { e.stopPropagation(); setAppState('history'); soundEngine.playClick(); }}
            className="pointer-events-auto p-3 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full border border-white/5 text-zinc-300 hover:text-white transition-all active:scale-95 shadow-lg"
        >
            <History className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Floating Panels */}
      <div className="mt-auto relative z-[100] p-4 md:p-6 flex flex-col items-center gap-3 pointer-events-none w-full">
        
        {!departure && (
            <div className="w-full max-w-lg transition-all duration-500 pointer-events-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-2xl">
                <div className="flex flex-col items-center text-center gap-2 text-zinc-300 py-2">
                    <p className="text-lg font-bold text-white">Where to start?</p>
                    <p className="text-xs opacity-60">지도에서 출발역을 선택해주세요</p>
                </div>
            </div>
        )}

        {departure && !arrival && (
            <>
                <div className="w-full max-w-lg transition-all duration-500 pointer-events-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 shadow-2xl">
                     <div className="flex items-center justify-between px-2 pb-2 border-b border-white/5 mb-2">
                         <span className="text-sm font-bold text-white flex items-center gap-2">
                            <Clock className="w-4 h-4 text-white" /> 
                            {selectedTime ? `${selectedTime} Min` : 'Time'}
                         </span>
                         <span className="text-xs text-zinc-400 font-mono">
                             {selectedTime ? `~${Math.round((selectedTime/60)*150)} km` : ''}
                         </span>
                     </div>
                     <div className="py-1">
                         <RulerTimePicker 
                            value={selectedTime || 30} 
                            onChange={handleTimeChange}
                            min={30}
                            max={300}
                            step={5}
                         />
                     </div>
                </div>

                <div className="w-full max-w-lg transition-all duration-500 pointer-events-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 shadow-2xl animate-fade-in-up">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-1">Available Stations</p>
                    
                    {reachableStations.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                            {reachableStations.map(station => (
                                <button
                                    key={station.id}
                                    onClick={() => { soundEngine.playClick(); setArrival(station); }}
                                    className="flex-shrink-0 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl px-3 py-2 transition-all active:scale-95 group cursor-pointer min-w-[100px]"
                                >
                                    <div className="w-2 h-2 rounded-full bg-zinc-500 group-hover:bg-white transition-colors"></div>
                                    <div className="text-left">
                                        <div className="text-xs font-bold text-zinc-200 group-hover:text-white">{station.name}</div>
                                        <div className="text-[9px] text-zinc-500 font-mono">{station.estimatedTime} min</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-xs text-zinc-500">시간을 조절하여 갈 수 있는 역을 찾아보세요</p>
                        </div>
                    )}
                </div>
            </>
        )}

        {departure && arrival && (
             <div className="w-full max-w-lg transition-all duration-500 pointer-events-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-2xl animate-fade-in">
               <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 md:gap-6">
                 <div className="flex-1 flex items-center justify-around border-b md:border-b-0 md:border-r border-white/5 pb-4 md:pb-0 md:pr-6">
                   <div className="text-center">
                      <p className="text-[8px] text-zinc-500 font-bold tracking-widest mb-0.5 uppercase">Start</p>
                      <h2 className="text-base font-bold text-white">{departure.name}</h2>
                   </div>
                   
                   <div className="flex flex-col items-center justify-center px-4">
                       <ArrowRight className="text-zinc-500 w-3 h-3 mb-1" />
                       <span className="text-[9px] font-mono text-zinc-400 border border-white/10 rounded-full px-1.5 py-0.5">{journeyDurationMinutes}m</span>
                   </div>

                   <div className="text-center">
                      <p className="text-[8px] text-zinc-500 font-bold tracking-widest mb-0.5 uppercase">End</p>
                      <h2 className="text-base font-bold text-white">{arrival.name}</h2>
                   </div>
                 </div>
                 <div className="flex items-center justify-between md:justify-end gap-5">
                   <button 
                     onClick={(e) => { e.stopPropagation(); setAppState('seat'); soundEngine.playClick(); }}
                     className="px-6 py-3 bg-white hover:bg-zinc-200 text-black rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                   >
                     좌석 선택
                   </button>
                 </div>
               </div>
            </div>
        )}
      </div>
    </div>
    );
};

const HistoryScreen = ({ history, setAppState }) => (
    <div className="w-full h-full bg-[#09090b] flex flex-col p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-[#09090b] to-[#09090b] pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <History className="w-6 h-6 text-zinc-500" /> Journey History
                </h2>
                <button onClick={() => setAppState('booking')} className="p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 transition-colors">
                    <X className="w-5 h-5 text-white" />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
                {history.length === 0 ? (
                    <div className="text-center py-20 text-zinc-600">
                        <p>아직 기록된 여정이 없습니다.</p>
                    </div>
                ) : (
                    history.map((item) => (
                        <div key={item.id} className="bg-white/5 border border-white/5 rounded-2xl p-5 flex items-center justify-between hover:bg-white/10 transition-colors">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-3 text-sm font-bold text-white">
                                    <span>{item.departure}</span>
                                    <ArrowRight className="w-3 h-3 text-zinc-500" />
                                    <span>{item.arrival}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(item.timestamp?.seconds * 1000).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.duration} min</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Class</div>
                                <div className="text-xs font-bold text-zinc-300">{item.seat}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
);

const SeatScreen = ({ mapCenter, zoom, stations, departure, arrival, seats, selectedSeat, setSelectedSeat, setAppState, journeyDurationMinutes }) => (
    <div className="w-full h-full bg-[#09090b] flex items-center justify-center p-4 md:p-6 relative">
      <div className="absolute inset-0 opacity-10 pointer-events-none grayscale">
        <MapView center={mapCenter} zoom={zoom} stations={stations} departure={departure} arrival={arrival} showRoute={true} />
      </div>
      
      <div className="relative z-[100] w-full max-w-2xl bg-black/50 backdrop-blur-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-full max-h-[600px] md:h-[480px] border border-white/5 animate-fade-in-up">
        <div className="w-full md:w-1/3 bg-white/5 p-6 md:p-8 border-b md:border-b-0 md:border-r border-white/5 flex flex-col shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setAppState('booking'); soundEngine.playClick(); }} className="p-2 bg-white/5 border border-white/5 rounded-lg mb-4 md:mb-6 hover:bg-white/10 self-start text-white transition-all cursor-pointer">
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
          <h2 className="text-xl font-black text-white mb-1.5 uppercase tracking-tight">Seat Class</h2>
          <p className="text-zinc-400 text-[10px] leading-relaxed mb-4 md:mb-6">최상의 집중을 위한 공간을 선택하세요.</p>
          <div className="mt-auto bg-black/20 text-white p-4 rounded-xl border border-white/5 space-y-3">
             <div className="flex justify-between items-center text-[9px]">
                <span className="font-bold opacity-60 uppercase">{departure.name}</span>
                <span className="text-zinc-600">➔</span>
                <span className="font-bold opacity-60 uppercase">{arrival.name}</span>
             </div>
             <p className="font-mono text-white text-base font-black text-center">{journeyDurationMinutes} Min Journey</p>
          </div>
        </div>
        
        <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-transparent flex flex-col">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {seats.map((seat) => (
              <button
                key={seat.id}
                onClick={(e) => { e.stopPropagation(); setSelectedSeat(seat); soundEngine.playClick(); }}
                className={`p-4 rounded-xl border transition-all relative group h-24 md:h-28 flex flex-col justify-between cursor-pointer ${
                  selectedSeat?.id === seat.id
                  ? 'bg-zinc-800 border-zinc-600 ring-1 ring-white/10'
                  : 'bg-white/5 border-white/5 hover:border-white/10 text-zinc-400'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className={`p-2 rounded-md ${selectedSeat?.id === seat.id ? 'bg-black/30' : 'bg-white/5'}`}>
                    {seat.icon}
                  </div>
                  {selectedSeat?.id === seat.id && <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center"><Check className="w-2 h-2 text-black"/></div>}
                </div>
                <div>
                   <h3 className="font-bold text-xs mb-0.5 text-white text-left">{seat.name}</h3>
                   <p className="text-[9px] opacity-50 leading-tight text-left">{seat.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setAppState('ticket'); soundEngine.playClick(); }}
            disabled={!selectedSeat}
            className={`mt-auto w-full py-3.5 rounded-xl font-bold text-xs transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
              selectedSeat ? 'bg-white text-black hover:bg-zinc-200' : 'bg-white/5 text-zinc-600 cursor-not-allowed border border-white/5'
            }`}
          >
            발권하기 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
);

const TicketScreen = ({ departure, arrival, selectedSeat, journeyDurationMinutes, startJourney }) => (
    <div className="w-full h-full bg-[#09090b] flex items-center justify-center p-6 relative">
      <div className="relative z-[100] w-full max-w-[340px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up">
        <div className="bg-white/5 p-6 text-white relative">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-zinc-500 text-[8px] font-black tracking-widest mb-1 uppercase">Travel Pass</p>
              <h1 className="text-base font-black italic tracking-tight uppercase">Focus Rail</h1>
            </div>
            <Monitor className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="flex justify-between items-center mb-4 px-1">
            <div className="flex-1">
               <p className="text-zinc-600 text-[7px] font-bold mb-0.5 uppercase tracking-widest">ORG</p>
               <p className="text-2xl font-black tracking-tighter text-zinc-200">{departure.name.substring(0,2)}</p>
            </div>
            <div className="flex flex-col items-center">
               <Train className="w-4 h-4 text-zinc-700 mb-1.5" />
               <div className="w-12 border-b border-zinc-700 border-dashed"></div>
               <p className="text-zinc-600 text-[8px] font-mono mt-1.5 uppercase">{journeyDurationMinutes}m</p>
            </div>
            <div className="text-right flex-1">
               <p className="text-zinc-600 text-[7px] font-bold mb-0.5 uppercase tracking-widest">DST</p>
               <p className="text-2xl font-black tracking-tighter text-zinc-200">{arrival.name.substring(0,2)}</p>
            </div>
          </div>
          <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-[#09090b] rounded-full z-10 border border-white/5"></div>
          <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-[#09090b] rounded-full z-10 border border-white/5"></div>
        </div>
        <div className="bg-transparent p-6 pt-8 border-t border-dashed border-zinc-800">
           <div className="grid grid-cols-2 gap-y-4 mb-6 text-white/60">
             <InfoItem label="Passenger" value="Focus Traveler" />
             <InfoItem label="Seat" value={selectedSeat?.name || '-'} />
             <InfoItem label="Date" value={new Date().toLocaleDateString('ko-KR')} />
             <InfoItem label="Platform" value="7" />
           </div>
           <button 
             onClick={(e) => { e.stopPropagation(); startJourney(); }}
             className="w-full py-3 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
           >
             여정 시작 <ArrowRight className="w-4 h-4" />
           </button>
        </div>
      </div>
    </div>
);

const JourneyScreen = ({ mapCenter, zoom, stations, departure, arrival, trainPos, setZoom, isPaused, togglePause, resetApp, journeyDurationMinutes, timeLeft, selectedSeat, soundMode, setSoundMode, volume, setVolume }) => {
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Journey to ${arrival.name}`,
        artist: 'Focus Rail',
        album: `${journeyDurationMinutes} min trip`,
        artwork: [
          { src: 'https://via.placeholder.com/512?text=Focus+Rail', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (isPaused) togglePause();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (!isPaused) togglePause();
      });
      
      return () => {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
      };
    }
  }, [arrival, journeyDurationMinutes, isPaused, togglePause]);

  return (
    <div className="w-full h-screen relative bg-zinc-950 overflow-hidden">
      <div className="absolute inset-0 z-0">
         <MapView 
            center={mapCenter} zoom={zoom} stations={stations}
            departure={departure} arrival={arrival} trainPosition={trainPos} showRoute={true}
            onZoomChange={(v) => { soundEngine.playClick(); setZoom(v); }}
            dimmed={true}
         />
      </div>
      
      {isPaused && (
        <div className="absolute inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center animate-fade-in p-6">
           <div className="text-center w-full max-w-xs">
             <Pause className="w-12 h-12 text-zinc-500 mx-auto mb-4 opacity-50" />
             <h2 className="text-2xl font-black text-white tracking-widest uppercase mb-8">Paused</h2>
             
             <button onClick={(e) => { e.stopPropagation(); togglePause(); }} className="w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform text-xs tracking-widest mb-3 cursor-pointer">
               RESUME
             </button>
             
             <button onClick={(e) => { e.stopPropagation(); resetApp(); }} className="w-full py-4 bg-zinc-800 text-zinc-400 font-bold rounded-xl hover:bg-zinc-700 hover:text-white transition-all text-xs tracking-widest flex items-center justify-center gap-2 cursor-pointer">
                <LogOut className="w-3 h-3" /> QUIT JOURNEY
             </button>
           </div>
        </div>
      )}

      {/* Top Bar - Reverted */}
      <div className="absolute top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-start z-[100] pointer-events-none">
         <div className="bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/5 flex items-center gap-3 md:gap-4 shadow-2xl pointer-events-auto max-w-[70%]">
            <div className="flex items-center gap-2 shrink-0">
               <div className={`w-1.5 h-1.5 bg-white rounded-full ${!isPaused && 'animate-ping'}`}></div>
               <span className="text-zinc-200 text-[9px] font-black tracking-widest uppercase opacity-80 hidden md:inline">{isPaused ? 'PAUSED' : 'TRAVELING'}</span>
            </div>
            <div className="h-3 w-px bg-zinc-700 hidden md:block"></div>
            <span className="text-white text-xs font-bold truncate">{departure?.name} → {arrival?.name}</span>
         </div>
         <button onClick={(e) => { e.stopPropagation(); togglePause(); }} className="bg-black/40 hover:bg-black/60 text-white p-3 md:p-4 rounded-full backdrop-blur-xl border border-white/5 transition-all active:scale-95 pointer-events-auto shadow-2xl group cursor-pointer">
           {isPaused ? <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" /> : <Pause className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />}
         </button>
      </div>

      {/* Bottom Bar - Reverted */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 flex flex-col items-center gap-4 z-[100] pointer-events-none">
         <div className="w-full max-w-lg bg-black/50 backdrop-blur-xl border border-white/5 rounded-3xl p-4 md:p-6 shadow-2xl relative overflow-hidden pointer-events-auto transition-opacity duration-300">
            <div className="absolute top-0 left-0 h-[2px] bg-zinc-800 w-full">
               <div className="h-full bg-white transition-all ease-linear shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{width: `${((journeyDurationMinutes * 60 - timeLeft) / (journeyDurationMinutes * 60)) * 100}%`}}></div>
            </div>
            <div className="flex flex-row justify-between items-end gap-4 md:gap-6 pt-2">
              <div className="flex-1">
                 <p className="text-zinc-500 text-[8px] font-black tracking-[0.2em] mb-1 uppercase">Remaining</p>
                 <h2 className="text-4xl md:text-5xl font-mono font-black text-white tracking-tighter tabular-nums leading-none">
                    {formatTime(timeLeft)}
                 </h2>
              </div>
              <div className="flex items-center gap-4 bg-white/5 p-2 px-3 rounded-lg border border-white/5 backdrop-blur-sm">
                  <div className="text-right">
                      <p className="text-[7px] text-zinc-500 font-bold mb-0.5 uppercase tracking-widest">Seat</p>
                      <div className="flex items-center gap-2 text-zinc-200 font-bold text-[10px]">
                          {selectedSeat?.icon} {selectedSeat?.name}
                      </div>
                  </div>
              </div>
            </div>
         </div>
         
         <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/5 rounded-full p-1.5 pr-6 shadow-2xl pointer-events-auto transition-all hover:bg-black/80 max-w-full overflow-x-auto no-scrollbar">
             <div className="flex gap-1 p-1 bg-white/5 rounded-full shrink-0">
                {[
                  {id: 'none', icon: <VolumeX className="w-3.5 h-3.5" />},
                  {id: 'train', icon: <Train className="w-3.5 h-3.5" />},
                  {id: 'rain', icon: <CloudRain className="w-3.5 h-3.5" />},
                  {id: 'waves', icon: <Waves className="w-3.5 h-3.5" />} 
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={(e) => { e.stopPropagation(); setSoundMode(mode.id); soundEngine.playClick(); }}
                    className={`p-2.5 rounded-full transition-all duration-300 shrink-0 cursor-pointer ${soundMode === mode.id ? 'bg-white text-black shadow-lg scale-105' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                  >
                    {mode.icon}
                  </button>
                ))}
             </div>
             <div className="w-px h-6 bg-white/10 mx-2 shrink-0"></div>
             <div className="flex items-center gap-3 shrink-0">
                <Speaker className={`w-3.5 h-3.5 ${volume === 0 ? 'text-zinc-600' : 'text-zinc-400'}`} />
                <input
                  type="range" min="0" max="1" step="0.01"
                  value={volume}
                  onChange={(e) => { e.stopPropagation(); setVolume(parseFloat(e.target.value)); }}
                  className="w-16 md:w-20 h-1 bg-zinc-800 rounded-full appearance-none accent-white cursor-pointer hover:accent-zinc-200"
                />
             </div>
         </div>
      </div>
    </div>
  );
};

const ArrivalScreen = ({ mapCenter, zoom, stations, departure, arrival, resetApp }) => (
    <div className="w-full h-full bg-[#09090b] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none grayscale">
             <MapView center={mapCenter} zoom={zoom} stations={stations} departure={departure} arrival={arrival} resetApp={resetApp} />
        </div>
        <div className="relative z-[100] bg-black/60 backdrop-blur-2xl p-10 rounded-[2rem] border border-white/5 text-center shadow-2xl animate-fade-in-up max-w-sm w-full">
            <div className="w-20 h-20 bg-gradient-to-tr from-white to-zinc-400 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                <Check className="w-10 h-10 text-black" strokeWidth={3} />
            </div>
            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Arrived</h2>
            <p className="text-sm text-zinc-400 mb-10 leading-relaxed">
               {arrival?.name}에 도착했습니다.<br/>성공적인 몰입이 되었기를 바랍니다.
            </p>
            <button onClick={(e) => { e.stopPropagation(); resetApp(); }} className="w-full py-4 bg-white/5 hover:bg-white hover:text-black text-white border border-white/5 rounded-xl font-bold text-xs transition-all uppercase tracking-widest cursor-pointer">
                Return Home
            </button>
        </div>
    </div>
);

/* --- Main App Component --- */
const App = () => {
  const [appState, setAppState] = useState('booking'); 
  const [mapCenter, setMapCenter] = useState({ lat: 36.3, lng: 127.8 });
  const [zoom, setZoom] = useState(8); 
  const [departure, setDeparture] = useState(null);
  const [arrival, setArrival] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0); 
  
  const [radiusKm, setRadiusKm] = useState(0); 
  const [selectedTime, setSelectedTime] = useState(null); 

  const [journeyStartTime, setJourneyStartTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedTime, setPausedTime] = useState(0);
  const [totalPausedDuration, setTotalPausedDuration] = useState(0);

  const [soundMode, setSoundMode] = useState('none');
  const [volume, setVolume] = useState(0.5);
  
  const animationFrameRef = useRef(null);
  const [trainPos, setTrainPos] = useState(null);

  /* --- Firestore Auth & Data --- */
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);

  // Auth Init
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Fetch History
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'history'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by timestamp desc locally
        data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setHistory(data);
    });
    return () => unsubscribe();
  }, [user]);

  // Define seats array
  const seats = [
    { id: 'window', name: '창가 1인석', icon: <Armchair className="w-4 h-4" />, desc: '깊은 몰입에 최적화' },
    { id: 'table', name: '테이블석', icon: <Coffee className="w-4 h-4" />, desc: '자료를 펼쳐보는 작업' },
    { id: 'quiet', name: '정숙 칸', icon: <Battery className="w-4 h-4" />, desc: '소음 없는 정적 집중' },
    { id: 'cafe', name: '라운지 칸', icon: <Wifi className="w-4 h-4" />, desc: '가벼운 아이데이션' },
  ];

  // Define stations
  const stations = useMemo(() => [
    { id: 1, name: '서울역', lat: 37.5547, lng: 126.9707 },
    { id: 2, name: '대전역', lat: 36.3323, lng: 127.4342 },
    { id: 3, name: '동대구역', lat: 35.8762, lng: 128.6273 },
    { id: 4, name: '부산역', lat: 35.1148, lng: 129.0401 },
    { id: 5, name: '강릉역', lat: 37.7635, lng: 128.8988 },
    { id: 6, name: '광주송정역', lat: 35.1375, lng: 126.7915 },
    { id: 7, name: '천안아산역', lat: 36.7944, lng: 127.1042 },
    { id: 8, name: '여수엑스포역', lat: 34.7526, lng: 127.7459 },
    { id: 9, name: '포항역', lat: 36.0720, lng: 129.3400 },
    { id: 10, name: '춘천역', lat: 37.8847, lng: 127.7170 },
  ], []);

  // Calculate journey duration - MOVED UP before saveJourney
  const journeyDurationMinutes = useMemo(() => {
    if (!departure || !arrival) return 0;
    const R = 6371;
    const dLat = deg2rad(arrival.lat - departure.lat);
    const dLng = deg2rad(arrival.lng - departure.lng);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
              Math.cos(deg2rad(departure.lat)) * Math.cos(deg2rad(arrival.lat)) * Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;
    return Math.max(15, Math.round(dist * 0.25));
  }, [departure, arrival]);

  // Save Journey - NOW AFTER journeyDurationMinutes is defined
  const saveJourney = useCallback(async () => {
      if (!user || !departure || !arrival || !selectedSeat) return;
      try {
          await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'history'), {
              departure: departure.name,
              arrival: arrival.name,
              seat: selectedSeat.name,
              duration: journeyDurationMinutes,
              timestamp: serverTimestamp(),
          });
      } catch (e) {
          console.error("Error saving journey:", e);
      }
  }, [user, departure, arrival, selectedSeat, journeyDurationMinutes]);

  useEffect(() => {
    const unlockAudio = () => {
      soundEngine.resume();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
    }
  }, []);

  useEffect(() => {
    if (appState === 'journey' && !isPaused) {
        soundEngine.play(soundMode);
    } else {
        soundEngine.stop();
    }
  }, [soundMode, appState, isPaused]);

  useEffect(() => {
    soundEngine.setVolume(volume);
  }, [volume]);

  const animate = useCallback(() => {
    if (isPaused || !journeyStartTime) return;

    const now = Date.now();
    const totalDurationMs = journeyDurationMinutes * 60 * 1000;
    const elapsed = now - journeyStartTime - totalPausedDuration;
    const progress = Math.max(0, Math.min(1, elapsed / totalDurationMs));

    const remainingSec = Math.max(0, Math.ceil((totalDurationMs - elapsed) / 1000));
    setTimeLeft(remainingSec);

    if (departure && arrival) {
      const newLat = departure.lat + (arrival.lat - departure.lat) * progress;
      const newLng = departure.lng + (arrival.lng - departure.lng) * progress;
      const newPos = { lat: newLat, lng: newLng };
      
      setTrainPos(newPos);
    }

    if (progress >= 1) {
      setAppState('arrival');
      saveJourney(); // Save history when arrived
      soundEngine.stop();
    } else {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [journeyStartTime, totalPausedDuration, isPaused, journeyDurationMinutes, departure, arrival, saveJourney]);

  useEffect(() => {
    if (appState === 'journey' && !isPaused) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [appState, isPaused, animate]);

  const togglePause = () => {
    if (isPaused) {
      const now = Date.now();
      setTotalPausedDuration(prev => prev + (now - pausedTime));
      setIsPaused(false);
    } else {
      setPausedTime(Date.now());
      setIsPaused(true);
      soundEngine.stop();
    }
    soundEngine.playClick();
  };

  const handleStationSelect = (station) => {
    soundEngine.playClick();
    if (!departure) {
      setDeparture(station);
      setMapCenter({ lat: station.lat, lng: station.lng });
      setZoom(8);
    } else if (radiusKm > 0) {
      const dist = getDistanceFromLatLonInKm(departure.lat, departure.lng, station.lat, station.lng);
      if (dist <= radiusKm && station.id !== departure.id) {
          setArrival(station);
      }
    }
  };

  const startJourney = async () => {
    if (!departure || !arrival || !selectedSeat) return;
    soundEngine.playClick();
    setJourneyStartTime(Date.now());
    setTotalPausedDuration(0);
    setTrainPos(departure);
    setZoom(13);
    setAppState('journey');
    soundEngine.init();
    await soundEngine.play(soundMode);
  };

  const resetSelection = () => {
    soundEngine.playClick();
    setDeparture(null);
    setArrival(null);
    setRadiusKm(0);
    setSelectedTime(null);
    setMapCenter({ lat: 36.3, lng: 127.8 });
    setZoom(8);
  };

  const resetApp = () => {
    soundEngine.playClick();
    setAppState('booking');
    resetSelection();
    setSelectedSeat(null);
    setIsPaused(false);
    setSoundMode('none');
    soundEngine.stop();
  };

  return (
    <div className="w-full h-screen bg-[#09090b] text-zinc-200 font-sans overflow-hidden select-none">
       {appState === 'booking' && (
         <BookingScreen 
           mapCenter={mapCenter} zoom={zoom} stations={stations} 
           departure={departure} arrival={arrival} 
           onStationSelect={handleStationSelect} 
           setMapCenter={setMapCenter} setZoom={setZoom} 
           resetSelection={resetSelection} setAppState={setAppState}
           setRadiusKm={setRadiusKm} radiusKm={radiusKm}
           setSelectedTime={setSelectedTime} selectedTime={selectedTime}
           journeyDurationMinutes={journeyDurationMinutes} 
           setArrival={setArrival} 
         />
       )}
       {appState === 'seat' && (
         <SeatScreen 
            mapCenter={mapCenter} zoom={zoom} stations={stations} 
            departure={departure} arrival={arrival} 
            seats={seats} selectedSeat={selectedSeat} setSelectedSeat={setSelectedSeat}
            setAppState={setAppState} journeyDurationMinutes={journeyDurationMinutes}
         />
       )}
       {appState === 'ticket' && (
         <TicketScreen 
            departure={departure} arrival={arrival} selectedSeat={selectedSeat}
            journeyDurationMinutes={journeyDurationMinutes} startJourney={startJourney}
         />
       )}
       {appState === 'journey' && (
         <JourneyScreen 
            mapCenter={mapCenter} zoom={zoom} stations={stations}
            departure={departure} arrival={arrival} trainPos={trainPos}
            setZoom={setZoom} isPaused={isPaused} togglePause={togglePause} resetApp={resetApp}
            journeyDurationMinutes={journeyDurationMinutes} timeLeft={timeLeft}
            selectedSeat={selectedSeat} soundMode={soundMode} setSoundMode={setSoundMode}
            volume={volume} setVolume={setVolume}
         />
       )}
       {appState === 'arrival' && (
         <ArrivalScreen 
            mapCenter={mapCenter} zoom={zoom} stations={stations} 
            departure={departure} arrival={arrival} resetApp={resetApp}
         />
       )}
       {appState === 'history' && (
         <HistoryScreen history={history} setAppState={setAppState} />
       )}
       <style>{`
         .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
         .animate-fade-in-up { animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
         .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
         .no-scrollbar::-webkit-scrollbar { display: none; }
         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
         @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
         @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
         @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
       `}</style>
    </div>
  );
};

export default App;