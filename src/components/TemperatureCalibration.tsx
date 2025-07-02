import React, { useState } from 'react';
import { Settings, Zap, RotateCcw, Save, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

export interface CalibrationConfig {
  enabled: boolean;
  offsets: number[]; // 每个通道的校准偏移值
  appliedToData: boolean; // 是否已应用到数据
}

interface TemperatureCalibrationProps {
  config: CalibrationConfig;
  onConfigChange: (config: CalibrationConfig) => void;
  onApplyCalibration: () => void;
  channelCount: number;
  language: 'zh' | 'en';
  hasData: boolean;
}

export default function TemperatureCalibration({ 
  config, 
  onConfigChange, 
  onApplyCalibration,
  channelCount, 
  language, 
  hasData 
}: TemperatureCalibrationProps) {
  const { t } = useTranslation(language);
  const [isExpanded, setIsExpanded] = useState(false);
  const [presetMode, setPresetMode] = useState<'individual' | 'uniform'>('individual');
  const [uniformOffset, setUniformOffset] = useState<number>(0);

  const handleOffsetChange = (channelIndex: number, value: number) => {
    const newOffsets = [...config.offsets];
    newOffsets[channelIndex] = value;
    
    onConfigChange({
      ...config,
      offsets: newOffsets
    });
  };

  const handleToggleEnabled = () => {
    onConfigChange({
      ...config,
      enabled: !config.enabled
    });
  };

  const handleResetOffsets = () => {
    onConfigChange({
      ...config,
      offsets: new Array(16).fill(0),
      appliedToData: false
    });
  };

  const handleApplyUniformOffset = () => {
    const newOffsets = new Array(16).fill(0);
    for (let i = 0; i < channelCount; i++) {
      newOffsets[i] = uniformOffset;
    }
    
    onConfigChange({
      ...config,
      offsets: newOffsets
    });
  };

  const handleApplyCalibration = () => {
    if (!hasData) {
      alert(language === 'zh' 
        ? '没有数据可以校准，请先采集或导入数据'
        : 'No data to calibrate, please collect or import data first'
      );
      return;
    }

    if (config.offsets.every(offset => offset === 0)) {
      alert(language === 'zh' 
        ? '所有校准值都为0，无需校准'
        : 'All calibration values are 0, no calibration needed'
      );
      return;
    }

    const confirmMessage = language === 'zh' 
      ? '确定要应用校准值吗？这将修改所有现有数据的温度值。此操作不可撤销。'
      : 'Are you sure you want to apply calibration? This will modify temperature values of all existing data. This operation cannot be undone.';
    
    if (confirm(confirmMessage)) {
      onApplyCalibration();
      onConfigChange({
        ...config,
        appliedToData: true
      });
    }
  };

  // 预设校准值
  const presetOffsets = [
    { name: language === 'zh' ? '无校准' : 'No Calibration', values: new Array(16).fill(0) },
    { name: language === 'zh' ? '标准校准 (-1°C)' : 'Standard Calibration (-1°C)', values: new Array(16).fill(-1) },
    { name: language === 'zh' ? '高温校准 (-2°C)' : 'High Temp Calibration (-2°C)', values: new Array(16).fill(-2) },
    { name: language === 'zh' ? '低温校准 (+1°C)' : 'Low Temp Calibration (+1°C)', values: new Array(16).fill(1) }
  ];

  const activeChannelOffsets = config.offsets.slice(0, channelCount);
  const hasNonZeroOffsets = activeChannelOffsets.some(offset => offset !== 0);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      {/* 折叠标题栏 */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-400" />
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">
            {language === 'zh' ? '温度校准与预处理' : 'Temperature Calibration & Preprocessing'}
          </h3>
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            config.enabled 
              ? 'bg-green-900 text-green-300'
              : 'bg-gray-700 text-gray-400'
          }`}>
            {config.enabled ? t('enabled') : t('disabled')}
          </div>
          {hasNonZeroOffsets && (
            <div className="px-2 py-1 bg-orange-900 text-orange-300 rounded text-xs font-medium">
              {language === 'zh' ? '有校准值' : 'Has Offsets'}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {!isExpanded && hasData && hasNonZeroOffsets && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleApplyCalibration();
              }}
              className="flex items-center gap-2 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm transition-colors"
            >
              <Zap className="w-4 h-4" />
              {language === 'zh' ? '应用校准' : 'Apply Calibration'}
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
          {/* 校准开关和状态 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-300">
                  {language === 'zh' ? '启用温度校准' : 'Enable Temperature Calibration'}
                </span>
                <button
                  onClick={handleToggleEnabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.enabled ? 'bg-orange-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              {config.appliedToData && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-900 border border-green-700 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-green-300 text-sm">
                    {language === 'zh' ? '校准已应用到数据' : 'Calibration applied to data'}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetOffsets}
                className="flex items-center gap-2 px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {language === 'zh' ? '重置' : 'Reset'}
              </button>
            </div>
          </div>

          {config.enabled && (
            <>
              {/* 预设模式选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  {language === 'zh' ? '校准模式' : 'Calibration Mode'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPresetMode('individual')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      presetMode === 'individual'
                        ? 'border-orange-500 bg-orange-900 text-orange-300'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm font-medium">
                      {language === 'zh' ? '独立校准' : 'Individual Calibration'}
                    </div>
                    <div className="text-xs opacity-75 mt-1">
                      {language === 'zh' ? '为每个通道设置不同的校准值' : 'Set different calibration values for each channel'}
                    </div>
                  </button>

                  <button
                    onClick={() => setPresetMode('uniform')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      presetMode === 'uniform'
                        ? 'border-orange-500 bg-orange-900 text-orange-300'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm font-medium">
                      {language === 'zh' ? '统一校准' : 'Uniform Calibration'}
                    </div>
                    <div className="text-xs opacity-75 mt-1">
                      {language === 'zh' ? '为所有通道设置相同的校准值' : 'Set same calibration value for all channels'}
                    </div>
                  </button>
                </div>
              </div>

              {/* 统一校准模式 */}
              {presetMode === 'uniform' && (
                <div className="p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {language === 'zh' ? '统一校准偏移值 (°C)' : 'Uniform Calibration Offset (°C)'}
                      </label>
                      <input
                        type="number"
                        value={uniformOffset}
                        onChange={(e) => setUniformOffset(parseFloat(e.target.value) || 0)}
                        step="0.1"
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                        placeholder="0.0"
                      />
                    </div>
                    <button
                      onClick={handleApplyUniformOffset}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                    >
                      {language === 'zh' ? '应用到所有通道' : 'Apply to All Channels'}
                    </button>
                  </div>
                </div>
              )}

              {/* 预设校准值 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  {language === 'zh' ? '预设校准值' : 'Preset Calibration Values'}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {presetOffsets.map((preset, index) => (
                    <button
                      key={index}
                      onClick={() => onConfigChange({
                        ...config,
                        offsets: [...preset.values]
                      })}
                      className="px-3 py-2 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 独立通道校准 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  {language === 'zh' ? '通道校准偏移值 (°C)' : 'Channel Calibration Offsets (°C)'}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Array.from({ length: channelCount }, (_, i) => (
                    <div key={i} className="space-y-1">
                      <label className="block text-xs text-gray-400">
                        {language === 'zh' ? '通道' : 'Ch'} {i + 1}
                      </label>
                      <input
                        type="number"
                        value={config.offsets[i] || 0}
                        onChange={(e) => handleOffsetChange(i, parseFloat(e.target.value) || 0)}
                        step="0.1"
                        className="w-full px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded text-white focus:ring-2 focus:ring-orange-500"
                        placeholder="0.0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 校准应用 */}
              <div className="p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-2">
                      {language === 'zh' ? '应用校准到数据' : 'Apply Calibration to Data'}
                    </h4>
                    <p className="text-sm text-gray-300">
                      {language === 'zh' 
                        ? '点击下方按钮将校准值应用到所有现有数据。校准后的温度 = 原始温度 + 校准偏移值'
                        : 'Click the button below to apply calibration to all existing data. Calibrated temperature = Original temperature + Calibration offset'
                      }
                    </p>
                    {hasNonZeroOffsets && (
                      <div className="mt-2 text-xs text-orange-300">
                        {language === 'zh' 
                          ? `活跃通道校准值: ${activeChannelOffsets.map((offset, i) => `Ch${i+1}: ${offset > 0 ? '+' : ''}${offset}°C`).join(', ')}`
                          : `Active channel offsets: ${activeChannelOffsets.map((offset, i) => `Ch${i+1}: ${offset > 0 ? '+' : ''}${offset}°C`).join(', ')}`
                        }
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={handleApplyCalibration}
                    disabled={!hasData || !hasNonZeroOffsets}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    <Zap className="w-4 h-4" />
                    {language === 'zh' ? '应用校准' : 'Apply Calibration'}
                  </button>
                </div>
              </div>

              {/* 重要说明 */}
              <div className="p-4 bg-blue-900 border border-blue-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-300 font-medium">
                    {language === 'zh' ? '重要说明' : 'Important Notes'}
                  </span>
                </div>
                <ul className="text-blue-300 text-sm space-y-1">
                  <li>• <strong>{language === 'zh' ? '校准公式' : 'Calibration Formula'}</strong>: {language === 'zh' ? '校准后温度 = 原始温度 + 偏移值' : 'Calibrated Temperature = Original Temperature + Offset'}</li>
                  <li>• <strong>{language === 'zh' ? '数据记录' : 'Data Recording'}</strong>: {language === 'zh' ? '导出的CSV文件将包含原始温度和校准后温度两列' : 'Exported CSV files will include both original and calibrated temperature columns'}</li>
                  <li>• <strong>{language === 'zh' ? '应用时机' : 'Application Timing'}</strong>: {language === 'zh' ? '可以在数据采集前设置，也可以在采集后应用' : 'Can be set before data collection or applied after collection'}</li>
                  <li>• <strong>{language === 'zh' ? '不可撤销' : 'Irreversible'}</strong>: {language === 'zh' ? '应用校准后无法撤销，请谨慎操作' : 'Calibration application cannot be undone, please operate carefully'}</li>
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}