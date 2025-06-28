export interface SerialConfig {
  port: string;
  baudRate: number;
  parity: 'none' | 'even' | 'odd';
  stopBits: 1 | 2;
  dataBits: 7 | 8;
  startRegister: number;
  customRegisters?: number[]; // 新增：自定义寄存器地址数组
}

export interface TemperatureReading {
  timestamp: number;
  channel: number;
  temperature: number;
  rawValue: number;
}

export interface RecordingConfig {
  interval: number; // in seconds
  selectedChannels: boolean[];
  isRecording: boolean;
}

export interface DisplayConfig {
  mode: 'full' | 'sliding';
  viewMode: 'combined' | 'individual'; // 新增：综合视图或分析视图
  timeWindow: number; // in minutes for sliding mode
  showGrid: boolean;
  showLegend: boolean;
  relativeTime: boolean; // 新增：是否显示相对时间
}

export interface ConnectionStatus {
  isConnected: boolean;
  lastError?: string;
  lastSuccessfulRead?: number;
}

export interface ChannelConfig {
  id: number;
  name: string;
  color: string;
  enabled: boolean;
  minRange: number;
  maxRange: number;
}

export interface TestModeConfig {
  enabled: boolean;
  dataGenerationRate: number; // readings per second
  temperatureRange: {
    min: number;
    max: number;
  };
  noiseLevel: number; // 0-1 scale
}

export interface DataStorageConfig {
  autoSaveEnabled: boolean;
  autoSaveInterval: number; // in minutes
  lastAutoSave?: number;
  totalSavedReadings: number;
}

export interface ChannelStatistics {
  maxTemp: number;
  minTemp: number;
  avgTemp: number;
  currentTemp: number | null;
  readingCount: number;
}

// 新增：温度转换配置
export interface TemperatureConversionConfig {
  mode: 'builtin' | 'custom';
  customFormula: string;
  testValue: number;
}

// 新增：拖拽布局配置
export interface LayoutConfig {
  modules: ModuleLayout[];
  gridCols: number;
  autoSave: boolean;
}

export interface ModuleLayout {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  isDraggable?: boolean;
  isResizable?: boolean;
}

// 新增：Modbus RTU配置
export interface ModbusRTUConfig {
  enabled: boolean;
  slaveId: number;
  functionCodes: ModbusFunctionCode[];
  timeout: number; // ms
  retries: number;
  responseDelay: number; // ms
}

export interface ModbusFunctionCode {
  code: number;
  name: string;
  description: string;
  enabled: boolean;
}

// 新增：Modbus TCP配置
export interface ModbusTCPConfig {
  enabled: boolean;
  mode: 'client' | 'server';
  host: string;
  port: number;
  maxConnections: number;
  connectionTimeout: number; // ms
  keepAlive: boolean;
  unitId: number;
}

// 新增：Modbus通信状态
export interface ModbusStatus {
  rtu: {
    connected: boolean;
    lastTransaction: number;
    errorCount: number;
    successCount: number;
  };
  tcp: {
    connected: boolean;
    activeConnections: number;
    lastTransaction: number;
    errorCount: number;
    successCount: number;
  };
}

// 新增：Modbus数据操作
export interface ModbusOperation {
  id: string;
  type: 'read' | 'write';
  functionCode: number;
  startAddress: number;
  quantity: number;
  data?: number[];
  timestamp: number;
  status: 'pending' | 'success' | 'error';
  error?: string;
  response?: number[];
}