import React from 'react';
import { Thermometer, TrendingUp, TrendingDown, Minus, BarChart } from 'lucide-react';
import { TemperatureReading, ChannelConfig } from '../types';
import { formatTemperature, calculateMovingAverage } from '../utils/temperatureProcessor';

interface ChannelGridProps {
  readings: TemperatureReading[];
  channels: ChannelConfig[];
  onChannelToggle: (channelId: number) => void;
}

export default function ChannelGrid({ readings, channels, onChannelToggle }: ChannelGridProps) {
  const getChannelData = (channelId: number) => {
    const channelReadings = readings
      .filter(r => r.channel === channelId)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    if (channelReadings.length === 0) {
      return { 
        current: null, 
        trend: 'stable', 
        average: null,
        maxTemp: null,
        minTemp: null,
        readingCount: 0
      };
    }
    
    const temperatures = channelReadings.map(r => r.temperature);
    const current = channelReadings[channelReadings.length - 1].temperature;
    const previous = channelReadings.length > 1 ? channelReadings[channelReadings.length - 2].temperature : current;
    const trend = current > previous + 0.1 ? 'up' : current < previous - 0.1 ? 'down' : 'stable';
    const average = calculateMovingAverage(channelReadings.slice(-10).map(r => r.temperature));
    const maxTemp = Math.max(...temperatures);
    const minTemp = Math.min(...temperatures);
    
    return { 
      current, 
      trend, 
      average,
      maxTemp,
      minTemp,
      readingCount: channelReadings.length
    };
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-red-400" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-blue-400" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTemperatureColor = (temp: number | null) => {
    if (temp === null) return 'text-gray-400';
    if (temp < 20) return 'text-blue-400';
    if (temp > 40) return 'text-red-400';
    return 'text-green-400';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart className="w-5 h-5 text-cyan-400" />
          温度通道监测
        </h3>
        <div className="text-sm text-gray-400">
          点击通道卡片切换启用/禁用状态
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {channels.map(channel => {
          const data = getChannelData(channel.id);
          
          return (
            <div
              key={channel.id}
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-lg ${
                channel.enabled
                  ? 'border-gray-600 bg-gray-700 hover:border-gray-500'
                  : 'border-gray-700 bg-gray-800 opacity-60'
              }`}
              onClick={() => onChannelToggle(channel.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: channel.color }}
                  />
                  <span className="text-sm font-medium text-gray-300">
                    {channel.name}
                  </span>
                </div>
                <Thermometer className="w-4 h-4 text-gray-400" />
              </div>
              
              {/* 当前温度显示 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">当前温度</span>
                  {getTrendIcon(data.trend)}
                </div>
                
                <div className={`text-2xl font-bold ${getTemperatureColor(data.current)}`}>
                  {data.current !== null ? formatTemperature(data.current) : '--'}
                </div>
                
                {/* 紧凑统计 */}
                {data.readingCount > 0 && (
                  <div className="bg-gray-900 rounded-lg p-2 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-red-300">最高:</span>
                      <span className="text-xs font-medium text-red-400">
                        {formatTemperature(data.maxTemp!)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-blue-300">最低:</span>
                      <span className="text-xs font-medium text-blue-400">
                        {formatTemperature(data.minTemp!)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-3 pt-2 border-t border-gray-600">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">通道 {channel.id}</span>
                  <span className={`px-2 py-1 rounded-full ${
                    channel.enabled 
                      ? 'bg-green-900 text-green-300'
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {channel.enabled ? '活跃' : '禁用'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}