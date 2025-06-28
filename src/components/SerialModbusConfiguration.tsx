import React, { useState, useEffect, useRef } from 'react';
import { Settings, Wifi, WifiOff, CheckCircle, XCircle, AlertCircle, Hash, Zap, Activity, AlertTriangle } from 'lucide-react';
import { SerialConfig, ConnectionStatus } from '../types';

interface SerialModbusConfigurationProps {
  config: SerialConfig;
  connectionStatus: ConnectionStatus;
  onConfigChange: (config: SerialConfig) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];

// Modbus RTU CRC计算
function calculateCRC(buffer: Uint8Array): number {
  let crc = 0xFFFF;
  
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    
    for (let j = 0; j < 8; j++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc = crc >> 1;
      }
    }
  }
  
  return crc;
}

// 构造Modbus RTU请求帧
function buildModbusFrame(slaveId: number, functionCode: number, startAddress: number, quantity: number): Uint8Array {
  const frame = new Uint8Array(8);
  
  frame[0] = slaveId;
  frame[1] = functionCode;
  frame[2] = (startAddress >> 8) & 0xFF; // 高字节
  frame[3] = startAddress & 0xFF;        // 低字节
  frame[4] = (quantity >> 8) & 0xFF;     // 高字节
  frame[5] = quantity & 0xFF;            // 低字节
  
  const crc = calculateCRC(frame.slice(0, 6));
  frame[6] = crc & 0xFF;        // CRC低字节
  frame[7] = (crc >> 8) & 0xFF; // CRC高字节
  
  return frame;
}

