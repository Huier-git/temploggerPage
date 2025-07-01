import React, { useState, useEffect, useRef } from 'react';
import { Settings, Wifi, WifiOff, CheckCircle, XCircle, AlertCircle, Hash, Zap, Activity, AlertTriangle, Globe } from 'lucide-react';
import { SerialConfig, ConnectionStatus } from '../types';
import { useTranslation } from '../utils/i18n';

interface SerialModbusConfigurationProps {
  config: SerialConfig;
  connectionStatus: ConnectionStatus;
  onConfigChange: (config: SerialConfig) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  language: 'zh' | 'en';
  sessionActive: boolean;
}

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];

// Available Modbus function codes
const FUNCTION_CODES = [
  { code: 0x01, name: 'Read Coils', description: 'Read discrete outputs (0x)' },
  { code: 0x02, name: 'Read Discrete Inputs', description: 'Read discrete inputs (1x)' },
  { code: 0x03, name: 'Read Holding Registers', description: 'Read holding registers (4x)' },
  { code: 0x04, name: 'Read Input Registers', description: 'Read input registers (3x)' },
  { code: 0x05, name: 'Write Single Coil', description: 'Write single coil (0x)' },
  { code: 0x06, name: 'Write Single Register', description: 'Write single register (4x)' },
  { code: 0x0F, name: 'Write Multiple Coils', description: 'Write multiple coils (0x)' },
  { code: 0x10, name: 'Write Multiple Registers', description: 'Write multiple registers (4x)' }
];

