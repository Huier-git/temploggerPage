import React, { useState } from 'react';
import { Calculator, Code, Save, RotateCcw, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

export interface TemperatureConversionConfig {
  mode: 'builtin' | 'custom';
  customFormula: string;
  testValue: number;
}

interface TemperatureConversionConfigProps {
  config: TemperatureConversionConfig;
  onConfigChange: (config: TemperatureConversionConfig) => void;
}

export default function TemperatureConversionConfig({ config, onConfigChange }: TemperatureConversionConfigProps) {
  const [testResult, setTestResult] = useState<{ value: number; error?: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // 默认折叠

  // 内置转换逻辑
  const builtinConversion = `// 内置转换逻辑
if (registerValue > 32767) {
  return (registerValue - 65536) * 0.1;
}
return registerValue * 0.1;`;

  // 默认自定义公式
  const defaultCustomFormula = `// 自定义转换公式
// registerValue: 原始寄存器值 (0-65535)
// 返回: 温度值 (°C)

if (registerValue > 32767) {
  // 处理负温度 (二进制补码)
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
        throw new Error('公式返回值不是有效数字');
      }
      
      setTestResult({ value: result });
    } catch (error) {
      setTestResult({ 
        value: 0, 
        error: error instanceof Error ? error.message : '未知错误' 
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
    { label: '正常温度 (25°C)', value: 250 },
    { label: '高温 (100°C)', value: 1000 },
    { label: '负温度 (-10°C)', value: 65436 }, // 65536 - 100
    { label: '零度', value: 0 },
    { label: '最大正值', value: 32767 },
    { label: '最大负值', value: 32768 }
  ];

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      {/* 折叠标题栏 */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Calculator className="w-5 h-5 text-green-400" />
          <h3 className="text-xl font-semibold text-white">温度转换配置</h3>
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            config.mode === 'builtin' 
              ? 'bg-green-900 text-green-300'
              : 'bg-blue-900 text-blue-300'
          }`}>
            {config.mode === 'builtin' ? '内置转换' : '自定义公式'}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetToDefault();
              }}
              className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重置
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
          {/* 转换模式选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">转换模式</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleModeChange('builtin')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  config.mode === 'builtin'
                    ? 'border-green-500 bg-green-900 text-green-300'
                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">内置转换</span>
                </div>
                <div className="text-xs opacity-75">
                  使用标准的16位二进制补码转换，分辨率0.1°C
                </div>
              </button>

              <button
                onClick={() => handleModeChange('custom')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  config.mode === 'custom'
                    ? 'border-green-500 bg-green-900 text-green-300'
                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Code className="w-4 h-4" />
                  <span className="font-medium">自定义公式</span>
                </div>
                <div className="text-xs opacity-75">
                  编写自定义JavaScript代码进行温度转换
                </div>
              </button>
            </div>
          </div>

          {/* 当前转换逻辑显示 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              当前转换逻辑
            </label>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                {config.mode === 'builtin' ? builtinConversion : config.customFormula}
              </pre>
            </div>
          </div>

          {/* 自定义公式编辑器 */}
          {config.mode === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                自定义转换公式
              </label>
              <textarea
                value={config.customFormula}
                onChange={(e) => handleFormulaChange(e.target.value)}
                className="w-full h-40 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                placeholder="输入JavaScript代码..."
              />
              <div className="mt-2 text-xs text-gray-400">
                <strong>可用变量:</strong> registerValue (0-65535) | <strong>返回:</strong> 温度值 (°C)
              </div>
            </div>
          )}

          {/* 测试区域 */}
          <div className="p-4 bg-gray-700 rounded-lg">
            <h4 className="text-lg font-semibold text-white mb-4">公式测试</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  测试寄存器值
                </label>
                <input
                  type="number"
                  value={config.testValue}
                  onChange={(e) => handleTestValueChange(parseInt(e.target.value) || 0)}
                  min={0}
                  max={65535}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                
                {showAdvanced && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-400 mb-2">预设测试值:</div>
                    <div className="grid grid-cols-2 gap-1">
                      {presetTestValues.map((preset, index) => (
                        <button
                          key={index}
                          onClick={() => handleTestValueChange(preset.value)}
                          className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  转换结果
                </label>
                <div className="flex gap-2">
                  <div className={`flex-1 px-3 py-2 rounded-lg border ${
                    testResult?.error 
                      ? 'bg-red-900 border-red-700 text-red-300'
                      : 'bg-gray-600 border-gray-500 text-white'
                  }`}>
                    {testResult ? (
                      testResult.error ? (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm">错误: {testResult.error}</span>
                        </div>
                      ) : (
                        <span className="text-lg font-mono">{testResult.value.toFixed(1)}°C</span>
                      )
                    ) : (
                      <span className="text-gray-400">点击测试按钮</span>
                    )}
                  </div>
                  
                  <button
                    onClick={testConversion}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                  >
                    测试
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
            >
              {showAdvanced ? '简化' : '高级'}设置
            </button>
            
            <button
              onClick={resetToDefault}
              className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </button>
          </div>

          {/* 重要说明 */}
          <div className="p-4 bg-blue-900 border border-blue-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 font-medium">重要说明</span>
            </div>
            <ul className="text-blue-300 text-sm space-y-1">
              <li>• <strong>测试模式</strong>: 生成的数据不经过温度转换，直接使用温度值</li>
              <li>• <strong>实际设备</strong>: 从Modbus寄存器读取的原始值会经过此转换</li>
              <li>• <strong>自定义公式</strong>: 请确保代码安全，避免无限循环或异常操作</li>
              <li>• <strong>数据范围</strong>: 寄存器值范围 0-65535，推荐温度范围 -273°C 到 1000°C</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}