import React, { useState } from 'react';
import { Calculator, Code, Save, RotateCcw, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

export interface TemperatureConversionConfig {
  mode: 'builtin' | 'custom';
  customFormula: string;
  testValue: number;
}

interface TemperatureConversionConfigProps {
  config: TemperatureConversionConfig;
  onConfigChange: (config: TemperatureConversionConfig) => void;
  language: 'zh' | 'en';
  isDarkMode: boolean;
}

export default function TemperatureConversionConfig({ config, onConfigChange, language, isDarkMode }: TemperatureConversionConfigProps) {
  const { t } = useTranslation(language);
  const [testResult, setTestResult] = useState<{ value: number; error?: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // 默认折叠

  // 内置转换逻辑
  const builtinConversion = language === 'zh' 
    ? `// 内置转换逻辑
if (registerValue > 32767) {
  return (registerValue - 65536) * 0.1;
}
return registerValue * 0.1;`
    : `// Built-in conversion logic
if (registerValue > 32767) {
  return (registerValue - 65536) * 0.1;
}
return registerValue * 0.1;`;

  // 默认自定义公式
  const defaultCustomFormula = language === 'zh'
    ? `// 自定义转换公式
// registerValue: 原始寄存器值 (0-65535)
// 返回: 温度值 (°C)

if (registerValue > 32767) {
  // 处理负温度 (二进制补码)
  return (registerValue - 65536) * 0.1;
}
return registerValue * 0.1;`
    : `// Custom conversion formula
// registerValue: Raw register value (0-65535)
// Return: Temperature value (°C)

if (registerValue > 32767) {
  // Handle negative temperature (two's complement)
  return (registerValue - 65536) * 0.1;
}
return registerValue * 0.1;`;

  // 测试转换公式
  const testConversion = () => {
    try {
      let result: number;
      
      if (config.mode === 'builtin') {
        // 使用内置逻辑
        if (config.testValue > 32767) {
          result = (config.testValue - 65536) * 0.1;
        } else {
          result = config.testValue * 0.1;
        }
      } else {
        // 使用自定义公式
        const registerValue = config.testValue;
        
        // 创建安全的执行环境
        const safeEval = new Function('registerValue', `
          ${config.customFormula}
        `);
        
        result = safeEval(registerValue);
      }
      
      if (typeof result !== 'number' || isNaN(result)) {
        throw new Error(language === 'zh' ? '公式返回值不是有效数字' : 'Formula returns invalid number');
      }
      
      setTestResult({ value: result });
    } catch (error) {
      setTestResult({ 
        value: 0, 
        error: error instanceof Error ? error.message : (language === 'zh' ? '未知错误' : 'Unknown error')
      });
    }
  };

  const handleModeChange = (mode: 'builtin' | 'custom') => {
    onConfigChange({
      ...config,
      mode,
      customFormula: mode === 'custom' && !config.customFormula 
        ? defaultCustomFormula 
        : config.customFormula
    });
  };

  const handleFormulaChange = (formula: string) => {
    onConfigChange({
      ...config,
      customFormula: formula
    });
  };

  const handleTestValueChange = (value: number) => {
    onConfigChange({
      ...config,
      testValue: value
    });
    setTestResult(null);
  };

  const resetToDefault = () => {
    onConfigChange({
      mode: 'builtin',
      customFormula: defaultCustomFormula,
      testValue: 250
    });
    setTestResult(null);
  };

  // 预设测试值
  const presetTestValues = [
    { label: language === 'zh' ? '正常温度 (25°C)' : 'Normal temp (25°C)', value: 250 },
    { label: language === 'zh' ? '高温 (100°C)' : 'High temp (100°C)', value: 1000 },
    { label: language === 'zh' ? '负温度 (-10°C)' : 'Negative temp (-10°C)', value: 65436 }, // 65536 - 100
    { label: language === 'zh' ? '零度' : 'Zero', value: 0 },
    { label: language === 'zh' ? '最大正值' : 'Max positive', value: 32767 },
    { label: language === 'zh' ? '最大负值' : 'Max negative', value: 32768 }
  ];

  return (
    <div className={`rounded-lg border p-6 ${
      isDarkMode 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
    }`}>
      {/* 折叠标题栏 */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Calculator className="w-5 h-5 text-green-400" />
          <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {t('temperatureConversionConfig')}
          </h3>
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            config.mode === 'builtin' 
              ? 'bg-green-900 text-green-300'
              : 'bg-blue-900 text-blue-300'
          }`}>
            {config.mode === 'builtin' ? t('builtinConversion') : t('customFormula')}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetToDefault();
              }}
              className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-colors text-white ${
                isDarkMode 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              {t('reset')}
            </button>
          )}
          
          {isExpanded ? (
            <ChevronUp className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
          ) : (
            <ChevronDown className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
          )}
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="mt-6 space-y-6">
          {/* 转换模式选择 */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('conversionMode')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleModeChange('builtin')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  config.mode === 'builtin'
                    ? 'border-green-500 bg-green-900 text-green-300'
                    : isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500' : 'border-gray-300 bg-gray-100 text-gray-700 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">{t('builtinConversion')}</span>
                </div>
                <div className="text-xs opacity-75">
                  {language === 'zh' 
                    ? '使用标准的16位二进制补码转换，分辨率0.1°C'
                    : 'Use standard 16-bit two\'s complement conversion, 0.1°C resolution'
                  }
                </div>
              </button>

              <button
                onClick={() => handleModeChange('custom')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  config.mode === 'custom'
                    ? 'border-green-500 bg-green-900 text-green-300'
                    : isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500' : 'border-gray-300 bg-gray-100 text-gray-700 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Code className="w-4 h-4" />
                  <span className="font-medium">{t('customFormula')}</span>
                </div>
                <div className="text-xs opacity-75">
                  {language === 'zh' 
                    ? '编写自定义JavaScript代码进行温度转换'
                    : 'Write custom JavaScript code for temperature conversion'
                  }
                </div>
              </button>
            </div>
          </div>

          {/* 当前转换逻辑显示 */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('currentConversionLogic')}
            </label>
            <div className={`rounded-lg p-4 border ${
              isDarkMode 
                ? 'bg-gray-900 border-gray-600' 
                : 'bg-gray-100 border-gray-300'
            }`}>
              <pre className={`text-sm whitespace-pre-wrap font-mono ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {config.mode === 'builtin' ? builtinConversion : config.customFormula}
              </pre>
            </div>
          </div>

          {/* 自定义公式编辑器 */}
          {config.mode === 'custom' && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('customConversionFormula')}
              </label>
              <textarea
                value={config.customFormula}
                onChange={(e) => handleFormulaChange(e.target.value)}
                className={`w-full h-40 px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none ${
                  isDarkMode 
                    ? 'bg-gray-900 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder={language === 'zh' ? '输入JavaScript代码...' : 'Enter JavaScript code...'}
              />
              <div className={`mt-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <strong>{language === 'zh' ? '可用变量' : 'Available variables'}:</strong> registerValue (0-65535) | <strong>{language === 'zh' ? '返回' : 'Return'}:</strong> {language === 'zh' ? '温度值 (°C)' : 'Temperature value (°C)'}
              </div>
            </div>
          )}

          {/* 测试区域 */}
          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <h4 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {t('formulaTest')}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('testRegisterValue')}
                </label>
                <input
                  type="number"
                  value={config.testValue}
                  onChange={(e) => handleTestValueChange(parseInt(e.target.value) || 0)}
                  min={0}
                  max={65535}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    isDarkMode 
                      ? 'bg-gray-600 border-gray-500 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
                
                {showAdvanced && (
                  <div className="mt-2">
                    <div className={`text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {language === 'zh' ? '预设测试值:' : 'Preset test values:'}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {presetTestValues.map((preset, index) => (
                        <button
                          key={index}
                          onClick={() => handleTestValueChange(preset.value)}
                          className={`px-2 py-1 text-xs rounded transition-colors text-white ${
                            isDarkMode 
                              ? 'bg-gray-600 hover:bg-gray-500' 
                              : 'bg-gray-500 hover:bg-gray-600'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('conversionResult')}
                </label>
                <div className="flex gap-2">
                  <div className={`flex-1 px-3 py-2 rounded-lg border ${
                    testResult?.error 
                      ? isDarkMode ? 'bg-red-900 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
                      : isDarkMode ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}>
                    {testResult ? (
                      testResult.error ? (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm">{language === 'zh' ? '错误' : 'Error'}: {testResult.error}</span>
                        </div>
                      ) : (
                        <span className="text-lg font-mono">{testResult.value.toFixed(1)}°C</span>
                      )
                    ) : (
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                        {language === 'zh' ? '点击测试按钮' : 'Click test button'}
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={testConversion}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors text-white ${
                      isDarkMode 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {t('test')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors text-white ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600' 
                  : 'bg-gray-500 hover:bg-gray-600'
              }`}
            >
              {showAdvanced ? t('simple') : t('advanced')}{language === 'zh' ? '设置' : ' settings'}
            </button>
            
            <button
              onClick={resetToDefault}
              className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-colors text-white ${
                isDarkMode 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              {t('reset')}
            </button>
          </div>

          {/* 重要说明 */}
          <div className={`p-4 border rounded-lg ${
            isDarkMode 
              ? 'bg-blue-900 border-blue-700' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-blue-400" />
              <span className={`font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                {t('importantNotes')}
              </span>
            </div>
            <ul className={`text-sm space-y-1 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
              <li>• <strong>{language === 'zh' ? '测试模式' : 'Test mode'}</strong>: {language === 'zh' ? '生成的数据不经过温度转换，直接使用温度值' : 'Generated data does not go through temperature conversion, uses temperature values directly'}</li>
              <li>• <strong>{language === 'zh' ? '实际设备' : 'Real device'}</strong>: {language === 'zh' ? '从Modbus寄存器读取的原始值会经过此转换' : 'Raw values read from Modbus registers will go through this conversion'}</li>
              <li>• <strong>{language === 'zh' ? '自定义公式' : 'Custom formula'}</strong>: {language === 'zh' ? '请确保代码安全，避免无限循环或异常操作' : 'Please ensure code safety, avoid infinite loops or abnormal operations'}</li>
              <li>• <strong>{language === 'zh' ? '数据范围' : 'Data range'}</strong>: {language === 'zh' ? '寄存器值范围 0-65535，推荐温度范围 -273°C 到 1000°C' : 'Register value range 0-65535, recommended temperature range -273°C to 1000°C'}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}