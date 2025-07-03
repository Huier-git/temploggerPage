import React, { useState, useEffect } from 'react';
import { Settings, Zap, RotateCcw, Save, AlertTriangle, CheckCircle, Calculator, ChevronDown, ChevronUp, Target, Thermometer } from 'lucide-react';
import { ChannelConfig } from '../types';
import { useTranslation } from '../utils/i18n';

interface CalibrationOffset {
  channelId: number;
  offset: number;
  enabled: boolean;
}

interface TemperatureCalibrationProps {
  channels: ChannelConfig[];
  onApplyCalibration: (offsets: CalibrationOffset[]) => void;
  language: 'zh' | 'en';
  maxChannels: number;
  currentReadings?: Array<{ channel: number; temperature: number }>; // 新增：当前读数
}

export default function TemperatureCalibration({ 
  channels, 
  onApplyCalibration, 
  language, 
  maxChannels,
  currentReadings = [] // 新增：当前读数
}: TemperatureCalibrationProps) {
  const { t } = useTranslation(language);
  const [offsets, setOffsets] = useState<CalibrationOffset[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [lastAppliedTime, setLastAppliedTime] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 新增：一键校准状态
  const [oneClickTargetTemp, setOneClickTargetTemp] = useState<string>('25.0');
  const [showOneClickCalibration, setShowOneClickCalibration] = useState(false);

  // 初始化校准偏移值
  useEffect(() => {
    const initialOffsets = channels
      .filter(channel => channel.id <= maxChannels)
      .map(channel => ({
        channelId: channel.id,
        offset: 0,
        enabled: channel.enabled
      }));
    setOffsets(initialOffsets);
  }, [channels, maxChannels]);

  const handleOffsetChange = (channelId: number, value: number) => {
    setOffsets(prev => prev.map(offset => 
      offset.channelId === channelId 
        ? { ...offset, offset: value }
        : offset
    ));
  };

  const handleEnabledChange = (channelId: number, enabled: boolean) => {
    setOffsets(prev => prev.map(offset => 
      offset.channelId === channelId 
        ? { ...offset, enabled }
        : offset
    ));
  };

  // 新增：一键校准功能
  const handleOneClickCalibration = () => {
    const targetTemp = parseFloat(oneClickTargetTemp);
    
    if (isNaN(targetTemp)) {
      alert(language === 'zh' ? '请输入有效的目标温度' : 'Please enter a valid target temperature');
      return;
    }

    if (currentReadings.length === 0) {
      alert(language === 'zh' ? '没有当前温度数据可用于校准' : 'No current temperature data available for calibration');
      return;
    }

    // 计算每个通道的当前温度
    const channelTemps = new Map<number, number>();
    currentReadings.forEach(reading => {
      channelTemps.set(reading.channel, reading.temperature);
    });

    // 检查有多少个通道有数据
    const availableChannels = Array.from(channelTemps.keys()).filter(ch => ch <= maxChannels);
    
    if (availableChannels.length === 0) {
      alert(language === 'zh' ? '没有可用的通道数据进行校准' : 'No available channel data for calibration');
      return;
    }

    // 显示确认对话框
    const confirmMessage = language === 'zh' 
      ? `确定要将所有 ${availableChannels.length} 个通道的温度校准到 ${targetTemp}°C 吗？\n\n这将自动计算每个通道的偏移值：\n${availableChannels.map(ch => {
          const currentTemp = channelTemps.get(ch) || 0;
          const offset = targetTemp - currentTemp;
          return `通道 ${ch}: ${currentTemp.toFixed(1)}°C → ${targetTemp}°C (偏移: ${offset > 0 ? '+' : ''}${offset.toFixed(1)}°C)`;
        }).join('\n')}\n\n此操作将覆盖当前的校准设置。`
      : `Are you sure you want to calibrate all ${availableChannels.length} channels to ${targetTemp}°C?\n\nThis will automatically calculate offset values for each channel:\n${availableChannels.map(ch => {
          const currentTemp = channelTemps.get(ch) || 0;
          const offset = targetTemp - currentTemp;
          return `Channel ${ch}: ${currentTemp.toFixed(1)}°C → ${targetTemp}°C (Offset: ${offset > 0 ? '+' : ''}${offset.toFixed(1)}°C)`;
        }).join('\n')}\n\nThis will override current calibration settings.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    // 计算并应用偏移值
    const newOffsets = offsets.map(offset => {
      const currentTemp = channelTemps.get(offset.channelId);
      if (currentTemp !== undefined && offset.channelId <= maxChannels) {
        const calculatedOffset = targetTemp - currentTemp;
        return {
          ...offset,
          offset: calculatedOffset,
          enabled: true // 自动启用校准
        };
      }
      return offset;
    });

    setOffsets(newOffsets);
    
    // 显示成功消息
    const successMessage = language === 'zh' 
      ? `成功设置 ${availableChannels.length} 个通道的校准值，目标温度: ${targetTemp}°C`
      : `Successfully set calibration values for ${availableChannels.length} channels, target temperature: ${targetTemp}°C`;
    
    alert(successMessage);
  };

  const handleApplyCalibration = async () => {
    setIsApplying(true);
    
    try {
      // 只应用启用通道的校准值
      const activeOffsets = offsets.filter(offset => offset.enabled);
      await onApplyCalibration(activeOffsets);
      setLastAppliedTime(Date.now());
      
      // 显示成功提示
      const message = language === 'zh' 
        ? `成功应用 ${activeOffsets.length} 个通道的校准值`
        : `Successfully applied calibration for ${activeOffsets.length} channels`;
      alert(message);
    } catch (error) {
      console.error('校准应用失败:', error);
      const message = language === 'zh' 
        ? '校准应用失败，请重试'
        : 'Calibration application failed, please try again';
      alert(message);
    } finally {
      setIsApplying(false);
    }
  };

  const handleResetOffsets = () => {
    setOffsets(prev => prev.map(offset => ({ ...offset, offset: 0 })));
  };

  const handleSetAllOffsets = (value: number) => {
    setOffsets(prev => prev.map(offset => ({ ...offset, offset: value })));
  };

  const getActiveOffsetsCount = () => {
    return offsets.filter(offset => offset.enabled && offset.offset !== 0).length;
  };

  const hasNonZeroOffsets = () => {
    return offsets.some(offset => offset.offset !== 0);
  };

  // 获取当前温度显示
  const getCurrentTemperature = (channelId: number): number | null => {
    const reading = currentReadings.find(r => r.channel === channelId);
    return reading ? reading.temperature : null;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      {/* 折叠标题栏 */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-orange-400" />
            <Settings className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">
            {language === 'zh' ? '温度校准与预处理' : 'Temperature Calibration & Preprocessing'}
          </h2>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            getActiveOffsetsCount() > 0
              ? 'bg-orange-900 text-orange-300 border border-orange-700'
              : 'bg-gray-700 text-gray-300 border border-gray-600'
          }`}>
            {getActiveOffsetsCount()} {language === 'zh' ? '个通道已校准' : 'channels calibrated'}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isExpanded && lastAppliedTime && (
            <div className="text-sm text-green-400">
              {language === 'zh' ? '最后校准' : 'Last calibrated'}: {new Date(lastAppliedTime).toLocaleTimeString()}
            </div>
          )}
          
          {!isExpanded && hasNonZeroOffsets() && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleApplyCalibration();
              }}
              disabled={isApplying}
              className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isApplying ? (
                <>
                  <Zap className="w-4 h-4 animate-pulse" />
                  {language === 'zh' ? '应用中...' : 'Applying...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {language === 'zh' ? '应用校准' : 'Apply Calibration'}
                </>
              )}
            </button>
          )}
          
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="mt-6 space-y-6">
          {/* 状态信息 */}
          {lastAppliedTime && (
            <div className="text-sm text-green-400 text-center">
              {language === 'zh' ? '最后校准时间' : 'Last calibrated'}: {new Date(lastAppliedTime).toLocaleString()}
            </div>
          )}

          {/* 一键校准功能 */}
          <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg border border-purple-600">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">
                  {language === 'zh' ? '一键温度校准' : 'One-Click Temperature Calibration'}
                </h3>
              </div>
              <button
                onClick={() => setShowOneClickCalibration(!showOneClickCalibration)}
                className="text-purple-300 hover:text-purple-200 transition-colors"
              >
                {showOneClickCalibration ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            
            {showOneClickCalibration && (
              <div className="space-y-4">
                <div className="text-purple-200 text-sm">
                  {language === 'zh' 
                    ? '输入目标温度，系统将自动计算所有通道的偏移值，使所有读数统一到目标温度。'
                    : 'Enter target temperature, system will automatically calculate offset values for all channels to unify all readings to the target temperature.'
                  }
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      <Thermometer className="w-4 h-4 inline mr-1" />
                      {language === 'zh' ? '目标温度 (°C)' : 'Target Temperature (°C)'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={oneClickTargetTemp}
                      onChange={(e) => setOneClickTargetTemp(e.target.value)}
                      className="w-full px-3 py-2 bg-purple-800 border border-purple-600 rounded-lg text-white focus:ring-2 focus:ring-purple-400"
                      placeholder="25.0"
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      onClick={handleOneClickCalibration}
                      disabled={currentReadings.length === 0}
                      className="flex items-center gap-2 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                    >
                      <Target className="w-4 h-4" />
                      {language === 'zh' ? '一键校准' : 'One-Click Calibrate'}
                    </button>
                  </div>
                  
                  <div className="text-sm text-purple-300">
                    <div className="font-medium">{language === 'zh' ? '当前数据状态:' : 'Current Data Status:'}</div>
                    <div>
                      {currentReadings.length > 0 
                        ? `${currentReadings.length} ${language === 'zh' ? '个通道有数据' : 'channels with data'}`
                        : (language === 'zh' ? '无当前数据' : 'No current data')
                      }
                    </div>
                  </div>
                </div>
                
                {/* 当前温度预览 */}
                {currentReadings.length > 0 && (
                  <div className="p-3 bg-purple-800 rounded-lg">
                    <div className="text-sm font-medium text-purple-200 mb-2">
                      {language === 'zh' ? '当前温度读数:' : 'Current Temperature Readings:'}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                      {currentReadings
                        .filter(reading => reading.channel <= maxChannels)
                        .sort((a, b) => a.channel - b.channel)
                        .map(reading => {
                          const targetTemp = parseFloat(oneClickTargetTemp) || 25;
                          const offset = targetTemp - reading.temperature;
                          return (
                            <div key={reading.channel} className="bg-purple-700 rounded p-2">
                              <div className="text-purple-200">Ch{reading.channel}</div>
                              <div className="text-white font-mono">{reading.temperature.toFixed(1)}°C</div>
                              <div className={`text-xs ${offset > 0 ? 'text-green-300' : offset < 0 ? 'text-red-300' : 'text-gray-300'}`}>
                                {offset > 0 ? '+' : ''}{offset.toFixed(1)}°C
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 快速操作 */}
          <div className="p-4 bg-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-3">
              {language === 'zh' ? '快速操作' : 'Quick Actions'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {language === 'zh' ? '批量设置偏移值' : 'Batch Set Offset'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const value = parseFloat((e.target as HTMLInputElement).value) || 0;
                        handleSetAllOffsets(value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.querySelector('input[placeholder="0.0"]') as HTMLInputElement;
                      const value = parseFloat(input.value) || 0;
                      handleSetAllOffsets(value);
                      input.value = '';
                    }}
                    className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                  >
                    {language === 'zh' ? '应用' : 'Apply'}
                  </button>
                </div>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleResetOffsets}
                  className="flex items-center gap-2 w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  {language === 'zh' ? '重置所有偏移值' : 'Reset All Offsets'}
                </button>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleApplyCalibration}
                  disabled={isApplying || !hasNonZeroOffsets()}
                  className="flex items-center gap-2 w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {isApplying ? (
                    <>
                      <Zap className="w-4 h-4 animate-pulse" />
                      {language === 'zh' ? '应用中...' : 'Applying...'}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {language === 'zh' ? '应用校准' : 'Apply Calibration'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 通道校准设置 */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              {language === 'zh' ? '通道校准设置' : 'Channel Calibration Settings'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {offsets.map(offset => {
                const channel = channels.find(ch => ch.id === offset.channelId);
                if (!channel) return null;
                
                const isLocked = channel.id > maxChannels;
                const currentTemp = getCurrentTemperature(offset.channelId);
                
                return (
                  <div
                    key={offset.channelId}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isLocked 
                        ? 'border-gray-700 bg-gray-900 opacity-40'
                        : offset.enabled
                          ? 'border-orange-500 bg-gray-700'
                          : 'border-gray-600 bg-gray-800'
                    }`}
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
                      </div>
                      
                      {!isLocked && (
                        <input
                          type="checkbox"
                          checked={offset.enabled}
                          onChange={(e) => handleEnabledChange(offset.channelId, e.target.checked)}
                          className="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500"
                        />
                      )}
                    </div>
                    
                    {/* 当前温度显示 */}
                    {!isLocked && currentTemp !== null && (
                      <div className="mb-2 p-2 bg-gray-600 rounded text-xs">
                        <div className="text-gray-400">{language === 'zh' ? '当前温度' : 'Current Temp'}</div>
                        <div className="text-white font-mono">{currentTemp.toFixed(1)}°C</div>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        {language === 'zh' ? '校准偏移值 (°C)' : 'Calibration Offset (°C)'}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={offset.offset}
                        onChange={(e) => handleOffsetChange(offset.channelId, parseFloat(e.target.value) || 0)}
                        disabled={isLocked || !offset.enabled}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="0.0"
                      />
                    </div>
                    
                    {offset.offset !== 0 && offset.enabled && !isLocked && (
                      <div className="mt-2 text-xs text-orange-400">
                        {language === 'zh' ? '校准后' : 'After calibration'}: 
                        {currentTemp !== null && (
                          <span className="ml-1 font-mono">
                            {(currentTemp + offset.offset).toFixed(1)}°C
                          </span>
                        )}
                        <div>T + ({offset.offset > 0 ? '+' : ''}{offset.offset})°C</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 说明信息 */}
          <div className="p-4 bg-blue-900 border border-blue-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 font-medium">
                {language === 'zh' ? '校准说明' : 'Calibration Instructions'}
              </span>
            </div>
            <ul className="text-blue-300 text-sm space-y-1">
              <li>• <strong>{language === 'zh' ? '一键校准' : 'One-Click Calibration'}</strong>: {language === 'zh' ? '自动计算所有通道偏移值，统一到目标温度' : 'Automatically calculate offset values for all channels to unify to target temperature'}</li>
              <li>• <strong>{language === 'zh' ? '校准公式' : 'Calibration Formula'}</strong>: {language === 'zh' ? '校准后温度 = 原始温度 + 偏移值' : 'Calibrated Temperature = Original Temperature + Offset'}</li>
              <li>• <strong>{language === 'zh' ? '正偏移值' : 'Positive Offset'}</strong>: {language === 'zh' ? '增加温度读数（如传感器读数偏低）' : 'Increases temperature reading (if sensor reads low)'}</li>
              <li>• <strong>{language === 'zh' ? '负偏移值' : 'Negative Offset'}</strong>: {language === 'zh' ? '减少温度读数（如传感器读数偏高）' : 'Decreases temperature reading (if sensor reads high)'}</li>
              <li>• <strong>{language === 'zh' ? '应用范围' : 'Application Scope'}</strong>: {language === 'zh' ? '校准将应用到当前会话的所有历史数据' : 'Calibration applies to all historical data in current session'}</li>
              <li>• <strong>{language === 'zh' ? '数据导出' : 'Data Export'}</strong>: {language === 'zh' ? 'CSV导出将包含原始温度和校准后温度两列' : 'CSV export will include both original and calibrated temperature columns'}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}