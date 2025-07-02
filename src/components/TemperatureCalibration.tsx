import React, { useState, useEffect } from 'react';
import { Settings, Zap, RotateCcw, Save, AlertTriangle, CheckCircle, Calculator, ChevronDown, ChevronUp } from 'lucide-react';
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
}

export default function TemperatureCalibration({ 
  channels, 
  onApplyCalibration, 
  language, 
  maxChannels 
}: TemperatureCalibrationProps) {
  const { t } = useTranslation(language);
  const [offsets, setOffsets] = useState<CalibrationOffset[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [lastAppliedTime, setLastAppliedTime] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false); // 默认折叠状态

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
                        {language === 'zh' ? '校准后' : 'After calibration'}: T + ({offset.offset > 0 ? '+' : ''}{offset.offset})°C
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
              <li>• <strong>{language === 'zh' ? '校准公式' : 'Calibration Formula'}</strong>: {language === 'zh' ? '校准后温度 = 原始温度 + 偏移值' : 'Calibrated Temperature = Original Temperature + Offset'}</li>
              <li>• <strong>{language === 'zh' ? '正偏移值' : 'Positive Offset'}</strong>: {language === 'zh' ? '增加温度读数（如传感器读数偏低）' : 'Increases temperature reading (if sensor reads low)'}</li>
              <li>• <strong>{language === 'zh' ? '负偏移值' : 'Negative Offset'}</strong>: {language === 'zh' ? '减少温度读数（如传感器读数偏高）' : 'Decreases temperature reading (if sensor reads high)'}</li>
              <li>• <strong>{language === 'zh' ? '应用范围' : 'Application Scope'}</strong>: {language === 'zh' ? '校准将应用到当前会话的所有历史数据' : 'Calibration applies to all historical data in current session'}</li>
              <li>• <strong>{language === 'zh' ? '数据导出' : 'Data Export'}</strong>: {language === 'zh' ? 'CSV导出将包含原始温度和校准后温度两列' : 'CSV export will include both original and calibrated temperature columns'}</li>
              <li>• <strong>{language === 'zh' ? '曲线显示' : 'Chart Display'}</strong>: {language === 'zh' ? '可在显示控制面板中切换查看原始/校准数据' : 'Switch between original/calibrated data view in display controls'}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}