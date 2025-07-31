import React from 'react';
import { Play, Pause, Download, Clock, Database, Save, Upload, FileText, BarChart, Trash2 } from 'lucide-react';
import { RecordingConfig, TemperatureReading, SerialConfig, DataStorageConfig } from '../types';
import { exportToCSV, prepareExportData } from '../utils/csvExporter';
import { useTranslation } from '../utils/i18n';

interface DataRecordingControlsProps {
  recordingConfig: RecordingConfig;
  storageConfig: DataStorageConfig;
  readings: TemperatureReading[];
  serialConfig: SerialConfig;
  onRecordingConfigChange: (config: RecordingConfig) => void;
  onStorageConfigChange: (config: DataStorageConfig) => void;
  onManualSave: () => void;
  onImportData: (file: File) => void;
  onClearSavedData: () => void;
  language: 'zh' | 'en';
  isDarkMode: boolean;
}

export default function DataRecordingControls({
  recordingConfig,
  storageConfig,
  readings,
  serialConfig,
  onRecordingConfigChange,
  onStorageConfigChange,
  onManualSave,
  onImportData,
  onClearSavedData,
  language,
  isDarkMode
}: DataRecordingControlsProps) {
  const { t } = useTranslation(language);
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
      alert(t('noDataToSave'));
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
      
      alert(`${t('exportSuccess')} ${readings.length} ${t('records')}`);
    } catch (error) {
      alert(t('exportFailed'));
      console.error('Export error:', error);
    }
  };

  // 修改：导出CSV功能（与手动保存相同）
  const handleExport = () => {
    handleManualSave();
  };

  // 清理保存的数据 - 使用传入的 onClearSavedData 函数，只在停止记录时允许
  const handleClearSavedData = () => {
    if (recordingConfig.isRecording) {
      alert(language === 'zh' ? '请先停止数据记录再清理本地数据' : 'Please stop data recording before clearing local data');
      return;
    }
    
    if (confirm(t('confirmClearData'))) {
      onClearSavedData();
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
          alert(language === 'zh' ? '保存的数据格式无效' : 'Invalid saved data format');
        }
      } else {
        alert(language === 'zh' ? '没有找到保存的数据' : 'No saved data found');
      }
    } catch (error) {
      alert(language === 'zh' ? '加载保存的数据失败' : 'Failed to load saved data');
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
    if (!storageConfig.lastAutoSave) return t('neverExported');
    return new Date(storageConfig.lastAutoSave).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
  };

  // 获取保存的数据统计
  const getSavedDataStats = () => {
    try {
      const saved = localStorage.getItem('temperatureData');
      if (saved) {
        const data = JSON.parse(saved);
        return {
          count: data.readings?.length || 0,
          saveTime: data.timestamp ? new Date(data.timestamp).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : t('unknown')
        };
      }
    } catch (error) {
      console.error('Failed to get saved data stats:', error);
    }
    return { count: 0, saveTime: t('none') };
  };

  // 计算本地存储使用量 - 实时更新
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
      return t('unknown');
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
    <div className={`rounded-lg p-6 border ${
      isDarkMode 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-purple-400" />
          <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {t('dataRecordingAndStorage')}
          </h2>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            recordingConfig.isRecording 
              ? 'bg-green-900 text-green-300 border border-green-700'
              : 'bg-gray-700 text-gray-300 border border-gray-600'
          }`}>
            {recordingConfig.isRecording ? t('recording') : t('stopped')}
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
            {recordingConfig.isRecording ? t('stop') : t('start')}
          </button>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart className="w-4 h-4 text-blue-400" />
            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('currentData')}
            </span>
          </div>
          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {displayCurrentData}
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {totalReadings > 0 ? t('records') : t('noSession')}
          </div>
        </div>

        <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-green-400" />
            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('recordingDuration')}
            </span>
          </div>
          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {displayDuration}
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {totalReadings > 0 ? t('minutes') : t('noSession')}
          </div>
        </div>

        <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-purple-400" />
            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('activeChannels')}
            </span>
          </div>
          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {activeChannels}
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {serialConfig.registerCount} {t('totalChannels')}
          </div>
        </div>

        <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Save className="w-4 h-4 text-yellow-400" />
            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('localStorage')}
            </span>
          </div>
          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {localStorageUsage}
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {t('usedSpace')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 记录配置 */}
        <div>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {t('recordingConfig')}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <Clock className="w-4 h-4 inline mr-1" />
                {t('samplingFrequency')} (Hz)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customFrequency}
                  onChange={(e) => handleCustomFrequencyChange(e.target.value)}
                  min="0.01"
                  max="100"
                  step="0.1"
                  className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder={language === 'zh' ? '输入频率' : 'Enter frequency'}
                />
                <div className={`flex items-center px-3 py-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-300' 
                    : 'bg-gray-100 border-gray-300 text-gray-700'
                }`}>
                  Hz
                </div>
              </div>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {language === 'zh' ? '当前' : 'Current'}: {currentFrequency} Hz ({language === 'zh' ? '每' : 'every'} {recordingConfig.interval.toFixed(1)} {language === 'zh' ? '秒采集一次' : 'seconds'})
              </div>
              <div className="flex gap-1 mt-2">
                {[0.1, 0.2, 0.5, 1, 2, 5, 10].map(freq => (
                  <button
                    key={freq}
                    onClick={() => {
                      setCustomFrequency(freq.toString());
                      handleFrequencyChange(freq);
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors text-white ${
                      isDarkMode 
                        ? 'bg-gray-600 hover:bg-gray-500' 
                        : 'bg-gray-500 hover:bg-gray-600'
                    }`}
                  >
                    {freq}Hz
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('channelSelection')}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {recordingConfig.selectedChannels.slice(0, serialConfig.registerCount).map((selected, index) => (
                  <button
                    key={index}
                    onClick={() => handleChannelToggle(index)}
                    className={`p-2 rounded-lg border transition-colors ${
                      selected
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
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
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {t('dataExportAndManagement')}
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{t('autoExport')}</span>
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
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('autoExportInterval')} ({t('minutes')})
              </label>
              <select
                value={storageConfig.autoSaveInterval}
                onChange={(e) => handleAutoSaveIntervalChange(parseInt(e.target.value))}
                disabled={!storageConfig.autoSaveEnabled}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value={1}>1{language === 'zh' ? '分钟' : ' minute'}</option>
                <option value={5}>5{language === 'zh' ? '分钟' : ' minutes'}</option>
                <option value={10}>10{language === 'zh' ? '分钟' : ' minutes'}</option>
                <option value={15}>15{language === 'zh' ? '分钟' : ' minutes'}</option>
                <option value={30}>30{language === 'zh' ? '分钟' : ' minutes'}</option>
                <option value={60}>1{language === 'zh' ? '小时' : ' hour'}</option>
              </select>
            </div>

            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('lastExportTime')}: {formatLastSaveTime()}
            </div>

            {/* 导出状态信息 */}
            {storageConfig.totalSavedReadings > 0 && (
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <div className={`text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {language === 'zh' ? '最后导出信息:' : 'Last export info:'}:
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {language === 'zh' ? '数据量' : 'Data count'}: {storageConfig.totalSavedReadings.toLocaleString()} {t('records')}
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {language === 'zh' ? '导出时间' : 'Export time'}: {formatLastSaveTime()}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={handleManualSave}
                disabled={totalReadings === 0}
                className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg font-medium transition-colors text-white disabled:cursor-not-allowed ${
                  totalReadings === 0
                    ? isDarkMode ? 'bg-gray-600' : 'bg-gray-400'
                    : isDarkMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                <Download className="w-4 h-4" />
                {t('exportCSVNow')}
              </button>

              <button
                onClick={handleLoadSavedData}
                disabled={savedStats.count === 0}
                className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg font-medium transition-colors text-white disabled:cursor-not-allowed ${
                  savedStats.count === 0
                    ? isDarkMode ? 'bg-gray-600' : 'bg-gray-400'
                    : isDarkMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-500 hover:bg-indigo-600'
                }`}
              >
                <FileText className="w-4 h-4" />
                {t('loadLocalData')}
              </button>

              <button
                onClick={handleClearSavedData}
                disabled={localStorageUsage === '0 KB' || recordingConfig.isRecording}
                className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg font-medium transition-colors text-white disabled:cursor-not-allowed ${
                  localStorageUsage === '0 KB' || recordingConfig.isRecording
                    ? isDarkMode ? 'bg-gray-600' : 'bg-gray-400'
                    : isDarkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
                }`}
                title={recordingConfig.isRecording ? (language === 'zh' ? '请先停止记录' : 'Please stop recording first') : ''}
              >
                <Trash2 className="w-4 h-4" />
                {t('clearLocalData')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}