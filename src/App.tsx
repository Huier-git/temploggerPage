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
import { useTemperatureData } from './hooks/useTemperatureData';
import { useDataStorage } from './hooks/useDataStorage';
import { SerialConfig, ConnectionStatus, RecordingConfig, DisplayConfig, ChannelConfig, TestModeConfig, TemperatureConversionConfig as TemperatureConversionConfigType, LanguageConfig } from './types';
import { useTranslation } from './utils/i18n';
import { generateDynamicColors } from './utils/colorGenerator';

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // 默认暗色模式
  });
  
  const [language, setLanguage] = useState<LanguageConfig>(() => {
    const saved = localStorage.getItem('language');
    return { current: saved === 'en' ? 'en' : 'zh' }; // 默认中文
  });
  
  const { t } = useTranslation(language.current);
  
  const [serialConfig, setSerialConfig] = useState<SerialConfig>({
    port: 'COM1',
    baudRate: 9600,
    parity: 'none',
    stopBits: 1,
    dataBits: 8,
    startRegister: 0, // 默认改为0
    registerCount: 10, // 新增：默认10个寄存器
    offsetAddress: 40001 // 新增：用户可配置的偏移地址
  });

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastError: undefined,
    lastSuccessfulRead: undefined
  });

  const [recordingConfig, setRecordingConfig] = useState<RecordingConfig>({
    interval: 1, // 默认1秒间隔 (1Hz)
    selectedChannels: new Array(16).fill(false).map((_, i) => i < 10), // 前10个通道默认启用
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

  // 动态生成通道颜色
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
      enabled: i < 10, // 前10个通道默认启用
      minRange: 0,
      maxRange: 100
    }));
  });

  // 新增：会话状态管理
  const [sessionActive, setSessionActive] = useState(false);

  // 新增：本地存储使用量状态
  const [localStorageUsage, setLocalStorageUsage] = useState('0 KB');

  // 新增：记录会话状态变化，用于准确的暂停/恢复检测
  const [sessionEvents, setSessionEvents] = useState<Array<{
    timestamp: number;
    action: 'start' | 'pause' | 'resume' | 'stop';
    reason: string;
  }>>([]);

  // 新增：图表悬停数据状态
  const [chartHoverData, setChartHoverData] = useState<{ [channelId: number]: number } | null>(null);

  const { readings, isReading, replaceReadings, clearReadings } = useTemperatureData(
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

  // 语言切换
  const toggleLanguage = () => {
    const newLang = language.current === 'zh' ? 'en' : 'zh';
    setLanguage({ current: newLang });
    localStorage.setItem('language', newLang);
    
    // 更新通道名称
    setChannels(prev => prev.map(channel => ({
      ...channel,
      name: newLang === 'zh' ? `传感器 ${channel.id}` : `Sensor ${channel.id}`
    })));
  };

  // 主题切换
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  // 更新当前时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 检测会话是否活跃
  useEffect(() => {
    const isActive = readings.length > 0 || recordingConfig.isRecording || testModeConfig.enabled || connectionStatus.isConnected;
    setSessionActive(isActive);
  }, [readings.length, recordingConfig.isRecording, testModeConfig.enabled, connectionStatus.isConnected]);

  // 根据寄存器数量更新通道配置和颜色 - 只在会话未活跃时允许
  useEffect(() => {
    if (sessionActive) return; // 会话活跃时不允许修改
    
    const newChannelCount = Math.min(16, Math.max(1, serialConfig.registerCount));
    
    // 重新生成颜色方案
    const colorScheme = generateDynamicColors(newChannelCount, {
      scheme: 'optimized',
      saturationRange: [70, 90],
      lightnessRange: [50, 75]
    });
    
    setChannels(prev => {
      const updated = [...prev];
      // 启用前N个通道，禁用其余通道，并更新颜色
      for (let i = 0; i < 16; i++) {
        updated[i].enabled = i < newChannelCount;
        if (i < newChannelCount) {
          updated[i].color = colorScheme.colors[i].hex;
        }
      }
      return updated;
    });
    
    // 更新录制配置中的通道选择
    setRecordingConfig(prev => ({
      ...prev,
      selectedChannels: prev.selectedChannels.map((_, i) => i < newChannelCount)
    }));
  }, [serialConfig.registerCount, sessionActive]);

  // 实时计算本地存储使用量
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

  // 监听本地存储变化并更新使用量
  useEffect(() => {
    const updateStorageUsage = () => {
      setLocalStorageUsage(calculateLocalStorageUsage());
    };

    // 初始计算
    updateStorageUsage();

    // 监听存储变化事件
    const handleStorageChange = () => {
      updateStorageUsage();
    };

    // 监听自定义存储事件
    window.addEventListener('storage', handleStorageChange);
    
    // 定期更新（每5秒）以确保实时性
    const interval = setInterval(updateStorageUsage, 5000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [t]);

  // 当数据变化时触发存储使用量更新
  useEffect(() => {
    setLocalStorageUsage(calculateLocalStorageUsage());
    // 触发存储事件以通知其他组件
    window.dispatchEvent(new Event('storage'));
  }, [readings.length]);

  // 监听录制状态变化，记录会话事件
  useEffect(() => {
    const now = Date.now();
    
    if (recordingConfig.isRecording) {
      // 开始或恢复录制
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
      // 停止或暂停录制
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

  // 计算采样时间间隔
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
    // 模拟连接过程
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
    // 检查通道是否在允许范围内
    if (channelId > serialConfig.registerCount) {
      return; // 超出寄存器数量的通道不允许切换
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

  const handleImportData = async (file: File) => {
    try {
      const importedReadings = await importFromCSV(file);
      replaceReadings(importedReadings);
      // 清空会话事件，因为导入的是新数据
      setSessionEvents([]);
      alert(t('importSuccess') + ` ${importedReadings.length} ${t('records')}`);
    } catch (error) {
      alert(t('importFailed') + ': ' + (error as Error).message);
    }
  };

  // 清除数据时启动新会话
  const handleStartNewSession = () => {
    clearReadings();
    setStorageConfig(prev => ({
      ...prev,
      totalSavedReadings: 0,
      lastAutoSave: undefined
    }));
    // 清理当前数据引用
    localStorage.removeItem('currentReadings');
    
    // 重置连接状态
    setConnectionStatus({
      isConnected: false,
      lastError: undefined,
      lastSuccessfulRead: undefined
    });
    
    // 停止录制和测试模式
    setRecordingConfig(prev => ({
      ...prev,
      isRecording: false
    }));
    
    setTestModeConfig(prev => ({
      ...prev,
      enabled: false
    }));

    // 清空会话事件并记录新会话开始
    setSessionEvents([{
      timestamp: Date.now(),
      action: 'start',
      reason: 'New session started'
    }]);
  };

  // 清理当前数据（不影响会话状态）
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
      // 记录数据清理事件
      setSessionEvents(prev => [...prev, {
        timestamp: Date.now(),
        action: 'stop',
        reason: 'Current data cleared'
      }]);
      alert(language.current === 'zh' ? '当前数据已清理' : 'Current data cleared');
    }
  };

  // 测试模式启动确认
  const handleTestModeToggle = (newConfig: TestModeConfig) => {
    if (newConfig.enabled && !testModeConfig.enabled) {
      // 启动测试模式时显示确认警告
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

  // 清理保存的数据 - 使用 useDataStorage hook 的方法
  const handleClearSavedData = () => {
    const success = clearSavedData();
    if (success) {
      alert(t('dataCleared'));
    } else {
      alert(language.current === 'zh' ? '清理数据失败' : 'Failed to clear data');
    }
  };

  // 自动保存功能 - 修复自动保存
  useEffect(() => {
    if (storageConfig.autoSaveEnabled && readings.length > 0) {
      // 更新当前数据引用供自动保存使用
      localStorage.setItem('currentReadings', JSON.stringify(readings));
      localStorage.setItem('currentSessionEvents', JSON.stringify(sessionEvents));
    }
  }, [readings, storageConfig.autoSaveEnabled, sessionEvents]);

  // 更新最后成功读取时间
  useEffect(() => {
    if (readings.length > 0) {
      setConnectionStatus(prev => ({
        ...prev,
        lastSuccessfulRead: readings[readings.length - 1].timestamp
      }));
    }
  }, [readings]);

  const samplingInfo = getSamplingInfo();

  // 主题类名
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
            {/* 语言和主题切换按钮 */}
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

            {/* 系统状态信息 - 自适应网格 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm w-full lg:w-auto">
              {/* 当前时间 */}
              <div className="text-left lg:text-right">
                <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} flex items-center gap-1`}>
                  <Clock className="w-4 h-4" />
                  {t('currentTime')}
                </div>
                <div className={`${isDarkMode ? 'text-white' : 'text-gray-900'} font-mono text-sm lg:text-base`}>
                  {currentTime.toLocaleTimeString(language.current === 'zh' ? 'zh-CN' : 'en-US')}
                </div>
              </div>

              {/* 采样设置 */}
              <div className="text-left lg:text-right">
                <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t('samplingSettings')}</div>
                <div className="text-cyan-400 font-medium">
                  {samplingInfo.frequency} ({samplingInfo.interval})
                </div>
              </div>

              {/* Modbus连接状态 */}
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

              {/* 本地存储使用量 */}
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

            {/* 运行状态和数据统计 */}
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
        
        {/* 会话状态提示 */}
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
        {/* 第一行：温度图表和钻具可视化 */}
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

        {/* 第二行：通道网格 */}
        <ChannelGrid
          readings={readings}
          channels={channels}
          onChannelToggle={handleChannelToggle}
          language={language.current}
          maxChannels={serialConfig.registerCount}
        />

        {/* 第三行：控制面板 */}
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

        {/* 第四行：串口Modbus配置 */}
        <SerialModbusConfiguration
          config={serialConfig}
          connectionStatus={connectionStatus}
          onConfigChange={setSerialConfig}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          language={language.current}
          sessionActive={sessionActive}
        />

        {/* 第五行：温度转换配置 */}
        <TemperatureConversionConfig
          config={temperatureConversionConfig}
          onConfigChange={setTemperatureConversionConfig}
          language={language.current}
        />

        {/* 第六行：测试模式 */}
        <TestModeControls
          config={testModeConfig}
          onConfigChange={handleTestModeToggle}
          language={language.current}
        />
      </main>

      {/* 版权信息页脚 */}
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