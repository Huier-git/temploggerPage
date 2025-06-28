import React from 'react';
import { Play, Pause, Download, Clock, Database, Save, Upload, FileText, BarChart, Trash2 } from 'lucide-react';
import { RecordingConfig, TemperatureReading, SerialConfig, DataStorageConfig } from '../types';
import { exportToCSV, prepareExportData } from '../utils/csvExporter';

interface DataRecordingControlsProps {
  recordingConfig: RecordingConfig;
  storageConfig: DataStorageConfig;
  readings: TemperatureReading[];
  serialConfig: SerialConfig;
  onRecordingConfigChange: (config: RecordingConfig) => void;
  onStorageConfigChange: (config: DataStorageConfig) => void;
  onManualSave: () => void;
  onImportData: (file: File) => void;
}

export default function DataRecordingControls({
  recordingConfig,
  storageConfig,
  readings,
  serialConfig,
  onRecordingConfigChange,
  onStorageConfigChange,
  onManualSave,
  onImportData
}: DataRecordingControlsProps) {
  const [customFrequency, setCustomFrequency] = React.useState<string>('1.0');

  const handleToggleRecording = () => {
    onRecordingConfigChange({
      ...recordingConfig,
      isRecording: !recordingConfig.isRecording
    });
  };

  const handleFrequencyChange = (frequency: number) => {
    // 将频率转换为间隔（秒）
    const interval = Math.max(0.1, 1 / frequency);
    onRecordingConfigChange({
      ...recordingConfig,
      interval
    });
  };

  const handleCustomFrequencyChange = (value: string) => {
    setCustomFrequency(value);
    const frequency = parseFloat(value);
    if (!isNaN(frequency) && frequency > 0 && frequency <= 100) {
      handleFrequencyChange(frequency);
    }
  };

  const handleChannelToggle = (channelIndex: number) => {
    const newChannels = [...recordingConfig.selectedChannels];
    newChannels[channelIndex] = !newChannels[channelIndex];
    onRecordingConfigChange({
      ...recordingConfig,
      selectedChannels: newChannels
    });
  };

  const handleAutoSaveToggle = () => {
    const newEnabled = !storageConfig.autoSaveEnabled;
    onStorageConfigChange({
      ...storageConfig,
      autoSaveEnabled: newEnabled,
      lastAutoSave: newEnabled ? Date.now() : undefined
    });
  };

  const handleAutoSaveIntervalChange = (interval: number) => {
    onStorageConfigChange({
      ...storageConfig,
      autoSaveInterval: interval
    });
  };

  // 修改：手动保存直接下载CSV
  const handleManualSave = () => {
    if (readings.length === 0) {
      alert('没有数据可以保存');
      return;
    }

    try {
      const exportData = prepareExportData(readings, serialConfig, recordingConfig);
      exportToCSV(exportData);
      
      // 更新保存状态
      onStorageConfigChange({
        ...storageConfig,
        totalSavedReadings: readings.length,
        lastAutoSave: Date.now()
      });
      
      alert(`成功导出 ${readings.length} 条数据记录为CSV文件`);
    } catch (error) {
      alert('导出失败，请重试');
      console.error('导出错误:', error);
    }
  };

  // 修改：导出CSV功能（与手动保存相同）
  const handleExport = () => {
    handleManualSave();
  };

  // 清理保存的数据
  const handleClearSavedData = () => {
    if (confirm('确定要清理所有本地数据吗？此操作不可撤销。')) {
      try {
        localStorage.removeItem('temperatureData');
        localStorage.removeItem('currentReadings');
        onStorageConfigChange({
          ...storageConfig,
          totalSavedReadings: 0,
          lastAutoSave: undefined
        });
        alert('本地数据已清理');
      } catch (error) {
        alert('清理数据失败');
      }
    }
  };

  // 加载保存的数据
  const handleLoadSavedData = () => {
    try {
      const saved = localStorage.getItem('temperatureData');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.readings && Array.isArray(data.readings)) {
          // 创建一个虚拟的CSV文件来重用导入逻辑
          const csvContent = convertReadingsToCSV(data.readings);
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const file = new File([blob], 'saved_data.csv', { type: 'text/csv' });
          onImportData(file);
        } else {
          alert('保存的数据格式无效');
        }
      } else {
        alert('没有找到保存的数据');
      }
    } catch (error) {
      alert('加载保存的数据失败');
    }
  };

  // 将读数转换为CSV格式
  const convertReadingsToCSV = (readings: TemperatureReading[]): string => {
    let csv = 'Timestamp,Channel,Temperature(°C),Raw Value\n';
    readings.forEach(reading => {
      csv += `${reading.timestamp},${reading.channel},${reading.temperature.toFixed(1)},${reading.rawValue}\n`;
    });
    return csv;
  };

  const activeChannels = recordingConfig.selectedChannels.filter(Boolean).length;
  const totalReadings = readings.length;
  const recordingDuration = totalReadings > 0 ? 
    Math.round((readings[readings.length - 1]?.timestamp - readings[0]?.timestamp) / 1000 / 60) : 0;

  const formatLastSaveTime = () => {
    if (!storageConfig.lastAutoSave) return '从未导出';
    return new Date(storageConfig.lastAutoSave).toLocaleString('zh-CN');
  };

  // 获取保存的数据统计
  const getSavedDataStats = () => {
    try {
      const saved = localStorage.getItem('temperatureData');
      if (saved) {
        const data = JSON.parse(saved);
        return {
          count: data.readings?.length || 0,
          saveTime: data.timestamp ? new Date(data.timestamp).toLocaleString('zh-CN') : '未知'
        };
      }
    } catch (error) {
      console.error('获取保存数据统计失败:', error);
    }
    return { count: 0, saveTime: '无' };
  };

  // 计算本地存储使用量
  const getLocalStorageUsage = () => {
    try {
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length;
        }
      }
      
      const sizeInMB = (totalSize / 1024 / 1024).toFixed(2);
      const sizeInKB = (totalSize / 1024).toFixed(0);
      
      return totalSize > 1024 * 1024 ? `${sizeInMB} MB` : `${sizeInKB} KB`;
    } catch (error) {
      return '未知';
    }
  };

  const savedStats = getSavedDataStats();
  const localStorageUsage = getLocalStorageUsage();

  // 显示数据初始化为空
  const displayCurrentData = totalReadings > 0 ? totalReadings.toLocaleString() : '--';
  const displayDuration = totalReadings > 0 ? recordingDuration.toString() : '--';

  // 计算当前频率
  const currentFrequency = recordingConfig.interval > 0 ? (1 / recordingConfig.interval).toFixed(1) : '1.0';

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-white">数据记录与存储</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            recordingConfig.isRecording 
              ? 'bg-green-900 text-green-300 border border-green-700'
              : 'bg-gray-700 text-gray-300 border border-gray-600'
          }`}>
            {recordingConfig.isRecording ? '记录中' : '已停止'}
          </div>
          
          <button
            onClick={handleToggleRecording}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              recordingConfig.isRecording
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {recordingConfig.isRecording ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {recordingConfig.isRecording ? '停止' : '开始'}
          </button>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">当前数据</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {displayCurrentData}
          </div>
          <div className="text-xs text-gray-400">
            {totalReadings > 0 ? '条记录' : '无数据'}
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-gray-300">记录时长</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {displayDuration}
          </div>
          <div className="text-xs text-gray-400">
            {totalReadings > 0 ? '分钟' : '无会话'}
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-gray-300">活跃通道</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {activeChannels}
          </div>
          <div className="text-xs text-gray-400">共10个通道</div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Save className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-gray-300">本地存储</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {localStorageUsage}
          </div>
          <div className="text-xs text-gray-400">
            已使用空间
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 记录配置 */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">记录配置</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                采集频率 (Hz)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customFrequency}
                  onChange={(e) => handleCustomFrequencyChange(e.target.value)}
                  min="0.01"
                  max="100"
                  step="0.1"
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="输入频率"
                />
                <div className="flex items-center px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-300">
                  Hz
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                当前: {currentFrequency} Hz (每 {recordingConfig.interval.toFixed(1)} 秒采集一次)
              </div>
              <div className="flex gap-1 mt-2">
                {[0.1, 0.2, 0.5, 1, 2, 5, 10].map(freq => (
                  <button
                    key={freq}
                    onClick={() => {
                      setCustomFrequency(freq.toString());
                      handleFrequencyChange(freq);
                    }}
                    className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                  >
                    {freq}Hz
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                通道选择
              </label>
              <div className="grid grid-cols-5 gap-2">
                {recordingConfig.selectedChannels.map((selected, index) => (
                  <button
                    key={index}
                    onClick={() => handleChannelToggle(index)}
                    className={`p-2 rounded-lg border transition-colors ${
                      selected
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Ch {index + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 数据导出与管理 */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">数据导出与管理</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">自动导出</span>
              <button
                onClick={handleAutoSaveToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  storageConfig.autoSaveEnabled ? 'bg-emerald-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    storageConfig.autoSaveEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                自动导出间隔 (分钟)
              </label>
              <select
                value={storageConfig.autoSaveInterval}
                onChange={(e) => handleAutoSaveIntervalChange(parseInt(e.target.value))}
                disabled={!storageConfig.autoSaveEnabled}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                <option value={1}>1分钟</option>
                <option value={5}>5分钟</option>
                <option value={10}>10分钟</option>
                <option value={15}>15分钟</option>
                <option value={30}>30分钟</option>
                <option value={60}>1小时</option>
              </select>
            </div>

            <div className="text-xs text-gray-400">
              最后导出时间: {formatLastSaveTime()}
            </div>

            {/* 导出状态信息 */}
            {storageConfig.totalSavedReadings > 0 && (
              <div className="p-3 bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-300 mb-1">最后导出信息:</div>
                <div className="text-xs text-gray-400">
                  数据量: {storageConfig.totalSavedReadings.toLocaleString()} 条记录
                </div>
                <div className="text-xs text-gray-400">
                  导出时间: {formatLastSaveTime()}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={handleManualSave}
                disabled={totalReadings === 0}
                className="flex items-center gap-2 w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                立即导出CSV
              </button>

              <button
                onClick={handleLoadSavedData}
                disabled={savedStats.count === 0}
                className="flex items-center gap-2 w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                <FileText className="w-4 h-4" />
                加载本地数据
              </button>

              <button
                onClick={handleClearSavedData}
                disabled={localStorageUsage === '0 KB'}
                className="flex items-center gap-2 w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                清理本地数据
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}