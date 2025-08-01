import React from 'react';
import { Thermometer, TrendingUp, TrendingDown, Minus, BarChart, Lock } from 'lucide-react';
import { TemperatureReading, ChannelConfig } from '../types';
import { formatTemperature, calculateMovingAverage } from '../utils/temperatureProcessor';
import { useTranslation } from '../utils/i18n';

interface ChannelGridProps {
  readings: TemperatureReading[];
  channels: ChannelConfig[];
  onChannelToggle: (channelId: number) => void;
  language: 'zh' | 'en';
  maxChannels: number; // 新增：最大允许的通道数
  isDarkMode: boolean;
}

export default function ChannelGrid({ readings, channels, onChannelToggle, language, maxChannels, isDarkMode }: ChannelGridProps) {
  const { t } = useTranslation(language);
  
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
    <div className={`rounded-lg p-6 border ${
      isDarkMode 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-lg font-semibold flex items-center gap-2 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          <BarChart className="w-5 h-5 text-cyan-400" />
          {t('temperatureChannelMonitoring')}
        </h3>
        <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {t('clickChannelToToggle')}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {channels.map(channel => {
          const data = getChannelData(channel.id);
          const isLocked = channel.id > maxChannels; // 超出寄存器数量的通道被锁定
          
          return (
            <div
              key={channel.id}
              className={`p-4 rounded-lg border-2 transition-all ${
                isLocked 
                  ? `opacity-40 cursor-not-allowed ${
                      isDarkMode 
                        ? 'border-gray-700 bg-gray-900' 
                        : 'border-gray-300 bg-gray-100'
                    }`
                  : channel.enabled
                    ? `cursor-pointer hover:shadow-lg ${
                        isDarkMode 
                          ? 'border-gray-600 bg-gray-700 hover:border-gray-500' 
                          : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                      }`
                    : `opacity-60 cursor-pointer ${
                        isDarkMode 
                          ? 'border-gray-700 bg-gray-800' 
                          : 'border-gray-400 bg-gray-200'
                      }`
              }`}
              onClick={() => !isLocked && onChannelToggle(channel.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: isLocked ? '#6B7280' : channel.color }}
                  />
                  <span className="text-sm font-medium text-gray-300">
                    {channel.name}
                  </span>
                  <span className={`text-sm font-medium ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {isLocked && <Lock className="w-3 h-3 text-gray-500" />}
                  <Thermometer className="w-4 h-4 text-gray-400" />
                </div>
              </div>
              
              {/* 当前温度显示 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{t('currentTemperature')}</span>
                  {!isLocked && getTrendIcon(data.trend)}
                </div>
                
                <div className={`text-2xl font-bold ${
                  isLocked ? 'text-gray-500' : getTemperatureColor(data.current)
                }`}>
                  {!isLocked && data.current !== null ? formatTemperature(data.current) : '--'}
                </div>
                
                {/* 紧凑统计 */}
                {!isLocked && data.readingCount > 0 && (
                  <div className={`rounded-lg p-2 space-y-1 ${
                    isDarkMode ? 'bg-gray-900' : 'bg-gray-100'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`text-xs ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>{t('highest')}:</span>
                      <span className={`text-xs font-medium ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                        {formatTemperature(data.maxTemp!)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className={`text-xs ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>{t('lowest')}:</span>
                      <span className={`text-xs font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                        {formatTemperature(data.minTemp!)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-3 pt-2 border-t border-gray-600">
                <div className="flex items-center justify-between text-xs">
                  <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t('channel')} {channel.id}</span>
                  <span className={`px-2 py-1 rounded-full ${
                    isLocked
                      ? `${isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-300 text-gray-600'}`
                      : channel.enabled 
                        ? `${isDarkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'}`
                        : `${isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'}`
                  }`}>
                    {isLocked 
                      ? (language === 'zh' ? '锁定' : 'Locked')
                      : channel.enabled 
                        ? t('active') 
                        : t('disabled')
                    }
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* 通道状态说明 */}
      <div className={`mt-4 p-3 rounded-lg ${
        isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
      }`}>
        <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart className="w-4 h-4 text-cyan-400" />
            <span className="font-medium">{t('channelStatus')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>{language === 'zh' ? '活跃通道' : 'Active channels'}: {channels.filter(ch => ch.enabled && ch.id <= maxChannels).length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <span>{language === 'zh' ? '可用通道' : 'Available channels'}: {maxChannels}</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-3 h-3 text-gray-500" />
              <span>{language === 'zh' ? '锁定通道' : 'Locked channels'}: {16 - maxChannels}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span>{language === 'zh' ? '总通道数' : 'Total channels'}: 16</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}