export default function SerialModbusConfiguration({
  config,
  connectionStatus,
  onConfigChange,
  onConnect,
  onDisconnect,
  language,
  sessionActive
}: SerialModbusConfigurationProps) {
  const { t } = useTranslation(language);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastConnectionAttempt, setLastConnectionAttempt] = useState<number | null>(null);
  const [customRegisters, setCustomRegisters] = useState<string>('');
  const [useCustomRegisters, setUseCustomRegisters] = useState(false);
  const [parsedRegisters, setParsedRegisters] = useState<number[]>([]);
  const [serialPort, setSerialPort] = useState<SerialPort | null>(null);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [connectionMode, setConnectionMode] = useState<'webserial' | 'websocket'>('webserial');
  const [websocketPort, setWebsocketPort] = useState<number>(8080);
  const [modbusStats, setModbusStats] = useState({
    successCount: 0,
    errorCount: 0,
    lastTransaction: 0,
    slaveId: 1,
    retries: 3,
    timeout: 1000,
    selectedFunctionCode: 0x03,
    autoHandleOffsetAddress: false
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

  // Check Web Serial API support
  const isWebSerialSupported = 'serial' in navigator;

  const handleInputChange = (field: keyof SerialConfig, value: string | number) => {
    if (sessionActive && (field === 'registerCount' || field === 'startRegister' || field === 'offsetAddress')) {
      return;
    }
    
    onConfigChange({
      ...config,
      [field]: value
    });
  };

  const handleCustomRegistersChange = (value: string) => {
    if (sessionActive) return;
    
    setCustomRegisters(value);
    
    const registers = value
      .split(';')
      .map(reg => reg.trim())
      .filter(reg => reg !== '')
      .map(reg => parseInt(reg))
      .filter(reg => !isNaN(reg) && reg >= 0 && reg <= 65535);
    
    setParsedRegisters(registers);
    
    onConfigChange({
      ...config,
      customRegisters: registers.length > 0 ? registers : undefined
    });
  };

  const handleUseCustomRegistersToggle = () => {
    if (sessionActive) return;
    
    const newUseCustom = !useCustomRegisters;
    setUseCustomRegisters(newUseCustom);
    
    if (!newUseCustom) {
      onConfigChange({
        ...config,
        customRegisters: undefined
      });
    } else if (parsedRegisters.length > 0) {
      onConfigChange({
        ...config,
        customRegisters: parsedRegisters
      });
    }
  };

  const addOperationLog = (type: 'read' | 'write', status: 'success' | 'error' | 'timeout', message: string) => {
    const newLog = {
      id: `${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      type,
      status,
      message
    };
    
    setOperationLog(prev => [...prev.slice(-9), newLog]);
  };

  // WebSocket connection
  const handleWebSocketConnect = async () => {
    const confirmMessage = language === 'zh' 
      ? `确定要通过WebSocket连接到 ws://localhost:${websocketPort} 吗？\n\n请确保您已经运行了串口转WebSocket的后端程序。`
      : `Are you sure you want to connect via WebSocket to ws://localhost:${websocketPort}?\n\nPlease ensure you have the serial-to-WebSocket backend program running.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsConnecting(true);
    setLastConnectionAttempt(Date.now());

    try {
      const ws = new WebSocket(`ws://localhost:${websocketPort}`);
      
      ws.onopen = () => {
        setWebsocket(ws);
        onConnect();
        addOperationLog('read', 'success', `${language === 'zh' ? '成功连接到WebSocket' : 'Successfully connected to WebSocket'} ws://localhost:${websocketPort}`);
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(language === 'zh' ? 'WebSocket连接成功' : 'WebSocket Connection Successful', {
            body: `${language === 'zh' ? '已连接到' : 'Connected to'} ws://localhost:${websocketPort}`,
            icon: '/favicon.ico'
          });
        }
        
        setIsConnecting(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket connection failed:', error);
        addOperationLog('read', 'error', `${language === 'zh' ? 'WebSocket连接失败' : 'WebSocket connection failed'}`);
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(language === 'zh' ? 'WebSocket连接失败' : 'WebSocket Connection Failed', {
            body: language === 'zh' ? '无法连接到后端程序' : 'Unable to connect to backend program',
            icon: '/favicon.ico'
          });
        }
        
        setIsConnecting(false);
      };

      ws.onclose = () => {
        setWebsocket(null);
        onDisconnect();
        addOperationLog('read', 'success', language === 'zh' ? 'WebSocket连接已断开' : 'WebSocket connection closed');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'modbus_response') {
            setModbusStats(prev => ({
              ...prev,
              successCount: prev.successCount + 1,
              lastTransaction: Date.now()
            }));
            addOperationLog('read', 'success', `${language === 'zh' ? '收到Modbus响应' : 'Received Modbus response'}: ${data.data.length} bytes`);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

    } catch (error) {
      console.error('WebSocket connection failed:', error);
      addOperationLog('read', 'error', `${language === 'zh' ? 'WebSocket连接失败' : 'WebSocket connection failed'}: ${(error as Error).message}`);
      setIsConnecting(false);
    }
  };

  // Web Serial API connection
  const handleWebSerialConnect = async () => {
    if (!isWebSerialSupported) {
      alert(language === 'zh' ? '您的浏览器不支持Web Serial API。请使用Chrome 89+或Edge 89+。' : 'Your browser does not support Web Serial API. Please use Chrome 89+ or Edge 89+.');
      return;
    }

    setIsConnecting(true);
    setLastConnectionAttempt(Date.now());

    try {
      const port = await navigator.serial.requestPort();
      
      await port.open({
        baudRate: config.baudRate,
        dataBits: config.dataBits,
        stopBits: config.stopBits,
        parity: config.parity
      });

      setSerialPort(port);
      
      if (port.readable && port.writable) {
        readerRef.current = port.readable.getReader();
        writerRef.current = port.writable.getWriter();
        
        // Store references globally for useTemperatureData hook
        (window as any).__serialPort = port;
        (window as any).__serialReader = readerRef.current;
        (window as any).__serialWriter = writerRef.current;
      }

      onConnect();
      addOperationLog('read', 'success', `${language === 'zh' ? '成功连接到串口，波特率' : 'Successfully connected to serial port, baud rate'} ${config.baudRate}`);
      
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(language === 'zh' ? '串口连接成功' : 'Serial Connection Successful', {
          body: `${language === 'zh' ? '已连接到串口，波特率' : 'Connected to serial port, baud rate'} ${config.baudRate}`,
          icon: '/favicon.ico'
        });
      }
      
    } catch (error) {
      console.error('Serial connection failed:', error);
      addOperationLog('read', 'error', `${language === 'zh' ? '连接失败' : 'Connection failed'}: ${(error as Error).message}`);
      
      await cleanupConnection();
      
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(language === 'zh' ? '串口连接失败' : 'Serial Connection Failed', {
          body: (error as Error).message,
          icon: '/favicon.ico'
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

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

      if (websocket) {
        websocket.close();
        setWebsocket(null);
      }
      
      // Clear global references
      (window as any).__serialPort = null;
      (window as any).__serialReader = null;
      (window as any).__serialWriter = null;
    } catch (error) {
      console.error('Error during connection cleanup:', error);
    }
  };

  const handleDisconnect = async () => {
    await cleanupConnection();
    onDisconnect();
    addOperationLog('read', 'success', language === 'zh' ? '连接已断开' : 'Connection disconnected');
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(language === 'zh' ? '连接已关闭' : 'Connection Closed', {
        body: language === 'zh' ? '已断开连接' : 'Connection has been disconnected',
        icon: '/favicon.ico'
      });
    }
  };

  const handleConnect = () => {
    if (connectionMode === 'webserial') {
      handleWebSerialConnect();
    } else {
      handleWebSocketConnect();
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
    if (isConnecting) return t('connecting');
    if (connectionStatus.isConnected) return t('connected');
    return t('disconnected');
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
          <h2 className="text-xl font-semibold text-white">{t('serialModbusRTUConfig')}</h2>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <select
              value={connectionMode}
              onChange={(e) => setConnectionMode(e.target.value as 'webserial' | 'websocket')}
              disabled={connectionStatus.isConnected || isConnecting}
              className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="webserial">Web Serial API</option>
              <option value="websocket">WebSocket Bridge</option>
            </select>
          </div>

          {connectionMode === 'websocket' && (
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <input
                type="number"
                value={websocketPort}
                onChange={(e) => setWebsocketPort(parseInt(e.target.value) || 8080)}
                min={1024}
                max={65535}
                disabled={connectionStatus.isConnected || isConnecting}
                className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Port"
              />
            </div>
          )}
          
          <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${getConnectionStatusColor()}`}>
            {getConnectionStatusIcon()}
            <div className="flex flex-col">
              <span className="font-medium text-sm">{getConnectionStatusText()}</span>
              {connectionStatus.isConnected && connectionStatus.lastSuccessfulRead && (
                <span className="text-xs opacity-75">
                  {t('lastRead')}: {new Date(connectionStatus.lastSuccessfulRead).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={connectionStatus.isConnected ? handleDisconnect : handleConnect}
            disabled={isConnecting || (connectionMode === 'webserial' && !isWebSerialSupported)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              connectionStatus.isConnected
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isConnecting ? (
              <>
                <AlertCircle className="w-4 h-4 animate-spin" />
                {t('connecting')}
              </>
            ) : connectionStatus.isConnected ? (
              <>
                <WifiOff className="w-4 h-4" />
                {t('disconnect')}
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                {connectionMode === 'webserial' ? t('connectSerial') : 'Connect WebSocket'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Connection mode info */}
      <div className="mb-6 p-3 bg-gray-700 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          {connectionMode === 'webserial' ? (
            <Settings className="w-4 h-4 text-blue-400" />
          ) : (
            <Globe className="w-4 h-4 text-green-400" />
          )}
          <span className="text-white font-medium">
            {connectionMode === 'webserial' 
              ? (language === 'zh' ? 'Web Serial API 模式' : 'Web Serial API Mode')
              : (language === 'zh' ? 'WebSocket 桥接模式' : 'WebSocket Bridge Mode')
            }
          </span>
        </div>
        <div className="text-sm text-gray-300">
          {connectionMode === 'webserial' ? (
            language === 'zh' 
              ? '直接通过浏览器连接串口设备（需要Chrome 89+或Edge 89+）'
              : 'Connect directly to serial device via browser (requires Chrome 89+ or Edge 89+)'
          ) : (
            language === 'zh' 
              ? `通过WebSocket连接到本地后端程序 (ws://localhost:${websocketPort})，适用于不支持Web Serial API的浏览器`
              : `Connect via WebSocket to local backend program (ws://localhost:${websocketPort}), suitable for browsers without Web Serial API support`
          )}
        </div>
      </div>

      {/* Modbus RTU status display */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">{t('successfulTransactions')}</span>
          </div>
          <div className="text-lg font-bold text-blue-400">
            {modbusStats.successCount}
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-gray-300">{t('errorCount')}</span>
          </div>
          <div className="text-lg font-bold text-yellow-400">
            {modbusStats.errorCount}
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-gray-300">{t('slaveID')}</span>
          </div>
          <div className="text-lg font-bold text-purple-400">
            {modbusStats.slaveId}
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-gray-300">{t('lastTransaction')}</span>
          </div>
          <div className="text-sm font-bold text-green-400">
            {modbusStats.lastTransaction > 0 
              ? new Date(modbusStats.lastTransaction).toLocaleTimeString()
              : t('none')
            }
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Serial configuration */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">{t('serialParameters')}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('baudRate')}
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
                {t('parity')}
              </label>
              <select
                value={config.parity}
                onChange={(e) => handleInputChange('parity', e.target.value as 'none' | 'even' | 'odd')}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={connectionStatus.isConnected || isConnecting}
              >
                <option value="none">{language === 'zh' ? '无' : 'None'}</option>
                <option value="even">{language === 'zh' ? '偶校验' : 'Even'}</option>
                <option value="odd">{language === 'zh' ? '奇校验' : 'Odd'}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('dataBits')}
              </label>
              <select
                value={config.dataBits}
                onChange={(e) => handleInputChange('dataBits', parseInt(e.target.value) as 7 | 8)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={connectionStatus.isConnected || isConnecting}
              >
                <option value={7}>7 {language === 'zh' ? '位' : 'bits'}</option>
                <option value={8}>8 {language === 'zh' ? '位' : 'bits'}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('stopBits')}
              </label>
              <select
                value={config.stopBits}
                onChange={(e) => handleInputChange('stopBits', parseInt(e.target.value) as 1 | 2)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={connectionStatus.isConnected || isConnecting}
              >
                <option value={1}>1 {language === 'zh' ? '位' : 'bit'}</option>
                <option value={2}>2 {language === 'zh' ? '位' : 'bits'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modbus configuration */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">{t('modbusRTUParameters')}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('slaveID')}
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
                {t('functionCode')}
              </label>
              <select
                value={modbusStats.selectedFunctionCode}
                onChange={(e) => setModbusStats(prev => ({
                  ...prev,
                  selectedFunctionCode: parseInt(e.target.value)
                }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                disabled={connectionStatus.isConnected}
              >
                {FUNCTION_CODES.map(fc => (
                  <option key={fc.code} value={fc.code}>
                    0x{fc.code.toString(16).toUpperCase().padStart(2, '0')} - {fc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('timeout')} (ms)
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
                {t('retryCount')}
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
          </div>

          {/* Offset address handling option */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">{t('autoHandleOffsetAddress')}</span>
              <button
                onClick={() => setModbusStats(prev => ({
                  ...prev,
                  autoHandleOffsetAddress: !prev.autoHandleOffsetAddress
                }))}
                disabled={connectionStatus.isConnected}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                  modbusStats.autoHandleOffsetAddress ? 'bg-orange-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    modbusStats.autoHandleOffsetAddress ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('offsetAddress')}
              </label>
              <input
                type="number"
                value={config.offsetAddress}
                onChange={(e) => handleInputChange('offsetAddress', parseInt(e.target.value) || 40001)}
                min={0}
                max={65535}
                className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 ${
                  sessionActive ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={connectionStatus.isConnected || sessionActive}
              />
            </div>
            
            <div className="text-xs text-gray-400">
              {language === 'zh' 
                ? `启用时，地址≥${config.offsetAddress}将自动减去${config.offsetAddress}偏移` 
                : `When enabled, addresses ≥${config.offsetAddress} will automatically subtract ${config.offsetAddress} offset`
              }
            </div>
          </div>
        </div>
      </div>

      {/* Register configuration */}
      <div className="mt-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">{t('registerConfiguration')}</h3>
            {sessionActive && (
              <div className="px-2 py-1 bg-yellow-900 text-yellow-300 rounded text-xs">
                {language === 'zh' ? '已锁定' : 'Locked'}
              </div>
            )}
          </div>
          
          <button
            onClick={handleUseCustomRegistersToggle}
            disabled={connectionStatus.isConnected || isConnecting || sessionActive}
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
              {useCustomRegisters ? t('customRegisterMode') : t('consecutiveRegisterMode')}
            </span>
          </div>

          {useCustomRegisters ? (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('customRegisterAddresses')} ({language === 'zh' ? '用分号分隔，最多16个' : 'separated by semicolons, max 16'})
              </label>
              <input
                type="text"
                value={customRegisters}
                onChange={(e) => handleCustomRegistersChange(e.target.value)}
                placeholder={language === 'zh' ? '例如: 40001;40003;40005;40010;40015' : 'e.g.: 40001;40003;40005;40010;40015'}
                className={`w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  sessionActive ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={connectionStatus.isConnected || isConnecting || sessionActive}
              />
              
              {parsedRegisters.length > 0 && (
                <div className="mt-2 p-2 bg-gray-600 rounded">
                  <div className="text-xs text-gray-300 mb-1">
                    {language === 'zh' ? '已解析的寄存器地址:' : 'Parsed register addresses:'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {parsedRegisters.slice(0, 16).map((reg, index) => (
                      <span key={index} className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                        Ch{index + 1}: {reg}
                      </span>
                    ))}
                  </div>
                  {parsedRegisters.length > 16 && (
                    <div className="text-xs text-yellow-400 mt-1">
                      {language === 'zh' ? '注意: 只显示前16个寄存器地址' : 'Note: Only showing first 16 register addresses'}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('startRegister')}
                </label>
                <input
                  type="number"
                  value={config.startRegister}
                  onChange={(e) => handleInputChange('startRegister', parseInt(e.target.value))}
                  className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    sessionActive ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  min={0}
                  max={65535}
                  disabled={connectionStatus.isConnected || isConnecting || sessionActive}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('registerCount')}
                </label>
                <input
                  type="number"
                  value={config.registerCount}
                  onChange={(e) => handleInputChange('registerCount', parseInt(e.target.value))}
                  className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    sessionActive ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  min={1}
                  max={16}
                  disabled={connectionStatus.isConnected || isConnecting || sessionActive}
                />
              </div>
              
              <div className="md:col-span-2">
                <div className="text-sm text-gray-400">
                  {language === 'zh' 
                    ? `使用连续寄存器模式: 从寄存器 ${config.startRegister} 开始读取 ${config.registerCount} 个连续寄存器 (${config.startRegister} - ${config.startRegister + config.registerCount - 1})`
                    : `Using consecutive register mode: reading ${config.registerCount} consecutive registers from ${config.startRegister} (${config.startRegister} - ${config.startRegister + config.registerCount - 1})`
                  }
                  {modbusStats.autoHandleOffsetAddress && config.startRegister >= config.offsetAddress && (
                    <span className="text-orange-400">
                      {language === 'zh' 
                        ? ` → 实际地址: ${config.startRegister - config.offsetAddress} - ${config.startRegister - config.offsetAddress + config.registerCount - 1}`
                        : ` → actual addresses: ${config.startRegister - config.offsetAddress} - ${config.startRegister - config.offsetAddress + config.registerCount - 1}`
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Operation log */}
      <div className="mt-6">
        <h4 className="text-lg font-semibold text-white mb-4">{t('operationLog')}</h4>
        
        <div className="bg-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto">
          {operationLog.length === 0 ? (
            <div className="text-gray-400 text-center py-4">
              {t('noOperationRecords')}
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
                        {log.type === 'read' ? t('read') : t('write')}
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

      {/* Connection mode instructions */}
      {connectionMode === 'webserial' && !isWebSerialSupported && (
        <div className="mt-4 p-3 bg-red-900 border border-red-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-300 font-medium">{t('webSerialNotSupported')}</span>
          </div>
          <div className="text-red-300 text-sm space-y-1">
            <p>{language === 'zh' ? '您的浏览器不支持Web Serial API。请使用以下浏览器:' : 'Your browser does not support Web Serial API. Please use:'}</p>
            <p>• Chrome 89+ {language === 'zh' ? '或' : 'or'} Edge 89+</p>
            <p>• {language === 'zh' ? '确保在HTTPS环境下运行' : 'Ensure running in HTTPS environment'}</p>
            <p>• {language === 'zh' ? '或切换到WebSocket桥接模式' : 'Or switch to WebSocket Bridge mode'}</p>
          </div>
        </div>
      )}

      {connectionMode === 'websocket' && (
        <div className="mt-4 p-3 bg-blue-900 border border-blue-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-blue-400" />
            <span className="text-blue-300 font-medium">
              {language === 'zh' ? 'WebSocket桥接模式说明' : 'WebSocket Bridge Mode Instructions'}
            </span>
          </div>
          <div className="text-blue-300 text-sm space-y-1">
            <p>{language === 'zh' ? '1. 确保您已运行串口转WebSocket的后端程序' : '1. Ensure you have the serial-to-WebSocket backend program running'}</p>
            <p>{language === 'zh' ? '2. 后端程序应监听指定端口并转发Modbus数据' : '2. Backend program should listen on specified port and forward Modbus data'}</p>
            <p>{language === 'zh' ? '3. 点击连接将尝试连接到' : '3. Click connect to attempt connection to'} ws://localhost:{websocketPort}</p>
            <p>{language === 'zh' ? '4. 适用于不支持Web Serial API的浏览器' : '4. Suitable for browsers without Web Serial API support'}</p>
          </div>
        </div>
      )}

      {/* General connection instructions */}
      {!connectionStatus.isConnected && !isConnecting && (
        <div className="mt-4 p-3 bg-gray-700 border border-gray-600 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-gray-400" />
            <span className="text-gray-300 font-medium">
              {language === 'zh' ? '连接说明' : 'Connection Instructions'}
            </span>
          </div>
          <div className="text-gray-300 text-sm space-y-1">
            <p>{language === 'zh' ? '1. 确保您的Modbus RTU设备已连接' : '1. Ensure your Modbus RTU device is connected'}</p>
            <p>{language === 'zh' ? '2. 选择合适的连接模式（Web Serial或WebSocket）' : '2. Select appropriate connection mode (Web Serial or WebSocket)'}</p>
            <p>{language === 'zh' ? '3. 配置正确的串口参数和Modbus设置' : '3. Configure correct serial parameters and Modbus settings'}</p>
            <p>{language === 'zh' ? '4. 点击连接按钮建立通信' : '4. Click connect button to establish communication'}</p>
          </div>
        </div>
      )}
    </div>
  );
}