export default function SerialModbusConfiguration({
  config,
  connectionStatus,
  onConfigChange,
  onConnect,
  onDisconnect
}: SerialModbusConfigurationProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastConnectionAttempt, setLastConnectionAttempt] = useState<number | null>(null);
  const [customRegisters, setCustomRegisters] = useState<string>('');
  const [useCustomRegisters, setUseCustomRegisters] = useState(false);
  const [parsedRegisters, setParsedRegisters] = useState<number[]>([]);
  const [serialPort, setSerialPort] = useState<SerialPort | null>(null);
  const [modbusStats, setModbusStats] = useState({
    successCount: 0,
    errorCount: 0,
    lastTransaction: 0,
    slaveId: 1,
    retries: 3,
    timeout: 1000
  });
  const [operationLog, setOperationLog] = useState<Array<{
    id: string;
    timestamp: number;
    type: 'read' | 'write';
    status: 'success' | 'error' | 'timeout';
    message: string;
  }>>([]);

  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);

  // 检查Web Serial API支持
  const isWebSerialSupported = 'serial' in navigator;

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

  // 添加操作日志
  const addOperationLog = (type: 'read' | 'write', status: 'success' | 'error' | 'timeout', message: string) => {
    const newLog = {
      id: `${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      type,
      status,
      message
    };
    
    setOperationLog(prev => [...prev.slice(-9), newLog]); // 保留最近10条记录
  };

  // Web Serial API连接
  const handleWebSerialConnect = async () => {
    if (!isWebSerialSupported) {
      alert('您的浏览器不支持Web Serial API。请使用Chrome 89+或Edge 89+。');
      return;
    }

    setIsConnecting(true);
    setLastConnectionAttempt(Date.now());

    try {
      // 请求串口
      const port = await navigator.serial.requestPort();
      
      // 打开串口
      await port.open({
        baudRate: config.baudRate,
        dataBits: config.dataBits,
        stopBits: config.stopBits,
        parity: config.parity
      });

      setSerialPort(port);
      
      // 获取读写流
      if (port.readable && port.writable) {
        readerRef.current = port.readable.getReader();
        writerRef.current = port.writable.getWriter();
      }

      // 测试Modbus通信
      const testSuccess = await testModbusCommunication();
      
      if (testSuccess) {
        onConnect();
        addOperationLog('read', 'success', `成功连接到串口，波特率 ${config.baudRate}`);
        
        // 启动定期读取
        startPeriodicReading();
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('串口连接成功', {
            body: `已连接到串口，波特率 ${config.baudRate}`,
            icon: '/favicon.ico'
          });
        }
      } else {
        throw new Error('Modbus通信测试失败');
      }
      
    } catch (error) {
      console.error('串口连接失败:', error);
      addOperationLog('read', 'error', `连接失败: ${(error as Error).message}`);
      
      // 清理资源
      await cleanupConnection();
      
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('串口连接失败', {
          body: (error as Error).message,
          icon: '/favicon.ico'
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // 测试Modbus通信
  const testModbusCommunication = async (): Promise<boolean> => {
    if (!writerRef.current || !readerRef.current) return false;

    try {
      // 构造读取保持寄存器的Modbus帧 (功能码0x03)
      const startAddr = config.customRegisters ? config.customRegisters[0] : config.startRegister;
      const actualAddr = startAddr >= 40001 ? startAddr - 40001 : startAddr; // 处理40001偏移
      const frame = buildModbusFrame(modbusStats.slaveId, 0x03, actualAddr, 1);
      
      // 发送请求
      await writerRef.current.write(frame);
      addOperationLog('read', 'success', `发送Modbus请求: 从站${modbusStats.slaveId}, 地址${startAddr}`);
      
      // 等待响应 (简化版本，实际应该有超时处理)
      const response = await Promise.race([
        readerRef.current.read(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('响应超时')), modbusStats.timeout)
        )
      ]);
      
      if (response.value && response.value.length >= 5) {
        // 简单验证响应格式
        const responseFrame = response.value;
        if (responseFrame[0] === modbusStats.slaveId && responseFrame[1] === 0x03) {
          setModbusStats(prev => ({
            ...prev,
            successCount: prev.successCount + 1,
            lastTransaction: Date.now()
          }));
          addOperationLog('read', 'success', `收到有效Modbus响应，数据长度: ${responseFrame.length}`);
          return true;
        }
      }
      
      throw new Error('无效的Modbus响应');
      
    } catch (error) {
      setModbusStats(prev => ({
        ...prev,
        errorCount: prev.errorCount + 1
      }));
      addOperationLog('read', 'error', `Modbus通信失败: ${(error as Error).message}`);
      return false;
    }
  };

  // 定期读取温度数据
  const startPeriodicReading = () => {
    // 这里可以实现定期读取逻辑
    // 由于这是演示，我们只是模拟成功的连接状态
    console.log('开始定期读取温度数据...');
  };

  // 清理连接
  const cleanupConnection = async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current.releaseLock();
        readerRef.current = null;
      }
      
      if (writerRef.current) {
        await writerRef.current.close();
        writerRef.current = null;
      }
      
      if (serialPort) {
        await serialPort.close();
        setSerialPort(null);
      }
    } catch (error) {
      console.error('清理连接时出错:', error);
    }
  };

  const handleDisconnect = async () => {
    await cleanupConnection();
    onDisconnect();
    addOperationLog('read', 'success', '串口连接已断开');
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('串口连接已关闭', {
        body: '已断开串口连接',
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

  // 组件卸载时清理连接
  useEffect(() => {
    return () => {
      cleanupConnection();
    };
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
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <Zap className="w-5 h-5 text-orange-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">串口Modbus RTU配置</h2>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Web Serial API支持状态 */}
          <div className={`px-3 py-1 rounded-full text-xs ${
            isWebSerialSupported 
              ? 'bg-green-900 text-green-300' 
              : 'bg-red-900 text-red-300'
          }`}>
            {isWebSerialSupported ? 'Web Serial支持' : 'Web Serial不支持'}
          </div>
          
          {/* 连接状态指示器 */}
          <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${getConnectionStatusColor()}`}>
            {getConnectionStatusIcon()}
            <div className="flex flex-col">
              <span className="font-medium text-sm">{getConnectionStatusText()}</span>
              {connectionStatus.isConnected && connectionStatus.lastSuccessfulRead && (
                <span className="text-xs opacity-75">
                  最后读取: {new Date(connectionStatus.lastSuccessfulRead).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={connectionStatus.isConnected ? handleDisconnect : handleWebSerialConnect}
            disabled={isConnecting || !isWebSerialSupported}
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
                连接串口
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modbus RTU状态显示 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">成功事务</span>
          </div>
          <div className="text-lg font-bold text-blue-400">
            {modbusStats.successCount}
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-gray-300">错误次数</span>
          </div>
          <div className="text-lg font-bold text-yellow-400">
            {modbusStats.errorCount}
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-gray-300">从站ID</span>
          </div>
          <div className="text-lg font-bold text-purple-400">
            {modbusStats.slaveId}
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-gray-300">最后事务</span>
          </div>
          <div className="text-sm font-bold text-green-400">
            {modbusStats.lastTransaction > 0 
              ? new Date(modbusStats.lastTransaction).toLocaleTimeString()
              : '无'
            }
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 串口配置 */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">串口参数</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
        </div>

        {/* Modbus配置 */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Modbus RTU参数</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                从站ID
              </label>
              <input
                type="number"
                value={modbusStats.slaveId}
                onChange={(e) => setModbusStats(prev => ({
                  ...prev,
                  slaveId: parseInt(e.target.value) || 1
                }))}
                min={1}
                max={247}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                disabled={connectionStatus.isConnected}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                超时时间 (ms)
              </label>
              <input
                type="number"
                value={modbusStats.timeout}
                onChange={(e) => setModbusStats(prev => ({
                  ...prev,
                  timeout: parseInt(e.target.value) || 1000
                }))}
                min={100}
                max={10000}
                step={100}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                重试次数
              </label>
              <input
                type="number"
                value={modbusStats.retries}
                onChange={(e) => setModbusStats(prev => ({
                  ...prev,
                  retries: parseInt(e.target.value) || 3
                }))}
                min={0}
                max={10}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
              />
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
        </div>
      </div>

      {/* 自定义寄存器配置 */}
      <div className="mt-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
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

      {/* 操作日志 */}
      <div className="mt-6">
        <h4 className="text-lg font-semibold text-white mb-4">操作日志</h4>
        
        <div className="bg-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto">
          {operationLog.length === 0 ? (
            <div className="text-gray-400 text-center py-4">
              暂无操作记录
            </div>
          ) : (
            <div className="space-y-2">
              {operationLog.slice().reverse().map(log => (
                <div key={log.id} className="flex items-center justify-between p-2 bg-gray-600 rounded">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      log.status === 'success' ? 'bg-green-400' :
                      log.status === 'error' ? 'bg-red-400' : 'bg-yellow-400'
                    }`}></div>
                    
                    <div className="text-sm">
                      <span className="text-white font-medium">
                        {log.type === 'read' ? '读取' : '写入'}
                      </span>
                      <span className="text-gray-300 ml-2">
                        {log.message}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Web Serial API说明 */}
      {!isWebSerialSupported && (
        <div className="mt-4 p-3 bg-red-900 border border-red-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-300 font-medium">Web Serial API不支持</span>
          </div>
          <div className="text-red-300 text-sm space-y-1">
            <p>您的浏览器不支持Web Serial API。请使用以下浏览器:</p>
            <p>• Chrome 89+ 或 Edge 89+</p>
            <p>• 确保在HTTPS环境下运行</p>
          </div>
        </div>
      )}

      {/* 连接说明 */}
      {!connectionStatus.isConnected && !isConnecting && isWebSerialSupported && (
        <div className="mt-4 p-3 bg-blue-900 border border-blue-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-blue-400" />
            <span className="text-blue-300 font-medium">连接说明</span>
          </div>
          <div className="text-blue-300 text-sm space-y-1">
            <p>1. 确保您的Modbus RTU设备已连接到计算机</p>
            <p>2. 点击"连接串口"选择正确的串口设备</p>
            <p>3. 系统将自动测试Modbus通信</p>
            <p>4. 配置正确的从站ID和寄存器地址</p>
            <p>5. 支持功能码0x03(读保持寄存器)和CRC校验</p>
          </div>
        </div>
      )}
    </div>
  );
}