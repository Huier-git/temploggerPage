import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TemperatureReading, DisplayConfig, ChannelConfig } from '../types';
import { formatTemperature } from '../utils/temperatureProcessor';

interface TemperatureChartProps {
  readings: TemperatureReading[];
  displayConfig: DisplayConfig;
  channels: ChannelConfig[];
}

export default function TemperatureChart({ readings, displayConfig, channels }: TemperatureChartProps) {
  // Filter readings based on display mode and time window
  const filteredReadings = React.useMemo(() => {
    if (displayConfig.mode === 'sliding') {
      const cutoffTime = Date.now() - (displayConfig.timeWindow * 60 * 1000);
      return readings.filter(reading => reading.timestamp >= cutoffTime);
    }
    return readings;
  }, [readings, displayConfig]);

  // Get start time for relative time calculation
  const startTime = React.useMemo(() => {
    if (filteredReadings.length === 0) return Date.now();
    return Math.min(...filteredReadings.map(r => r.timestamp));
  }, [filteredReadings]);

  // Transform data for chart
  const chartData = React.useMemo(() => {
    const dataMap = new Map<number, any>();
    
    // 如果没有数据，返回空数组
    if (filteredReadings.length === 0) {
      return [];
    }
    
    filteredReadings.forEach(reading => {
      const timestamp = reading.timestamp;
      const relativeTime = displayConfig.relativeTime 
        ? Math.round((timestamp - startTime) / 1000) // relative seconds
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
      dataMap.get(timestamp)[`channel${reading.channel}`] = reading.temperature;
    });
    
    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [filteredReadings, displayConfig.relativeTime, startTime]);

  // 计算Y轴范围 - 统一处理，确保一致性
  const calculateYAxisDomain = React.useCallback((data: any[], channelsToUse: ChannelConfig[]) => {
    if (data.length === 0) return [0, 50];
    
    const allTemperatures: number[] = [];
    data.forEach(item => {
      channelsToUse.filter(ch => ch.enabled).forEach(channel => {
        const temp = item[`channel${channel.id}`];
        if (typeof temp === 'number' && !isNaN(temp)) {
          allTemperatures.push(temp);
        }
      });
    });
    
    if (allTemperatures.length === 0) return [0, 50];
    
    const minTemp = Math.min(...allTemperatures);
    const maxTemp = Math.max(...allTemperatures);
    const range = maxTemp - minTemp;
    const padding = Math.max(range * 0.1, 2); // 至少2度的padding
    
    return [
      Math.floor((minTemp - padding) * 10) / 10, // 保留1位小数
      Math.ceil((maxTemp + padding) * 10) / 10   // 保留1位小数
    ];
  }, []);

  const yAxisDomain = React.useMemo(() => {
    return calculateYAxisDomain(chartData, channels);
  }, [chartData, channels, calculateYAxisDomain]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 shadow-xl">
          <p className="text-gray-300 text-sm mb-2 font-medium">
            {displayConfig.relativeTime ? `Time: ${label}` : `Time: ${label}`}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toFixed(1)}°C`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Render individual chart for each channel
  const renderIndividualChart = (channel: ChannelConfig) => {
    const channelData = chartData.map(item => ({
      ...item,
      temperature: item[`channel${channel.id}`]
    })).filter(item => item.temperature !== undefined);

    if (channelData.length === 0) {
      return (
        <div key={channel.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4 h-64 flex items-center justify-center">
          <p className="text-gray-400 text-sm">{channel.name} - No Data</p>
        </div>
      );
    }

    // 计算单个通道的Y轴范围 - 使用统一的计算方法
    const channelTemps = channelData.map(d => d.temperature).filter(t => !isNaN(t));
    const minTemp = Math.min(...channelTemps);
    const maxTemp = Math.max(...channelTemps);
    const range = maxTemp - minTemp;
    const padding = Math.max(range * 0.1, 1);
    const channelYDomain = [
      Math.floor((minTemp - padding) * 10) / 10, // 保留1位小数
      Math.ceil((maxTemp + padding) * 10) / 10   // 保留1位小数
    ];

    return (
      <div key={channel.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: channel.color }}
          />
          {channel.name}
        </h4>
        
        <div style={{ width: '100%', height: '200px' }}>
          <ResponsiveContainer>
            <LineChart data={channelData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              {displayConfig.showGrid && (
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              )}
              <XAxis 
                dataKey="time" 
                stroke="#9CA3AF"
                fontSize={10}
                interval="preserveStartEnd"
                tick={{ fill: '#9CA3AF' }}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={10}
                tickFormatter={(value) => `${value.toFixed(1)}°C`}
                tick={{ fill: '#9CA3AF' }}
                domain={channelYDomain}
              />
              <Tooltip content={<CustomTooltip />} />
              
              <Line
                type="monotone"
                dataKey="temperature"
                stroke={channel.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: channel.color, strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 h-[600px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-400 text-lg">No Temperature Data</p>
          <p className="text-gray-500 text-sm mt-2">Start test mode or connect device to begin monitoring</p>
        </div>
      </div>
    );
  }

  // Individual view: display independent subplots
  if (displayConfig.viewMode === 'individual') {
    const enabledChannels = channels.filter(channel => channel.enabled);
    
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 h-[600px] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">
            Individual View - Channel Analysis
          </h3>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">
              Display Mode: {displayConfig.mode === 'sliding' ? `Sliding Window (${displayConfig.timeWindow}min)` : 'Full History'}
            </div>
            <div className="text-sm text-gray-400">
              Time Axis: {displayConfig.relativeTime ? 'Relative Time' : 'Absolute Time'}
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

  // Combined view: all curves in the same chart - 固定高度600px
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 h-[600px] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">
          Combined View - Temperature Trends
        </h3>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            Display Mode: {displayConfig.mode === 'sliding' ? `Sliding Window (${displayConfig.timeWindow}min)` : 'Full History'}
          </div>
          <div className="text-sm text-gray-400">
            Time Axis: {displayConfig.relativeTime ? 'Relative Time (min:sec)' : 'Absolute Time'}
          </div>
          <div className="text-sm text-gray-400">
            Data Points: {chartData.length.toLocaleString()}
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData} 
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            {displayConfig.showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            )}
            <XAxis 
              dataKey="time" 
              stroke="#9CA3AF"
              fontSize={12}
              interval="preserveStartEnd"
              tick={{ fill: '#9CA3AF' }}
            />
            <YAxis 
              stroke="#9CA3AF"
              fontSize={12}
              tickFormatter={(value) => `${value.toFixed(1)}°C`}
              tick={{ fill: '#9CA3AF' }}
              domain={yAxisDomain}
            />
            <Tooltip content={<CustomTooltip />} />
            {displayConfig.showLegend && (
              <Legend 
                wrapperStyle={{ color: '#9CA3AF' }}
                iconType="line"
              />
            )}
            
            {channels.filter(channel => channel.enabled).map(channel => (
              <Line
                key={channel.id}
                type="monotone"
                dataKey={`channel${channel.id}`}
                stroke={channel.color}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, stroke: channel.color, strokeWidth: 2 }}
                name={channel.name}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}