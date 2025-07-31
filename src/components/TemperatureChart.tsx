import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TemperatureReading, DisplayConfig, ChannelConfig } from '../types';
import { formatTemperature } from '../utils/temperatureProcessor';
import { Zap, ToggleLeft, ToggleRight, TrendingDown } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface TemperatureChartProps {
  readings: TemperatureReading[];
  displayConfig: DisplayConfig;
  channels: ChannelConfig[];
  language: 'zh' | 'en';
  onHoverDataChange?: (hoverData: { [channelId: number]: number } | null) => void;
  isDarkMode: boolean;
}

// 性能优化配置
const MAX_CHART_POINTS = 10000; // 图表最大显示点数
const DOWNSAMPLING_THRESHOLD = 15000; // 开始降采样的阈值

// Function to darken a color for calibrated data display
const darkenColor = (color: string, factor: number = 0.6): string => {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Darken by multiplying by factor
  const darkR = Math.round(r * factor);
  const darkG = Math.round(g * factor);
  const darkB = Math.round(b * factor);
  
  // Convert back to hex
  return `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`;
};

// 数据降采样函数 - 保持校准数据的连贯性
const downsampleReadings = (
  readings: TemperatureReading[], 
  targetPoints: number,
  showCalibratedData: boolean,
  hasCalibrationData: boolean
): TemperatureReading[] => {
  if (readings.length <= targetPoints) {
    return readings;
  }

  console.log(`开始数据降采样: ${readings.length} -> ${targetPoints} 点`);
  
  const bucketSize = Math.ceil(readings.length / targetPoints);
  const downsampledReadings: TemperatureReading[] = [];
  
  // 按时间戳排序
  const sortedReadings = [...readings].sort((a, b) => a.timestamp - b.timestamp);
  
  for (let i = 0; i < sortedReadings.length; i += bucketSize) {
    const bucket = sortedReadings.slice(i, i + bucketSize);
    
    // 按通道分组
    const channelGroups = new Map<number, TemperatureReading[]>();
    bucket.forEach(reading => {
      if (!channelGroups.has(reading.channel)) {
        channelGroups.set(reading.channel, []);
      }
      channelGroups.get(reading.channel)!.push(reading);
    });
    
    // 为每个通道创建聚合数据点
    channelGroups.forEach((channelReadings, channel) => {
      if (channelReadings.length === 0) return;
      
      // 使用桶中间的时间戳
      const middleIndex = Math.floor(channelReadings.length / 2);
      const timestamp = channelReadings[middleIndex].timestamp;
      
      // 计算平均温度
      const avgTemperature = channelReadings.reduce((sum, r) => sum + r.temperature, 0) / channelReadings.length;
      
      // 计算平均原始值
      const avgRawValue = Math.round(channelReadings.reduce((sum, r) => sum + r.rawValue, 0) / channelReadings.length);
      
      // 处理校准温度 - 确保连贯性
      let avgCalibratedTemperature: number | undefined;
      const calibratedReadings = channelReadings.filter(r => r.calibratedTemperature !== undefined);
      
      if (calibratedReadings.length > 0) {
        // 如果桶中有校准数据，计算平均校准温度
        avgCalibratedTemperature = calibratedReadings.reduce((sum, r) => sum + r.calibratedTemperature!, 0) / calibratedReadings.length;
      } else if (hasCalibrationData) {
        // 如果整体有校准数据但当前桶没有，使用原始温度作为校准温度以保持连贯性
        avgCalibratedTemperature = avgTemperature;
      }
      
      const downsampledReading: TemperatureReading = {
        timestamp,
        channel,
        temperature: avgTemperature,
        rawValue: avgRawValue
      };
      
      // 只有在有校准数据时才添加校准温度字段
      if (avgCalibratedTemperature !== undefined) {
        downsampledReading.calibratedTemperature = avgCalibratedTemperature;
      }
      
      downsampledReadings.push(downsampledReading);
    });
  }
  
  // 按时间戳重新排序
  const result = downsampledReadings.sort((a, b) => a.timestamp - b.timestamp);
  
  console.log(`降采样完成: ${readings.length} -> ${result.length} 点 (目标: ${targetPoints})`);
  console.log('降采样后样本数据:', result.slice(0, 3));
  
  return result;
};

