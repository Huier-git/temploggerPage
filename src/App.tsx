import React, { useState, useEffect } from 'react';
import { Activity, Thermometer, Wifi, WifiOff, Clock, Database, Sun, Moon, Globe, AlertTriangle } from 'lucide-react';
import SerialModbusConfiguration from './components/SerialModbusConfiguration';
import ChannelGrid from './components/ChannelGrid';
import TemperatureChart from './components/TemperatureChart';
import DataRecordingControls from './components/DataRecordingControls';
import DisplayControls from './components/DisplayControls';
import TestModeControls from './components/TestModeControls';
import DrillVisualization from './components/DrillVisualization';
import TemperatureConversionConfig from './components/TemperatureConversionConfig';
import TemperatureCalibration from './components/TemperatureCalibration';
import RawDataDisplay from './components/RawDataDisplay';
import { useTemperatureData } from './hooks/useTemperatureData';
import { useDataStorage } from './hooks/useDataStorage';
import { SerialConfig, ConnectionStatus, RecordingConfig, DisplayConfig, ChannelConfig, TestModeConfig, TemperatureConversionConfig as TemperatureConversionConfigType, LanguageConfig, CalibrationConfig } from './types';
import { useTranslation } from './utils/i18n';
import { generateDynamicColors } from './utils/colorGenerator';

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });
  
  const [language, setLanguage] = useState<LanguageConfig>(() => {
    const saved = localStorage.getItem('language');
    return { current: saved === 'en' ? 'en' : 'zh' };
  });
  
  const { t } = useTranslation(language.current);
  
  const [serialConfig, setSerialConfig] = useState<SerialConfig>({
    port: 'COM1',
    baudRate: 9600,
    parity: 'none',
    stopBits: 1,
    dataBits: 8,
    startRegister: 0,
    registerCount: 10,
    offsetAddress: 40001
  });

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastError: undefined,
    lastSuccessfulRead: undefined
  });

  const [recordingConfig, setRecordingConfig] = useState<RecordingConfig>({
    interval: 1,
    selectedChannels: new Array(16).fill(false).map((_, i) => i < 10),
    isRecording: false
  });

  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>({
    mode: 'sliding',
    viewMode: 'combined',
    timeWindow: 10,
    showGrid: true,
    showLegend: true,
    relativeTime: true
  });

  const [testModeConfig, setTestModeConfig] = useState<TestModeConfig>({
    enabled: false,
    dataGenerationRate: 1,
    temperatureRange: { min: 15, max: 45 },
    noiseLevel: 0.3
  });

  const [temperatureConversionConfig, setTemperatureConversionConfig] = useState<TemperatureConversionConfigType>({
    mode: 'builtin',
    customFormula: `// Custom conversion formula
// registerValue: Raw register value (0-65535)
// Return: Temperature value (°C)

if (registerValue > 32767) {
  // Handle negative temperature (two's complement)
  return (registerValue - 65536) * 0.1;
}
return registerValue * 0.1;`,
    testValue: 250
  });

  // 新增：校准配置
  const [calibrationConfig, setCalibrationConfig] = useState<CalibrationConfig>({
    enabled: false,
    offsets: new Array(16).fill(0),
    appliedToData: false
  });

  const [channels, setChannels] = useState<ChannelConfig[]>(() => {
    const colorScheme = generateDynamicColors(16, {
      scheme: 'optimized',
      saturationRange: [70, 90],
      lightnessRange: [50, 75]
    });
    
    return Array.from({ length: 16 }, (_, i) => ({
      id: i + 1,
      name: language.current === 'zh' ? `传感器 ${i + 1}` : `Sensor ${i + 1}`,
      color: colorScheme.colors[i].hex,
      enabled: i < 10,
      minRange: 0,
      maxRange: 100
    }));
  });

  const [sessionActive, setSessionActive] = useState(false);
  const [localStorageUsage, setLocalStorageUsage] = useState('0 KB');
  const [sessionEvents, setSessionEvents] = useState<Array<{
    timestamp: number;
    action: 'start' | 'pause' | 'resume' | 'stop';
    reason: string;
  }>>([]);
  const [chartHoverData, setChartHoverData] = useState<{ [channelId: number]: number } | null>(null);

  const { readings, rawDataReadings, isReading, replaceReadings, clearReadings } = useTemperatureData(
    serialConfig, 
    recordingConfig, 
    connectionStatus,
    testModeConfig,
    temperatureConversionConfig
  );

  const {
    config: storageConfig,
    setConfig: setStorageConfig,
    saveData,
    loadData,
    importFromCSV,
    clearSavedData
  } = useDataStorage();

  const toggleLanguage = () => {
    const newLang = language.current === 'zh' ? 'en' : 'zh';
    setLanguage({ current: newLang });
    localStorage.setItem('language', newLang);
    
    setChannels(prev => prev.map(channel => ({
      ...channel,
      name: newLang === 'zh' ? `传感器 ${channel.id}` : `Sensor ${channel.id}`
    })));
  };

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const isActive = readings.length > 0 || recordingConfig.isRecording || testModeConfig.enabled || connectionStatus.isConnected;
    setSessionActive(isActive);
  }, [readings.length, recordingConfig.isRecording, testModeConfig.enabled, connectionStatus.isConnected]);

  useEffect(() => {
    if (sessionActive) return;
    
    const newChannelCount = Math.min(16, Math.max(1, serialConfig.registerCount));
    
    const colorScheme = generateDynamicColors(newChannelCount, {
      scheme: 'optimized',
      saturationRange: [70, 90],
      lightnessRange: [50, 75]
    });
    
    setChannels(prev => {
      const updated = [...prev];
      for (let i = 0; i < 16; i++) {
        updated[i].enabled = i < newChannelCount;
        if (i < newChannelCount) {
          updated[i].color = colorScheme.colors[i].hex;
        }
      }
      return updated;
    });
    
    setRecordingConfig(prev => ({
      ...prev,
      selectedChannels: prev.selectedChannels.map((_, i) => i < newChannelCount)
    }));
  }, [serialConfig.registerCount, sessionActive]);

  const calculateLocalStorageUsage = () => {
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

  useEffect(() => {
    const updateStorageUsage = () => {
      setLocalStorageUsage(calculateLocalStorageUsage());
    };

    updateStorageUsage();

    const handleStorageChange = () => {
      updateStorageUsage();
    };

    window.addEventListener('storage', handleStorageChange);
    
    const interval = setInterval(updateStorageUsage, 5000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [t]);

  useEffect(() => {
    setLocalStorageUsage(calculateLocalStorageUsage());
    window.dispatchEvent(new Event('storage'));
  }, [readings.length]);

  useEffect(() => {
    const now = Date.now();
    
    if (recordingConfig.isRecording) {
      const lastEvent = sessionEvents[sessionEvents.length - 1];
      if (!lastEvent || lastEvent.action === 'stop' || lastEvent.action === 'pause') {
        const action = lastEvent?.action === 'pause' ? 'resume' : 'start';
        const reason = testModeConfig.enabled ? 'Test mode started' : 'Recording started';
        
        setSessionEvents(prev => [...prev, {
          timestamp: now,
          action,
          reason
        }]);
      }
    } else {
      const lastEvent = sessionEvents[sessionEvents.length - 1];
      if (lastEvent && (lastEvent.action === 'start' || lastEvent.action === 'resume')) {
        const reason = testModeConfig.enabled ? 'Test mode paused' : 'Recording paused';
        
        setSessionEvents(prev => [...prev, {
          timestamp: now,
          action: 'pause',
          reason
        }]);
      }
    }
  }, [recordingConfig.isRecording, testModeConfig.enabled]);

  const getSamplingInfo = () => {
    const frequency = (1 / recordingConfig.interval).toFixed(1);
    const intervalMs = recordingConfig.interval * 1000;
    
    return {
      frequency: `${frequency} Hz`,
      interval: intervalMs >= 1000 
        ? `${(intervalMs / 1000).toFixed(1)}s` 
        : `${intervalMs}ms`
    };
  };

  const handleConnect = () => {
    setConnectionStatus(prev => ({
      ...prev,
      isConnected: true,
      lastError: undefined,
      lastSuccessfulRead: Date.now()
    }));
  };

  const handleDisconnect = () => {
    setConnectionStatus(prev => ({
      ...prev,
      isConnected: false,
      lastError: undefined
    }));
    setRecordingConfig(prev => ({
      ...prev,
      isRecording: false
    }));
  };

  const handleChannelToggle = (channelId: number) => {
    if (channelId > serialConfig.registerCount) {
      return;
    }
    
    setChannels(prev => prev.map(channel =>
      channel.id === channelId
        ? { ...channel, enabled: !channel.enabled }
        : channel
    ));
  };

  const handleManualSave = () => {
    const success = saveData(readings, serialConfig, recordingConfig, sessionEvents);
    if (success) {
      alert(t('exportSuccess') + ` ${readings.length} ${t('records')}`);
    } else {
      alert(t('exportFailed'));
    }
  };

  // 修改：增强的CSV导入处理，自动可视化
  const handleImportData = async (file: File) => {
    try {
      const importedReadings = await importFromCSV(file);
      
      // 自动替换当前数据并可视化
      replaceReadings(importedReadings);
      setSessionEvents([]);
      
      // 重置校准状态
      setCalibrationConfig(prev => ({
        ...prev,
        appliedToData: false
      }));
      
      // 自动调整显示配置以最佳显示导入的数据
      if (importedReadings.length > 0) {
        setDisplayConfig(prev => ({
          ...prev,
          mode: 'full', // 显示全部数据
          viewMode: 'combined' // 使用综合视图
        }));
      }
      
      console.log(`Successfully imported and visualized ${importedReadings.length} temperature readings`);
      
    } catch (error) {
      console.error('Import failed:', error);
      throw error; // 重新抛出错误让DisplayControls处理
    }
  };

  const handleStartNewSession = () => {
    clearReadings();
    setStorageConfig(prev => ({
      ...prev,
      totalSavedReadings: 0,
      lastAutoSave: undefined
    }));
    localStorage.removeItem('currentReadings');
    
    setConnectionStatus({
      isConnected: false,
      lastError: undefined,
      lastSuccessfulRead: undefined
    });
    
    setRecordingConfig(prev => ({
      ...prev,
      isRecording: false
    }));
    
    setTestModeConfig(prev => ({
      ...prev,
      enabled: false
    }));

    // 重置校准状态
    setCalibrationConfig(prev => ({
      ...prev,
      appliedToData: false
    }));

    setSessionEvents([{
      timestamp: Date.now(),
      action: 'start',
      reason: 'New session started'
    }]);
  };

  const handleClearCurrentData = () => {
    if (recordingConfig.isRecording || testModeConfig.enabled) {
      alert(language.current === 'zh' 
        ? '请先停止数据采集再清理当前数据' 
        : 'Please stop data collection before clearing current data'
      );
      return;
    }

    if (confirm(language.current === 'zh' 
      ? '确定要清理当前会话的所有数据吗？此操作不可撤销。' 
      : 'Are you sure you want to clear all data in current session? This operation cannot be undone.'
    )) {
      clearReadings();
      setCalibrationConfig(prev => ({
        ...prev,
        appliedToData: false
      }));
      setSessionEvents(prev => [...prev, {
        timestamp: Date.now(),
        action: 'stop',
        reason: 'Current data cleared'
      }]);
      alert(language.current === 'zh' ? '当前数据已清理' : 'Current data cleared');
    }
  };

  const handleTestModeToggle = (newConfig: TestModeConfig) => {
    if (newConfig.enabled && !testModeConfig.enabled) {
      const confirmMessage = language.current === 'zh' 
        ? '确定要启动测试模式吗？测试模式将生成模拟数据，不会连接真实设备。'
        : 'Are you sure you want to start test mode? Test mode will generate simulated data and will not connect to real devices.';
      
      if (confirm(confirmMessage)) {
        setTestModeConfig(newConfig);
      }
    } else {
      setTestModeConfig(newConfig);
    }
  };

  const handleClearSavedData = () => {
    const success = clearSavedData();
    if (success) {
      alert(t('dataCleared'));
    } else {
      alert(language.current === 'zh' ? '清理数据失败' : 'Failed to clear data');
    }
  };

  // 清理原始数据的处理函数
  const handleClearRawData = () => {
    handleClearCurrentData();
  };

  // 新增：应用校准到数据
  const handleApplyCalibration = () => {
    if (readings.length === 0) {
      return;
    }

    // 应用校准偏移值到所有数据
    const calibratedReadings = readings.map(reading => ({
      ...reading,
      calibratedTemperature: reading.temperature + (calibrationConfig.offsets[reading.channel - 1] || 0)
    }));

    // 替换当前数据
    replaceReadings(calibratedReadings);
    
    console.log(`Applied calibration to ${calibratedReadings.length} temperature readings`);
  };

  useEffect(() => {
    if (storageConfig.autoSaveEnabled && readings.length > 0) {
      localStorage.setItem('currentReadings', JSON.stringify(readings));
      localStorage.setItem('currentSessionEvents', JSON.stringify(sessionEvents));
    }
  }, [readings, storageConfig.autoSaveEnabled, sessionEvents]);

  useEffect(() => {
    if (readings.length > 0) {
      setConnectionStatus(prev => ({
        ...prev,
        lastSuccessfulRead: readings[readings.length - 1].timestamp
      }));
    }
  }, [readings]);

  const samplingInfo = getSamplingInfo();

  const themeClasses = isDarkMode 
    ? 'bg-gray-900 text-white' 
    : 'bg-gray-50 text-gray-900';

  const cardClasses = isDarkMode 
    ? 'bg-gray-800 border-gray-700' 
    : 'bg-white border-gray-200';

  const headerClasses = isDarkMode 
    ? 'bg-gradient-to-r from-gray-800 to-gray-700 border-gray-600' 
    : 'bg-gradient-to-r from-gray-100 to-gray-200 border-gray-300';

  return (
    <div className={`min-h-screen ${themeClasses}`}>
      <header className={`${headerClasses} border-b px-6 py-4 shadow-lg`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl shadow-lg">
              <Thermometer className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {t('appTitle')}
              </h1>
              <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {t('appSubtitle')}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-6 w-full lg:w-auto">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleLanguage}
                className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-blue-400' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
                title={t('language')}
              >
                <Globe className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {language.current === 'zh' ? '中' : 'EN'}
                </span>
              </button>
              
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
                title={isDarkMode ? t('switchToDayMode') : t('switchToNightMode')}
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm w-full lg:w-auto">
              <div className="text-left lg:text-right">
                <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} flex items-center gap-1`}>
                  <Clock className="w-4 h-4" />
                  {t('currentTime')}
                </div>
                <div className={`${isDarkMode ? 'text-white' : 'text-gray-900'} font-mono text-sm lg:text-base`}>
                  {currentTime.toLocaleTimeString(language.current === 'zh' ? 'zh-CN' : 'en-US')}
                </div>
              </div>

              <div className="text-left lg:text-right">
                <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t('samplingSettings')}</div>
                <div className="text-cyan-400 font-medium">
                  {samplingInfo.frequency} ({samplingInfo.interval})
                </div>
              </div>

              <div className="text-left lg:text-right">
                <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} flex items-center gap-1 lg:justify-end`}>
                  {connectionStatus.isConnected ? (
                    <Wifi className="w-4 h-4 text-green-400" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-400" />
                  )}
                  {t('modbusStatus')}
                </div>
                <div className={`font-medium ${
                  connectionStatus.isConnected ? 'text-green-400' : 'text-red-400'
                }`}>
                  {connectionStatus.isConnected ? t('connected') : t('disconnected')}
                </div>
              </div>

              <div className="text-left lg:text-right">
                <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} flex items-center gap-1 lg:justify-end`}>
                  <Database className="w-4 h-4" />
                  {t('localStorage')}
                </div>
                <div className="text-purple-400 font-medium">
                  {localStorageUsage}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
              {(isReading || testModeConfig.enabled) && (
                <div className="flex items-center gap-3 px-4 py-2 bg-green-900 rounded-lg border border-green-600">
                  <Activity className="w-5 h-5 animate-pulse text-green-400" />
                  <span className="text-green-300 font-medium">
                    {testModeConfig.enabled ? t('testModeRunning') : t('dataCollecting')}
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-4">
                <div className="text-left lg:text-right">
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t('totalDataPoints')}</div>
                  <div className="text-2xl font-bold text-cyan-400">
                    {readings.length > 0 ? readings.length.toLocaleString() : '--'}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleClearCurrentData}
                    disabled={recordingConfig.isRecording || testModeConfig.enabled}
                    className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
                    title={language.current === 'zh' ? '清理当前数据' : 'Clear Current Data'}
                  >
                    {language.current === 'zh' ? '清理数据' : 'Clear Data'}
                  </button>
                  
                  <button
                    onClick={handleStartNewSession}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                  >
                    {t('newSession')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {sessionActive && (
          <div className="mt-4 p-3 bg-yellow-900 border border-yellow-700 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 font-medium">
                {language.current === 'zh' 
                  ? '会话活跃中 - 寄存器配置已锁定，如需修改请开启新会话'
                  : 'Session Active - Register configuration locked, start new session to modify'
                }
              </span>
            </div>
          </div>
        )}
      </header>

      <main className="p-6 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <TemperatureChart
              readings={readings}
              displayConfig={displayConfig}
              channels={channels}
              language={language.current}
              onHoverDataChange={setChartHoverData}
            />
          </div>
          <div>
            <DrillVisualization
              readings={readings}
              channels={channels}
              language={language.current}
              hoverTemperatures={chartHoverData}
            />
          </div>
        </div>

        <ChannelGrid
          readings={readings}
          channels={channels}
          onChannelToggle={handleChannelToggle}
          language={language.current}
          maxChannels={serialConfig.registerCount}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <DisplayControls
            config={displayConfig}
            onConfigChange={setDisplayConfig}
            onImportData={handleImportData}
            language={language.current}
          />
          
          <div className="lg:col-span-2">
            <DataRecordingControls
              recordingConfig={recordingConfig}
              storageConfig={storageConfig}
              readings={readings}
              serialConfig={serialConfig}
              onRecordingConfigChange={setRecordingConfig}
              onStorageConfigChange={setStorageConfig}
              onManualSave={handleManualSave}
              onImportData={handleImportData}
              onClearSavedData={handleClearSavedData}
              language={language.current}
            />
          </div>
        </div>

        <SerialModbusConfiguration
          config={serialConfig}
          connectionStatus={connectionStatus}
          onConfigChange={setSerialConfig}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          language={language.current}
          sessionActive={sessionActive}
        />

        <RawDataDisplay
          rawDataReadings={rawDataReadings}
          language={language.current}
          onClearRawData={handleClearRawData}
        />

        <TemperatureCalibration
          config={calibrationConfig}
          onConfigChange={setCalibrationConfig}
          onApplyCalibration={handleApplyCalibration}
          channelCount={serialConfig.registerCount}
          language={language.current}
          hasData={readings.length > 0}
        />

        <TemperatureConversionConfig
          config={temperatureConversionConfig}
          onConfigChange={setTemperatureConversionConfig}
          language={language.current}
        />

        <TestModeControls
          config={testModeConfig}
          onConfigChange={handleTestModeToggle}
          language={language.current}
        />
      </main>

      <footer className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'} border-t px-6 py-4 mt-8`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                © 2025 Biomimetic and Intelligent Robotics Lab, Guangdong University of Technology. All rights reserved.
              </div>
              <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-xs mt-1`}>
                广东工业大学机电工程学院仿生与智能机器人实验室
              </div>
            </div>
            
            <div className="text-center md:text-right">
              <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
                Author: Minhui Ye
              </div>
              <div className={`${isDarkMode ? 'text-gray-500' : 'text-gray-600'} text-xs`}>
                Contact: ye_minhui@foxmail.com
              </div>
            </div>
          </div>
          
          <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
            <div className={`text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-600'} text-xs`}>
              Guangzhou 510006, China | {t('appTitle')} v1.0
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;