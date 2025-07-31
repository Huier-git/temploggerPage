import React, { useState } from 'react';
import { TestTube, Play, Pause, Settings, AlertTriangle } from 'lucide-react';
import { TestModeConfig } from '../types';
import { useTranslation } from '../utils/i18n';

interface TestModeControlsProps {
  config: TestModeConfig;
  onConfigChange: (config: TestModeConfig) => void;
  language: 'zh' | 'en';
  isDarkMode: boolean;
}

export default function TestModeControls({ config, onConfigChange, language, isDarkMode }: TestModeControlsProps) {
  const { t } = useTranslation(language);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validateConfig = (newConfig: TestModeConfig): string[] => {
    const errors: string[] = [];
    
    if (newConfig.temperatureRange.min >= newConfig.temperatureRange.max) {
      errors.push(language === 'zh' 
        ? '最低温度必须小于最高温度' 
        : 'Minimum temperature must be less than maximum temperature'
      );
    }
    
    if (newConfig.temperatureRange.min < -50 || newConfig.temperatureRange.max > 200) {
      errors.push(language === 'zh' 
        ? '温度范围应在-50°C到200°C之间' 
        : 'Temperature range should be between -50°C and 200°C'
      );
    }
    
    if (newConfig.dataGenerationRate <= 0 || newConfig.dataGenerationRate > 10) {
      errors.push(language === 'zh' 
        ? '数据生成频率应在0.1到10次/秒之间' 
        : 'Data generation rate should be between 0.1 and 10 readings per second'
      );
    }
    
    if (newConfig.noiseLevel < 0 || newConfig.noiseLevel > 1) {
      errors.push(language === 'zh' 
        ? '噪声水平应在0%到100%之间' 
        : 'Noise level should be between 0% and 100%'
      );
    }
    
    return errors;
  };

  const handleToggleTestMode = () => {
    const newConfig = {
      ...config,
      enabled: !config.enabled
    };
    
    if (newConfig.enabled) {
      const errors = validateConfig(newConfig);
      setValidationErrors(errors);
      
      if (errors.length === 0) {
        onConfigChange(newConfig);
      }
    } else {
      setValidationErrors([]);
      onConfigChange(newConfig);
    }
  };

  const handleConfigChange = (field: keyof TestModeConfig, value: any) => {
    const newConfig = {
      ...config,
      [field]: value
    };
    
    const errors = validateConfig(newConfig);
    setValidationErrors(errors);
    
    onConfigChange(newConfig);
  };

  const handleRangeChange = (field: 'min' | 'max', value: number) => {
    const newConfig = {
      ...config,
      temperatureRange: {
        ...config.temperatureRange,
        [field]: value
      }
    };
    
    const errors = validateConfig(newConfig);
    setValidationErrors(errors);
    
    onConfigChange(newConfig);
  };

  const resetToDefaults = () => {
    const defaultConfig: TestModeConfig = {
      enabled: false,
      dataGenerationRate: 1,
      temperatureRange: { min: 15, max: 45 },
      noiseLevel: 0.3
    };
    
    setValidationErrors([]);
    onConfigChange(defaultConfig);
  };

  return (
    <div className={`rounded-lg p-4 border shadow-md ${
      isDarkMode 
        ? 'bg-gradient-to-r from-purple-800 to-indigo-800 border-purple-600' 
        : 'bg-gradient-to-r from-purple-100 to-indigo-100 border-purple-300'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600 rounded-lg">
            <TestTube className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>{t('testMode')}</h2>
            <p className={`text-xs ${
              isDarkMode ? 'text-purple-200' : 'text-purple-700'
            }`}>{t('simulatedDataGeneration')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            config.enabled 
              ? 'bg-green-900 text-green-300 border border-green-700'
             : isDarkMode ? 'bg-gray-700 text-gray-300 border border-gray-600' : 'bg-gray-200 text-gray-700 border border-gray-400'
          }`}>
            {config.enabled ? t('active') : t('inactive')}
          </div>
          
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm transition-colors text-white ${
              isDarkMode 
                ? 'bg-purple-700 hover:bg-purple-600' 
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            <Settings className="w-3 h-3" />
            {showAdvanced ? (language === 'zh' ? '隐藏' : 'Hide') : t('settings')}
          </button>
          
          <button
            onClick={handleToggleTestMode}
            disabled={validationErrors.length > 0 && !config.enabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              config.enabled
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {config.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {config.enabled ? t('stop') : t('start')}
          </button>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className={`mt-3 p-3 border rounded-lg ${
          isDarkMode 
            ? 'bg-red-900 border-red-700' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className={`font-medium text-sm ${
              isDarkMode ? 'text-red-300' : 'text-red-700'
            }`}>{t('configurationErrors')}</span>
          </div>
          <ul className={`text-xs space-y-1 ${
            isDarkMode ? 'text-red-300' : 'text-red-700'
          }`}>
            {validationErrors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className={`grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 pt-4 border-t ${
          isDarkMode ? 'border-purple-600' : 'border-purple-300'
        }`}>
          <div>
            <label className={`block text-xs font-medium mb-1 ${
              isDarkMode ? 'text-purple-200' : 'text-purple-700'
            }`}>
              {t('generationRate')} (Hz)
            </label>
            <select
              value={config.dataGenerationRate}
              onChange={(e) => handleConfigChange('dataGenerationRate', parseFloat(e.target.value))}
              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-400 ${
                isDarkMode 
                  ? 'bg-purple-700 border-purple-600 text-white' 
                  : 'bg-white border-purple-300 text-gray-900'
              }`}
            >
              <option value={0.1}>0.1 Hz</option>
              <option value={0.5}>0.5 Hz</option>
              <option value={1}>1.0 Hz</option>
              <option value={2}>2.0 Hz</option>
              <option value={5}>5.0 Hz</option>
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${
              isDarkMode ? 'text-purple-200' : 'text-purple-700'
            }`}>
              {t('minTemperature')} (°C)
            </label>
            <input
              type="number"
              value={config.temperatureRange.min}
              onChange={(e) => handleRangeChange('min', parseFloat(e.target.value))}
              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-400 ${
                isDarkMode 
                  ? 'bg-purple-700 border-purple-600 text-white' 
                  : 'bg-white border-purple-300 text-gray-900'
              }`}
              min={-50}
              max={200}
              step={0.1}
            />
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${
              isDarkMode ? 'text-purple-200' : 'text-purple-700'
            }`}>
              {t('maxTemperature')} (°C)
            </label>
            <input
              type="number"
              value={config.temperatureRange.max}
              onChange={(e) => handleRangeChange('max', parseFloat(e.target.value))}
              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-400 ${
                isDarkMode 
                  ? 'bg-purple-700 border-purple-600 text-white' 
                  : 'bg-white border-purple-300 text-gray-900'
              }`}
              min={-50}
              max={200}
              step={0.1}
            />
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${
              isDarkMode ? 'text-purple-200' : 'text-purple-700'
            }`}>
              {t('noiseLevel')}: {(config.noiseLevel * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.noiseLevel}
              onChange={(e) => handleConfigChange('noiseLevel', parseFloat(e.target.value))}
              className={`w-full h-1 rounded appearance-none cursor-pointer ${
                isDarkMode 
                  ? 'bg-purple-700' 
                  : 'bg-purple-300'
              }`}
            />
          </div>

          <div className="md:col-span-4 flex justify-end">
            <button
              onClick={resetToDefaults}
              className={`px-3 py-1 rounded text-sm transition-colors text-white ${
                isDarkMode 
                  ? 'bg-purple-600 hover:bg-purple-500' 
                  : 'bg-purple-500 hover:bg-purple-600'
              }`}
            >
              {t('resetToDefaults')}
            </button>
          </div>
        </div>
      )}

      {/* Current Configuration Summary */}
      {config.enabled && (
        <div className={`mt-3 p-2 rounded-lg ${
          isDarkMode ? 'bg-purple-900' : 'bg-purple-100'
        }`}>
          <div className={`text-xs ${
            isDarkMode ? 'text-purple-200' : 'text-purple-700'
          }`}>
            <span className="font-medium">{t('activeConfiguration')}:</span> {' '}
            {config.dataGenerationRate} Hz, {config.temperatureRange.min}°C {language === 'zh' ? '到' : 'to'} {config.temperatureRange.max}°C, {(config.noiseLevel * 100).toFixed(0)}% {language === 'zh' ? '噪声' : 'noise'}
          </div>
        </div>
      )}
    </div>
  );
}