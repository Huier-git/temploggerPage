import React, { useState, useRef, useEffect } from 'react';
import { TemperatureReading, ChannelConfig } from '../types';
import { formatTemperature } from '../utils/temperatureProcessor';
import { Thermometer, Move, RotateCcw, Eye, EyeOff, MousePointer } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface SensorPosition {
  channelId: number;
  x: number; // 0-100 percentage from left
  y: number; // 0-100 percentage from top
}

interface DrillVisualizationProps {
  readings: TemperatureReading[];
  channels: ChannelConfig[];
  language: 'zh' | 'en';
  hoverTemperatures?: { [channelId: number]: number } | null; // 新增：来自图表悬停的温度数据
}

export default function DrillVisualization({ 
  readings, 
  channels, 
  language, 
  hoverTemperatures 
}: DrillVisualizationProps) {
  const { t } = useTranslation(language);
  
  // 获取启用的通道数量
  const enabledChannels = channels.filter(channel => channel.enabled);
  const enabledChannelCount = enabledChannels.length;
  
  const [sensorPositions, setSensorPositions] = useState<SensorPosition[]>(() =>
    // 根据启用的通道数量优化传感器分布
    enabledChannels.map((channel, index) => {
      const totalRange = 90; // 5% to 95% = 90% space
      const spacing = enabledChannelCount > 1 ? totalRange / (enabledChannelCount - 1) : 0;
      const yPosition = enabledChannelCount === 1 ? 50 : 5 + (index * spacing);
      
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
  const [useHoverData, setUseHoverData] = useState(false); // 新增：是否使用悬停数据
  const drillRef = useRef<HTMLDivElement>(null);

  // 当启用通道变化时，重新计算传感器位置
  useEffect(() => {
    const newEnabledChannels = channels.filter(channel => channel.enabled);
    const newCount = newEnabledChannels.length;
    
    if (newCount !== enabledChannelCount) {
      // 重新分布传感器位置
      const newPositions = newEnabledChannels.map((channel, index) => {
        const totalRange = 90;
        const spacing = newCount > 1 ? totalRange / (newCount - 1) : 0;
        const yPosition = newCount === 1 ? 50 : 5 + (index * spacing);
        
        // 保留已存在传感器的位置，新增的使用默认位置
        const existingPosition = sensorPositions.find(pos => pos.channelId === channel.id);
        
        return existingPosition || {
          channelId: channel.id,
          x: 50,
          y: Math.min(95, yPosition)
        };
      });
      
      setSensorPositions(newPositions);
    }
  }, [channels]);

  // Get latest temperature data or hover data
  const getTemperature = (channelId: number): number | null => {
    // 如果启用了悬停数据模式且有悬停数据，优先使用悬停数据
    if (useHoverData && hoverTemperatures && hoverTemperatures[channelId] !== undefined) {
      return hoverTemperatures[channelId];
    }
    
    // 否则使用最新的实际数据
    const channelReadings = readings
      .filter(r => r.channel === channelId)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return channelReadings.length > 0 ? channelReadings[0].temperature : null;
  };

  // Calculate temperature range for color mapping
  const getTemperatureRange = () => {
    const temperatures = enabledChannels
      .map(channel => getTemperature(channel.id))
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

  // Enhanced temperature to color mapping with improved gradient
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

  // Enhanced temperature gradient calculation with horizontal temperature differences
  const getIntersectingTemperatures = () => {
    const intersectingTemps: Array<{ 
      y: number; 
      x: number; 
      temperature: number; 
      color: string;
      weight: number;
    }> = [];
    
    sensorPositions.forEach(sensorPos => {
      const channel = enabledChannels.find(ch => ch.id === sensorPos.channelId);
      if (!channel || !channel.enabled) return;
      
      if (isSensorIntersectingDrill(sensorPos)) {
        const temperature = getTemperature(channel.id);
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

  // Enhanced gradient generation with horizontal temperature interpolation
  const generateDrillGradient = (intersectingTemperatures: any[], gradientId: string) => {
    if (intersectingTemperatures.length === 0) {
      return (
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{stopColor:'#c0c0c0', stopOpacity: 0.3}}/>
          <stop offset="100%" style={{stopColor:'#a0a0a0', stopOpacity: 0.3}}/>
        </linearGradient>
      );
    }

    // Sort by Y position and create interpolated gradient
    const sortedTemps = [...intersectingTemperatures].sort((a, b) => a.y - b.y);
    
    // Create gradient stops with horizontal temperature consideration
    const gradientStops = [];
    
    for (let i = 0; i < sortedTemps.length; i++) {
      const temp = sortedTemps[i];
      const offset = `${temp.y}%`;
      
      // Consider horizontal temperature differences for color blending
      let blendedColor = temp.color;
      
      // If there are nearby sensors horizontally, blend their colors
      const nearbyHorizontal = sortedTemps.filter(t => 
        Math.abs(t.y - temp.y) < 10 && Math.abs(t.x - temp.x) > 5
      );
      
      if (nearbyHorizontal.length > 0) {
        // Blend colors based on horizontal temperature differences
        const avgTemp = (temp.temperature + nearbyHorizontal.reduce((sum, t) => sum + t.temperature, 0)) / (nearbyHorizontal.length + 1);
        blendedColor = temperatureToColor(avgTemp);
      }
      
      gradientStops.push(
        <stop 
          key={i} 
          offset={offset} 
          style={{
            stopColor: blendedColor, 
            stopOpacity: temp.weight * 0.8
          }}
        />
      );
    }
    
    return (
      <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
        {gradientStops}
      </linearGradient>
    );
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

  // Reset sensor positions to optimal distribution based on current enabled channels
  const resetPositions = () => {
    const currentEnabledChannels = channels.filter(channel => channel.enabled);
    const count = currentEnabledChannels.length;
    
    setSensorPositions(currentEnabledChannels.map((channel, index) => {
      const totalRange = 90;
      const spacing = count > 1 ? totalRange / (count - 1) : 0;
      const yPosition = count === 1 ? 50 : 5 + (index * spacing);
      
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

  const intersectingTemperatures = getIntersectingTemperatures();

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 h-[600px] flex flex-col">
      {/* Compact header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Thermometer className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-bold text-white">{t('drillTemperatureDistribution')}</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 新增：图表悬停数据开关 */}
          <button
            onClick={() => setUseHoverData(!useHoverData)}
            className={`flex items-center gap-1 p-1.5 rounded transition-colors ${
              useHoverData 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title={useHoverData 
              ? (language === 'zh' ? '使用图表悬停数据' : 'Using chart hover data')
              : (language === 'zh' ? '使用实时数据' : 'Using real-time data')
            }
          >
            <MousePointer className="w-4 h-4" />
            {useHoverData && (
              <div className="w-2 h-2 bg-blue-300 rounded-full animate-pulse"></div>
            )}
          </button>
          
          <button
            onClick={() => setShowTemperatureScale(!showTemperatureScale)}
            className="p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            title={showTemperatureScale ? t('hideTemperatureScale') : t('showTemperatureScale')}
          >
            {showTemperatureScale ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setCompactMode(!compactMode)}
            className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors"
          >
            {compactMode ? t('detailed') : t('compact')}
          </button>
          
          <button
            onClick={resetPositions}
            className="flex items-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            {t('reset')}
          </button>
        </div>
      </div>

      {/* Instructions moved below title */}
      <div className="mb-3 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <Move className="w-3 h-3" />
          <span>{t('dragToAdjustPosition')}</span>
          {useHoverData && (
            <>
              <span>•</span>
              <MousePointer className="w-3 h-3" />
              <span>{language === 'zh' ? '使用图表悬停温度' : 'Using chart hover temperatures'}</span>
            </>
          )}
        </div>
      </div>

      {/* 悬停数据状态提示 */}
      {useHoverData && (
        <div className="mb-2 p-2 bg-blue-900 border border-blue-700 rounded-lg">
          <div className="flex items-center gap-2 text-xs">
            <MousePointer className="w-3 h-3 text-blue-400" />
            <span className="text-blue-300">
              {hoverTemperatures 
                ? (language === 'zh' 
                    ? `显示图表悬停数据 (${Object.keys(hoverTemperatures).length} 个通道)`
                    : `Showing chart hover data (${Object.keys(hoverTemperatures).length} channels)`
                  )
                : (language === 'zh' 
                    ? '将鼠标悬停在温度图表上查看对应温度分布'
                    : 'Hover over temperature chart to see corresponding temperature distribution'
                  )
              }
            </span>
          </div>
        </div>
      )}

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

                  {/* Enhanced dynamic temperature gradients with horizontal consideration */}
                  {generateDrillGradient(intersectingTemperatures, 'temperatureGradient')}
                  {generateDrillGradient(
                    intersectingTemperatures.filter(temp => temp.y >= 85), 
                    'drillBitTemperatureGradient'
                  )}
                </defs>
                
                {/* Main drill body */}
                <rect x="75" y="20" width="50" height="320" 
                      fill="url(#pipeGradient)" 
                      stroke="#666" 
                      strokeWidth="2"/>
                
                {/* Enhanced temperature overlay */}
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
                
                {/* Enhanced drill bit temperature overlay */}
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
                const channel = enabledChannels.find(ch => ch.id === sensorPos.channelId);
                if (!channel || !channel.enabled) return null;
                
                const temperature = getTemperature(channel.id);
                const color = temperatureToColor(temperature);
                const isIntersecting = isSensorIntersectingDrill(sensorPos);
                const isHoverData = useHoverData && hoverTemperatures && hoverTemperatures[channel.id] !== undefined;
                
                return (
                  <div
                    key={sensorPos.channelId}
                    className={`absolute rounded-full border-2 shadow-lg cursor-move transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center font-bold text-white transition-all ${
                      draggedSensor === sensorPos.channelId ? 'scale-125 z-10' : 'hover:scale-110'
                    } ${isIntersecting ? 'border-white' : 'border-gray-400'} ${
                      compactMode ? 'w-4 h-4 text-xs' : 'w-5 h-5 text-xs'
                    } ${isHoverData ? 'ring-2 ring-blue-400' : ''}`}
                    style={{
                      backgroundColor: color,
                      left: `${sensorPos.x}%`,
                      top: `${sensorPos.y}%`,
                      transition: draggedSensor === sensorPos.channelId ? 'none' : 'all 0.2s ease',
                      boxShadow: isIntersecting 
                        ? '0 0 8px rgba(255,255,255,0.5)' 
                        : isHoverData 
                          ? '0 0 8px rgba(59,130,246,0.5)'
                          : '0 2px 4px rgba(0,0,0,0.3)',
                      fontSize: compactMode ? '8px' : '10px',
                      minWidth: '16px',
                      minHeight: '16px'
                    }}
                    onMouseDown={(e) => handleMouseDown(sensorPos.channelId, e)}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      setDraggedSensor(sensorPos.channelId);
                    }}
                    title={`${language === 'zh' ? '传感器' : 'Sensor'} ${channel.id}: ${temperature !== null ? formatTemperature(temperature) : (language === 'zh' ? '无数据' : 'No Data')}${isIntersecting ? ` (${t('affectsDrillColor')})` : ''}${isHoverData ? ` (${language === 'zh' ? '图表悬停数据' : 'Chart hover data'})` : ''}`}
                  >
                    {channel.id}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar - responsive width */}
        <div className={`flex flex-col gap-3 ${compactMode ? 'w-32' : 'w-40'}`}>
          {/* Temperature scale */}
          {showTemperatureScale && (
            <div className="bg-gray-700 rounded-lg p-3">
              <h4 className={`font-semibold text-white mb-2 text-center ${compactMode ? 'text-xs' : 'text-sm'}`}>
                {t('temperatureRange')}
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
                  {t('affecting')}: {intersectingTemperatures.length}/{enabledChannels.length}
                </div>
                {useHoverData && (
                  <div className={`text-blue-400 ${compactMode ? 'text-xs' : 'text-xs'}`}>
                    {language === 'zh' ? '悬停模式' : 'Hover Mode'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sensor status - scrollable */}
          <div className="bg-gray-700 rounded-lg p-3 flex-1 min-h-0">
            <h4 className={`font-semibold text-white mb-2 ${compactMode ? 'text-xs' : 'text-sm'}`}>
              {t('sensorStatus')}
            </h4>
            
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {enabledChannels.map(channel => {
                const sensorPos = sensorPositions.find(pos => pos.channelId === channel.id);
                const temperature = getTemperature(channel.id);
                const color = temperatureToColor(temperature);
                const isIntersecting = sensorPos ? isSensorIntersectingDrill(sensorPos) : false;
                const isHoverData = useHoverData && hoverTemperatures && hoverTemperatures[channel.id] !== undefined;
                
                return (
                  <div key={channel.id} className="flex items-center gap-2">
                    <div
                      className={`rounded-full border flex items-center justify-center font-bold text-white flex-shrink-0 ${
                        isIntersecting ? 'border-white' : 'border-gray-400'
                      } ${compactMode ? 'w-3 h-3 text-xs' : 'w-3 h-3 text-xs'} ${
                        isHoverData ? 'ring-1 ring-blue-400' : ''
                      }`}
                      style={{ 
                        backgroundColor: color,
                        boxShadow: isIntersecting 
                          ? '0 0 4px rgba(255,255,255,0.5)' 
                          : isHoverData 
                            ? '0 0 4px rgba(59,130,246,0.5)'
                            : 'none',
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
                        {isHoverData && <span className="text-blue-400 ml-1">*</span>}
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