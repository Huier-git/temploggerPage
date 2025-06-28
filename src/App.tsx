import React, { useState, useEffect } from 'react';
import { Activity, Thermometer, Wifi, WifiOff, Clock, Database, Sun, Moon } from 'lucide-react';
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
import { SerialConfig, ConnectionStatus, RecordingConfig, DisplayConfig, ChannelConfig, TestModeConfig, TemperatureConversionConfig as TemperatureConversionConfigType } from './types';

// Default channel colors
const CHANNEL_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9'
];

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // 默认暗色模式
  });
  
  const [serialConfig, setSerialConfig] = useState<SerialConfig>({
    port: 'COM1',
    baudRate: 9600,
    parity: 'none',
    stopBits: 1,
    dataBits: 8,
    startRegister: 40001
  });

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastError: undefined,
    lastSuccessfulRead: undefined
  });

  const [recordingConfig, setRecordingConfig] = useState<RecordingConfig>({
    interval: 1, // 默认1秒间隔 (1Hz)
    selectedChannels: new Array(10).fill(true),
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
    customFormula: `// 自定义转换公式
// registerValue: 原始寄存器值 (0-65535)
// 返回: 温度值 (°C)

if (registerValue > 32767) {
  // 处理负温度 (二进制补码)
  return (registerValue - 65536) * 0.1;
}
return registerValue * 0.1;`,
    testValue: 250
  });

  const [channels, setChannels] = useState<ChannelConfig[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `传感器 ${i + 1}`,
      color: CHANNEL_COLORS[i],
      enabled: true,
      minRange: 0,
      maxRange: 100
    }))
  );

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
    importFromCSV
  } = useDataStorage();

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
      return `${sizeInMB} MB`;
    } catch (error) {
      return '未知';
    }
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
    setChannels(prev => prev.map(channel =>
      channel.id === channelId
        ? { ...channel, enabled: !channel.enabled }
        : channel
    ));
  };

  const handleManualSave = () => {
    const success = saveData(readings, serialConfig, recordingConfig);
    if (success) {
      alert(`成功导出 ${readings.length} 条数据记录为CSV文件`);
    } else {
      alert('导出失败，请重试');
    }
  };

  const handleImportData = async (file: File) => {
    try {
      const importedReadings = await importFromCSV(file);
      replaceReadings(importedReadings);
      alert(`成功导入 ${importedReadings.length} 条数据记录`);
    } catch (error) {
      alert('导入失败: ' + (error as Error).message);
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
  };

  // 自动保存功能 - 修复自动保存
  useEffect(() => {
    if (storageConfig.autoSaveEnabled && readings.length > 0) {
      // 更新当前数据引用供自动保存使用
      localStorage.setItem('currentReadings', JSON.stringify(readings));
    }
  }, [readings, storageConfig.autoSaveEnabled]);

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
  const localStorageUsage = getLocalStorageUsage();

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
                钻具温度采集显示平台
              </h1>
              <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Drill String Temperature Monitoring System
              </p>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-6 w-full lg:w-auto">
            {/* 主题切换按钮 */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
              title={isDarkMode ? '切换到日间模式' : '切换到夜间模式'}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* 系统状态信息 - 自适应网格 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm w-full lg:w-auto">
              {/* 当前时间 */}
              <div className="text-left lg:text-right">
                <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} flex items-center gap-1`}>
                  <Clock className="w-4 h-4" />
                  当前时间
                </div>
                <div className={`${isDarkMode ? 'text-white' : 'text-gray-900'} font-mono text-sm lg:text-base`}>
                  {currentTime.toLocaleTimeString('zh-CN')}
                </div>
              </div>

              {/* 采样设置 */}
              <div className="text-left lg:text-right">
                <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>采样设置</div>
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
                  Modbus状态
                </div>
                <div className={`font-medium ${
                  connectionStatus.isConnected ? 'text-green-400' : 'text-red-400'
                }`}>
                  {connectionStatus.isConnected ? '已连接' : '未连接'}
                </div>
              </div>

              {/* 本地存储使用量 */}
              <div className="text-left lg:text-right">
                <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} flex items-center gap-1 lg:justify-end`}>
                  <Database className="w-4 h-4" />
                  本地存储
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
                    {testModeConfig.enabled ? '测试模式运行中' : '数据采集中'}
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-4">
                <div className="text-left lg:text-right">
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>总数据点</div>
                  <div className="text-2xl font-bold text-cyan-400">
                    {readings.length > 0 ? readings.length.toLocaleString() : '--'}
                  </div>
                </div>
                
                <button
                  onClick={handleStartNewSession}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                >
                  新建会话
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* 第一行：温度图表和钻具可视化 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <TemperatureChart
              readings={readings}
              displayConfig={displayConfig}
              channels={channels}
            />
          </div>
          <div>
            <DrillVisualization
              readings={readings}
              channels={channels}
            />
          </div>
        </div>

        {/* 第二行：通道网格 */}
        <ChannelGrid
          readings={readings}
          channels={channels}
          onChannelToggle={handleChannelToggle}
        />

        {/* 第三行：控制面板 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <DisplayControls
            config={displayConfig}
            onConfigChange={setDisplayConfig}
            onImportData={handleImportData}
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
        />

        {/* 第五行：温度转换配置 */}
        <TemperatureConversionConfig
          config={temperatureConversionConfig}
          onConfigChange={setTemperatureConversionConfig}
        />

        {/* 第六行：测试模式 */}
        <TestModeControls
          config={testModeConfig}
          onConfigChange={setTestModeConfig}
        />
      </main>

      {/* 版权信息页脚 */}
      <footer className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'} border-t px-6 py-4 mt-8`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                © 2024 Biomimetic and Intelligent Robotics Lab, Guangdong University of Technology. All rights reserved.
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
              Guangzhou 510006, China | 钻具温度采集显示平台 v1.0
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;