export default function TemperatureChart({ 
  readings, 
  displayConfig, 
  channels, 
  language,
  onHoverDataChange,
  isDarkMode
}: TemperatureChartProps) {
  const { t } = useTranslation(language);
  
  // Internal state for calibration toggle (separate from displayConfig)
  const [showCalibratedData, setShowCalibratedData] = React.useState(false);

  // Filter readings based on display mode and time window
  const filteredReadings = React.useMemo(() => {
    if (displayConfig.mode === 'sliding') {
      const cutoffTime = Date.now() - (displayConfig.timeWindow * 60 * 1000);
      return readings.filter(reading => reading.timestamp >= cutoffTime);
    }
    return readings;
  }, [readings, displayConfig]);

  // Check if we have calibration data
  const hasCalibrationData = React.useMemo(() => {
    return filteredReadings.some(reading => reading.calibratedTemperature !== undefined);
  }, [filteredReadings]);

  // Reset calibration toggle when no calibration data is available
  React.useEffect(() => {
    if (!hasCalibrationData) {
      setShowCalibratedData(false);
    }
  }, [hasCalibrationData]);

  // 数据降采样处理 - 新增性能优化
  const processedReadings = React.useMemo(() => {
    console.log('开始处理数据降采样:', {
      filteredReadingsLength: filteredReadings.length,
      threshold: DOWNSAMPLING_THRESHOLD,
      targetPoints: MAX_CHART_POINTS,
      hasCalibrationData,
      showCalibratedData
    });

    if (filteredReadings.length <= DOWNSAMPLING_THRESHOLD) {
      console.log('数据量未超过阈值，使用原始数据');
      return filteredReadings;
    }

    const downsampled = downsampleReadings(
      filteredReadings, 
      MAX_CHART_POINTS, 
      showCalibratedData, 
      hasCalibrationData
    );
    
    return downsampled;
  }, [filteredReadings, showCalibratedData, hasCalibrationData]);

  // Get start time for relative time calculation
  const startTime = React.useMemo(() => {
    if (processedReadings.length === 0) return Date.now();
    return Math.min(...processedReadings.map(r => r.timestamp));
  }, [processedReadings]);

  // Transform data for chart - 使用处理后的数据
  const chartData = React.useMemo(() => {
    console.log('开始处理图表数据:', {
      processedReadingsLength: processedReadings.length,
      sampleData: processedReadings.slice(0, 3)
    });
    
    const dataMap = new Map<number, any>();
    
    if (processedReadings.length === 0) {
      console.log('处理后的读数为空，返回空数组');
      return [];
    }
    
    // 按时间戳分组数据
    processedReadings.forEach(reading => {
      const timestamp = reading.timestamp;
      const relativeTime = displayConfig.relativeTime 
        ? Math.round((timestamp - startTime) / 1000)
        : timestamp;
      
      if (!dataMap.has(timestamp)) {
        dataMap.set(timestamp, { 
          timestamp,
          relativeTime,
          time: displayConfig.relativeTime 
            ? `${Math.floor(relativeTime / 60)}:${(relativeTime % 60).toString().padStart(2, '0')}`
            : new Date(timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })
        });
      }
      
      const dataPoint = dataMap.get(timestamp);
      
      // 始终存储原始温度数据
      dataPoint[`channel${reading.channel}`] = reading.temperature;
      
      // 如果有校准数据，也存储校准温度
      if (reading.calibratedTemperature !== undefined) {
        dataPoint[`channel${reading.channel}_calibrated`] = reading.calibratedTemperature;
      }
    });
    
    const result = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    
    console.log('图表数据处理完成:', {
      resultLength: result.length,
      sampleResult: result.slice(0, 2),
      dataMapSize: dataMap.size
    });
    
    return result;
  }, [processedReadings, displayConfig.relativeTime, startTime]);

  // 添加调试信息
  React.useEffect(() => {
    console.log('TemperatureChart 状态更新:', {
      readingsLength: readings.length,
      filteredReadingsLength: filteredReadings.length,
      processedReadingsLength: processedReadings.length,
      chartDataLength: chartData.length,
      displayConfig: displayConfig.mode,
      timeWindow: displayConfig.timeWindow,
      isDownsampled: filteredReadings.length > DOWNSAMPLING_THRESHOLD
    });
  }, [readings.length, filteredReadings.length, processedReadings.length, chartData.length, displayConfig]);

  // Calculate Y-axis range
  const calculateYAxisDomain = React.useCallback((data: any[], channelsToUse: ChannelConfig[]) => {
    if (data.length === 0) return [0, 50];
    
    const allTemperatures: number[] = [];
    data.forEach(item => {
      channelsToUse.filter(ch => ch.enabled).forEach(channel => {
        // 根据当前显示模式获取温度值
        const tempKey = showCalibratedData && hasCalibrationData 
          ? `channel${channel.id}_calibrated` 
          : `channel${channel.id}`;
        
        const temp = item[tempKey];
        if (typeof temp === 'number' && !isNaN(temp)) {
          allTemperatures.push(temp);
        }
      });
    });
    
    if (allTemperatures.length === 0) return [0, 50];
    
    const minTemp = Math.min(...allTemperatures);
    const maxTemp = Math.max(...allTemperatures);
    const range = maxTemp - minTemp;
    const padding = Math.max(range * 0.1, 2);
    
    return [
      Math.floor((minTemp - padding) * 10) / 10,
      Math.ceil((maxTemp + padding) * 10) / 10
    ];
  }, [showCalibratedData, hasCalibrationData]);

  const yAxisDomain = React.useMemo(() => {
    return calculateYAxisDomain(chartData, channels);
  }, [chartData, channels, calculateYAxisDomain]);

  // Handle mouse hover events
  const handleMouseMove = React.useCallback((data: any) => {
    if (!onHoverDataChange || !data || !data.activePayload) {
      return;
    }

    const hoverData: { [channelId: number]: number } = {};
    
    channels.filter(ch => ch.enabled).forEach(channel => {
      const channelKey = showCalibratedData && hasCalibrationData 
        ? `channel${channel.id}_calibrated` 
        : `channel${channel.id}`;
      
      const payload = data.activePayload.find((p: any) => p.dataKey === channelKey);
      if (payload && typeof payload.value === 'number') {
        hoverData[channel.id] = payload.value;
      }
    });

    onHoverDataChange(Object.keys(hoverData).length > 0 ? hoverData : null);
  }, [onHoverDataChange, channels, showCalibratedData, hasCalibrationData]);

  const handleMouseLeave = React.useCallback(() => {
    if (onHoverDataChange) {
      onHoverDataChange(null);
    }
  }, [onHoverDataChange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`border rounded-lg p-4 shadow-xl ${
          isDarkMode 
            ? 'bg-gray-900 border-gray-600' 
            : 'bg-white border-gray-300'
        }`}>
          <p className={`text-sm mb-2 font-medium ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            {displayConfig.relativeTime ? `${t('time')}: ${label}` : `${t('time')}: ${label}`}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toFixed(1)}°C`}
              {showCalibratedData && hasCalibrationData && (
                <span className="text-orange-400 ml-1">
                  ({language === 'zh' ? '校准' : 'Cal'})
                </span>
              )}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Render individual chart for each channel - 使用处理后的数据
  const renderIndividualChart = (channel: ChannelConfig) => {
    // 修复：直接从处理后的数据中提取该通道的数据
    const channelReadings = processedReadings
      .filter(reading => reading.channel === channel.id)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`通道 ${channel.id} 数据处理:`, {
      channelReadings: channelReadings.length,
      showCalibratedData,
      hasCalibrationData
    });
    
    const channelData = channelReadings.map(reading => {
      const relativeTime = displayConfig.relativeTime 
        ? Math.round((reading.timestamp - startTime) / 1000)
        : reading.timestamp;
      
      // 根据校准设置选择温度值
      const temperature = showCalibratedData && hasCalibrationData && reading.calibratedTemperature !== undefined
        ? reading.calibratedTemperature
        : reading.temperature;
      
      return {
        timestamp: reading.timestamp,
        relativeTime,
        time: displayConfig.relativeTime 
          ? `${Math.floor(relativeTime / 60)}:${(relativeTime % 60).toString().padStart(2, '0')}`
          : new Date(reading.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }),
        temperature
      };
    });

    if (channelData.length === 0) {
      console.log(`通道 ${channel.id} 无数据`);
      return (
        <div key={channel.id} className={`rounded-lg border p-4 h-64 flex items-center justify-center ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="text-center">
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {channel.name} - {t('noData')}
            </p>
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              {language === 'zh' ? '该通道无数据' : 'No data for this channel'}
            </p>
          </div>
        </div>
      );
    }

    console.log(`通道 ${channel.id} 最终数据:`, {
      dataLength: channelData.length,
      sampleData: channelData.slice(0, 2)
    });

    const channelTemps = channelData.map(d => d.temperature).filter(t => !isNaN(t));
    const minTemp = Math.min(...channelTemps);
    const maxTemp = Math.max(...channelTemps);
    const range = maxTemp - minTemp;
    const padding = Math.max(range * 0.1, 1);
    const channelYDomain = [
      Math.floor((minTemp - padding) * 10) / 10,
      Math.ceil((maxTemp + padding) * 10) / 10
    ];

    // Choose color based on calibration status
    const lineColor = showCalibratedData && hasCalibrationData 
      ? darkenColor(channel.color) 
      : channel.color;

    return (
      <div key={channel.id} className={`rounded-lg border p-4 ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <h4 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: lineColor }}
          />
          {channel.name}
          {showCalibratedData && hasCalibrationData && (
            <span className="text-orange-400 text-sm flex items-center gap-1">
              <Zap className="w-3 h-3" />
              ({language === 'zh' ? '校准' : 'Cal'})
            </span>
          )}
        </h4>
        
        <div style={{ width: '100%', height: '200px' }}>
          <ResponsiveContainer>
            <LineChart 
              data={channelData} 
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {displayConfig.showGrid && (
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={isDarkMode ? "#374151" : "#E5E7EB"} 
                  opacity={0.3} 
                />
              )}
              <XAxis 
                dataKey="time" 
                stroke={isDarkMode ? "#9CA3AF" : "#6B7280"}
                fontSize={10}
                interval="preserveStartEnd"
                tick={{ fill: isDarkMode ? '#9CA3AF' : '#6B7280' }}
              />
              <YAxis 
                stroke={isDarkMode ? "#9CA3AF" : "#6B7280"}
                fontSize={10}
                tickFormatter={(value) => `${value.toFixed(1)}°C`}
                tick={{ fill: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                domain={channelYDomain}
              />
              <Tooltip content={<CustomTooltip />} />
              
              <Line
                type="monotone"
                dataKey="temperature"
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: lineColor, strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // 性能指示器
  const isDownsampled = filteredReadings.length > DOWNSAMPLING_THRESHOLD;
  const downsamplingRatio = isDownsampled 
    ? ((filteredReadings.length - processedReadings.length) / filteredReadings.length * 100).toFixed(1)
    : '0';

  if (chartData.length === 0) {
    return (
      <div className={`rounded-lg border h-[600px] flex items-center justify-center ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="text-center">
          {readings.length === 0 ? (
            <>
              <div className="text-6xl mb-4">📊</div>
              <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('noTemperatureData')}
              </p>
              <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                {t('startTestModeOrConnect')}
              </p>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">⏳</div>
              <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {language === 'zh' ? '数据加载中...' : 'Loading data...'}
              </p>
              <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                {language === 'zh' 
                  ? `原始数据: ${readings.length} 条，过滤后: ${filteredReadings.length} 条，图表数据: ${chartData.length} 条` 
                  : `Raw: ${readings.length}, Filtered: ${filteredReadings.length}, Chart: ${chartData.length} records`
                }
              </p>
              <div className={`mt-4 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                <p>{language === 'zh' ? '显示模式' : 'Display mode'}: {displayConfig.mode}</p>
                {displayConfig.mode === 'sliding' && (
                  <p>{language === 'zh' ? '时间窗口' : 'Time window'}: {displayConfig.timeWindow} {language === 'zh' ? '分钟' : 'minutes'}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Individual view
  if (displayConfig.viewMode === 'individual') {
    const enabledChannels = channels.filter(channel => channel.enabled);
    
    console.log('分析视图渲染:', {
      enabledChannelsCount: enabledChannels.length,
      totalReadings: readings.length,
      filteredReadings: filteredReadings.length,
      processedReadings: processedReadings.length
    });
    
    return (
      <div className={`rounded-lg border p-6 h-[600px] flex flex-col ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className={`text-2xl font-bold flex items-center gap-2 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {language === 'zh' ? '分析视图 - 通道分析' : 'Individual View - Channel Analysis'}
            {showCalibratedData && hasCalibrationData && (
              <span className="text-orange-400 text-lg flex items-center gap-1">
                <Zap className="w-5 h-5" />
                ({language === 'zh' ? '校准数据' : 'Calibrated Data'})
              </span>
            )}
          </h3>
          <div className="flex items-center gap-4">
            {/* Calibration Toggle Switch */}
            {hasCalibrationData && (
              <div className="flex items-center gap-3">
                <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {language === 'zh' ? '显示校准数据' : 'Show Calibrated Data'}
                </span>
                <button
                  onClick={() => setShowCalibratedData(!showCalibratedData)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
                    showCalibratedData 
                      ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                      : isDarkMode ? 'bg-gray-600 hover:bg-gray-500 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  {showCalibratedData ? (
                    <ToggleRight className="w-4 h-4" />
                  ) : (
                    <ToggleLeft className="w-4 h-4" />
                  )}
                  <span className="text-sm">
                    {showCalibratedData 
                      ? (language === 'zh' ? '校准' : 'Calibrated')
                      : (language === 'zh' ? '原始' : 'Original')
                    }
                  </span>
                </button>
              </div>
            )}
            
            {/* 性能指示器 */}
            {isDownsampled && (
              <div className={`flex items-center gap-2 px-3 py-1 border rounded-lg ${
                isDarkMode 
                  ? 'bg-blue-900 border-blue-600' 
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <TrendingDown className="w-4 h-4 text-blue-400" />
                <span className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                  {language === 'zh' ? '性能优化' : 'Performance Mode'}: -{downsamplingRatio}%
                </span>
              </div>
            )}
            
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {language === 'zh' ? '显示模式' : 'Display Mode'}: {displayConfig.mode === 'sliding' 
                ? `${language === 'zh' ? '滑动窗口' : 'Sliding Window'} (${displayConfig.timeWindow}${language === 'zh' ? '分钟' : 'min'})` 
                : (language === 'zh' ? '完整历史' : 'Full History')
              }
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {language === 'zh' ? '时间轴' : 'Time Axis'}: {displayConfig.relativeTime 
                ? (language === 'zh' ? '相对时间' : 'Relative Time') 
                : (language === 'zh' ? '绝对时间' : 'Absolute Time')
              }
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {enabledChannels.map(channel => renderIndividualChart(channel))}
          </div>
        </div>
      </div>
    );
  }

  // Combined view
  return (
    <div className={`rounded-lg border p-6 h-[600px] flex flex-col ${
      isDarkMode 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-2xl font-bold flex items-center gap-2 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          {language === 'zh' ? '综合视图 - 温度趋势' : 'Combined View - Temperature Trends'}
          {showCalibratedData && hasCalibrationData && (
            <span className="text-orange-400 text-lg flex items-center gap-1">
              <Zap className="w-5 h-5" />
              ({language === 'zh' ? '校准数据' : 'Calibrated Data'})
            </span>
          )}
        </h3>
        <div className="flex items-center gap-4">
          {/* Calibration Toggle Switch */}
          {hasCalibrationData && (
            <div className="flex items-center gap-3">
              <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {language === 'zh' ? '显示校准数据' : 'Show Calibrated Data'}
              </span>
              <button
                onClick={() => setShowCalibratedData(!showCalibratedData)}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
                  showCalibratedData 
                    ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                    : isDarkMode ? 'bg-gray-600 hover:bg-gray-500 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                {showCalibratedData ? (
                  <ToggleRight className="w-4 h-4" />
                ) : (
                  <ToggleLeft className="w-4 h-4" />
                )}
                <span className="text-sm">
                  {showCalibratedData 
                    ? (language === 'zh' ? '校准' : 'Calibrated')
                    : (language === 'zh' ? '原始' : 'Original')
                  }
                </span>
              </button>
            </div>
          )}
          
          {/* 性能指示器 */}
          {isDownsampled && (
            <div className={`flex items-center gap-2 px-3 py-1 border rounded-lg ${
              isDarkMode 
                ? 'bg-blue-900 border-blue-600' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <TrendingDown className="w-4 h-4 text-blue-400" />
              <span className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                {language === 'zh' ? '性能优化' : 'Performance Mode'}: -{downsamplingRatio}%
              </span>
            </div>
          )}
          
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {language === 'zh' ? '显示模式' : 'Display Mode'}: {displayConfig.mode === 'sliding' 
              ? `${language === 'zh' ? '滑动窗口' : 'Sliding Window'} (${displayConfig.timeWindow}${language === 'zh' ? '分钟' : 'min'})` 
              : (language === 'zh' ? '完整历史' : 'Full History')
            }
          </div>
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {language === 'zh' ? '时间轴' : 'Time Axis'}: {displayConfig.relativeTime 
              ? (language === 'zh' ? '相对时间 (分:秒)' : 'Relative Time (min:sec)') 
              : (language === 'zh' ? '绝对时间' : 'Absolute Time')
            }
          </div>
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {language === 'zh' ? '数据点' : 'Data Points'}: {chartData.length.toLocaleString()}
            {isDownsampled && (
              <span className="text-blue-400 ml-1">
                / {filteredReadings.length.toLocaleString()}
              </span>
            )}
          </div>
          
          {/* Status indicator */}
          {hasCalibrationData && (
            <div className={`text-sm px-3 py-1 rounded-full border flex items-center gap-1 ${
              showCalibratedData 
                ? isDarkMode ? 'bg-orange-900 text-orange-300 border-orange-600' : 'bg-orange-50 text-orange-700 border-orange-200'
                : isDarkMode ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-100 text-gray-600 border-gray-300'
            }`}>
              <Zap className="w-3 h-3" />
              {showCalibratedData 
                ? (language === 'zh' ? '显示校准数据' : 'Showing Calibrated')
                : (language === 'zh' ? '显示原始数据' : 'Showing Original')
              }
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData} 
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {displayConfig.showGrid && (
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={isDarkMode ? "#374151" : "#E5E7EB"} 
                opacity={0.3} 
              />
            )}
            <XAxis 
              dataKey="time" 
              stroke={isDarkMode ? "#9CA3AF" : "#6B7280"}
              fontSize={12}
              interval="preserveStartEnd"
              tick={{ fill: isDarkMode ? '#9CA3AF' : '#6B7280' }}
            />
            <YAxis 
              stroke={isDarkMode ? "#9CA3AF" : "#6B7280"}
              fontSize={12}
              tickFormatter={(value) => `${value.toFixed(1)}°C`}
              tick={{ fill: isDarkMode ? '#9CA3AF' : '#6B7280' }}
              domain={yAxisDomain}
            />
            <Tooltip content={<CustomTooltip />} />
            {displayConfig.showLegend && (
              <Legend 
                wrapperStyle={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                iconType="line"
              />
            )}
            
            {channels.filter(channel => channel.enabled).map(channel => {
              // Choose data key and color based on calibration status
              const dataKey = showCalibratedData && hasCalibrationData 
                ? `channel${channel.id}_calibrated` 
                : `channel${channel.id}`;
              
              const lineColor = showCalibratedData && hasCalibrationData 
                ? darkenColor(channel.color) 
                : channel.color;
              
              const channelName = showCalibratedData && hasCalibrationData 
                ? `${channel.name} (${language === 'zh' ? '校准' : 'Cal'})`
                : channel.name;
              
              return (
                <Line
                  key={`${channel.id}_${showCalibratedData ? 'cal' : 'raw'}`}
                  type="monotone"
                  dataKey={dataKey}
                  stroke={lineColor}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, stroke: lineColor, strokeWidth: 2 }}
                  name={channelName}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}