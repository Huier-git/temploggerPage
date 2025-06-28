import React, { useState, useRef, useEffect } from 'react';
import { TemperatureReading, ChannelConfig } from '../types';
import { formatTemperature } from '../utils/temperatureProcessor';
import { Thermometer, Move, RotateCcw, Eye, EyeOff } from 'lucide-react';

interface SensorPosition {
  channelId: number;
  x: number; // 0-100 percentage from left
  y: number; // 0-100 percentage from top
}

interface DrillVisualizationProps {
  readings: TemperatureReading[];
  channels: ChannelConfig[];
}

export default function DrillVisualization({ readings, channels }: DrillVisualizationProps) {
  const [sensorPositions, setSensorPositions] = useState<SensorPosition[]>(() =>
    // Optimized sensor distribution: evenly spaced across drill string and bit
    channels.map((channel, index) => {
      const totalRange = 90; // 5% to 95% = 90% space
      const spacing = totalRange / (channels.length - 1);
      const yPosition = 5 + (index * spacing);
      
      return {
        channelId: channel.id,
        x: 50, // Center all sensors on drill string
        y: Math.min(95, yPosition)
      };
    })
  );
  
  const [draggedSensor, setDraggedSensor] = useState<number | null>(null);
  const [showTemperatureScale, setShowTemperatureScale] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const drillRef = useRef<HTMLDivElement>(null);

  // Get latest temperature data
  const getLatestTemperature = (channelId: number): number | null => {
    const channelReadings = readings
      .filter(r => r.channel === channelId)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return channelReadings.length > 0 ? channelReadings[0].temperature : null;
  };

  // Calculate temperature range for color mapping
  const getTemperatureRange = () => {
    const temperatures = channels
      .map(channel => getLatestTemperature(channel.id))
      .filter(temp => temp !== null) as number[];
    
    if (temperatures.length === 0) return { min: 0, max: 50 };
    
    const min = Math.min(...temperatures);
    const max = Math.max(...temperatures);
    const range = max - min;
    
    return {
      min: min - range * 0.1,
      max: max + range * 0.1
    };
  };

  // Temperature to color mapping with improved gradient
  const temperatureToColor = (temperature: number | null): string => {
    if (temperature === null) return '#6B7280';
    
    const { min, max } = getTemperatureRange();
    const normalized = Math.max(0, Math.min(1, (temperature - min) / (max - min)));
    
    // Enhanced color gradient: blue -> cyan -> green -> yellow -> orange -> red
    if (normalized < 0.2) {
      const t = normalized / 0.2;
      return `rgb(${Math.round(0 + t * 0)}, ${Math.round(100 + t * 155)}, ${Math.round(255 - t * 55)})`;
    } else if (normalized < 0.4) {
      const t = (normalized - 0.2) / 0.2;
      return `rgb(${Math.round(0 + t * 0)}, ${Math.round(255 - t * 55)}, ${Math.round(200 - t * 200)})`;
    } else if (normalized < 0.6) {
      const t = (normalized - 0.4) / 0.2;
      return `rgb(${Math.round(0 + t * 255)}, ${Math.round(200 + t * 55)}, ${Math.round(0)})`;
    } else if (normalized < 0.8) {
      const t = (normalized - 0.6) / 0.2;
      return `rgb(${Math.round(255)}, ${Math.round(255 - t * 100)}, ${Math.round(0)})`;
    } else {
      const t = (normalized - 0.8) / 0.2;
      return `rgb(${Math.round(255)}, ${Math.round(155 - t * 155)}, ${Math.round(0)})`;
    }
  };

  // Check if sensor intersects with drill string (including bit)
  const isSensorIntersectingDrill = (sensorPos: SensorPosition): boolean => {
    // Main body: x: 37.5%-62.5%, y: 5%-85%
    // Drill bit: x: 32.5%-67.5%, y: 85%-96.25%
    
    const mainBodyLeft = 37.5;
    const mainBodyRight = 62.5;
    const mainBodyTop = 5;
    const mainBodyBottom = 85;
    
    const drillBitLeft = 32.5;
    const drillBitRight = 67.5;
    const drillBitTop = 85;
    const drillBitBottom = 96.25;
    
    const inMainBody = sensorPos.x >= mainBodyLeft && 
                      sensorPos.x <= mainBodyRight && 
                      sensorPos.y >= mainBodyTop && 
                      sensorPos.y <= mainBodyBottom;
    
    const inDrillBit = sensorPos.x >= drillBitLeft && 
                       sensorPos.x <= drillBitRight && 
                       sensorPos.y >= drillBitTop && 
                       sensorPos.y <= drillBitBottom;
    
    return inMainBody || inDrillBit;
  };

  // Get intersecting temperatures for drill string coloring
  const getIntersectingTemperatures = () => {
    const intersectingTemps: Array<{ 
      y: number; 
      x: number; 
      temperature: number; 
      color: string;
      weight: number;
    }> = [];
    
    sensorPositions.forEach(sensorPos => {
      const channel = channels.find(ch => ch.id === sensorPos.channelId);
      if (!channel || !channel.enabled) return;
      
      if (isSensorIntersectingDrill(sensorPos)) {
        const temperature = getLatestTemperature(channel.id);
        if (temperature !== null) {
          const centerX = 50;
          const distanceFromCenter = Math.abs(sensorPos.x - centerX);
          const weight = Math.max(0.1, 1 - (distanceFromCenter / 25));
          
          intersectingTemps.push({
            y: sensorPos.y,
            x: sensorPos.x,
            temperature,
            color: temperatureToColor(temperature),
            weight
          });
        }
      }
    });
    
    return intersectingTemps.sort((a, b) => a.y - b.y);
  };

  // Handle sensor dragging
  const handleMouseDown = (channelId: number, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggedSensor(channelId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedSensor === null || !drillRef.current) return;
    
    const rect = drillRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;
    const percentageX = Math.max(5, Math.min(95, (relativeX / rect.width) * 100));
    const percentageY = Math.max(2, Math.min(98, (relativeY / rect.height) * 100));
    
    setSensorPositions(prev => prev.map(pos =>
      pos.channelId === draggedSensor
        ? { ...pos, x: percentageX, y: percentageY }
        : pos
    ));
  };

  const handleMouseUp = () => {
    setDraggedSensor(null);
  };

  // Reset sensor positions to optimal distribution
  const resetPositions = () => {
    setSensorPositions(channels.map((channel, index) => {
      const totalRange = 90;
      const spacing = totalRange / (channels.length - 1);
      const yPosition = 5 + (index * spacing);
      
      return {
        channelId: channel.id,
        x: 50,
        y: Math.min(95, yPosition)
      };
    }));
  };

  // Generate temperature scale
  const generateTemperatureScale = () => {
    const { min, max } = getTemperatureRange();
    const steps = compactMode ? 3 : 5;
    const stepSize = (max - min) / steps;
    
    return Array.from({ length: steps + 1 }, (_, i) => ({
      value: min + i * stepSize,
      position: (i / steps) * 100
    }));
  };

  // Global mouse event handlers
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggedSensor === null || !drillRef.current) return;
      
      const rect = drillRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top;
      const percentageX = Math.max(5, Math.min(95, (relativeX / rect.width) * 100));
      const percentageY = Math.max(2, Math.min(98, (relativeY / rect.height) * 100));
      
      setSensorPositions(prev => prev.map(pos =>
        pos.channelId === draggedSensor
          ? { ...pos, x: percentageX, y: percentageY }
          : pos
      ));
    };

    const handleGlobalMouseUp = () => {
      setDraggedSensor(null);
    };

    if (draggedSensor !== null) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggedSensor]);

  const enabledChannels = channels.filter(channel => channel.enabled);
  const intersectingTemperatures = getIntersectingTemperatures();

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 h-[600px] flex flex-col">
      {/* Compact header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Thermometer className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-bold text-white">钻具温度分布</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemperatureScale(!showTemperatureScale)}
            className="p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            title={showTemperatureScale ? '隐藏温度条' : '显示温度条'}
          >
            {showTemperatureScale ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setCompactMode(!compactMode)}
            className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors"
          >
            {compactMode ? '详细' : '紧凑'}
          </button>
          
          <button
            onClick={resetPositions}
            className="flex items-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            重置
          </button>
        </div>
      </div>

      {/* Main content - responsive layout */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Drill visualization - takes most space */}
        <div className="flex-1 flex flex-col items-center">
          <div className="relative w-full max-w-xs h-full">
            {/* Drill string SVG */}
            <div
              ref={drillRef}
              className="relative cursor-crosshair w-full h-full"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{ userSelect: 'none', minHeight: '300px' }}
            >
              <svg viewBox="0 0 200 400" className="w-full h-full">
                <defs>
                  {/* Enhanced gradients */}
                  <linearGradient id="pipeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{stopColor:'#c0c0c0'}}/>
                    <stop offset="50%" style={{stopColor:'#f0f0f0'}}/>
                    <stop offset="100%" style={{stopColor:'#a0a0a0'}}/>
                  </linearGradient>
                  
                  <linearGradient id="bladeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#888'}}/>
                    <stop offset="50%" style={{stopColor:'#bbb'}}/>
                    <stop offset="100%" style={{stopColor:'#666'}}/>
                  </linearGradient>
                  
                  <linearGradient id="drillBitGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{stopColor:'#555'}}/>
                    <stop offset="50%" style={{stopColor:'#888'}}/>
                    <stop offset="100%" style={{stopColor:'#333'}}/>
                  </linearGradient>

                  {/* Dynamic temperature gradients */}
                  <linearGradient id="temperatureGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    {intersectingTemperatures.length > 0 ? (
                      intersectingTemperatures.map((temp, index) => (
                        <stop 
                          key={index} 
                          offset={`${temp.y}%`} 
                          style={{
                            stopColor: temp.color, 
                            stopOpacity: temp.weight * 0.8
                          }}
                        />
                      ))
                    ) : (
                      <>
                        <stop offset="0%" style={{stopColor:'#c0c0c0', stopOpacity: 0.3}}/>
                        <stop offset="100%" style={{stopColor:'#a0a0a0', stopOpacity: 0.3}}/>
                      </>
                    )}
                  </linearGradient>

                  <linearGradient id="drillBitTemperatureGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    {intersectingTemperatures.filter(temp => temp.y >= 85).length > 0 ? (
                      intersectingTemperatures
                        .filter(temp => temp.y >= 85)
                        .map((temp, index) => (
                          <stop 
                            key={index} 
                            offset={`${((temp.y - 85) / (96.25 - 85)) * 100}%`} 
                            style={{
                              stopColor: temp.color, 
                              stopOpacity: temp.weight * 0.8
                            }}
                          />
                        ))
                    ) : (
                      <>
                        <stop offset="0%" style={{stopColor:'#555', stopOpacity: 0.3}}/>
                        <stop offset="100%" style={{stopColor:'#333', stopOpacity: 0.3}}/>
                      </>
                    )}
                  </linearGradient>
                </defs>
                
                {/* Main drill body */}
                <rect x="75" y="20" width="50" height="320" 
                      fill="url(#pipeGradient)" 
                      stroke="#666" 
                      strokeWidth="2"/>
                
                {/* Temperature overlay */}
                {intersectingTemperatures.length > 0 && (
                  <rect x="75" y="20" width="50" height="320" 
                        fill="url(#temperatureGradient)" 
                        stroke="none"/>
                )}
                
                {/* Spiral blades - simplified for performance */}
                <g id="leftBlades">
                  {Array.from({ length: 8 }, (_, i) => (
                    <path key={i} d={`M 75 ${40 + i * 40} Q 65 ${42 + i * 40} 60 ${45 + i * 40} L 65 ${50 + i * 40} Q 70 ${47 + i * 40} 75 ${50 + i * 40}`} 
                          fill="url(#bladeGradient)" stroke="#444" strokeWidth="1"/>
                  ))}
                </g>
                
                <g id="rightBlades">
                  {Array.from({ length: 8 }, (_, i) => (
                    <path key={i} d={`M 125 ${50 + i * 40} Q 135 ${47 + i * 40} 140 ${50 + i * 40} L 135 ${55 + i * 40} Q 130 ${52 + i * 40} 125 ${55 + i * 40}`} 
                          fill="url(#bladeGradient)" stroke="#444" strokeWidth="1"/>
                  ))}
                </g>
                
                {/* Thread lines - reduced for performance */}
                <g id="threadLines" stroke="#999" strokeWidth="0.5" opacity="0.6">
                  {Array.from({ length: 8 }, (_, i) => (
                    <line key={i} x1="75" y1={35 + i * 40} x2="125" y2={35 + i * 40}/>
                  ))}
                </g>
                
                {/* Drill bit */}
                <rect x="65" y="340" width="70" height="20" 
                      fill="url(#drillBitGradient)" 
                      stroke="#333" 
                      strokeWidth="2"/>
                
                {/* Drill bit temperature overlay */}
                {intersectingTemperatures.filter(temp => temp.y >= 85).length > 0 && (
                  <rect x="65" y="340" width="70" height="20" 
                        fill="url(#drillBitTemperatureGradient)" 
                        stroke="none"/>
                )}
                
                {/* Cutting edges */}
                <polygon points="75,360 85,365 100,367 115,365 125,360 100,363" 
                         fill="#555" stroke="#222" strokeWidth="1"/>
                
                {/* Drill tip */}
                <polygon points="85,365 95,375 100,378 105,375 115,365 100,370" 
                         fill="#444" stroke="#111" strokeWidth="1"/>
                
                {/* Center point */}
                <polygon points="95,375 100,385 105,375 100,378" 
                         fill="#222" stroke="#000" strokeWidth="1"/>
                
                {/* Center line */}
                <line x1="100" y1="20" x2="100" y2="385" 
                      stroke="#ddd" strokeWidth="1" strokeDasharray="5,5" opacity="0.5"/>
              </svg>
              
              {/* Sensor positions - optimized for touch */}
              {sensorPositions.map(sensorPos => {
                const channel = channels.find(ch => ch.id === sensorPos.channelId);
                if (!channel || !channel.enabled) return null;
                
                const temperature = getLatestTemperature(channel.id);
                const color = temperatureToColor(temperature);
                const isIntersecting = isSensorIntersectingDrill(sensorPos);
                
                return (
                  <div
                    key={sensorPos.channelId}
                    className={`absolute rounded-full border-2 shadow-lg cursor-move transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center font-bold text-white transition-all ${
                      draggedSensor === sensorPos.channelId ? 'scale-125 z-10' : 'hover:scale-110'
                    } ${isIntersecting ? 'border-white' : 'border-gray-400'} ${
                      compactMode ? 'w-4 h-4 text-xs' : 'w-5 h-5 text-xs'
                    }`}
                    style={{
                      backgroundColor: color,
                      left: `${sensorPos.x}%`,
                      top: `${sensorPos.y}%`,
                      transition: draggedSensor === sensorPos.channelId ? 'none' : 'all 0.2s ease',
                      boxShadow: isIntersecting ? '0 0 8px rgba(255,255,255,0.5)' : '0 2px 4px rgba(0,0,0,0.3)',
                      fontSize: compactMode ? '8px' : '10px',
                      minWidth: '16px',
                      minHeight: '16px'
                    }}
                    onMouseDown={(e) => handleMouseDown(sensorPos.channelId, e)}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      setDraggedSensor(sensorPos.channelId);
                    }}
                    title={`传感器 ${channel.id}: ${temperature !== null ? formatTemperature(temperature) : '无数据'}${isIntersecting ? ' (影响钻具颜色)' : ''}`}
                  >
                    {channel.id}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Instructions - compact */}
          <div className="mt-2 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <Move className="w-3 h-3" />
              <span>拖拽调整位置 • 相交影响颜色</span>
            </div>
          </div>
        </div>

        {/* Sidebar - responsive width */}
        <div className={`flex flex-col gap-3 ${compactMode ? 'w-32' : 'w-40'}`}>
          {/* Temperature scale */}
          {showTemperatureScale && (
            <div className="bg-gray-700 rounded-lg p-3">
              <h4 className={`font-semibold text-white mb-2 text-center ${compactMode ? 'text-xs' : 'text-sm'}`}>
                温度范围
              </h4>
              
              <div className="flex justify-center">
                <div className={`relative rounded ${compactMode ? 'h-16 w-3' : 'h-20 w-4'}`}>
                  <div
                    className="absolute inset-0 rounded"
                    style={{
                      background: 'linear-gradient(to top, rgb(0,100,255), rgb(0,255,200), rgb(0,255,0), rgb(255,255,0), rgb(255,155,0), rgb(255,0,0))'
                    }}
                  ></div>
                  
                  {/* Temperature scale marks */}
                  {generateTemperatureScale().map((scale, index) => (
                    <div
                      key={index}
                      className={`absolute text-gray-300 transform -translate-y-1/2 ${compactMode ? 'text-xs' : 'text-xs'}`}
                      style={{ 
                        top: `${100 - scale.position}%`,
                        right: '100%',
                        marginRight: '0.25rem',
                        fontSize: compactMode ? '8px' : '9px'
                      }}
                    >
                      {scale.value.toFixed(0)}°
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Statistics */}
              <div className="text-center mt-2">
                <div className={`text-gray-400 ${compactMode ? 'text-xs' : 'text-xs'}`}>
                  影响: {intersectingTemperatures.length}/{enabledChannels.length}
                </div>
              </div>
            </div>
          )}

          {/* Sensor status - scrollable */}
          <div className="bg-gray-700 rounded-lg p-3 flex-1 min-h-0">
            <h4 className={`font-semibold text-white mb-2 ${compactMode ? 'text-xs' : 'text-sm'}`}>
              传感器状态
            </h4>
            
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {enabledChannels.map(channel => {
                const sensorPos = sensorPositions.find(pos => pos.channelId === channel.id);
                const temperature = getLatestTemperature(channel.id);
                const color = temperatureToColor(temperature);
                const isIntersecting = sensorPos ? isSensorIntersectingDrill(sensorPos) : false;
                
                return (
                  <div key={channel.id} className="flex items-center gap-2">
                    <div
                      className={`rounded-full border flex items-center justify-center font-bold text-white flex-shrink-0 ${
                        isIntersecting ? 'border-white' : 'border-gray-400'
                      } ${compactMode ? 'w-3 h-3 text-xs' : 'w-3 h-3 text-xs'}`}
                      style={{ 
                        backgroundColor: color,
                        boxShadow: isIntersecting ? '0 0 4px rgba(255,255,255,0.5)' : 'none',
                        fontSize: '7px',
                        minWidth: '12px',
                        minHeight: '12px'
                      }}
                    >
                      {channel.id}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className={`text-gray-300 ${compactMode ? 'text-xs' : 'text-xs'}`}>
                        Ch{channel.id}
                      </div>
                      {!compactMode && (
                        <div className="text-xs text-gray-400 truncate">
                          {temperature !== null ? formatTemperature(temperature) : '--'}
                        </div>
                      )}
                    </div>
                    
                    <div className={`px-1 py-0.5 rounded flex-shrink-0 ${
                      isIntersecting 
                        ? 'bg-green-900 text-green-300' 
                        : 'bg-gray-600 text-gray-400'
                    }`} style={{ fontSize: compactMode ? '7px' : '8px' }}>
                      {isIntersecting ? '✓' : '○'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}