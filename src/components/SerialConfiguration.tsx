import React, { useState, useEffect } from 'react';
import { Settings, Wifi, WifiOff, CheckCircle, XCircle, AlertCircle, Hash } from 'lucide-react';
import { SerialConfig, ConnectionStatus } from '../types';

interface SerialConfigurationProps {
  config: SerialConfig;
  connectionStatus: ConnectionStatus;
  onConfigChange: (config: SerialConfig) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];
const AVAILABLE_PORTS = ['COM1', 'COM2', 'COM3', 'COM4', '/dev/ttyUSB0', '/dev/ttyUSB1'];

export default function SerialConfiguration({
  config,
  connectionStatus,
  onConfigChange,
  onConnect,
  onDisconnect
}: SerialConfigurationProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastConnectionAttempt, setLastConnectionAttempt] = useState<number | null>(null);
  const [customRegisters, setCustomRegisters] = useState<string>('');
  const [useCustomRegisters, setUseCustomRegisters] = useState(false);
  const [parsedRegisters, setParsedRegisters] = useState<number[]>([]);

  const handleInputChange = (field: keyof SerialConfig, value: string | number) => {
    onConfigChange({
      ...config,
      [field]: value
    });
  };

  const handleCustomRegistersChange = (value: string) => {
    setCustomRegisters(value);
    
    // 解析寄存器地址
    const registers = value
      .split(';')
      .map(reg => reg.trim())
      .filter(reg => reg !== '')
      .map(reg => parseInt(reg))
      .filter(reg => !isNaN(reg) && reg >= 0 && reg <= 65535);
    
    setParsedRegisters(registers);
    
    // 更新配置
    onConfigChange({
      ...config,
      customRegisters: registers.length > 0 ? registers : undefined
    });
  };

  const handleUseCustomRegistersToggle = () => {
    const newUseCustom = !useCustomRegisters;
    setUseCustomRegisters(newUseCustom);
    
    if (!newUseCustom) {
      // 切换回连续寄存器模式
      onConfigChange({
        ...config,
        customRegisters: undefined
      });
    } else if (parsedRegisters.length > 0) {
      // 切换到自定义寄存器模式
      onConfigChange({
        ...config,
        customRegisters: parsedRegisters
      });
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setLastConnectionAttempt(Date.now());
    
    // 模拟连接延迟
    setTimeout(() => {
      const success = Math.random() > 0.2; // 80% 成功率用于演示
      
      if (success) {
        onConnect();
        // 成功连接的浏览器通知
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('串口连接成功', {
            body: `已连接到 ${config.port}，波特率 ${config.baudRate}`,
            icon: '/favicon.ico'
          });
        }
      } else {
        // 模拟连接错误
        const errorMessage = `连接到 ${config.port} 失败。请检查设备连接。`;
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('串口连接失败', {
            body: errorMessage,
            icon: '/favicon.ico'
          });
        }
      }
      
      setIsConnecting(false);
    }, 2000);
  };

  const handleDisconnect = () => {
    onDisconnect();
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('串口连接已关闭', {
        body: `已断开与 ${config.port} 的连接`,
        icon: '/favicon.ico'
      });
    }
  };

  // 在组件挂载时请求通知权限
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const getConnectionStatusIcon = () => {
    if (isConnecting) {
      return <AlertCircle className="w-5 h-5 text-yellow-400 animate-pulse" />;
    }
    if (connectionStatus.isConnected) {
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    }
    return <XCircle className="w-5 h-5 text-red-400" />;
  };

  const getConnectionStatusText = () => {
    if (isConnecting) return '连接中...';
    if (connectionStatus.isConnected) return '已连接';
    return '未连接';
  };

  const getConnectionStatusColor = () => {
    if (isConnecting) return 'bg-yellow-900 text-yellow-300 border-yellow-700';
    if (connectionStatus.isConnected) return 'bg-green-900 text-green-300 border-green-700';
    return 'bg-red-900 text-red-300 border-red-700';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">串口配置</h2>
        </div>
        
        <div className="flex items-center gap-4">
          {/* 增强的连接状态指示器 */}
          <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${getConnectionStatusColor()}`}>
            {getConnectionStatusIcon()}
            <div className="flex flex-col">
              <span className="font-medium text-sm">{getConnectionStatusText()}</span>
              {connectionStatus.isConnected && connectionStatus.lastSuccessfulRead && (
                <span className="text-xs opacity-75">
                  最后读取: {new Date(connectionStatus.lastSuccessfulRead).toLocaleTimeString()}
                </span>
              )}
              {isConnecting && (
                <span className="text-xs opacity-75">
                  正在建立连接...
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={connectionStatus.isConnected ? handleDisconnect : handleConnect}
            disabled={isConnecting}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              connectionStatus.isConnected
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isConnecting ? (
              <>
                <AlertCircle className="w-4 h-4 animate-spin" />
                连接中...
              </>
            ) : connectionStatus.isConnected ? (
              <>
                <WifiOff className="w-4 h-4" />
                断开连接
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                连接
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            串口端口
          </label>
          <select
            value={config.port}
            onChange={(e) => handleInputChange('port', e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={connectionStatus.isConnected || isConnecting}
          >
            {AVAILABLE_PORTS.map(port => (
              <option key={port} value={port}>{port}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            波特率
          </label>
          <select
            value={config.baudRate}
            onChange={(e) => handleInputChange('baudRate', parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={connectionStatus.isConnected || isConnecting}
          >
            {BAUD_RATES.map(rate => (
              <option key={rate} value={rate}>{rate}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            校验位
          </label>
          <select
            value={config.parity}
            onChange={(e) => handleInputChange('parity', e.target.value as 'none' | 'even' | 'odd')}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={connectionStatus.isConnected || isConnecting}
          >
            <option value="none">无</option>
            <option value="even">偶校验</option>
            <option value="odd">奇校验</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            数据位
          </label>
          <select
            value={config.dataBits}
            onChange={(e) => handleInputChange('dataBits', parseInt(e.target.value) as 7 | 8)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={connectionStatus.isConnected || isConnecting}
          >
            <option value={7}>7位</option>
            <option value={8}>8位</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            停止位
          </label>
          <select
            value={config.stopBits}
            onChange={(e) => handleInputChange('stopBits', parseInt(e.target.value) as 1 | 2)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={connectionStatus.isConnected || isConnecting}
          >
            <option value={1}>1位</option>
            <option value={2}>2位</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            起始寄存器
          </label>
          <input
            type="number"
            value={config.startRegister}
            onChange={(e) => handleInputChange('startRegister', parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min={0}
            max={65535}
            disabled={connectionStatus.isConnected || isConnecting || useCustomRegisters}
          />
        </div>
      </div>

      {/* 自定义寄存器配置 */}
      <div className="mb-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">寄存器配置</h3>
          </div>
          
          <button
            onClick={handleUseCustomRegistersToggle}
            disabled={connectionStatus.isConnected || isConnecting}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
              useCustomRegisters ? 'bg-purple-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                useCustomRegisters ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className={`px-2 py-1 rounded ${useCustomRegisters ? 'bg-purple-600' : 'bg-blue-600'}`}>
              {useCustomRegisters ? '自定义寄存器模式' : '连续寄存器模式'}
            </span>
          </div>

          {useCustomRegisters ? (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                自定义寄存器地址 (用分号分隔，最多10个)
              </label>
              <input
                type="text"
                value={customRegisters}
                onChange={(e) => handleCustomRegistersChange(e.target.value)}
                placeholder="例如: 40001;40003;40005;40010;40015"
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={connectionStatus.isConnected || isConnecting}
              />
              
              {parsedRegisters.length > 0 && (
                <div className="mt-2 p-2 bg-gray-600 rounded">
                  <div className="text-xs text-gray-300 mb-1">已解析的寄存器地址:</div>
                  <div className="flex flex-wrap gap-1">
                    {parsedRegisters.slice(0, 10).map((reg, index) => (
                      <span key={index} className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                        通道{index + 1}: {reg}
                      </span>
                    ))}
                  </div>
                  {parsedRegisters.length > 10 && (
                    <div className="text-xs text-yellow-400 mt-1">
                      注意: 只显示前10个寄存器地址
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-400">
              使用连续寄存器模式: 从寄存器 {config.startRegister} 开始读取10个连续寄存器
              ({config.startRegister} - {config.startRegister + 9})
            </div>
          )}
        </div>
      </div>

      {/* 连接验证状态 */}
      {connectionStatus.isConnected && (
        <div className="mt-4 p-3 bg-green-900 border border-green-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-green-300 font-medium">连接已验证</span>
          </div>
          <div className="text-green-300 text-sm space-y-1">
            <p><strong>端口:</strong> {config.port}</p>
            <p><strong>波特率:</strong> {config.baudRate}</p>
            <p><strong>寄存器配置:</strong> {
              useCustomRegisters && parsedRegisters.length > 0
                ? `自定义寄存器 (${parsedRegisters.length}个)`
                : `连续寄存器 ${config.startRegister}-${config.startRegister + 9}`
            }</p>
            {connectionStatus.lastSuccessfulRead && (
              <p><strong>最后成功读取:</strong> {new Date(connectionStatus.lastSuccessfulRead).toLocaleString()}</p>
            )}
          </div>
        </div>
      )}

      {/* 错误处理 */}
      {connectionStatus.lastError && (
        <div className="mt-4 p-3 bg-red-900 border border-red-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-300 font-medium">连接错误</span>
          </div>
          <p className="text-red-300 text-sm">
            {connectionStatus.lastError}
          </p>
          {lastConnectionAttempt && (
            <p className="text-red-300 text-xs mt-1">
              最后尝试时间: {new Date(lastConnectionAttempt).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {/* 连接说明 */}
      {!connectionStatus.isConnected && !isConnecting && (
        <div className="mt-4 p-3 bg-blue-900 border border-blue-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-blue-400" />
            <span className="text-blue-300 font-medium">连接说明</span>
          </div>
          <div className="text-blue-300 text-sm space-y-1">
            <p>1. 确保您的Modbus设备已连接到所选串口</p>
            <p>2. 验证设备已通电并正在响应</p>
            <p>3. 检查波特率和其他参数是否与设备设置匹配</p>
            <p>4. 配置正确的寄存器地址</p>
            <p>5. 点击"连接"建立通信</p>
          </div>
        </div>
      )}
    </div>
  );
}