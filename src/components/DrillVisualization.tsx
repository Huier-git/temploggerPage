import React, { useState, useRef, useEffect } from 'react';
import { TemperatureReading, ChannelConfig } from '../types';
import { formatTemperature } from '../utils/temperatureProcessor';
import { Thermometer, Move, RotateCcw, Eye, EyeOff, MousePointer, Zap, Save, Upload, Download, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface SensorPosition {
  channelId: number;
  x: number;
  y: number;
}

interface SensorPreset {
  name: string;
  description: string;
  positions: SensorPosition[];
  channelCount: number;
  createdAt: string;
  version: string;
}

interface DrillVisualizationProps {
  readings: TemperatureReading[];
  channels: ChannelConfig[];
  language: 'zh' | 'en';
  hoverTemperatures?: { [channelId: number]: number } | null;
  isDarkMode: boolean;
}

export default function DrillVisualization({ 
  readings, 
  channels, 
  language, 
  hoverTemperatures,
  isDarkMode
}: DrillVisualizationProps) {
  const { t } = useTranslation(language);
  
  const enabledChannels = channels.filter(channel => channel.enabled);
  const enabledChannelCount = enabledChannels.length;
  
  const [sensorPositions, setSensorPositions] = useState<SensorPosition[]>(() =>
    enabledChannels.map((channel, index) => {
      const totalRange = 90;
      const spacing = enabledChannelCount > 1 ? totalRange / (enabledChannelCount - 1) : 0;
      const yPosition = enabledChannelCount === 1 ? 50 : 5 + (index * spacing);
      
      return {
        channelId: channel.id,
        x: 50,
        y: Math.min(95, yPosition)
      };
    })
  );
  
  const [draggedSensor, setDraggedSensor] = useState<number | null>(null);
  const [showTemperatureScale, setShowTemperatureScale] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [useHoverData, setUseHoverData] = useState(false);
  const [showCalibratedData, setShowCalibratedData] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [savedPresets, setSavedPresets] = useState<SensorPreset[]>([]);
  const drillRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 检查是否有校准数据
  const hasCalibrationData = React.useMemo(() => {
    return readings.some(reading => reading.calibratedTemperature !== undefined);
  }, [readings]);

  // 加载保存的预设
  useEffect(() => {
    try {
      const saved = localStorage.getItem('drillSensorPresets');
      if (saved) {
        setSavedPresets(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load sensor presets:', error);
    }
  }, []);

  // 保存预设到localStorage
  const savePresetsToStorage = (presets: SensorPreset[]) => {
    try {
      localStorage.setItem('drillSensorPresets', JSON.stringify(presets));
      setSavedPresets(presets);
    } catch (error) {
      console.error('Failed to save sensor presets:', error);
    }
  };

  useEffect(() => {
    const newEnabledChannels = channels.filter(channel => channel.enabled);
    const newCount = newEnabledChannels.length;
    
    if (newCount !== enabledChannelCount) {
      const newPositions = newEnabledChannels.map((channel, index) => {
        const totalRange = 90;
        const spacing = newCount > 1 ? totalRange / (newCount - 1) : 0;
        const yPosition = newCount === 1 ? 50 : 5 + (index * spacing);
        
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
    if (useHoverData && hoverTemperatures && hoverTemperatures[channelId] !== undefined) {
      return hoverTemperatures[channelId];
    }
    
    const channelReadings = readings
      .filter(r => r.channel === channelId)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (channelReadings.length === 0) return null;
    
    const latestReading = channelReadings[0];
    
    if (showCalibratedData && latestReading.calibratedTemperature !== undefined) {
      return latestReading.calibratedTemperature;
    }
    
    return latestReading.temperature;
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

  // 修正的温度到颜色映射 - 提高对比度
  const temperatureToColor = (temperature: number | null): string => {
    if (temperature === null) return '#6B7280';
    
    const { min, max } = getTemperatureRange();
    const normalized = Math.max(0, Math.min(1, (temperature - min) / (max - min)));
    
    // 提高颜色对比度的映射
    if (showCalibratedData && hasCalibrationData) {
      // 校准数据使用橙色系，增强对比度
      if (normalized < 0.25) {
        const t = normalized / 0.25;
        return `rgb(${Math.round(100 + t * 155)}, ${Math.round(50 + t * 115)}, ${Math.round(0)})`;
      } else if (normalized < 0.5) {
        const t = (normalized - 0.25) / 0.25;
        return `rgb(${Math.round(255)}, ${Math.round(165 + t * 90)}, ${Math.round(0 + t * 50)})`;
      } else if (normalized < 0.75) {
        const t = (normalized - 0.5) / 0.25;
        return `rgb(${Math.round(255)}, ${Math.round(255 - t * 90)}, ${Math.round(50 + t * 100)})`;
      } else {
        const t = (normalized - 0.75) / 0.25;
        return `rgb(${Math.round(255 - t * 55)}, ${Math.round(165 - t * 165)}, ${Math.round(150 + t * 105)})`;
      }
    }
    
    // 原始数据使用蓝-绿-黄-红渐变，增强对比度
    if (normalized < 0.2) {
      const t = normalized / 0.2;
      return `rgb(${Math.round(0)}, ${Math.round(100 + t * 155)}, ${Math.round(255)})`;
    } else if (normalized < 0.4) {
      const t = (normalized - 0.2) / 0.2;
      return `rgb(${Math.round(0)}, ${Math.round(255)}, ${Math.round(255 - t * 255)})`;
    } else if (normalized < 0.6) {
      const t = (normalized - 0.4) / 0.2;
      return `rgb(${Math.round(0 + t * 255)}, ${Math.round(255)}, ${Math.round(0)})`;
    } else if (normalized < 0.8) {
      const t = (normalized - 0.6) / 0.2;
      return `rgb(${Math.round(255)}, ${Math.round(255 - t * 155)}, ${Math.round(0)})`;
    } else {
      const t = (normalized - 0.8) / 0.2;
      return `rgb(${Math.round(255)}, ${Math.round(100 - t * 100)}, ${Math.round(0)})`;
    }
  };

  // Check if sensor intersects with drill string
  const isSensorIntersectingDrill = (sensorPos: SensorPosition): boolean => {
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

  // 🔥 全新的多方向热传导算法 - 基于距离加权插值（包含钻头部分）
  const calculateMultiDirectionalHeatConduction = () => {
    const intersectingSensors = sensorPositions
      .filter(pos => isSensorIntersectingDrill(pos))
      .map(pos => {
        const channel = enabledChannels.find(ch => ch.id === pos.channelId);
        const temperature = channel ? getTemperature(channel.id) : null;
        return temperature !== null ? { ...pos, temperature } : null;
      })
      .filter(sensor => sensor !== null) as Array<SensorPosition & { temperature: number }>;

    if (intersectingSensors.length === 0) return { mainBodyGradient: null, drillBitGradient: null };

    // 多方向热传导计算函数
    const getTemperatureAtPosition = (x: number, y: number): number => {
      if (intersectingSensors.length === 1) {
        return intersectingSensors[0].temperature;
      }

      // 计算每个传感器对当前位置的影响
      let totalWeightedTemperature = 0;
      let totalWeight = 0;

      intersectingSensors.forEach(sensor => {
        // 计算欧几里得距离
        const dx = x - sensor.x;
        const dy = y - sensor.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 避免除零错误，如果距离为0，直接返回该传感器的温度
        if (distance < 0.1) {
          return sensor.temperature;
        }

        // 使用反距离加权插值 (Inverse Distance Weighting)
        // 权重 = 1 / distance^p，其中p是幂参数（通常为1-3）
        const power = 2; // 幂参数，控制距离衰减的速度
        const weight = 1 / Math.pow(distance, power);
        
        totalWeightedTemperature += sensor.temperature * weight;
        totalWeight += weight;
      });

      // 如果总权重为0（理论上不应该发生），返回平均温度
      if (totalWeight === 0) {
        return intersectingSensors.reduce((sum, sensor) => sum + sensor.temperature, 0) / intersectingSensors.length;
      }

      return totalWeightedTemperature / totalWeight;
    };

    // 生成主体部分的温度分布网格 (Y: 5-85%)
    const mainBodyGradientStops = [];
    const mainBodyGridResolution = 50;
    
    for (let i = 0; i <= mainBodyGridResolution; i++) {
      const y = 5 + (80 * i / mainBodyGridResolution); // 主体Y范围：5-85%
      
      // 计算该Y位置上钻具主体范围内的平均温度
      const xSamples = 10;
      let totalTemp = 0;
      for (let j = 0; j <= xSamples; j++) {
        const x = 37.5 + (25 * j / xSamples); // 主体X范围：37.5-62.5%
        totalTemp += getTemperatureAtPosition(x, y);
      }
      const avgTemperature = totalTemp / (xSamples + 1);
      
      const color = temperatureToColor(avgTemperature);
      
      mainBodyGradientStops.push(
        <stop 
          key={`main-${i}`} 
          offset={`${(i / mainBodyGridResolution) * 100}%`} 
          style={{
            stopColor: color, 
            stopOpacity: 0.85
          }}
        />
      );
    }

    // 生成钻头部分的温度分布网格 (Y: 85-96.25%)
    const drillBitGradientStops = [];
    const drillBitGridResolution = 15;
    
    for (let i = 0; i <= drillBitGridResolution; i++) {
      const y = 85 + (11.25 * i / drillBitGridResolution); // 钻头Y范围：85-96.25%
      
      // 计算该Y位置上钻头范围内的平均温度
      const xSamples = 10;
      let totalTemp = 0;
      for (let j = 0; j <= xSamples; j++) {
        const x = 32.5 + (35 * j / xSamples); // 钻头X范围：32.5-67.5%
        totalTemp += getTemperatureAtPosition(x, y);
      }
      const avgTemperature = totalTemp / (xSamples + 1);
      
      const color = temperatureToColor(avgTemperature);
      
      drillBitGradientStops.push(
        <stop 
          key={`bit-${i}`} 
          offset={`${(i / drillBitGridResolution) * 100}%`} 
          style={{
            stopColor: color, 
            stopOpacity: 0.85
          }}
        />
      );
    }

    return {
      mainBodyGradient: (
        <linearGradient id="multiDirectionalHeatGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          {mainBodyGradientStops}
        </linearGradient>
      ),
      drillBitGradient: (
        <linearGradient id="drillBitHeatGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          {drillBitGradientStops}
        </linearGradient>
      )
    };
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

  // Reset sensor positions
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

  // 保存当前预设
  const saveCurrentPreset = () => {
    if (!presetName.trim()) {
      alert(language === 'zh' ? '请输入预设名称' : 'Please enter preset name');
      return;
    }

    const newPreset: SensorPreset = {
      name: presetName.trim(),
      description: presetDescription.trim(),
      positions: [...sensorPositions],
      channelCount: enabledChannelCount,
      createdAt: new Date().toISOString(),
      version: '1.0'
    };

    const updatedPresets = [...savedPresets, newPreset];
    savePresetsToStorage(updatedPresets);
    
    setPresetName('');
    setPresetDescription('');
    setShowPresetManager(false);
    
    alert(language === 'zh' ? '预设保存成功' : 'Preset saved successfully');
  };

  // 加载预设
  const loadPreset = (preset: SensorPreset) => {
    if (preset.channelCount !== enabledChannelCount) {
      const message = language === 'zh' 
        ? `预设通道数量(${preset.channelCount})与当前启用通道数量(${enabledChannelCount})不匹配，是否继续加载？`
        : `Preset channel count (${preset.channelCount}) doesn't match current enabled channels (${enabledChannelCount}). Continue loading?`;
      
      if (!confirm(message)) return;
    }

    // 只加载匹配的通道位置
    const newPositions = sensorPositions.map(pos => {
      const presetPos = preset.positions.find(p => p.channelId === pos.channelId);
      return presetPos || pos;
    });

    setSensorPositions(newPositions);
    alert(language === 'zh' ? '预设加载成功' : 'Preset loaded successfully');
  };

  // 删除预设
  const deletePreset = (index: number) => {
    const message = language === 'zh' ? '确定要删除这个预设吗？' : 'Are you sure you want to delete this preset?';
    if (confirm(message)) {
      const updatedPresets = savedPresets.filter((_, i) => i !== index);
      savePresetsToStorage(updatedPresets);
    }
  };

  // 导出预设
  const exportPresets = () => {
    if (savedPresets.length === 0) {
      alert(language === 'zh' ? '没有预设可以导出' : 'No presets to export');
      return;
    }

    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      presets: savedPresets
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `drill_sensor_presets_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 导入预设
  const importPresets = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (!data.presets || !Array.isArray(data.presets)) {
          throw new Error('Invalid preset file format');
        }

        const importedPresets = data.presets as SensorPreset[];
        const updatedPresets = [...savedPresets, ...importedPresets];
        savePresetsToStorage(updatedPresets);
        
        alert(language === 'zh' 
          ? `成功导入 ${importedPresets.length} 个预设` 
          : `Successfully imported ${importedPresets.length} presets`
        );
      } catch (error) {
        alert(language === 'zh' ? '导入失败：文件格式错误' : 'Import failed: Invalid file format');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
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

  const intersectingTemperatures = sensorPositions
    .filter(pos => isSensorIntersectingDrill(pos))
    .map(pos => {
      const channel = enabledChannels.find(ch => ch.id === pos.channelId);
      const temperature = channel ? getTemperature(channel.id) : null;
      return temperature !== null ? { ...pos, temperature } : null;
    })
    .filter(sensor => sensor !== null);

  const { mainBodyGradient, drillBitGradient } = calculateMultiDirectionalHeatConduction();

  return (
    <div className={`rounded-lg border p-4 h-[600px] flex flex-col ${
      isDarkMode 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Thermometer className="w-5 h-5 text-orange-400" />
          <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {t('drillTemperatureDistribution')}
          </h3>
          {showCalibratedData && hasCalibrationData && (
            <span className="text-orange-400 text-sm flex items-center gap-1">
              <Zap className="w-4 h-4" />
              ({language === 'zh' ? '校准数据' : 'Calibrated'})
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* 预设管理按钮 */}
          <button
            onClick={() => setShowPresetManager(!showPresetManager)}
            className={`flex items-center gap-1 p-1.5 rounded transition-colors text-white ${
              isDarkMode 
                ? 'bg-purple-600 hover:bg-purple-700' 
                : 'bg-purple-500 hover:bg-purple-600'
            }`}
            title={language === 'zh' ? '预设管理' : 'Preset Management'}
          >
            <Save className="w-4 h-4" />
          </button>

          {/* 校准数据切换开关 */}
          {hasCalibrationData && (
            <button
              onClick={() => setShowCalibratedData(!showCalibratedData)}
              className={`flex items-center gap-1 p-1.5 rounded transition-colors ${
                showCalibratedData 
                  ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              title={showCalibratedData 
                ? (language === 'zh' ? '显示校准后温度分布' : 'Showing calibrated temperature distribution')
                : (language === 'zh' ? '显示原始温度分布' : 'Showing original temperature distribution')
              }
            >
              <Zap className="w-4 h-4" />
              {showCalibratedData && (
                <div className="w-2 h-2 bg-orange-300 rounded-full animate-pulse"></div>
              )}
            </button>
          )}
          
          {/* 图表悬停数据开关 */}
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
            className={`p-1.5 rounded transition-colors text-white ${
              isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'bg-gray-500 hover:bg-gray-600'
            }`}
            title={showTemperatureScale ? t('hideTemperatureScale') : t('showTemperatureScale')}
          >
            {showTemperatureScale ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setCompactMode(!compactMode)}
            className={`px-2 py-1.5 rounded text-xs transition-colors text-white ${
              isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'bg-gray-500 hover:bg-gray-600'
            }`}
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

      {/* 预设管理面板 */}
      {showPresetManager && (
        <div className={`mb-4 p-4 rounded-lg border ${
          isDarkMode 
            ? 'bg-gray-700 border-gray-600' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {language === 'zh' ? '传感器位置预设管理' : 'Sensor Position Preset Management'}
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={exportPresets}
                disabled={savedPresets.length === 0}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors text-white disabled:cursor-not-allowed ${
                  savedPresets.length === 0
                    ? isDarkMode ? 'bg-gray-600' : 'bg-gray-400'
                    : isDarkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                <Download className="w-3 h-3" />
                {language === 'zh' ? '导出' : 'Export'}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors text-white ${
                  isDarkMode 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                <Upload className="w-3 h-3" />
                {language === 'zh' ? '导入' : 'Import'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={importPresets}
                className="hidden"
              />
            </div>
          </div>

          {/* 保存新预设 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder={language === 'zh' ? '预设名称' : 'Preset name'}
              className={`px-2 py-1 border rounded text-sm ${
                isDarkMode 
                  ? 'bg-gray-600 border-gray-500 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
            <input
              type="text"
              value={presetDescription}
              onChange={(e) => setPresetDescription(e.target.value)}
              placeholder={language === 'zh' ? '描述（可选）' : 'Description (optional)'}
              className={`px-2 py-1 border rounded text-sm ${
                isDarkMode 
                  ? 'bg-gray-600 border-gray-500 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
            <button
              onClick={saveCurrentPreset}
              className={`px-3 py-1 rounded text-sm transition-colors text-white ${
                isDarkMode 
                  ? 'bg-purple-600 hover:bg-purple-700' 
                  : 'bg-purple-500 hover:bg-purple-600'
              }`}
            >
              {language === 'zh' ? '保存当前位置' : 'Save Current Positions'}
            </button>
          </div>

          {/* 预设列表 */}
          <div className="max-h-32 overflow-y-auto">
            {savedPresets.length === 0 ? (
              <div className={`text-center py-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {language === 'zh' ? '暂无保存的预设' : 'No saved presets'}
              </div>
            ) : (
              <div className="space-y-1">
                {savedPresets.map((preset, index) => (
                  <div key={index} className={`flex items-center justify-between p-2 rounded ${
                    isDarkMode ? 'bg-gray-600' : 'bg-gray-100'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {preset.name}
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {preset.channelCount} {language === 'zh' ? '个通道' : 'channels'} • {new Date(preset.createdAt).toLocaleDateString()}
                        {preset.description && ` • ${preset.description}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => loadPreset(preset)}
                        className={`px-2 py-1 rounded text-xs transition-colors text-white ${
                          isDarkMode 
                            ? 'bg-green-600 hover:bg-green-700' 
                            : 'bg-green-500 hover:bg-green-600'
                        }`}
                      >
                        {language === 'zh' ? '加载' : 'Load'}
                      </button>
                      <button
                        onClick={() => deletePreset(index)}
                        className={`px-2 py-1 rounded text-xs transition-colors text-white ${
                          isDarkMode 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'bg-red-500 hover:bg-red-600'
                        }`}
                      >
                        {language === 'zh' ? '删除' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mb-3 text-center">
        <div className={`flex items-center justify-center gap-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <Move className="w-3 h-3" />
          <span>{language === 'zh' ? '拖拽调整位置 • 多方向热传导计算（含钻头）' : 'Drag to adjust position • Multi-directional heat conduction (including drill bit)'}</span>
          {useHoverData && (
            <>
              <span>•</span>
              <MousePointer className="w-3 h-3" />
              <span>{language === 'zh' ? '使用图表悬停温度' : 'Using chart hover temperatures'}</span>
            </>
          )}
          {showCalibratedData && hasCalibrationData && (
            <>
              <span>•</span>
              <Zap className="w-3 h-3" />
              <span>{language === 'zh' ? '显示校准温度' : 'Showing calibrated temperatures'}</span>
            </>
          )}
        </div>
      </div>

      {/* 状态提示 */}
      {(useHoverData || (showCalibratedData && hasCalibrationData)) && (
        <div className={`mb-2 p-2 border rounded-lg ${
          isDarkMode 
            ? 'bg-blue-900 border-blue-700' 
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center gap-2 text-xs">
            {useHoverData && (
              <>
                <MousePointer className="w-3 h-3 text-blue-400" />
                <span className={isDarkMode ? 'text-blue-300' : 'text-blue-700'}>
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
              </>
            )}
            {showCalibratedData && hasCalibrationData && (
              <>
                {useHoverData && <span className="text-blue-300">•</span>}
                <Zap className="w-3 h-3 text-orange-400" />
                <span className={isDarkMode ? 'text-orange-300' : 'text-orange-700'}>
                  {language === 'zh' ? '显示校准后的温度分布' : 'Showing calibrated temperature distribution'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Drill visualization */}
        <div className="flex-1 flex flex-col items-center">
          <div className="relative w-full max-w-xs h-full">
            <div
              ref={drillRef}
              className="relative cursor-crosshair w-full h-full"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{ userSelect: 'none', minHeight: '300px' }}
            >
              <svg viewBox="0 0 200 400" className="w-full h-full">
                <defs>
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

                  {/* 主体部分热传导渐变 */}
                  {mainBodyGradient}
                  
                  {/* 钻头部分热传导渐变 */}
                  {drillBitGradient}
                </defs>
                
                {/* Main drill body */}
                <rect x="75" y="20" width="50" height="320" 
                      fill="url(#pipeGradient)" 
                      stroke="#666" 
                      strokeWidth="2"/>
                
                {/* Multi-directional heat conduction overlay for main body */}
                {mainBodyGradient && (
                  <rect x="75" y="20" width="50" height="320" 
                        fill="url(#multiDirectionalHeatGradient)" 
                        stroke="none"/>
                )}
                
                {/* Spiral blades */}
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
                
                {/* Thread lines */}
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
                
                {/* Multi-directional heat conduction overlay for drill bit */}
                {drillBitGradient && (
                  <rect x="65" y="340" width="70" height="20" 
                        fill="url(#drillBitHeatGradient)" 
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
              
              {/* Sensor positions */}
              {sensorPositions.map(sensorPos => {
                const channel = enabledChannels.find(ch => ch.id === sensorPos.channelId);
                if (!channel || !channel.enabled) return null;
                
                const temperature = getTemperature(channel.id);
                const color = temperatureToColor(temperature);
                const isIntersecting = isSensorIntersectingDrill(sensorPos);
                const isHoverData = useHoverData && hoverTemperatures && hoverTemperatures[channel.id] !== undefined;
                const isCalibrated = showCalibratedData && hasCalibrationData;
                
                return (
                  <div
                    key={sensorPos.channelId}
                    className={`absolute rounded-full border-2 shadow-lg cursor-move transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center font-bold text-white transition-all ${
                      draggedSensor === sensorPos.channelId ? 'scale-125 z-10' : 'hover:scale-110'
                    } ${isIntersecting ? 'border-white' : 'border-gray-400'} ${
                      compactMode ? 'w-4 h-4 text-xs' : 'w-5 h-5 text-xs'
                    } ${isHoverData ? 'ring-2 ring-blue-400' : ''} ${isCalibrated ? 'ring-2 ring-orange-400' : ''}`}
                    style={{
                      backgroundColor: color,
                      left: `${sensorPos.x}%`,
                      top: `${sensorPos.y}%`,
                      transition: draggedSensor === sensorPos.channelId ? 'none' : 'all 0.2s ease',
                      boxShadow: isIntersecting 
                        ? '0 0 8px rgba(255,255,255,0.5)' 
                        : isHoverData 
                          ? '0 0 8px rgba(59,130,246,0.5)'
                          : isCalibrated
                            ? '0 0 8px rgba(251,146,60,0.5)'
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
                    title={`${language === 'zh' ? '传感器' : 'Sensor'} ${channel.id}: ${temperature !== null ? formatTemperature(temperature) : (language === 'zh' ? '无数据' : 'No Data')}${isIntersecting ? ` (${t('affectsDrillColor')})` : ''}${isHoverData ? ` (${language === 'zh' ? '图表悬停数据' : 'Chart hover data'})` : ''}${isCalibrated ? ` (${language === 'zh' ? '校准数据' : 'Calibrated data'})` : ''}`}
                  >
                    {channel.id}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className={`flex flex-col gap-3 ${compactMode ? 'w-32' : 'w-40'}`}>
          {/* Temperature scale */}
          {showTemperatureScale && (
            <div className={`rounded-lg p-3 ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <h4 className={`font-semibold mb-2 text-center ${compactMode ? 'text-xs' : 'text-sm'} ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {t('temperatureRange')}
              </h4>
              
              <div className="flex justify-center">
                <div className={`relative rounded ${compactMode ? 'h-16 w-3' : 'h-20 w-4'}`}>
                  <div
                    className="absolute inset-0 rounded"
                    style={{
                      background: showCalibratedData && hasCalibrationData
                        ? 'linear-gradient(to top, rgb(100,50,0), rgb(255,165,0), rgb(255,255,50), rgb(255,165,150), rgb(200,0,150), rgb(255,0,255))'
                        : 'linear-gradient(to top, rgb(0,100,255), rgb(0,255,255), rgb(0,255,0), rgb(255,255,0), rgb(255,100,0), rgb(255,0,0))'
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
                <div className={`${compactMode ? 'text-xs' : 'text-xs'} ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('affecting')}: {intersectingTemperatures.length}/{enabledChannels.length}
                </div>
                {useHoverData && (
                  <div className={`text-blue-400 ${compactMode ? 'text-xs' : 'text-xs'}`}>
                    {language === 'zh' ? '悬停模式' : 'Hover Mode'}
                  </div>
                )}
                {showCalibratedData && hasCalibrationData && (
                  <div className={`text-orange-400 ${compactMode ? 'text-xs' : 'text-xs'}`}>
                    {language === 'zh' ? '校准模式' : 'Calibrated Mode'}
                  </div>
                )}
                <div className={`${compactMode ? 'text-xs' : 'text-xs'} mt-1 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                  {language === 'zh' ? '多方向热传导+钻头' : 'Multi-directional+Bit'}
                </div>
              </div>
            </div>
          )}

          {/* Sensor status */}
          <div className={`rounded-lg p-3 flex-1 min-h-0 ${
            isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
          }`}>
            <h4 className={`font-semibold mb-2 ${compactMode ? 'text-xs' : 'text-sm'} ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {t('sensorStatus')}
            </h4>
            
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {enabledChannels.map(channel => {
                const sensorPos = sensorPositions.find(pos => pos.channelId === channel.id);
                const temperature = getTemperature(channel.id);
                const color = temperatureToColor(temperature);
                const isIntersecting = sensorPos ? isSensorIntersectingDrill(sensorPos) : false;
                const isHoverData = useHoverData && hoverTemperatures && hoverTemperatures[channel.id] !== undefined;
                const isCalibrated = showCalibratedData && hasCalibrationData;
                
                return (
                  <div key={channel.id} className="flex items-center gap-2">
                    <div
                      className={`rounded-full border flex items-center justify-center font-bold text-white flex-shrink-0 ${
                        isIntersecting ? 'border-white' : 'border-gray-400'
                      } ${compactMode ? 'w-3 h-3 text-xs' : 'w-3 h-3 text-xs'} ${
                        isHoverData ? 'ring-1 ring-blue-400' : ''
                      } ${isCalibrated ? 'ring-1 ring-orange-400' : ''}`}
                      style={{ 
                        backgroundColor: color,
                        boxShadow: isIntersecting 
                          ? '0 0 4px rgba(255,255,255,0.5)' 
                          : isHoverData 
                            ? '0 0 4px rgba(59,130,246,0.5)'
                            : isCalibrated
                              ? '0 0 4px rgba(251,146,60,0.5)'
                              : 'none',
                        fontSize: '7px',
                        minWidth: '12px',
                        minHeight: '12px'
                      }}
                    >
                      {channel.id}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className={`${compactMode ? 'text-xs' : 'text-xs'} flex items-center gap-1 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Ch{channel.id}
                        {isHoverData && <span className="text-blue-400">*</span>}
                        {isCalibrated && <Zap className="w-2 h-2 text-orange-400" />}
                      </div>
                      {!compactMode && (
                        <div className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {temperature !== null ? formatTemperature(temperature) : '--'}
                        </div>
                      )}
                    </div>
                    
                    <div className={`px-1 py-0.5 rounded flex-shrink-0 ${
                      isIntersecting 
                        ? isDarkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'
                        : isDarkMode ? 'bg-gray-600 text-gray-400' : 'bg-gray-200 text-gray-600'
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