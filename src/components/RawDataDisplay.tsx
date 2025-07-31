import React, { useState } from 'react';
import { Database, ChevronDown, ChevronUp, Eye, EyeOff, Download, Trash2 } from 'lucide-react';
import { RawDataReading } from '../hooks/useTemperatureData';
import { useTranslation } from '../utils/i18n';

interface RawDataDisplayProps {
  rawDataReadings: RawDataReading[];
  language: 'zh' | 'en';
  onClearRawData?: () => void;
  isDarkMode: boolean;
}

export default function RawDataDisplay({ rawDataReadings, language, onClearRawData, isDarkMode }: RawDataDisplayProps) {
  const { t } = useTranslation(language);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [maxDisplayCount, setMaxDisplayCount] = useState(50);

  // 获取最新的原始数据
  const latestRawData = rawDataReadings
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, maxDisplayCount);

  // 导出原始数据为CSV
  const exportRawDataToCSV = () => {
    if (rawDataReadings.length === 0) {
      alert(language === 'zh' ? '没有原始数据可以导出' : 'No raw data to export');
      return;
    }

    let csvContent = '';
    
    // 添加标题
    csvContent += '# Raw Modbus Data Export\n';
    csvContent += `# Export Date: ${new Date().toISOString()}\n`;
    csvContent += `# Total Records: ${rawDataReadings.length}\n`;
    csvContent += '#\n';
    
    // 添加列标题
    csvContent += 'Timestamp,Channel,Register_Address,Raw_Value,Converted_Temperature_C,Conversion_Method\n';
    
    // 添加数据行
    rawDataReadings.forEach(reading => {
      csvContent += `${reading.timestamp},${reading.channel},${reading.registerAddress},${reading.rawValue},${reading.convertedTemperature.toFixed(1)},${reading.conversionMethod}\n`;
    });
    
    // 生成文件名
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
    const filename = `raw_modbus_data_${dateStr}_${timeStr}_${rawDataReadings.length}records.csv`;
    
    // 创建并下载文件
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // 清理原始数据
  const handleClearRawData = () => {
    if (confirm(language === 'zh' 
      ? '确定要清理所有原始数据吗？此操作不可撤销。'
      : 'Are you sure you want to clear all raw data? This operation cannot be undone.'
    )) {
      if (onClearRawData) {
        onClearRawData();
      }
    }
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
  };

  // 获取转换方法的显示文本
  const getConversionMethodText = (method: 'builtin' | 'custom') => {
    return method === 'builtin' 
      ? (language === 'zh' ? '内置' : 'Built-in')
      : (language === 'zh' ? '自定义' : 'Custom');
  };

  return (
    <div className={`rounded-lg border p-4 ${
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
          <Database className="w-5 h-5 text-cyan-400" />
          <h3 className={`text-xl font-semibold ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {language === 'zh' ? '串口原始数据监控' : 'Serial Raw Data Monitor'}
          </h3>
          <div className="px-2 py-1 bg-cyan-900 text-cyan-300 rounded text-xs font-medium">
            {rawDataReadings.length} {language === 'zh' ? '条记录' : 'records'}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isExpanded && rawDataReadings.length > 0 && (
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {language === 'zh' ? '最新' : 'Latest'}: {formatTimestamp(rawDataReadings[rawDataReadings.length - 1]?.timestamp)}
            </div>
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
        <div className="mt-6 space-y-4">
          {/* 控制栏 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-colors ${
                  showDetails 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showDetails 
                  ? (language === 'zh' ? '隐藏详情' : 'Hide Details')
                  : (language === 'zh' ? '显示详情' : 'Show Details')
                }
              </button>
              
              <select
                value={maxDisplayCount}
                onChange={(e) => setMaxDisplayCount(parseInt(e.target.value))}
                className={`px-3 py-1 border rounded text-sm focus:ring-2 focus:ring-cyan-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value={20}>20 {language === 'zh' ? '条' : 'records'}</option>
                <option value={50}>50 {language === 'zh' ? '条' : 'records'}</option>
                <option value={100}>100 {language === 'zh' ? '条' : 'records'}</option>
                <option value={200}>200 {language === 'zh' ? '条' : 'records'}</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={exportRawDataToCSV}
                disabled={rawDataReadings.length === 0}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-colors text-white disabled:cursor-not-allowed ${
                  rawDataReadings.length === 0
                    ? isDarkMode ? 'bg-gray-600' : 'bg-gray-400'
                    : isDarkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                <Download className="w-4 h-4" />
                {language === 'zh' ? '导出CSV' : 'Export CSV'}
              </button>
              
              <button
                onClick={handleClearRawData}
                disabled={rawDataReadings.length === 0}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-colors text-white disabled:cursor-not-allowed ${
                  rawDataReadings.length === 0
                    ? isDarkMode ? 'bg-gray-600' : 'bg-gray-400'
                    : isDarkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                {language === 'zh' ? '清理' : 'Clear'}
              </button>
            </div>
          </div>

          {/* 数据统计 */}
          {rawDataReadings.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`rounded-lg p-3 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {language === 'zh' ? '总记录数' : 'Total Records'}
                </div>
                <div className="text-lg font-bold text-cyan-400">{rawDataReadings.length}</div>
              </div>
              
              <div className={`rounded-lg p-3 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {language === 'zh' ? '活跃通道' : 'Active Channels'}
                </div>
                <div className="text-lg font-bold text-green-400">
                  {new Set(rawDataReadings.map(r => r.channel)).size}
                </div>
              </div>
              
              <div className={`rounded-lg p-3 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {language === 'zh' ? '寄存器范围' : 'Register Range'}
                </div>
                <div className="text-lg font-bold text-purple-400">
                  {rawDataReadings.length > 0 ? (
                    `${Math.min(...rawDataReadings.map(r => r.registerAddress))}-${Math.max(...rawDataReadings.map(r => r.registerAddress))}`
                  ) : '--'}
                </div>
              </div>
              
              <div className={`rounded-lg p-3 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {language === 'zh' ? '最新时间' : 'Latest Time'}
                </div>
                <div className="text-sm font-bold text-yellow-400">
                  {rawDataReadings.length > 0 
                    ? new Date(Math.max(...rawDataReadings.map(r => r.timestamp))).toLocaleTimeString()
                    : '--'
                  }
                </div>
              </div>
            </div>
          )}

          {/* 数据表格 */}
          <div className={`rounded-lg overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            {rawDataReadings.length === 0 ? (
              <div className="p-8 text-center">
                <Database className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {language === 'zh' ? '暂无原始数据' : 'No raw data available'}
                </p>
                <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  {language === 'zh' 
                    ? '连接设备并开始数据采集后，原始Modbus数据将显示在这里'
                    : 'Raw Modbus data will appear here after connecting device and starting data collection'
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                    <tr>
                      <th className={`px-3 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {language === 'zh' ? '时间' : 'Time'}
                      </th>
                      <th className={`px-3 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {language === 'zh' ? '通道' : 'Channel'}
                      </th>
                      <th className={`px-3 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {language === 'zh' ? '寄存器' : 'Register'}
                      </th>
                      <th className={`px-3 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {language === 'zh' ? '原始值' : 'Raw Value'}
                      </th>
                      <th className={`px-3 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {language === 'zh' ? '温度(°C)' : 'Temperature(°C)'}
                      </th>
                      {showDetails && (
                        <th className={`px-3 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {language === 'zh' ? '转换方法' : 'Conversion'}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {latestRawData.map((reading, index) => (
                      <tr 
                        key={`${reading.timestamp}-${reading.channel}`}
                        className={`border-t hover:bg-opacity-50 ${
                          isDarkMode 
                            ? `border-gray-600 hover:bg-gray-600 ${index === 0 ? 'bg-gray-650' : ''}` 
                            : `border-gray-300 hover:bg-gray-200 ${index === 0 ? 'bg-gray-50' : ''}`
                        }`}
                      >
                        <td className={`px-3 py-2 font-mono text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {showDetails 
                            ? formatTimestamp(reading.timestamp)
                            : new Date(reading.timestamp).toLocaleTimeString()
                          }
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium">
                            Ch{reading.channel}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-purple-400 font-mono">
                          {reading.registerAddress}
                        </td>
                        <td className="px-3 py-2 text-cyan-400 font-mono">
                          {reading.rawValue}
                          {showDetails && (
                            <span className={`ml-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              (0x{reading.rawValue.toString(16).toUpperCase().padStart(4, '0')})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-green-400 font-mono font-bold">
                          {reading.convertedTemperature.toFixed(1)}°C
                        </td>
                        {showDetails && (
                          <td className="px-3 py-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              reading.conversionMethod === 'builtin'
                                ? 'bg-green-900 text-green-300'
                                : 'bg-blue-900 text-blue-300'
                            }`}>
                              {getConversionMethodText(reading.conversionMethod)}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 显示更多提示 */}
          {rawDataReadings.length > maxDisplayCount && (
            <div className={`text-center p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {language === 'zh' 
                  ? `显示最新 ${maxDisplayCount} 条记录，共 ${rawDataReadings.length} 条记录`
                  : `Showing latest ${maxDisplayCount} records out of ${rawDataReadings.length} total records`
                }
              </p>
            </div>
          )}

          {/* 说明信息 */}
          <div className={`p-3 border rounded-lg ${
            isDarkMode 
              ? 'bg-blue-900 border-blue-700' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className={`text-sm space-y-1 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
              <p><strong>{language === 'zh' ? '说明' : 'Note'}:</strong></p>
              <p>• <strong>{language === 'zh' ? '原始值' : 'Raw Value'}</strong>: {language === 'zh' ? '从Modbus寄存器直接读取的16位数值' : 'Raw 16-bit value read directly from Modbus register'}</p>
              <p>• <strong>{language === 'zh' ? '温度' : 'Temperature'}</strong>: {language === 'zh' ? '经过温度转换配置处理后的最终温度值' : 'Final temperature value after processing through temperature conversion configuration'}</p>
              <p>• <strong>{language === 'zh' ? '转换方法' : 'Conversion Method'}</strong>: {language === 'zh' ? '使用的温度转换方法（内置或自定义公式）' : 'Temperature conversion method used (built-in or custom formula)'}</p>
              <p>• <strong>{language === 'zh' ? '数据来源' : 'Data Source'}</strong>: {language === 'zh' ? '实时模式显示真实串口数据，测试模式显示模拟数据' : 'Real-time mode shows actual serial data, test mode shows simulated data'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}